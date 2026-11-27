import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Student from "@/models/Student";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import Course from "@/models/Course";
import { normalizeCourseCode, resolveCourseFeeConfigFromDocument } from "@/lib/student-import/course-fee-rules";
import { buildInstallments } from "@/lib/student-import/fee-allocation";
import { normalizeStudentName, normalizeIndianPhones } from "@/lib/student-import/identity-resolution.mjs";
import { normalizeStudentCode, normalizeReceiptNumber, parseImportAmount, makeReceiptBusinessKey } from "@/lib/student-import/normalization.mjs";
import { ensureEnrollmentIndexes } from "@/lib/student-import/import-payment-sheet";

export const runtime = "nodejs";
export const maxDuration = 300;

let receiptIndexPromise;
async function ensureReceiptIndex() {
  if (!receiptIndexPromise) {
    receiptIndexPromise = (async () => {
      const indexes = await StudentFeePayment.collection.indexes().catch(error => {
        if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
        throw error;
      });
      // Old unique indexes that include amountPaid allow a corrected amount to create a second receipt.
      // Replace only index definitions; never delete, archive, or rewrite payment documents.
      const obsolete = indexes.filter(index => index.unique
        && index.name !== "student_fee_source_row_unique"
        && index.key?.mrNo === 1
        && index.key?.paymentDate === 1
        && !index.key?.studentId
        && !index.key?.enrollmentId
        && !index.key?.masterStudentId
        && !index.key?.stCode
        && !index.key?.normalizedStCode
        && !index.key?.registrationId);
      for (const index of obsolete) await StudentFeePayment.collection.dropIndex(index.name);

      const legacyCodeDocs = await StudentFeePayment.find({
        mrNo: { $exists: true, $nin: [null, ""] },
        $or: [{ stCode: { $exists: true, $nin: [null, ""] } }, { normalizedStCode: { $exists: true, $nin: [null, ""] } }]
      }).select("_id stCode normalizedStCode mrNo normalizedMrNo").lean();
      const codeRepairs = legacyCodeDocs.flatMap(item => {
        const normalizedCode = normalizeStudentCode(item.stCode || item.normalizedStCode);
        const normalizedReceipt = normalizeReceiptNumber(item.mrNo || item.normalizedMrNo);
        const set = {};
        if (normalizedCode && normalizedCode !== item.normalizedStCode) set.normalizedStCode = normalizedCode;
        if (normalizedReceipt && normalizedReceipt !== item.normalizedMrNo) set.normalizedMrNo = normalizedReceipt;
        return Object.keys(set).length ? [{ updateOne: { filter: { _id: item._id }, update: { $set: set } } }] : [];
      });
      for (let offset = 0; offset < codeRepairs.length; offset += 500) {
        await StudentFeePayment.bulkWrite(codeRepairs.slice(offset, offset + 500), { ordered: false });
      }
      if (codeRepairs.length) console.log("[unified-import]", "normalize-existing-receipt-keys", 1, 0, { updated: codeRepairs.length });

      let currentIndexes = await StudentFeePayment.collection.indexes().catch(() => []);
      const expectedReceiptIndex = { normalizedStCode: 1, normalizedMrNo: 1, paymentDate: 1 };
      const existingReceiptIndex = currentIndexes.find(index => index.name === "normalized_stcode_receipt_date_unique");
      if (existingReceiptIndex && JSON.stringify(existingReceiptIndex.key) !== JSON.stringify(expectedReceiptIndex)) {
        await StudentFeePayment.collection.dropIndex("normalized_stcode_receipt_date_unique");
        currentIndexes = await StudentFeePayment.collection.indexes().catch(() => []);
      }
      if (!currentIndexes.some(index => index.name === "student_fee_source_row_unique")) {
        const duplicateSourceKeys = await StudentFeePayment.collection.aggregate([
          { $match: { sourceRowKey: { $type: "string", $gt: "" } } },
          { $group: { _id: "$sourceRowKey", count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } }, { $limit: 1 }
        ]).toArray();
        if (!duplicateSourceKeys.length) {
          await StudentFeePayment.collection.createIndex(
            { sourceRowKey: 1 },
            {
              unique: true,
              name: "student_fee_source_row_unique",
              partialFilterExpression: { sourceRowKey: { $type: "string", $gt: "" } }
            }
          );
        } else {
          console.warn("[unified-import] duplicate sourceRowKey documents exist; in-memory deduplication remains active and no unique index was added.");
        }
      }
      if (!currentIndexes.some(index => index.name === "normalized_stcode_receipt_date_unique")) {
        const duplicateKeys = await StudentFeePayment.collection.aggregate([
          { $match: {
            importBatchKey: "UNIFIED_WORKBOOK_IMPORT",
            normalizedStCode: { $type: "string", $gt: "" },
            normalizedMrNo: { $type: "string", $gt: "" },
            paymentDate: { $type: "date" }
          } },
          { $group: {
            _id: { normalizedStCode: "$normalizedStCode", normalizedMrNo: "$normalizedMrNo", paymentDate: "$paymentDate" },
            count: { $sum: 1 }
          } },
          { $match: { count: { $gt: 1 } } },
          { $limit: 1 }
        ]).toArray();
        if (!duplicateKeys.length) {
          await StudentFeePayment.collection.createIndex(
            { normalizedStCode: 1, normalizedMrNo: 1, paymentDate: 1 },
            {
              unique: true,
              name: "normalized_stcode_receipt_date_unique",
              partialFilterExpression: {
                importBatchKey: "UNIFIED_WORKBOOK_IMPORT",
                normalizedStCode: { $type: "string", $gt: "" },
                normalizedMrNo: { $type: "string", $gt: "" },
                paymentDate: { $type: "date" }
              }
            }
          );
        } else {
          console.warn("[unified-import] duplicate normalized Student Code / receipt / date records already exist; all records are preserved and receipt totals will be deduplicated during reconciliation");
        }
      }
    })().catch(error => {
      receiptIndexPromise = null;
      throw error;
    });
  }
  return receiptIndexPromise;
}

const clean = value => String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ").trim();
const codeLookupVariants = value => {
  const code = normalizeStudentCode(value);
  if (!code) return [];
  const variants = new Set([code, String(value ?? "").trim()]);
  if (/^\d+$/.test(code)) {
    for (let zeroes = 1; zeroes <= 8; zeroes += 1) variants.add("0".repeat(zeroes) + code);
    const spacedDigits = code.split("").join("\\s*");
    variants.add(new RegExp("^\\s*0*" + spacedDigits + "(?:\\.0+)?\\s*$", "i"));
  }
  return [...variants].filter(Boolean);
};
const displayName = value => clean(value).normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
const normalizeName = value => clean(value).normalize("NFKC").toUpperCase()
  .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const normalizeFather = value => normalizeName(value);
const validObjectId = value => mongoose.Types.ObjectId.isValid(String(value || ""));
const asDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const registrationIdentity = item => clean(item.registrationId)
  || (clean(item.stCode) ? normalizeName(item.cleanName) + "_" + normalizeStudentCode(item.stCode) : "");

function registrationSort(a, b) {
  const da = asDate(a.dateOfAdmission)?.getTime() ?? asDate(a.earliestPaymentDate)?.getTime() ?? 0;
  const db = asDate(b.dateOfAdmission)?.getTime() ?? asDate(b.earliestPaymentDate)?.getTime() ?? 0;
  return db - da || String(b.stCode).localeCompare(String(a.stCode));
}

const enrollmentUniqueKey = item => [
  String(item.studentId || ""), normalizeStudentCode(item.normalizedStCode || item.stCode),
  normalizeCourseCode(item.courseCode), asDate(item.admissionDate)?.toISOString().slice(0, 10) || ""
].join("|");

async function bulkWriteChunked(model, operations, warnings, label, chunkSize = 500) {
  for (let offset = 0; offset < operations.length; offset += chunkSize) {
    const chunk = operations.slice(offset, offset + chunkSize);
    try {
      await model.bulkWrite(chunk, { ordered: false });
    } catch (error) {
      const writeErrors = error.writeErrors || error.result?.writeErrors || error.result?.getWriteErrors?.() || [];
      const duplicateOnly = error.code === 11000 || (writeErrors.length > 0 && writeErrors.every(item => item.code === 11000));
      if (!duplicateOnly) throw error;
      const indexes = [...new Set(writeErrors.map(item => Number(item.index)).filter(Number.isInteger))];
      for (const index of (indexes.length ? indexes : chunk.map((_, i) => i))) {
        const operation = chunk[index];
        if (!operation) continue;
        try {
          if (model.modelName === "StudentEnrollment") {
            const filter = operation.updateOne?.filter || {};
            const update = operation.updateOne?.update || {};
            const set = { ...(update.$setOnInsert || {}), ...(update.$set || {}) };
            delete set._id;
            const repaired = await model.updateOne(filter, { $set: set }, { upsert: false });
            if (!repaired.matchedCount && !repaired.n) {
              warnings.push({ phase: label, index: offset + index, code: 11000, reason: "Duplicate enrollment key was reported, but no existing document matched the exact four-field key." });
            }
          } else {
            await model.bulkWrite([operation], { ordered: false });
          }
        } catch (retryError) {
          warnings.push({
            phase: label, index: offset + index,
            code: retryError.code || retryError.writeErrors?.[0]?.code || null,
            reason: retryError.message || "Duplicate-key write could not be reconciled."
          });
        }
      }
    }
  }
}

async function syncStudentGroups(groups = [], onPhase = () => {}) {
  await ensureEnrollmentIndexes();
  if (!Array.isArray(groups) || groups.length > 500) throw new Error("Student batch must contain between 1 and 500 Student Code profiles.");
  const allRegistrations = groups.flatMap(group => (group.registrations || []).map(item => ({
    ...item,
    stCode: normalizeStudentCode(item.stCode),
    registrationId: registrationIdentity({ ...item, stCode: normalizeStudentCode(item.stCode) }),
    cleanName: normalizeName(item.cleanName || group.cleanName),
    course: clean(item.course) || "Previous Course (Legacy)",
    dateOfAdmission: asDate(item.dateOfAdmission)
  }))).filter(item => item.stCode && item.cleanName);
  const codes = [...new Set(allRegistrations.map(item => item.stCode))];
  const codeVariants = [...new Set(codes.flatMap(codeLookupVariants))];
  const registrationIds = [...new Set(allRegistrations.map(item => item.registrationId))];
  const courseCodes = [...new Set(allRegistrations.map(item => normalizeCourseCode(item.course)).filter(Boolean))];
  const courseLookupCodes = [...new Set(courseCodes.flatMap(code => [code, code.replace(/[-_].*$/, "")]))];

  const [existingStudents, existingEnrollments, courseDocuments] = await Promise.all([
    Student.find({ $or: [
      { normalizedStCode: { $in: codes } },
      { regnNo: { $in: codeVariants } },
      { enrollmentNo: { $in: codeVariants } }
    ] }).lean(),
    StudentEnrollment.find({ mergedIntoEnrollmentId: null, $or: [
      { normalizedStCode: { $in: codes } },
      { stCode: { $in: codeVariants } },
      { registrationId: { $in: registrationIds } }
    ] }).lean(),
    Course.find({ code: { $in: courseLookupCodes } }).lean()
  ]);
  const existingStudentIds = existingStudents.map(item => item._id);
  const existingMasters = await StudentMaster.find({
    mergedIntoMasterId: null,
    isMerged: { $ne: true },
    $or: [
      { normalizedStCodes: { $in: codes } },
      { studentCodes: { $in: codeVariants } },
      { stCodes: { $in: codeVariants } },
      { primaryStCode: { $in: codeVariants } },
      { currentStCode: { $in: codeVariants } },
      { "registrations.stCode": { $in: codeVariants } },
      { "enrollments.stCode": { $in: codeVariants } },
      ...(existingStudentIds.length ? [{ legacyStudentIds: { $in: existingStudentIds } }] : [])
    ]
  }).lean();

  const studentByCode = new Map();
  for (const student of existingStudents) {
    const code = normalizeStudentCode(student.normalizedStCode || student.regnNo || student.enrollmentNo);
    if (code) studentByCode.set(code, [...(studentByCode.get(code) || []), student]);
  }
  const masterByCode = new Map();
  const masterByStudentId = new Map();
  for (const master of existingMasters) {
    const masterCodes = new Set([
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode),
      ...(master.enrollments || []).map(item => item.stCode),
      ...(master.legacyStudentIds || []).map(id => {
        const linked = legacyStudentById.get(String(id));
        return linked?.normalizedStCode || linked?.regnNo || linked?.enrollmentNo;
      })
    ].map(normalizeStudentCode).filter(Boolean));
    for (const code of masterCodes) masterByCode.set(code, [...(masterByCode.get(code) || []), master]);
    for (const id of master.legacyStudentIds || []) masterByStudentId.set(String(id), master);
  }
  const enrollmentByUniqueKey = new Map();
  for (const enrollment of existingEnrollments) enrollmentByUniqueKey.set(enrollmentUniqueKey(enrollment), enrollment);
  const courseByCode = new Map(courseDocuments.map(item => [normalizeCourseCode(item.code), item]));

  const studentInserts = [];
  const studentUpdates = [];
  const masterOps = [];
  const activeMasterOps = [];
  const enrollmentInserts = [];
  const enrollmentUpdates = [];
  const enrollmentStatusOps = [];
  const outputMap = [];
  const flaggedRows = [];
  const feeRuleCache = new Map();
  let matchedProfiles = 0, newProfiles = 0, registrationsLinked = 0, registrationsSeen = 0;

  for (const group of groups) {
    const registrations = (group.registrations || []).map(item => ({
      ...item,
      stCode: normalizeStudentCode(item.stCode),
      registrationId: registrationIdentity({ ...item, stCode: normalizeStudentCode(item.stCode) }),
      cleanName: normalizeName(item.cleanName || group.cleanName),
      course: clean(item.course) || "Previous Course (Legacy)",
      dateOfAdmission: asDate(item.dateOfAdmission),
      earliestPaymentDate: asDate(item.earliestPaymentDate),
      formNo: clean(item.formNo)
    })).filter(item => item.stCode && item.cleanName);
    if (!registrations.length) continue;
    registrations.sort(registrationSort);
    const newest = registrations[0];
    const code = normalizeStudentCode(group.studentCodes?.[0] || registrations[0].stCode);
    if (!code) {
      flaggedRows.push({ row: newest.rowNo || "", reason: "Student profile has no normalized Student Code." });
      continue;
    }
    const codeAmbiguous = registrations.some(item => item.stCodeUnique === false);
    const incomingName = normalizeName(group.cleanName || newest.cleanName);
    if (codeAmbiguous) {
      flaggedRows.push({
        row: newest.rowNo || "", stCode: code, name: incomingName,
        reason: "This Student Code is associated with multiple names in the workbook; no student or enrollment record was created or overwritten."
      });
      continue;
    }

    const legacyCandidates = studentByCode.get(code) || [];
    let canonicalStudent = null;
    if (legacyCandidates.length === 1) canonicalStudent = legacyCandidates[0];
    else if (legacyCandidates.length > 1) {
      const existingNames = new Set(legacyCandidates.map(item => normalizeName(item.applicantName || item.name || item.sourceStudentName)).filter(Boolean));
      if (existingNames.size === 1) {
        canonicalStudent = [...legacyCandidates].sort((left, right) =>
          new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
        )[0];
      } else {
        flaggedRows.push({
          row: newest.rowNo || "", stCode: code, name: incomingName,
          reason: "Multiple existing legacy Student records with this Student Code have different names; the code collision requires review."
        });
        continue;
      }
    }

    const codeMasters = masterByCode.get(code) || [];
    if (codeMasters.length > 1) {
      flaggedRows.push({
        row: newest.rowNo || "", stCode: code, name: incomingName,
        reason: "Multiple active Master Student profiles already claim this Student Code; no profile was guessed or overwritten."
      });
      continue;
    }
    const linkedMaster = canonicalStudent ? masterByStudentId.get(String(canonicalStudent._id)) : null;
    const linkedMasterCodes = new Set([
      ...(linkedMaster?.normalizedStCodes || []), ...(linkedMaster?.studentCodes || []), ...(linkedMaster?.stCodes || []),
      linkedMaster?.primaryStCode, linkedMaster?.currentStCode,
      ...(linkedMaster?.registrations || []).map(item => item.stCode),
      ...(linkedMaster?.enrollments || []).map(item => item.stCode)
    ].map(normalizeStudentCode).filter(Boolean));
    if (linkedMaster && linkedMasterCodes.size && !linkedMasterCodes.has(code)) {
      flaggedRows.push({
        row: newest.rowNo || "", stCode: code,
        reason: "The existing legacy Student points to a Master profile that does not list this Student Code; the existing link was preserved for review."
      });
      continue;
    }
    if (linkedMaster && codeMasters.length === 1 && String(linkedMaster._id) !== String(codeMasters[0]._id)) {
      flaggedRows.push({
        row: newest.rowNo || "", stCode: code,
        reason: "The legacy Student link and the active Student Code owner point to different Master profiles; the record was not overwritten."
      });
      continue;
    }
    const master = linkedMaster || codeMasters[0] || null;
    const masterExistingCodes = new Set([
      ...(master?.normalizedStCodes || []), ...(master?.studentCodes || []), ...(master?.stCodes || []),
      master?.primaryStCode, master?.currentStCode,
      ...(master?.registrations || []).map(item => item.stCode),
      ...(master?.enrollments || []).map(item => item.stCode)
    ].map(normalizeStudentCode).filter(Boolean));
    const masterHasOtherCodes = [...masterExistingCodes].some(existingCode => existingCode !== code);

    const masterId = master?._id || new mongoose.Types.ObjectId();
    if (master) matchedProfiles += 1;
    else newProfiles += 1;

    const studentId = canonicalStudent?._id || new mongoose.Types.ObjectId();
    const studentValues = {
      normalizedStCode: code,
      regnNo: code,
      enrollmentNo: canonicalStudent ? (canonicalStudent.enrollmentNo || "") : code,
      formNo: newest.formNo || "",
      admissionDate: newest.dateOfAdmission?.toISOString() || "",
      dateOfAdmission: newest.dateOfAdmission?.toISOString() || "",
      applicantName: displayName(group.cleanName || newest.cleanName),
      name: displayName(group.cleanName || newest.cleanName),
      sourceStudentName: displayName(group.cleanName || newest.cleanName) + "_" + code,
      sourceSex: newest.sex || "",
      sex: newest.sex || "",
      gender: newest.sex || "",
      fatherOrHusbandName: group.fatherName || newest.fatherName || "",
      fatherName: group.fatherName || newest.fatherName || "",
      address: newest.address || "",
      presentAddress: newest.address || "",
      mobileNumber: (group.phones || [])[0] || "",
      whatsappNumber: (group.phones || [])[1] || "",
      sourcePhone: (group.phones || []).join(","),
      qualification: newest.qualification || "",
      sourceQualification: newest.qualification || "",
      courseCode: newest.course || "",
      courseName: newest.course || "",
      course: newest.course || "",
      importSource: "Unified Excel Workbook"
    };
    if (!canonicalStudent) {
      studentInserts.push({ _id: studentId, ...studentValues, status: "Registered" });
    } else {
      const patch = {};
      for (const [key, value] of Object.entries(studentValues)) {
        if (value === "" || value === null || value === undefined) continue;
        if (String(canonicalStudent[key] ?? "") !== String(value)) patch[key] = value;
      }
      if (Object.keys(patch).length) studentUpdates.push({ updateOne: { filter: { _id: canonicalStudent._id }, update: { $set: patch } } });
    }

    const existingHistory = new Map();
    const historyKey = item => [
      normalizeStudentCode(item.stCode),
      normalizeCourseCode(item.course || item.courseName || item.courseCode || "PREVIOUS-LEGACY"),
      asDate(item.dateOfAdmission || item.admissionDate)?.toISOString().slice(0, 10) || ""
    ].join("|");
    for (const item of [...(master?.registrations || []), ...(master?.enrollments || [])]) {
      const key = historyKey(item);
      if (!existingHistory.has(key)) existingHistory.set(key, {
        stCode: code, registrationId: clean(item.registrationId) || code + "_" + normalizeCourseCode(item.course || item.courseCode),
        course: clean(item.course || item.courseCode) || "Previous Course (Legacy)",
        dateOfAdmission: asDate(item.dateOfAdmission || item.admissionDate),
        admissionDate: asDate(item.admissionDate || item.dateOfAdmission),
        earliestPaymentDate: asDate(item.earliestPaymentDate),
        formNo: clean(item.formNo), qualification: clean(item.qualification),
        rawAddress: clean(item.rawAddress || item.address), rawStName: clean(item.rawStName), isCurrent: false
      });
    }
    for (const item of existingEnrollments) {
      if (String(item.studentId) !== String(masterId) || normalizeStudentCode(item.stCode) !== code) continue;
      const key = historyKey({ ...item, course: item.courseName || item.courseCode });
      if (!existingHistory.has(key)) existingHistory.set(key, {
        stCode: code, registrationId: clean(item.registrationId) || code + "_" + normalizeCourseCode(item.courseCode),
        course: clean(item.courseName || item.courseCode) || "Previous Course (Legacy)",
        dateOfAdmission: asDate(item.admissionDate), admissionDate: asDate(item.admissionDate),
        earliestPaymentDate: asDate(item.earliestPaymentDate), formNo: clean(item.formNo),
        qualification: clean(item.qualification), rawAddress: clean(item.rawAddress),
        rawStName: clean(item.rawStName), isCurrent: false
      });
    }
    for (const item of registrations) {
      const key = historyKey(item);
      if (!existingHistory.has(key)) registrationsLinked += 1;
      const prior = existingHistory.get(key) || {};
      existingHistory.set(key, {
        ...prior, stCode: code, registrationId: item.registrationId,
        course: item.course || prior.course,
        dateOfAdmission: item.dateOfAdmission || prior.dateOfAdmission,
        admissionDate: item.dateOfAdmission || prior.admissionDate || prior.dateOfAdmission,
        earliestPaymentDate: item.earliestPaymentDate || prior.earliestPaymentDate,
        formNo: item.formNo || prior.formNo,
        qualification: item.qualification || prior.qualification,
        rawAddress: item.address || prior.rawAddress,
        rawStName: item.rawStName || prior.rawStName || (item.cleanName + "_" + code),
        isCurrent: false
      });
      registrationsSeen += 1;
    }
    const mergedRegistrations = [...existingHistory.values()].sort(registrationSort);
    const current = mergedRegistrations[0] || newest;
    mergedRegistrations.forEach((item, index) => { item.isCurrent = index === 0; });
    const currentIncoming = registrations.find(item => historyKey(item) === historyKey(current)) || current;
    const incomingPhones = normalizeIndianPhones([...(group.phones || []), ...(master?.phoneNumbers || []), ...(master?.phones || [])]);
    const legacyIds = [...new Set([...(master?.legacyStudentIds || []).map(String), String(studentId)])];
    const masterSet = {
      fullName: masterHasOtherCodes ? (master?.fullName || displayName(group.cleanName || newest.cleanName)) : displayName(group.cleanName || newest.cleanName),
      normalizedFullName: masterHasOtherCodes ? (master?.normalizedFullName || incomingName) : incomingName,
      normalizedStCodes: [...new Set([...(master?.normalizedStCodes || []).map(normalizeStudentCode), code])],
      primaryStCode: master?.primaryStCode || code,
      studentCodes: [...new Set([...(master?.studentCodes || []), code])],
      stCodes: [...new Set([...(master?.stCodes || []), code])],
      alternateNames: [...new Set([...(master?.alternateNames || []), master?.fullName || "", group.cleanName || ""].map(normalizeStudentName).filter(Boolean))],
      phones: incomingPhones,
      phoneNumbers: incomingPhones,
      registrations: mergedRegistrations,
      enrollments: mergedRegistrations,
      legacyStudentIds: legacyIds.map(id => new mongoose.Types.ObjectId(id)),
      normalizedFatherName: master?.normalizedFatherName || normalizeFather(group.fatherName || newest.fatherName),
      identityMatchMethod: master ? "STUDENT_CODE" : "STUDENT_CODE_NEW"
    };
    if (!master?.dob && asDate(group.dob)) masterSet.dob = asDate(group.dob);
    if (!master?.fatherName && (group.fatherName || newest.fatherName)) masterSet.fatherName = group.fatherName || newest.fatherName;
    if (!master?.gender && newest.sex) masterSet.gender = newest.sex;
    if (!masterHasOtherCodes || !master?.currentStCode) {
      masterSet.currentStCode = code;
      masterSet.currentRegistrationId = current.registrationId;
      masterSet.currentCourse = current.course;
      masterSet.currentAdmissionDate = current.dateOfAdmission || null;
      masterSet.dateOfAdmission = current.dateOfAdmission || null;
    }
    masterSet.formNo = current.formNo || master?.formNo || "";
    if (!master?.address && currentIncoming.address) masterSet.address = currentIncoming.address;
    if (!master?.qualification && currentIncoming.qualification) masterSet.qualification = currentIncoming.qualification;
    masterOps.push({ _id: masterId, isNew: !master, set: masterSet, insertDefaults: { photoUrl: "", hasPhoto: false } });

    let activeEnrollmentId = null;
    for (const registration of registrations) {
      const courseCode = registration.course === "Previous Course (Legacy)" ? "PREVIOUS-LEGACY" : normalizeCourseCode(registration.course);
      const targetKey = enrollmentUniqueKey({
        studentId: masterId, stCode: code, normalizedStCode: code,
        normalizedFullName: incomingName, courseCode, admissionDate: registration.dateOfAdmission
      });
      const existingEnrollment = enrollmentByUniqueKey.get(targetKey) || null;
      const enrollmentId = existingEnrollment?._id || new mongoose.Types.ObjectId();
      if (!existingEnrollment) enrollmentByUniqueKey.set(targetKey, {
        _id: enrollmentId, studentId: masterId, stCode: code, normalizedStCode: code,
        normalizedFullName: incomingName, courseCode, admissionDate: registration.dateOfAdmission
      });
      if (registration.registrationId === current.registrationId) activeEnrollmentId = enrollmentId;
      const courseRuleKey = normalizeCourseCode(courseCode);
      if (!feeRuleCache.has(courseRuleKey)) {
        const baseCode = courseRuleKey.replace(/[-_].*$/, "");
        feeRuleCache.set(courseRuleKey, resolveCourseFeeConfigFromDocument(
          courseRuleKey, courseByCode.get(courseRuleKey) || courseByCode.get(baseCode) || null
        ));
      }
      const courseRule = feeRuleCache.get(courseRuleKey);
      const enrollmentSet = {
        _id: enrollmentId, studentId: masterId, masterStudentId: masterId,
        legacyStudentId: studentId,
        stCode: code, normalizedStCode: code,
        registrationId: registration.registrationId,
        normalizedFullName: incomingName,
        formNo: registration.formNo || "", qualification: registration.qualification || "",
        rawAddress: registration.address || "", rawStName: registration.rawStName || (registration.cleanName + "_" + code),
        course: registration.course || courseCode, courseCode, courseName: registration.course,
        admissionDate: registration.dateOfAdmission,
        earliestPaymentDate: registration.earliestPaymentDate || null,
        status: registration.registrationId === current.registrationId ? "ACTIVE" : (courseCode === "PREVIOUS-LEGACY" ? "LEGACY" : "PROMOTED"),
        courseCategory: courseRule.courseCategory || "OTHER",
        semesterLabel: courseRule.semesterLabel || registration.course,
        feeConfig: courseRule.feeConfig,
        installments: courseRule.feeConfig?.configured ? buildInstallments({
          courseCode, admissionDate: registration.dateOfAdmission || new Date(),
          feeConfig: courseRule.feeConfig, semesterLabel: courseRule.semesterLabel || registration.course
        }) : []
      };
      if (!existingEnrollment) {
        enrollmentInserts.push(enrollmentSet);
      } else {
        const patch = {};
        for (const key of ["normalizedStCode", "registrationId", "normalizedFullName", "course", "courseName", "courseCode", "formNo", "qualification", "rawAddress", "rawStName", "admissionDate", "earliestPaymentDate"]) {
          const value = enrollmentSet[key];
          if (value !== "" && value !== null && value !== undefined && String(existingEnrollment[key] ?? "") !== String(value)) patch[key] = value;
        }
        if (existingEnrollment.feeConfig?.configured === false && courseRule.feeConfig?.configured) patch.feeConfig = courseRule.feeConfig;
        if (Object.keys(patch).length) enrollmentUpdates.push({ updateOne: { filter: { _id: existingEnrollment._id }, update: { $set: patch } } });
      }
      outputMap.push({
        registrationId: registration.registrationId, stCode: code, normalizedStCode: code,
        studentId: String(masterId), enrollmentId: String(enrollmentId), course: registration.course
      });
    }
    if (activeEnrollmentId) {
      activeMasterOps.push({ updateOne: { filter: { _id: masterId }, update: { $set: { activeEnrollmentId } } } });
      for (const prior of existingEnrollments) {
        if (String(prior.studentId) === String(masterId) && normalizeStudentCode(prior.stCode) === code
          && String(prior._id) !== String(activeEnrollmentId) && prior.status === "ACTIVE") {
          enrollmentStatusOps.push({ updateOne: { filter: { _id: prior._id }, update: { $set: { status: "PROMOTED" } } } });
        }
      }
      enrollmentStatusOps.push({ updateOne: { filter: { _id: activeEnrollmentId }, update: { $set: { status: "ACTIVE" } } } });
    }
  }

  const insertChunks = async (Model, docs, phase, size = 200) => {
    for (let offset = 0; offset < docs.length; offset += size) {
      const chunk = docs.slice(offset, offset + size);
      const started = Date.now();
      try {
        await Model.insertMany(chunk, { ordered: false });
      } catch (error) {
        const writeErrors = error.writeErrors || error.result?.writeErrors || [];
        const onlyDuplicates = error.code === 11000 || (writeErrors.length && writeErrors.every(item => item.code === 11000));
        if (!onlyDuplicates) throw error;
        if (Model.modelName === "StudentEnrollment") {
          const naturalQuery = { $or: chunk.map(item => ({
            studentId: item.studentId, normalizedStCode: item.normalizedStCode,
            normalizedFullName: item.normalizedFullName, courseCode: item.courseCode,
            admissionDate: item.admissionDate
          })) };
          let persisted = await StudentEnrollment.find(naturalQuery).lean();
          const persistedKeys = new Set(persisted.map(enrollmentUniqueKey));
          const missing = chunk.filter(item => !persistedKeys.has(enrollmentUniqueKey(item)));
          if (missing.length) {
            try { await Model.insertMany(missing, { ordered: false }); }
            catch (retryError) {
              const retryErrors = retryError.writeErrors || retryError.result?.writeErrors || [];
              if (retryError.code !== 11000 && !(retryErrors.length && retryErrors.every(item => item.code === 11000))) throw retryError;
              persisted = await StudentEnrollment.find(naturalQuery).lean();
              const afterRetry = new Set(persisted.map(enrollmentUniqueKey));
              const unresolved = missing.filter(item => !afterRetry.has(enrollmentUniqueKey(item)));
              if (unresolved.length) throw new Error("Enrollment duplicate recovery could not confirm " + unresolved.length + " records by their natural Student Code key.");
            }
          }
        } else if (Model.modelName === "Student") {
          const query = { normalizedStCode: { $in: chunk.map(item => item.normalizedStCode) } };
          let persisted = await Student.find(query).select("normalizedStCode").lean();
          const persistedCodes = new Set(persisted.map(item => normalizeStudentCode(item.normalizedStCode)));
          const missing = chunk.filter(item => !persistedCodes.has(normalizeStudentCode(item.normalizedStCode)));
          if (missing.length) {
            try { await Model.insertMany(missing, { ordered: false }); }
            catch (retryError) {
              const retryErrors = retryError.writeErrors || retryError.result?.writeErrors || [];
              if (retryError.code !== 11000 && !(retryErrors.length && retryErrors.every(item => item.code === 11000))) throw retryError;
              persisted = await Student.find(query).select("normalizedStCode").lean();
              const afterRetry = new Set(persisted.map(item => normalizeStudentCode(item.normalizedStCode)));
              const unresolved = missing.filter(item => !afterRetry.has(normalizeStudentCode(item.normalizedStCode)));
              if (unresolved.length) throw new Error("Student Code duplicate recovery could not confirm " + unresolved.length + " Student records.");
            }
          }
        } else {
          throw error;
        }
      }
      console.log("[unified-import]", phase, Math.floor(offset / size) + 1, Date.now() - started, { attempted: chunk.length });
    }
  };
  const updateChunks = async (Model, ops, phase, size = 500) => {
    for (let offset = 0; offset < ops.length; offset += size) {
      const chunk = ops.slice(offset, offset + size);
      const started = Date.now();
      if (chunk.length) await Model.bulkWrite(chunk, { ordered: false });
      console.log("[unified-import]", phase, Math.floor(offset / size) + 1, Date.now() - started, { updated: chunk.length });
    }
  };
  const masterOpsById = new Map();
  const arrayFields = ["normalizedStCodes", "studentCodes", "stCodes", "alternateNames", "phones", "phoneNumbers", "legacyStudentIds", "registrations", "enrollments"];
  const registrationMergeKey = item => [
    normalizeStudentCode(item.stCode),
    normalizeCourseCode(item.course || item.courseName || item.courseCode),
    asDate(item.dateOfAdmission || item.admissionDate)?.toISOString().slice(0, 10) || ""
  ].join("|");
  for (const item of masterOps) {
    const key = String(item._id);
    const prior = masterOpsById.get(key);
    if (!prior) {
      masterOpsById.set(key, item);
      continue;
    }
    for (const field of arrayFields) {
      const values = [...(prior.set[field] || []), ...(item.set[field] || [])];
      if (field === "registrations" || field === "enrollments") {
        const byKey = new Map();
        for (const value of values) {
          const rowKey = registrationMergeKey(value);
          byKey.set(rowKey, { ...(byKey.get(rowKey) || {}), ...value });
        }
        prior.set[field] = [...byKey.values()];
      } else {
        const unique = new Map(values.map(value => [String(value?._id || value), value]));
        prior.set[field] = [...unique.values()];
      }
    }
    for (const [field, value] of Object.entries(item.set || {})) {
      if (arrayFields.includes(field) || value === "" || value === null || value === undefined) continue;
      prior.set[field] = value;
    }
    prior.insertDefaults = { ...(prior.insertDefaults || {}), ...(item.insertDefaults || {}) };
  }
  const mergedMasterOps = [...masterOpsById.values()];
  await insertChunks(Student, studentInserts, "student-code-insert");
  if (studentInserts.length) {
    const reconcileStarted = Date.now();
    const persistedStudents = await Student.find({ $or: studentInserts.map(item => ({
      $or: [
        { normalizedStCode: normalizeStudentCode(item.normalizedStCode || item.regnNo || item.enrollmentNo) },
        { regnNo: { $in: codeLookupVariants(item.normalizedStCode || item.regnNo || item.enrollmentNo) } },
        { enrollmentNo: { $in: codeLookupVariants(item.normalizedStCode || item.regnNo || item.enrollmentNo) } }
      ]
    })) }).lean();
    const persistedByCode = new Map();
    for (const item of persistedStudents) {
      const code = normalizeStudentCode(item.normalizedStCode || item.regnNo || item.enrollmentNo);
      if (code) persistedByCode.set(code, [...(persistedByCode.get(code) || []), item]);
    }
    const remapStudentIds = new Map();
    const repairStudentOps = [];
    for (const requested of studentInserts) {
      const code = normalizeStudentCode(requested.normalizedStCode || requested.regnNo || requested.enrollmentNo);
      const candidates = persistedByCode.get(code) || [];
      if (!candidates.length) throw new Error("Student insert was not confirmed for Student Code " + code + "; stopping before enrollment writes.");
      const names = new Set(candidates.map(item => normalizeName(item.applicantName || item.name || item.sourceStudentName)).filter(Boolean));
      if (names.size > 1) throw new Error("Multiple existing Student records with different names claim Student Code " + code + "; review required.");
      const actual = [...candidates].sort((left, right) =>
        new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
      )[0];
      remapStudentIds.set(String(requested._id), actual._id);
      const patch = {};
      for (const [key, value] of Object.entries(requested)) {
        if (key === "_id" || key === "createdAt" || key === "updatedAt" || value === "" || value === null || value === undefined) continue;
        if (JSON.stringify(actual[key]) !== JSON.stringify(value)) patch[key] = value;
      }
      if (Object.keys(patch).length) repairStudentOps.push({ updateOne: { filter: { _id: actual._id }, update: { $set: patch } } });
    }
    if (repairStudentOps.length) await updateChunks(Student, repairStudentOps, "student-code-race-repair");
    for (const item of mergedMasterOps) {
      if (Array.isArray(item.set?.legacyStudentIds)) item.set.legacyStudentIds = item.set.legacyStudentIds.map(id => remapStudentIds.get(String(id)) || id);
    }
    for (const item of enrollmentInserts) {
      if (item.legacyStudentId && remapStudentIds.has(String(item.legacyStudentId))) item.legacyStudentId = remapStudentIds.get(String(item.legacyStudentId));
    }
    for (const operation of enrollmentUpdates) {
      const legacyId = operation.updateOne?.update?.$set?.legacyStudentId;
      if (legacyId && remapStudentIds.has(String(legacyId))) operation.updateOne.update.$set.legacyStudentId = remapStudentIds.get(String(legacyId));
    }
    console.log("[unified-import]", "student-insert-reconcile", 1, Date.now() - reconcileStarted, {
      requested: studentInserts.length, confirmed: persistedStudents.length, remapped: [...remapStudentIds].filter(([from, to]) => from !== String(to)).length
    });
  }
  await updateChunks(Student, studentUpdates, "student-code-update");
  const knownMasters = new Set(existingMasters.map(item => String(item._id)));
  const masterInserts = [], masterUpdates = [];
  for (const item of mergedMasterOps) {
    if (item.isNew || !knownMasters.has(String(item._id))) {
      masterInserts.push({ _id: item._id, ...item.insertDefaults, ...item.set });
      continue;
    }
    const prior = existingMasters.find(value => String(value._id) === String(item._id));
    const patch = {};
    for (const [key, value] of Object.entries(item.set || {})) {
      if (value === "" || value === null || value === undefined) continue;
      if (JSON.stringify(prior?.[key]) !== JSON.stringify(value)) patch[key] = value;
    }
    if (Object.keys(patch).length) masterUpdates.push({ updateOne: { filter: { _id: item._id }, update: { $set: patch } } });
  }
  await insertChunks(StudentMaster, masterInserts, "master-code-insert");
  await updateChunks(StudentMaster, masterUpdates, "master-code-update");
  await updateChunks(StudentMaster, activeMasterOps, "active-master");
  await insertChunks(StudentEnrollment, enrollmentInserts, "enrollment-code-insert");
  if (enrollmentInserts.length) {
    const persisted = await StudentEnrollment.find({ $or: enrollmentInserts.map(item => ({
      studentId: item.studentId,
      normalizedStCode: normalizeStudentCode(item.normalizedStCode || item.stCode),
      courseCode: item.courseCode,
      admissionDate: item.admissionDate || null
    })) }).lean();
    const persistedByKey = new Map(persisted.map(item => [enrollmentUniqueKey(item), item]));
    const actualIds = new Map();
    for (const item of enrollmentInserts) {
      const actual = persistedByKey.get(enrollmentUniqueKey(item));
      if (actual) actualIds.set(String(item._id), actual._id);
    }
    for (const operation of activeMasterOps) {
      const id = operation.updateOne?.update?.$set?.activeEnrollmentId;
      if (id && actualIds.has(String(id))) operation.updateOne.update.$set.activeEnrollmentId = actualIds.get(String(id));
    }
    for (const item of outputMap) if (actualIds.has(String(item.enrollmentId))) item.enrollmentId = String(actualIds.get(String(item.enrollmentId)));
    for (const operation of enrollmentStatusOps) {
      const id = operation.updateOne?.filter?._id;
      if (id && actualIds.has(String(id))) operation.updateOne.filter._id = actualIds.get(String(id));
    }
  }
  await updateChunks(StudentEnrollment, enrollmentUpdates, "enrollment-code-update");
  await updateChunks(StudentEnrollment, enrollmentStatusOps, "enrollment-status");
  onPhase("students");
  onPhase("enrollments");
  return {
    studentsMatchedUpdated: matchedProfiles, newStudentsCreated: newProfiles,
    registrationsLinked, registrationsSeen, duplicatesSkipped: 0,
    registrationMap: outputMap, flaggedRows
  };
}

async function syncFeeRows(rows = [], onProgress = () => {}, registrationMap = [], batchKey = "") {
  if (!Array.isArray(rows) || rows.length > 20000) throw new Error("Fee import must contain between 1 and 20,000 rows.");
  await ensureReceiptIndex();
  const codes = [...new Set(rows.map(item => normalizeStudentCode(item.stCode)).filter(Boolean))];
  const variants = [...new Set(codes.flatMap(codeLookupVariants))];
  const ids = [...new Set(rows.map(item => clean(item.registrationId)).filter(Boolean))];
  const enrollments = await StudentEnrollment.find({ mergedIntoEnrollmentId: null, $or: [
    { normalizedStCode: { $in: codes } }, { stCode: { $in: variants } }, { registrationId: { $in: ids } }
  ] }).lean();
  const enrollmentByCode = new Map();
  const enrollmentById = new Map();
  for (const item of enrollments) {
    const code = normalizeStudentCode(item.normalizedStCode || item.stCode);
    if (code) enrollmentByCode.set(code, [...(enrollmentByCode.get(code) || []), item]);
    if (item.registrationId) enrollmentById.set(String(item.registrationId), item);
  }
  const mappedByCode = new Map((registrationMap || []).map(item => [normalizeStudentCode(item.stCode), item]));
  const sourceRowKeys = rows.map(row => {
    const code = normalizeStudentCode(row.stCode);
    const key = makeReceiptBusinessKey(code, row.mrNo, row.paymentDate, row.amountPaid);
    return [clean(batchKey), clean(row.sourceSheet), Number(row.rowNo || 0), key].join("|");
  }).filter(Boolean);
  const existing = await StudentFeePayment.find({ $or: [
    { normalizedStCode: { $in: codes } },
    { stCode: { $in: variants } },
    { registrationId: { $in: ids } },
    ...(sourceRowKeys.length ? [{ sourceRowKey: { $in: sourceRowKeys } }] : [])
  ] }).select("sourceRowKey sourceBatchKey sourceStCode sourceSheet sourceRowNo normalizedStCode normalizedMrNo registrationId stNameKey stCode mrNo paymentDate amountPaid studentId masterStudentId enrollmentId courseCode course importBatchKey").lean();
  const existingByBusinessKey = new Map();
  const existingBySourceKey = new Map();
  for (const item of existing) {
    const code = normalizeStudentCode(item.normalizedStCode || item.stCode);
    const key = makeReceiptBusinessKey(code, item.normalizedMrNo || item.mrNo, item.paymentDate, item.amountPaid);
    if (code && key && !existingByBusinessKey.has(key)) existingByBusinessKey.set(key, item);
    if (item.sourceRowKey) existingBySourceKey.set(String(item.sourceRowKey), item);
  }

  const newDocs = [];
  const updateById = new Map();
  const unmatchedRows = [];
  const seenBusinessKeys = new Set();
  const seenSourceKeys = new Set();
  let newReceiptsAdded = 0, existingReceiptsUpdatedOrSkipped = 0, duplicateReceiptsSkipped = 0, existingReceiptsUpdated = 0;
  for (const row of rows) {
    const stCode = normalizeStudentCode(row.stCode);
    const paymentDate = asDate(row.paymentDate);
    const amountPaid = parseImportAmount(row.amountPaid);
    const mrNo = normalizeReceiptNumber(row.mrNo);
    const businessKey = makeReceiptBusinessKey(stCode, mrNo, paymentDate, amountPaid);
    const sourceRowKey = [clean(batchKey), clean(row.sourceSheet), Number(row.rowNo || 0), businessKey].join("|");
    const mapped = mappedByCode.get(stCode);
    let candidates = enrollmentByCode.get(stCode) || [];
    if (mapped?.ambiguous) candidates = [];
    if (mapped?.studentId) candidates = candidates.filter(item => String(item.studentId) === String(mapped.studentId));
    if (Array.isArray(mapped?.enrollmentIds) && mapped.enrollmentIds.length) {
      const allowed = new Set(mapped.enrollmentIds.map(String));
      candidates = candidates.filter(item => allowed.has(String(item._id)));
    }
    const exactRegistration = enrollmentById.get(String(row.registrationId || ""));
    if (exactRegistration && normalizeStudentCode(exactRegistration.stCode) === stCode
      && (!mapped?.studentId || String(exactRegistration.studentId) === String(mapped.studentId))) {
      candidates = [exactRegistration];
    }
    let enrollment = null;
    if (candidates.length === 1) enrollment = candidates[0];
    else if (candidates.length > 1 && paymentDate) {
      const eligible = candidates.filter(item => !asDate(item.admissionDate) || asDate(item.admissionDate) <= paymentDate);
      if (eligible.length) {
        const dated = eligible.filter(item => asDate(item.admissionDate));
        if (dated.length) {
          const latest = Math.max(...dated.map(item => asDate(item.admissionDate).getTime()));
          const latestItems = dated.filter(item => asDate(item.admissionDate).getTime() === latest);
          if (latestItems.length === 1) enrollment = latestItems[0];
        } else if (eligible.length === 1) enrollment = eligible[0];
      }
    }
    if (!stCode || !enrollment || !paymentDate || !mrNo || !Number.isFinite(amountPaid) || amountPaid < 0) {
      unmatchedRows.push({
        row: row.rowNo, sheet: row.sourceSheet || "", studentId: row.registrationId || stCode,
        stCode, name: row.cleanName || "", amountPaid: row.amountPaid ?? "",
        mrNo, paymentDate: row.paymentDate || "",
        reason: mapped?.ambiguous ? "This Student Code maps to multiple imported student profiles." :
          !enrollment ? (candidates.length > 1 ? "Student Code matched, but course/admission selection is ambiguous for this payment date." : "No enrollment exists for this normalized Student Code.") :
          "Receipt number, payment date, or amount is invalid."
      });
      continue;
    }
    const key = makeReceiptBusinessKey(stCode, mrNo, paymentDate, amountPaid);
    if (seenBusinessKeys.has(key) || seenSourceKeys.has(sourceRowKey)) {
      duplicateReceiptsSkipped += 1;
      existingReceiptsUpdatedOrSkipped += 1;
      unmatchedRows.push({
        row: row.rowNo, sheet: row.sourceSheet || "", studentId: row.registrationId || stCode,
        stCode, name: row.cleanName || "", amountPaid, mrNo, paymentDate,
        reason: "Duplicate payment business key appears more than once in this workbook; the first occurrence was retained."
      });
      continue;
    }
    seenBusinessKeys.add(key);
    seenSourceKeys.add(sourceRowKey);
    const priorReceipt = existingBySourceKey.get(sourceRowKey) || existingByBusinessKey.get(key);
    const courseCode = normalizeCourseCode(enrollment.courseCode || row.course);
    const paymentValues = {
      studentId: enrollment.studentId, masterStudentId: enrollment.studentId,
      enrollmentId: enrollment._id, stCode, sourceStCode: clean(row.sourceStCode || row.stCode), normalizedStCode: stCode,
      registrationId: enrollment.registrationId || row.registrationId || "",
      stNameKey: enrollment.registrationId || row.registrationId || "",
      courseCode, course: enrollment.course || enrollment.courseName || row.course || "",
      mrNo, normalizedMrNo: normalizeReceiptNumber(mrNo), paymentDate, amountPaid, rawPaymentDate: paymentDate,
      sourceSheet: clean(row.sourceSheet), sourceRowNo: Number(row.rowNo || 0),
      importBatchKey: "UNIFIED_WORKBOOK_IMPORT",
      sourceBatchKey: clean(batchKey), sourceRowKey,
      allocations: priorReceipt?.allocations || [],
      importWarnings: priorReceipt?.importWarnings || []
    };
    if (priorReceipt) {
      if (clean(priorReceipt.sourceBatchKey) === clean(batchKey)
        && clean(priorReceipt.sourceRowKey)
        && String(priorReceipt.sourceRowKey) !== sourceRowKey
        && (Number(priorReceipt.sourceRowNo || 0) !== Number(row.rowNo || 0)
          || clean(priorReceipt.sourceSheet) !== clean(row.sourceSheet))) {
        duplicateReceiptsSkipped += 1;
        existingReceiptsUpdatedOrSkipped += 1;
        unmatchedRows.push({
          row: row.rowNo, sheet: row.sourceSheet || "", studentId: row.registrationId || stCode,
          stCode, name: row.cleanName || "", amountPaid, mrNo, paymentDate,
          reason: "This Student Code / receipt / date / amount already appears on another row in the same workbook. The second row was not counted twice."
        });
        continue;
      }
      const patch = {};
      for (const [keyName, value] of Object.entries(paymentValues)) {
        if (value === "" || value === null || value === undefined) continue;
        if (keyName === "allocations" || keyName === "importWarnings") continue;
        if (String(priorReceipt[keyName] ?? "") !== String(value)) patch[keyName] = value;
      }
      if (Object.keys(patch).length) {
        updateById.set(String(priorReceipt._id), { updateOne: { filter: { _id: priorReceipt._id }, update: { $set: patch } } });
        existingReceiptsUpdated += 1;
      } else duplicateReceiptsSkipped += 1;
      existingReceiptsUpdatedOrSkipped += 1;
      continue;
    }
    newDocs.push({ _id: new mongoose.Types.ObjectId(), ...paymentValues });
  }

  const updateOps = [...updateById.values()];
  for (let offset = 0; offset < updateOps.length; offset += 500) {
    const chunk = updateOps.slice(offset, offset + 500);
    const started = Date.now();
    await StudentFeePayment.bulkWrite(chunk, { ordered: false });
    console.log("[unified-import]", "fee-repair", Math.floor(offset / 500) + 1, Date.now() - started, { updated: chunk.length });
  }
  for (let offset = 0; offset < newDocs.length; offset += 500) {
    const chunk = newDocs.slice(offset, offset + 500);
    const started = Date.now();
    try {
      const inserted = await StudentFeePayment.insertMany(chunk, { ordered: false });
      newReceiptsAdded += inserted.length;
    } catch (error) {
      const writeErrors = error.writeErrors || error.result?.writeErrors || [];
      const duplicateOnly = error.code === 11000 || (writeErrors.length > 0 && writeErrors.every(item => item.code === 11000));
      if (!duplicateOnly) throw error;
      const keys = chunk.map(item => makeReceiptBusinessKey(item.normalizedStCode, item.mrNo, item.paymentDate, item.amountPaid));
      const persisted = await StudentFeePayment.find({ $or: [
        { sourceRowKey: { $in: chunk.map(item => item.sourceRowKey) } },
        ...chunk.map(item => ({ normalizedStCode: item.normalizedStCode, mrNo: item.mrNo, paymentDate: item.paymentDate })),
        ...chunk.map(item => ({ stCode: item.stCode, mrNo: item.mrNo, paymentDate: item.paymentDate }))
      ] }).lean();
      const persistedKeys = new Set(persisted.map(item => makeReceiptBusinessKey(item.normalizedStCode || item.stCode, item.mrNo, item.paymentDate, item.amountPaid)));
      const persistedSourceKeys = new Set(persisted.map(item => String(item.sourceRowKey || "")));
      const missing = chunk.filter(item => !persistedSourceKeys.has(item.sourceRowKey) && !persistedKeys.has(makeReceiptBusinessKey(item.normalizedStCode, item.mrNo, item.paymentDate, item.amountPaid)));
      const repairs = [];
      for (const item of chunk) {
        const prior = persisted.find(doc => String(doc.sourceRowKey || "") === item.sourceRowKey
          || makeReceiptBusinessKey(doc.normalizedStCode || doc.stCode, doc.mrNo, doc.paymentDate, doc.amountPaid) === makeReceiptBusinessKey(item.normalizedStCode, item.mrNo, item.paymentDate, item.amountPaid));
        if (prior) {
          repairs.push({ updateOne: { filter: { _id: prior._id }, update: { $set: {
            studentId: item.studentId, masterStudentId: item.masterStudentId, enrollmentId: item.enrollmentId,
            stCode: item.stCode, sourceStCode: item.sourceStCode, normalizedStCode: item.normalizedStCode, registrationId: item.registrationId,
            stNameKey: item.stNameKey, courseCode: item.courseCode, course: item.course,
            mrNo: item.mrNo, paymentDate: item.paymentDate, amountPaid: item.amountPaid, rawPaymentDate: item.rawPaymentDate,
            sourceSheet: item.sourceSheet, sourceRowNo: item.sourceRowNo,
            sourceRowKey: item.sourceRowKey, sourceBatchKey: item.sourceBatchKey, importBatchKey: item.importBatchKey
          } } } });
          duplicateReceiptsSkipped += 1;
          existingReceiptsUpdatedOrSkipped += 1;
        }
      }
      if (repairs.length) await StudentFeePayment.bulkWrite(repairs, { ordered: false });
      if (missing.length) {
        try {
          const inserted = await StudentFeePayment.insertMany(missing, { ordered: false });
          newReceiptsAdded += inserted.length;
        } catch (retryError) {
          const retryErrors = retryError.writeErrors || retryError.result?.writeErrors || [];
          if (retryError.code !== 11000 && !(retryErrors.length > 0 && retryErrors.every(item => item.code === 11000))) throw retryError;
          const unresolved = await StudentFeePayment.find({ sourceRowKey: { $in: missing.map(item => item.sourceRowKey) } }).select("sourceRowKey").lean();
          const savedKeys = new Set(unresolved.map(item => item.sourceRowKey));
          const notSaved = missing.filter(item => !savedKeys.has(item.sourceRowKey));
          for (const item of notSaved) unmatchedRows.push({
            row: item.sourceRowNo, sheet: item.sourceSheet, stCode: item.stCode,
            name: item.stNameKey, amountPaid: item.amountPaid, mrNo: item.mrNo,
            paymentDate: item.paymentDate, reason: "MongoDB rejected this receipt with a duplicate-key conflict and no matching existing receipt could be found."
          });
        }
      }
    }
    console.log("[unified-import]", "fee-insert", Math.floor(offset / 500) + 1, Date.now() - started, { attempted: chunk.length });
  }
  onProgress({ percent: 92, stage: "Importing Fee Receipts", processed: rows.length, total: rows.length });
  return {
    newReceiptsAdded, existingReceiptsUpdatedOrSkipped, duplicateReceiptsSkipped,
    existingReceiptsUpdated, unmatchedRows, feeRowsProcessed: rows.length,
    feeRowsSavedOrAlreadyPresent: newReceiptsAdded + existingReceiptsUpdatedOrSkipped
  };
}

async function finalizeFeeSummaries(rawStudentIds = [], options = {}) {
  const studentIds = [...new Set((rawStudentIds || []).filter(validObjectId).map(id => String(id)))];
  const objectIds = studentIds.map(id => new mongoose.Types.ObjectId(id));
  const suppliedCodes = [...new Set((options.studentCodes || []).map(normalizeStudentCode).filter(Boolean))];
  if (!objectIds.length && !suppliedCodes.length) return { studentsFinalized: 0, enrollmentsFinalized: 0, databasePaymentRows: 0, databasePaymentTotal: 0, paymentReconciliationMatches: false };
  const masters = await StudentMaster.find({
    mergedIntoMasterId: null, isMerged: { $ne: true },
    $or: [
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ...(suppliedCodes.length ? [{ normalizedStCodes: { $in: suppliedCodes } }, { studentCodes: { $in: [...new Set(suppliedCodes.flatMap(codeLookupVariants))] } }] : [])
    ]
  }).lean();
  const legacyIds = [...new Set(masters.flatMap(master => master.legacyStudentIds || []).filter(validObjectId).map(String))];
  const legacyObjectIds = legacyIds.map(id => new mongoose.Types.ObjectId(id));
  const preliminaryCodes = [...new Set([
    ...suppliedCodes,
    ...masters.flatMap(master => [
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode),
      ...(master.enrollments || []).map(item => item.stCode)
    ])
  ].map(normalizeStudentCode).filter(Boolean))];
  const preliminaryVariants = [...new Set(preliminaryCodes.flatMap(codeLookupVariants))];
  const legacyStudents = (legacyObjectIds.length || preliminaryCodes.length) ? await Student.find({
    $or: [
      ...(legacyObjectIds.length ? [{ _id: { $in: legacyObjectIds } }] : []),
      ...(preliminaryCodes.length ? [{ normalizedStCode: { $in: preliminaryCodes } }, { regnNo: { $in: preliminaryVariants } }, { enrollmentNo: { $in: preliminaryVariants } }] : [])
    ]
  }).lean() : [];
  const legacyStudentById = new Map(legacyStudents.map(item => [String(item._id), item]));
  const codes = [...new Set([
    ...suppliedCodes,
    ...masters.flatMap(master => [
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode),
      ...(master.enrollments || []).map(item => item.stCode),
      ...(master.legacyStudentIds || []).map(id => {
        const linked = legacyStudentById.get(String(id));
        return linked?.normalizedStCode || linked?.regnNo || linked?.enrollmentNo;
      })
    ])
  ].map(normalizeStudentCode).filter(Boolean))];
  if (!masters.length && !codes.length) return { studentsFinalized: 0, enrollmentsFinalized: 0, databasePaymentRows: 0, databasePaymentTotal: 0, paymentReconciliationMatches: false };

  const codeVariants = [...new Set(codes.flatMap(codeLookupVariants))];
  const masterIds = [...new Set(masters.map(item => String(item._id)))];
  const masterObjectIds = masterIds.map(id => new mongoose.Types.ObjectId(id));
  const enrollments = await StudentEnrollment.find({
    mergedIntoEnrollmentId: null,
    $or: [
      ...(masterObjectIds.length ? [{ studentId: { $in: masterObjectIds } }] : []),
      ...(codes.length ? [{ normalizedStCode: { $in: codes } }, { stCode: { $in: codeVariants } }] : [])
    ]
  }).lean();
  const enrollmentIds = enrollments.map(item => item._id);
  const paymentTotals = await StudentFeePayment.aggregate([
    { $match: { $or: [
      ...(codes.length ? [{ normalizedStCode: { $in: codes } }, { stCode: { $in: codeVariants } }] : []),
      ...(enrollmentIds.length ? [{ enrollmentId: { $in: enrollmentIds } }] : []),
      ...(masterObjectIds.length ? [{ studentId: { $in: masterObjectIds } }, { masterStudentId: { $in: masterObjectIds } }] : [])
    ] } },
    { $addFields: {
      _rawStudentCode: { $toUpper: { $trim: { input: { $ifNull: [{ $cond: [
        { $and: [{ $ne: ["$normalizedStCode", null] }, { $ne: ["$normalizedStCode", ""] }] },
        "$normalizedStCode", "$stCode"
      ] }, ""] } } } }
    } },
    { $addFields: {
      _normalizedStudentCode: {
        $cond: [
          { $regexMatch: { input: "$_rawStudentCode", regex: "^[0-9]+$" } },
          { $let: {
            vars: { stripped: { $regexReplace: { input: "$_rawStudentCode", regex: "^0+", replacement: "" } } },
            in: { $cond: [{ $eq: ["$$stripped", ""] }, "0", "$$stripped"] }
          } },
          { $regexReplace: { input: "$_rawStudentCode", regex: "\\s+", replacement: "" } }
        ]
      }
    } },
    { $match: { _normalizedStudentCode: { $in: codes } } },
    { $addFields: {
      _normalizedReceiptNo: { $regexReplace: { input: { $toUpper: { $trim: { input: { $ifNull: ["$normalizedMrNo", "$mrNo"] } } } }, regex: "\\s+", replacement: "" } },
      _paymentDateKey: { $cond: [
        { $eq: [{ $type: "$paymentDate" }, "date"] },
        { $dateToString: { format: "%Y-%m-%d", date: "$paymentDate", timezone: "UTC" } },
        ""
      ] }
    } },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    { $group: {
      _id: {
        code: "$_normalizedStudentCode",
        receiptKey: { $cond: [{ $ne: ["$_normalizedReceiptNo", ""] }, "$_normalizedReceiptNo", { $toString: "$_id" }] },
        paymentDate: "$_paymentDateKey"
      },
      totalPaid: { $first: "$amountPaid" },
      enrollmentIds: { $addToSet: "$enrollmentId" },
      duplicateDocumentCount: { $sum: 1 }
    } },
    { $addFields: {
      canonicalEnrollmentId: {
        $cond: [
          { $eq: [{ $size: "$enrollmentIds" }, 1] },
          { $arrayElemAt: ["$enrollmentIds", 0] },
          null
        ]
      }
    } },
    { $group: {
      _id: { code: "$_id.code", enrollmentId: "$canonicalEnrollmentId" },
      totalPaid: { $sum: "$totalPaid" },
      paymentCount: { $sum: 1 },
      duplicateDocumentCount: { $sum: { $subtract: ["$duplicateDocumentCount", 1] } }
    } }
  ]);
  const paidByCode = new Map();
  const paidByEnrollment = new Map();
  let duplicatePaymentDocumentsFound = 0;
  for (const item of paymentTotals) {
    duplicatePaymentDocumentsFound += Number(item.duplicateDocumentCount || 0);
    const code = normalizeStudentCode(item._id.code);
    const paid = Number(item.totalPaid || 0);
    paidByCode.set(code, (paidByCode.get(code) || 0) + paid);
    if (item._id.enrollmentId) paidByEnrollment.set(code + "|" + String(item._id.enrollmentId), paid);
  }
  const enrollmentsByMaster = new Map();
  for (const enrollment of enrollments) {
    const key = String(enrollment.studentId);
    enrollmentsByMaster.set(key, [...(enrollmentsByMaster.get(key) || []), enrollment]);
  }
  const LegacyFeeSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, payments: [mongoose.Schema.Types.Mixed] }, { strict: false });
  const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", LegacyFeeSchema);
  const legacyStudentIds = legacyStudents.map(item => item._id);
  const legacyFees = legacyStudentIds.length ? await StudentFee.find({ studentId: { $in: legacyStudentIds } }).lean() : [];
  const importedReceiptKeys = new Set();
  const importedPaymentDocs = codes.length ? await StudentFeePayment.find({
    $or: [...codes.map(code => ({ normalizedStCode: code })), { stCode: { $in: codeVariants } }]
  }).select("normalizedStCode stCode mrNo normalizedMrNo paymentDate").lean() : [];
  for (const payment of importedPaymentDocs) {
    const code = normalizeStudentCode(payment.normalizedStCode || payment.stCode);
    const receipt = normalizeReceiptNumber(payment.normalizedMrNo || payment.mrNo);
    if (code && receipt) importedReceiptKeys.add([code, receipt, dateKey(payment.paymentDate)].join("|"));
  }
  const legacyPaidByCode = new Map();
  const legacyFeeByCode = new Map();
  const legacyReceiptKeys = new Set();
  const courseFeePurposes = new Set(["course fee", "admission fee", "installment", "tuition fee"]);
  for (const fee of legacyFees) {
    const linkedStudent = legacyStudentById.get(String(fee.studentId));
    const code = normalizeStudentCode(linkedStudent?.normalizedStCode || linkedStudent?.regnNo || linkedStudent?.enrollmentNo);
    if (!code || !codes.includes(code)) continue;
    const payable = Math.max(0, Number(fee.totalFee || 0) - Number(fee.discount || 0));
    const priorFee = legacyFeeByCode.get(code);
    if (!priorFee || new Date(fee.updatedAt || fee.createdAt || 0) > new Date(priorFee.updatedAt || priorFee.createdAt || 0)) legacyFeeByCode.set(code, fee);
    for (const payment of fee.payments || []) {
      const receipt = normalizeReceiptNumber(payment.receiptNo || payment.reference);
      const paymentDate = asDate(payment.date);
      const receiptKey = [code, receipt || String(payment._id || ""), dateKey(paymentDate)].join("|");
      if ((receipt && importedReceiptKeys.has(receiptKey)) || legacyReceiptKeys.has(receiptKey)) continue;
      legacyReceiptKeys.add(receiptKey);
      const items = Array.isArray(payment.items) ? payment.items : [];
      const hasPurpose = items.some(item => {
        const purpose = String(item.purpose || item.type || "").trim().toLowerCase();
        return purpose && purpose !== "other";
      });
      let coursePaid = 0;
      if (hasPurpose) {
        coursePaid = items.filter(item => courseFeePurposes.has(String(item.purpose || item.type || "").trim().toLowerCase()))
          .reduce((sum, item) => { const value = parseImportAmount(item.amount); return sum + (Number.isFinite(value) ? value : 0); }, 0);
      } else {
        const noteMatch = String(payment.note || "").match(/Fee sections:\s*([\s\S]*)$/i);
        if (noteMatch) {
          coursePaid = noteMatch[1].split(/;\s*/).reduce((sum, part) => {
            const item = part.match(/^(.*?):\s*₹([\d,.]+)(?:\s*\((.*?)\))?$/);
            return item && courseFeePurposes.has(item[1].trim().toLowerCase())
              ? sum + Number(item[2].replace(/,/g, "")) : sum;
          }, 0);
        } else {
          const type = String(payment.paymentType || "").toLowerCase();
          coursePaid = ["late fine", "lab charge", "registration fee"].some(label => type.includes(label))
            ? 0 : (Number.isFinite(parseImportAmount(payment.amount)) ? parseImportAmount(payment.amount) : 0);
        }
      }
      legacyPaidByCode.set(code, (legacyPaidByCode.get(code) || 0) + Math.max(0, coursePaid));
    }
  }
  for (const [code, paid] of legacyPaidByCode) {
    paidByCode.set(code, (paidByCode.get(code) || 0) + paid);
  }
  const studentsByCode = new Map();
  for (const student of legacyStudents) {
    const code = normalizeStudentCode(student.normalizedStCode || student.regnNo || student.enrollmentNo);
    if (code) studentsByCode.set(code, [...(studentsByCode.get(code) || []), student]);
  }

  const codeOwnerCounts = new Map();
  for (const master of masters) {
    const ownerCodes = new Set([
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode),
      ...(master.enrollments || []).map(item => item.stCode),
      ...(master.legacyStudentIds || []).map(id => {
        const linked = legacyStudentById.get(String(id));
        return linked?.normalizedStCode || linked?.regnNo || linked?.enrollmentNo;
      })
    ].map(normalizeStudentCode).filter(Boolean));
    for (const code of ownerCodes) codeOwnerCounts.set(code, (codeOwnerCounts.get(code) || 0) + 1);
  }
  const ambiguousCodes = new Set();
  const enrollmentOps = [];
  const masterOps = [];
  const studentOpsById = new Map();
  for (const master of masters) {
    const masterId = String(master._id);
    const masterCodes = [...new Set([
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode),
      ...(master.enrollments || []).map(item => item.stCode)
    ].map(normalizeStudentCode).filter(Boolean))];
    const relatedAll = enrollmentsByMaster.get(masterId) || [];
    let masterTotalFee = 0, masterTotalPaid = 0, masterBalanceDue = 0, masterDiscount = 0, masterCourseCount = 0, anyConfiguredFee = false;
    for (const code of masterCodes) {
      if ((codeOwnerCounts.get(code) || 0) > 1) {
        ambiguousCodes.add(code);
        continue;
      }
      const related = relatedAll.filter(item => normalizeStudentCode(item.normalizedStCode || item.stCode) === code);
      const totalPaid = Number(paidByCode.get(code) || 0);
      const enrollmentFeeTotal = related.reduce((sum, item) => sum + Number(item.feeConfig?.netPayableFee ?? item.summary?.totalDue ?? item.feeConfig?.grossFee ?? item.summary?.totalFee ?? 0), 0);
      const hasEnrollmentFee = related.some(item => Boolean(item.feeConfig) && item.feeConfig.configured !== false
        && item.feeConfig.feeRuleSource !== "UNCONFIGURED"
        && String(item.courseCode || "").toUpperCase() !== "PREVIOUS-LEGACY");
      const legacyFeeRecord = legacyFeeByCode.get(code);
      const legacyGrossFee = Number(legacyFeeRecord?.totalFee || 0);
      const legacyDiscount = Number(legacyFeeRecord?.discount || 0);
      const legacyPayable = Math.max(0, legacyGrossFee - legacyDiscount);
      const totalFee = hasEnrollmentFee || enrollmentFeeTotal > 0 ? enrollmentFeeTotal : legacyPayable;
      const balanceDue = Math.max(0, totalFee - totalPaid);
      const hasConfiguredFee = hasEnrollmentFee || legacyPayable > 0 || enrollmentFeeTotal > 0;
      masterTotalFee += totalFee;
      masterTotalPaid += totalPaid;
      masterBalanceDue += balanceDue;
      masterDiscount += hasEnrollmentFee ? related.reduce((sum, item) => sum + Number(item.feeConfig?.discountAmount || 0), 0) : legacyDiscount;
      masterCourseCount += related.length;
      anyConfiguredFee ||= hasConfiguredFee;

      const current = related.find(item => String(item._id) === String(master.activeEnrollmentId))
        || related.find(item => item.status === "ACTIVE")
        || [...related].sort((a, b) => (asDate(b.admissionDate)?.getTime() || 0) - (asDate(a.admissionDate)?.getTime() || 0))[0];
      const explicitlyAllocated = related.reduce((sum, item) => sum + Number(paidByEnrollment.get(code + "|" + String(item._id)) || 0), 0);
      const unallocatedPaid = Math.max(0, totalPaid - explicitlyAllocated);
      for (const enrollment of related) {
        const enrollmentConfiguredFee = Boolean(enrollment.feeConfig) && enrollment.feeConfig.configured !== false
          && enrollment.feeConfig.feeRuleSource !== "UNCONFIGURED"
          && String(enrollment.courseCode || "").toUpperCase() !== "PREVIOUS-LEGACY";
        const usesLegacyFee = !hasEnrollmentFee && enrollment._id && current && String(current._id) === String(enrollment._id) && legacyPayable > 0;
        const configuredFee = enrollmentConfiguredFee || usesLegacyFee;
        const enrollmentFee = enrollmentConfiguredFee
          ? Number(enrollment.feeConfig?.netPayableFee ?? enrollment.summary?.totalDue ?? enrollment.feeConfig?.grossFee ?? enrollment.summary?.totalFee ?? 0)
          : usesLegacyFee ? legacyPayable : Number(enrollment.summary?.totalDue || 0);
        let enrollmentPaid = Number(paidByEnrollment.get(code + "|" + String(enrollment._id)) || 0);
        if (current && String(current._id) === String(enrollment._id)) enrollmentPaid += unallocatedPaid;
        const enrollmentDue = Math.max(0, enrollmentFee - enrollmentPaid);
        const enrollmentStatus = configuredFee && enrollmentDue <= 0 ? "Paid" : enrollmentPaid > 0 ? "Partial" : "Not Paid";
        enrollmentOps.push({ updateOne: {
          filter: { _id: enrollment._id },
          update: { $set: { summary: {
            ...(enrollment.summary || {}),
            totalFee: usesLegacyFee ? legacyGrossFee : Number(enrollment.feeConfig?.grossFee ?? enrollment.summary?.totalFee ?? enrollmentFee),
            totalDue: enrollmentFee, totalPaid: enrollmentPaid, balanceDue: enrollmentDue,
            nextDueDate: enrollment.summary?.nextDueDate || null,
            feeStatus: enrollmentStatus
          } } }
        } });
      }
      for (const student of studentsByCode.get(code) || []) {
        studentOpsById.set(String(student._id), { updateOne: {
          filter: { _id: student._id },
          update: { $set: {
            normalizedStCode: code, totalFee, totalPaid, feeSummaryUpdatedAt: new Date(),
            dueAmount: balanceDue,
            paymentStatus: hasConfiguredFee && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid",
            feeStatus: hasConfiguredFee && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid"
          } }
        } });
      }
    }
    const masterFeeStatus = anyConfiguredFee && masterBalanceDue <= 0 ? "Paid" : masterTotalPaid > 0 ? "Partial" : "Not Paid";
    masterOps.push({ updateOne: {
      filter: { _id: master._id },
      update: { $set: { feeSummary: {
        totalFee: masterTotalFee, discount: masterDiscount, totalPaid: masterTotalPaid,
        balanceDue: masterBalanceDue, feeStatus: masterFeeStatus,
        courseCount: masterCourseCount, updatedAt: new Date()
      } } }
    } });
  }
  await bulkWriteChunked(StudentEnrollment, enrollmentOps, [], "fee-summary-enrollments", 500);
  await bulkWriteChunked(StudentMaster, masterOps, [], "fee-summary-masters", 500);
  await bulkWriteChunked(Student, [...studentOpsById.values()], [], "fee-summary-students", 500);

  const batchKey = clean(options.batchKey);
  let databasePaymentRows = 0, databasePaymentTotal = 0;
  if (batchKey) {
    const [batchTotals] = await StudentFeePayment.aggregate([
      { $match: { sourceBatchKey: batchKey } },
      { $group: { _id: null, rows: { $sum: 1 }, total: { $sum: "$amountPaid" } } }
    ]);
    databasePaymentRows = Number(batchTotals?.rows || 0);
    databasePaymentTotal = Number(batchTotals?.total || 0);
  }
  const expectedRows = Number(options.expectedPaymentRows || 0);
  const expectedTotal = Number(options.expectedPaymentTotal || 0);
  const paymentReconciliationMatches = Boolean(batchKey)
    && databasePaymentRows === expectedRows
    && Math.abs(databasePaymentTotal - expectedTotal) < 0.01;
  return {
    studentsFinalized: masterOps.length,
    enrollmentsFinalized: enrollmentOps.length,
    databasePaymentRows,
    databasePaymentTotal: Number(databasePaymentTotal.toFixed(2)),
    expectedPaymentRows: expectedRows,
    expectedPaymentTotal: Number(expectedTotal.toFixed(2)),
    paymentReconciliationMatches,
    ambiguousCodes: [...ambiguousCodes],
    duplicatePaymentDocumentsFound
  };
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to import workbook data." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to import workbook data." }, { status: 403 });
    }
    await connectMongoDB();
    const body = await request.json();
    if (body.action === "complete") return NextResponse.json({ error: "Use sequential import phases." }, { status: 400 });
    if (body.action === "students") {
      if(!Array.isArray(body.groups)||body.groups.length>200)return NextResponse.json({error:"Student chunks are limited to 200 profiles."},{status:400});
      const t=Date.now(),r=await syncStudentGroups(body.groups);
      console.log("[unified-import]","students",Number(body.chunkIndex||0)+1,Date.now()-t,{profiles:body.groups.length,created:r.newStudentsCreated,updated:r.studentsMatchedUpdated,registrations:r.registrationsSeen});
      return NextResponse.json({registrationMapChunk:r.registrationMap||[],created:r.newStudentsCreated||0,updated:r.studentsMatchedUpdated||0,enrollmentsLinked:r.registrationsLinked||0,duplicatesSkipped:r.duplicatesSkipped||0,warnings:[...(r.flaggedRows||[]),...(r.warnings||[])],studentIds:[...new Set((r.registrationMap||[]).map(x=>x.studentId).filter(Boolean))]});
    }
    if (body.action === "fees") {
      if(!Array.isArray(body.rows)||body.rows.length>500)return NextResponse.json({error:"Fee chunks are limited to 500 receipts."},{status:400});
      const t=Date.now(),r=await syncFeeRows(body.rows, () => {}, body.registrationMap || [], body.batchKey || "");
      console.log("[unified-import]","fees",Number(body.chunkIndex||0)+1,Date.now()-t,{rows:body.rows.length,inserted:r.newReceiptsAdded,updated:r.existingReceiptsUpdated,skipped:r.duplicateReceiptsSkipped,unmatched:r.unmatchedRows.length});
      return NextResponse.json(r);
    }
    if (body.action === "finalize") {
      const t=Date.now(),r=await finalizeFeeSummaries(body.studentIds||[], body);
      console.log("[unified-import]","finalize",1,Date.now()-t,{students:r.studentsFinalized,enrollments:r.enrollmentsFinalized,paymentRows:r.databasePaymentRows,paymentTotal:r.databasePaymentTotal,reconciled:r.paymentReconciliationMatches});
      return NextResponse.json(r);
    }
    return NextResponse.json({ error: "Unsupported import batch action." }, { status: 400 });
  } catch (error) {
    console.error("[unified-student-import]", error);
    return NextResponse.json({ error: "Unified workbook batch failed.", detail: error.message }, { status: 500 });
  }
}
