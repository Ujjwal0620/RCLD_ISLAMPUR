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

export const runtime = "nodejs";
export const maxDuration = 60;

let receiptIndexPromise;
async function ensureReceiptIndex() {
  if (!receiptIndexPromise) {
    receiptIndexPromise = (async () => {
      const indexes = await StudentFeePayment.collection.indexes().catch(error => {
        if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
        throw error;
      });
      const legacyIndexes = indexes.filter(index => index.unique
        && !index.key?.registrationId
        && ["mrNo", "paymentDate", "amountPaid"].every(key => index.key?.[key] === 1));
      const oldRegistrationIndexes = indexes.filter(index => index.unique
        && index.key?.registrationId === 1
        && ["mrNo", "paymentDate", "amountPaid"].every(key => index.key?.[key] === 1)
        && index.partialFilterExpression?.importBatchKey !== "UNIFIED_WORKBOOK_IMPORT");
      for (const legacy of [...legacyIndexes, ...oldRegistrationIndexes]) {
        await StudentFeePayment.collection.dropIndex(legacy.name);
      }
      const duplicateGroups = await StudentFeePayment.collection.aggregate([
        { $match: {
          importBatchKey: "UNIFIED_WORKBOOK_IMPORT",
          registrationId: { $type: "string", $gt: "" },
          mrNo: { $type: "string", $gt: "" },
          paymentDate: { $type: "date" },
          amountPaid: { $type: "number" }
        } },
        { $group: {
          _id: { registrationId: "$registrationId", mrNo: "$mrNo", paymentDate: "$paymentDate", amountPaid: "$amountPaid" },
          ids: { $push: "$_id" },
          count: { $sum: 1 }
        } },
        { $match: { count: { $gt: 1 } } }
      ]).toArray();
      const duplicateArchiveIds = duplicateGroups.flatMap(group => group.ids.slice(1));
      if (duplicateArchiveIds.length) {
        await StudentFeePayment.collection.updateMany(
          { _id: { $in: duplicateArchiveIds } },
          { $set: { importBatchKey: "UNIFIED_WORKBOOK_IMPORT_DUPLICATE_ARCHIVE" } }
        );
      }
      await StudentFeePayment.collection.createIndex(
        { registrationId: 1, mrNo: 1, paymentDate: 1, amountPaid: 1 },
        {
          unique: true,
          name: "registration_receipt_date_amount_unique",
          partialFilterExpression: {
            importBatchKey: "UNIFIED_WORKBOOK_IMPORT",
            registrationId: { $type: "string", $gt: "" },
            mrNo: { $type: "string", $gt: "" },
            paymentDate: { $type: "date" },
            amountPaid: { $type: "number" }
          }
        }
      );
    })().catch(error => {
      receiptIndexPromise = null;
      throw error;
    });
  }
  return receiptIndexPromise;
}

const clean = value => String(value ?? "").trim();
const displayName = value => clean(value).normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
const normalizeName = value => clean(value).normalize("NFKC").toUpperCase()
  .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const normalizeFather = value => normalizeName(value);
const normalizePhone = value => {
  let digits = clean(value).replace(/\\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
};
const validObjectId = value => mongoose.Types.ObjectId.isValid(String(value || ""));
const sameDate = (a, b) => {
  if (!a || !b) return false;
  const left = new Date(a), right = new Date(b);
  return !Number.isNaN(left.getTime()) && !Number.isNaN(right.getTime())
    && left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
};
const asDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const registrationIdentity = item => clean(item.registrationId)
  || (clean(item.cleanName) && clean(item.stCode) ? normalizeName(item.cleanName) + "_" + clean(item.stCode) : "");

function hasIdentityAnchor(group, candidate) {
  if (normalizeName(candidate.normalizedFullName || candidate.fullName) !== normalizeName(group.cleanName)) return false;
  const incomingPhones = new Set((group.phones || []).map(value => clean(value).replace(/\D/g, "")).filter(value => value.length === 10));
  const existingPhones = (candidate.phoneNumbers || []).map(value => clean(value).replace(/\D/g, "")).filter(value => value.length === 10);
  const samePhone = existingPhones.some(value => incomingPhones.has(value));
  const sameDob = [group.dob, ...(group.dobs || [])].some(value => sameDate(value, candidate.dob));
  const fatherNames = [...new Set([group.fatherName, ...(group.fatherNames || [])].map(normalizeFather).filter(Boolean))];
  const sameFather = fatherNames.includes(normalizeFather(candidate.fatherName));
  return samePhone || sameDob || sameFather;
}

function registrationSort(a, b) {
  const da = asDate(a.dateOfAdmission)?.getTime() ?? asDate(a.earliestPaymentDate)?.getTime() ?? 0;
  const db = asDate(b.dateOfAdmission)?.getTime() ?? asDate(b.earliestPaymentDate)?.getTime() ?? 0;
  return db - da || String(b.stCode).localeCompare(String(a.stCode));
}

async function syncStudentGroups(groups = []) {
  if (!Array.isArray(groups) || groups.length > 500) throw new Error("Student batch must contain between 1 and 500 profile groups.");
  const allRegistrations = groups.flatMap(group => (group.registrations || []).map(item => ({
    ...item,
    registrationId: registrationIdentity(item),
    cleanName: normalizeName(item.cleanName || group.cleanName),
    stCode: clean(item.stCode)
  }))).filter(item => item.registrationId && item.stCode && item.cleanName);
  const codes = [...new Set(allRegistrations.map(item => item.stCode))];
  const registrationIds = [...new Set(allRegistrations.map(item => item.registrationId))];
  const names = [...new Set(groups.map(group => normalizeName(group.cleanName)).filter(Boolean))];
  const phones = [...new Set(groups.flatMap(group => group.phones || []).map(value => clean(value).replace(/\D/g, "")).filter(value => value.length === 10))];
  const dobs = [...new Set(groups.flatMap(group => [group.dob, ...(group.dobs || [])]).map(value => asDate(value)?.toISOString().slice(0, 10)).filter(Boolean))];
  const fathers = [...new Set(groups.flatMap(group => [group.fatherName, ...(group.fatherNames || [])]).map(normalizeFather).filter(Boolean))];
  const courseCodes = [...new Set(allRegistrations.map(item => normalizeCourseCode(item.course)).filter(Boolean))];
  const courseLookupCodes = [...new Set(courseCodes.flatMap(code => [code, code.replace(/[-_].*$/, "")]))];

  const [existingStudents, existingEnrollments, courseDocuments] = await Promise.all([
    Student.find({ $or: [{ regnNo: { $in: codes } }, { enrollmentNo: { $in: codes } }] }).lean(),
    StudentEnrollment.find({ $or: [{ registrationId: { $in: registrationIds } }, { stCode: { $in: codes } }] }).lean(),
    Course.find({ code: { $in: courseLookupCodes } }).lean()
  ]);
  const existingStudentIds = existingStudents.map(item => item._id);
  const existingEnrollmentMasterIds = [...new Set(existingEnrollments.map(item => String(item.studentId)).filter(validObjectId))]
    .map(id => new mongoose.Types.ObjectId(id));
  const existingMasters = await StudentMaster.find({
    $or: [
      { normalizedFullName: { $in: names } },
      ...(registrationIds.length ? [
        { "registrations.registrationId": { $in: registrationIds } },
        { "enrollments.registrationId": { $in: registrationIds } }
      ] : []),
      ...(existingEnrollmentMasterIds.length ? [{ _id: { $in: existingEnrollmentMasterIds } }] : []),
      ...(phones.length ? [{ phoneNumbers: { $in: phones } }] : []),
      ...(dobs.length ? [{ dob: { $in: dobs.map(value => new Date(value + "T00:00:00.000Z")) } }] : []),
      ...(fathers.length ? [{ normalizedFatherName: { $in: fathers } }] : []),
      ...(existingStudentIds.length ? [{ legacyStudentIds: { $in: existingStudentIds } }] : [])
    ]
  }).lean();

  const studentByCode = new Map();
  for (const student of existingStudents) {
    for (const code of [student.regnNo, student.enrollmentNo]) {
      const key = clean(code).replace(/\.0+$/, "");
      if (key) studentByCode.set(key, [...(studentByCode.get(key) || []), student]);
    }
  }
  const masterByStudentId = new Map();
  for (const master of existingMasters) {
    for (const id of master.legacyStudentIds || []) masterByStudentId.set(String(id), master);
  }
  const courseByCode = new Map(courseDocuments.map(item => [normalizeCourseCode(item.code), item]));
  const enrollmentByRegistration = new Map();
  for (const item of existingEnrollments) {
    const key = String(item.registrationId || (item.stCode ? normalizeName(item.normalizedFullName) + "_" + clean(item.stCode) : ""));
    if (key) enrollmentByRegistration.set(key.toUpperCase(), item);
  }
  const studentOps = [];
  const masterOps = [];
  const activeMasterOps = [];
  const enrollmentOps = [];
  const enrollmentStatusOps = [];
  const outputMap = [];
  const flaggedRows = [];
  const feeRuleCache = new Map();
  let matchedProfiles = 0, newProfiles = 0, registrationsLinked = 0, registrationsSeen = 0;

  for (const group of groups) {
    const registrations = (group.registrations || []).map(item => ({
      ...item,
      registrationId: registrationIdentity(item),
      stCode: clean(item.stCode),
      cleanName: normalizeName(item.cleanName || group.cleanName),
      course: clean(item.course) || "Previous Course (Legacy)",
      dateOfAdmission: asDate(item.dateOfAdmission),
      earliestPaymentDate: asDate(item.earliestPaymentDate),
      formNo: clean(item.formNo)
    })).filter(item => item.registrationId && item.stCode);
    if (!registrations.length) continue;
    registrations.sort(registrationSort);
    const newest = registrations[0];
    const groupRegistrationIds = new Set(registrations.map(item => item.registrationId.toUpperCase()));
    const codeCandidates = [...new Map(registrations.flatMap(item => studentByCode.get(item.stCode) || [])
      .map(student => [String(student._id), student])).values()];
    const existingLegacy = codeCandidates.filter(student => {
      const sourceName = String(student.applicantName || student.name || student.sourceStudentName || "")
        .replace(/_[A-Z0-9-]+$/i, "");
      if (normalizeName(sourceName) !== normalizeName(group.cleanName)) return false;
      const rawSourceName = String(student.sourceStudentName || "");
      const sourceCode = rawSourceName.match(/_([A-Z0-9-]+)$/i)?.[1] || "";
      const sourceRegistrationId = sourceCode ? normalizeName(rawSourceName.replace(/_[A-Z0-9-]+$/i, "")) + "_" + sourceCode : "";
      if (sourceRegistrationId && groupRegistrationIds.has(sourceRegistrationId.toUpperCase())) return true;
      const studentPhones = [student.mobileNumber, student.phone, student.whatsappNumber, student.guardianContactNumber, student.sourcePhone]
        .join(",").split(/[,;/|]/).map(value => clean(value).replace(/\D/g, "")).filter(value => value.length === 10);
      return hasIdentityAnchor(group, {
        fullName: sourceName,
        dob: student.dateOfBirth || student.dob,
        fatherName: student.fatherOrHusbandName || student.fatherName,
        phoneNumbers: studentPhones
      });
    });
    const linkedMasterIds = new Set(existingLegacy.map(item => masterByStudentId.get(String(item._id))).filter(Boolean).map(item => String(item._id)));
    const registrationCandidates = existingMasters.filter(candidate =>
      [...(candidate.registrations || []), ...(candidate.enrollments || [])]
        .some(item => {
          const storedId = item.registrationId || (item.stCode
            ? normalizeName(candidate.normalizedFullName || candidate.fullName) + "_" + clean(item.stCode)
            : "");
          return groupRegistrationIds.has(String(storedId).toUpperCase());
        })
      || existingEnrollments.some(item => String(item.studentId) === String(candidate._id)
        && groupRegistrationIds.has(String(item.registrationId || (item.stCode
          ? normalizeName(item.normalizedFullName) + "_" + clean(item.stCode)
          : "")).toUpperCase()))
    );
    const candidates = registrationCandidates.length
      ? registrationCandidates
      : existingMasters.filter(candidate => hasIdentityAnchor(group, candidate));
    const byLinked = linkedMasterIds.size === 1 ? existingMasters.find(item => String(item._id) === [...linkedMasterIds][0]) : null;
    let master = linkedMasterIds.size > 1 ? null : (byLinked || (candidates.length === 1 ? candidates[0] : null));
    const ambiguous = linkedMasterIds.size > 1 || (!master && candidates.length > 1);
    if (ambiguous) flaggedRows.push({ row: registrations[0]?.rowNo || "", studentId: registrations.map(item => item.registrationId).join(", "), reason: "Multiple existing student profiles matched this name; created a separate profile rather than merging uncertain identities." });
    const masterLinkedLegacy = master ? codeCandidates.filter(student => (master.legacyStudentIds || []).some(id => String(id) === String(student._id))) : [];
    const safeExistingLegacy = ambiguous ? [] : [...new Map([...existingLegacy, ...masterLinkedLegacy].map(item => [String(item._id), item])).values()];
    const codeCollision = codeCandidates.length > safeExistingLegacy.length || registrations.some(item => item.stCodeUnique === false) || linkedMasterIds.size > 1;
    if (codeCollision) flaggedRows.push({ row: registrations[0]?.rowNo || "", studentId: registrations.map(item => item.registrationId).join(", "), reason: "A registration code is reused or the existing record lacks a matching identity anchor. The code-only match was rejected; a separate profile was created." });
    const masterId = master?._id || new mongoose.Types.ObjectId();
    if (master) matchedProfiles += 1;
    else newProfiles += 1;

    let legacyIds = [...new Set([
      ...(master?.legacyStudentIds || []).map(String),
      ...safeExistingLegacy.map(item => String(item._id))
    ])];
    let canonicalStudent = safeExistingLegacy[0] || null;
    if (!canonicalStudent) {
      const newStudentId = new mongoose.Types.ObjectId();
      canonicalStudent = {
        _id: newStudentId,
        formNo: newest.formNo || "",
        regnNo: newest.stCode,
        enrollmentNo: codeCollision ? "" : newest.stCode,
        admissionDate: newest.dateOfAdmission?.toISOString() || "",
        dateOfAdmission: newest.dateOfAdmission?.toISOString() || "",
        applicantName: displayName(group.cleanName),
        name: displayName(group.cleanName),
        sourceStudentName: displayName(group.cleanName) + "_" + newest.stCode,
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
        status: "Registered",
        importSource: "Unified Excel Workbook"
      };
      studentOps.push({ updateOne: { filter: { _id: newStudentId }, update: { $setOnInsert: canonicalStudent }, upsert: true } });
      legacyIds.push(String(newStudentId));
    }
    const existingRegs = new Map();
    for (const item of [...(master?.registrations || []), ...(master?.enrollments || [])]) {
      const id = clean(item.registrationId) || (clean(item.stCode) ? normalizeName(master?.normalizedFullName || master?.fullName || group.cleanName) + "_" + clean(item.stCode) : "");
      if (id && !existingRegs.has(id)) existingRegs.set(id, {
        stCode: clean(item.stCode), registrationId: id, course: clean(item.course || item.courseCode) || "Previous Course (Legacy)",
        dateOfAdmission: asDate(item.dateOfAdmission || item.admissionDate),
        earliestPaymentDate: asDate(item.earliestPaymentDate),
        formNo: clean(item.formNo), isCurrent: false
      });
    }
    for (const item of existingEnrollments) {
      if (String(item.studentId) !== String(masterId)) continue;
      const id = clean(item.registrationId) || (clean(item.stCode) ? normalizeName(group.cleanName) + "_" + clean(item.stCode) : "");
      if (id && !existingRegs.has(id)) existingRegs.set(id, {
        stCode: clean(item.stCode), registrationId: id,
        course: clean(item.courseName || item.courseCode) || "Previous Course (Legacy)",
        dateOfAdmission: asDate(item.admissionDate), earliestPaymentDate: asDate(item.earliestPaymentDate), formNo: clean(item.formNo), isCurrent: false
      });
    }
    for (const item of registrations) {
      if (!existingRegs.has(item.registrationId)) registrationsLinked += 1;
      const prior = existingRegs.get(item.registrationId) || {};
      existingRegs.set(item.registrationId, {
        ...prior, stCode: item.stCode, registrationId: item.registrationId,
        course: item.course || prior.course,
        dateOfAdmission: item.dateOfAdmission || prior.dateOfAdmission,
        earliestPaymentDate: item.earliestPaymentDate || prior.earliestPaymentDate,
        formNo: item.formNo || prior.formNo,
        isCurrent: false
      });
      registrationsSeen += 1;
    }
    const mergedRegistrations = [...existingRegs.values()].sort(registrationSort);
    const current = mergedRegistrations[0] || newest;
    mergedRegistrations.forEach((item, index) => { item.isCurrent = index === 0; });
    const existingCurrent = master?.registrations?.find(item => item.isCurrent)
      || master?.enrollments?.find(item => item.isCurrent);
    const existingCurrentDate = asDate(master?.currentAdmissionDate || master?.dateOfAdmission
      || existingCurrent?.dateOfAdmission || existingCurrent?.earliestPaymentDate);
    const effectiveCurrentDate = asDate(current.dateOfAdmission || current.earliestPaymentDate);
    const shouldPromote = !master || !existingCurrentDate || Boolean(effectiveCurrentDate && effectiveCurrentDate >= existingCurrentDate);
    const currentIncoming = registrations.find(item => item.registrationId === current.registrationId) || current;
    const incomingPhones = [...new Set([...(shouldPromote ? (currentIncoming.phones || []) : []), ...(master?.phoneNumbers || []), ...(group.phones || [])])];
    const masterSet = {
      fullName: master?.fullName || displayName(group.cleanName),
      normalizedFullName: normalizeName(group.cleanName),
      legacyStudentIds: legacyIds.map(id => validObjectId(id) ? new mongoose.Types.ObjectId(id) : id),
      stCodes: [...new Set([...(master?.stCodes || []), ...mergedRegistrations.map(item => item.stCode)].filter(Boolean))],
      registrations: mergedRegistrations,
      enrollments: mergedRegistrations,
      phoneNumbers: incomingPhones,
      normalizedFatherName: master?.normalizedFatherName || normalizeFather(group.fatherName || newest.fatherName),
      identityMatchMethod: master?.identityMatchMethod || (ambiguous ? "AMBIGUOUS_NEW_PROFILE" : "WORKBOOK_IDENTITY"),
      ...(ambiguous ? { identityWarnings: [...new Set([...(master?.identityWarnings || []), "Multiple possible existing profiles; imported history was not merged automatically."])] } : {})
    };
    if (!master?.dob && asDate(group.dob)) masterSet.dob = asDate(group.dob);
    if (!master?.fatherName && (group.fatherName || newest.fatherName)) masterSet.fatherName = group.fatherName || newest.fatherName;
    if (!master?.gender && newest.sex) masterSet.gender = newest.sex;
    if (shouldPromote) {
      masterSet.currentStCode = current.stCode;
      masterSet.currentRegistrationId = current.registrationId;
      masterSet.currentCourse = current.course;
      masterSet.currentAdmissionDate = current.dateOfAdmission || null;
      masterSet.dateOfAdmission = current.dateOfAdmission || null;
      masterSet.formNo = current.formNo || master?.formNo || "";
      masterSet.address = master?.address || currentIncoming.address || "";
      masterSet.qualification = master?.qualification || currentIncoming.qualification || "";
    } else {
      for (const [key, value] of [["address", currentIncoming.address], ["qualification", currentIncoming.qualification]]) {
        if (!master?.[key] && value) masterSet[key] = value;
      }
    }
    masterOps.push({ updateOne: { filter: { _id: masterId }, update: { $set: masterSet, $setOnInsert: { photoUrl: "", hasPhoto: false } }, upsert: true } });

    let currentEnrollmentId = null;
    for (const registration of registrations) {
      const courseCode = registration.course === "Previous Course (Legacy)" ? "PREVIOUS-LEGACY" : registration.course.toUpperCase();
      const existingEnrollment = enrollmentByRegistration.get(registration.registrationId.toUpperCase())
        || existingEnrollments.find(item => String(item.studentId) === String(masterId)
          && String(item.stCode || "") === registration.stCode
          && normalizeName(item.normalizedFullName) === normalizeName(group.cleanName)
          && (String(item.courseCode || "").toUpperCase() === courseCode || !item.courseCode || String(item.courseCode).toUpperCase() === "LEGACY"));
      const enrollmentId = existingEnrollment?._id || new mongoose.Types.ObjectId();
      if (registration.registrationId === current.registrationId) currentEnrollmentId = enrollmentId;
      const courseRuleKey = normalizeCourseCode(courseCode);
      if (!feeRuleCache.has(courseRuleKey)) {
        const baseCode = courseRuleKey.replace(/[-_].*$/, "");
        feeRuleCache.set(courseRuleKey, resolveCourseFeeConfigFromDocument(
          courseRuleKey, courseByCode.get(courseRuleKey) || courseByCode.get(baseCode) || null
        ));
      }
      const courseRule = feeRuleCache.get(courseRuleKey);
      const enrollmentSet = {
        studentId: masterId,
        legacyStudentId: canonicalStudent?._id || null,
        stCode: registration.stCode,
        registrationId: registration.registrationId,
        normalizedFullName: normalizeName(group.cleanName),
        formNo: registration.formNo || "",
        courseCode,
        courseName: registration.course,
        admissionDate: registration.dateOfAdmission,
        earliestPaymentDate: registration.earliestPaymentDate || null,
        status: registration.registrationId === current.registrationId ? "ACTIVE" : (courseCode === "PREVIOUS-LEGACY" ? "LEGACY" : "PROMOTED"),
        courseCategory: courseRule.courseCategory || "OTHER",
        semesterLabel: courseRule.semesterLabel || registration.course,
        feeConfig: courseRule.feeConfig,
        installments: courseRule.feeConfig?.configured ? buildInstallments({
          courseCode,
          admissionDate: registration.dateOfAdmission || new Date(),
          feeConfig: courseRule.feeConfig,
          semesterLabel: courseRule.semesterLabel || registration.course
        }) : [],
        summary: {
          totalFee: Number(courseRule.feeConfig?.grossFee || 0),
          totalDue: Number(courseRule.feeConfig?.netPayableFee || 0),
          totalPaid: 0,
          balanceDue: Number(courseRule.feeConfig?.netPayableFee || 0),
          feeStatus: "Unpaid"
        }
      };
      if (!existingEnrollment) {
        enrollmentOps.push({ updateOne: { filter: { _id: enrollmentId }, update: { $setOnInsert: enrollmentSet }, upsert: true } });
      } else {
        const patch = {};
        if (existingEnrollment.courseName !== registration.course) patch.courseName = registration.course;
        if (!existingEnrollment.registrationId) patch.registrationId = registration.registrationId;
        if (existingEnrollment.courseCode !== courseCode && (existingEnrollment.registrationId === registration.registrationId || !existingEnrollment.courseCode || String(existingEnrollment.courseCode).toUpperCase() === "LEGACY")) patch.courseCode = courseCode;
        if (existingEnrollment.feeConfig?.configured === false && courseRule.feeConfig?.configured) patch.feeConfig = courseRule.feeConfig;
        if (!existingEnrollment.semesterLabel && registration.course) patch.semesterLabel = registration.course;
        if (!existingEnrollment.formNo && registration.formNo) patch.formNo = registration.formNo;
        if (!existingEnrollment.admissionDate && registration.dateOfAdmission) patch.admissionDate = registration.dateOfAdmission;
        if (!existingEnrollment.earliestPaymentDate && registration.earliestPaymentDate) patch.earliestPaymentDate = registration.earliestPaymentDate;
        if (Object.keys(patch).length) enrollmentOps.push({ updateOne: { filter: { _id: existingEnrollment._id }, update: { $set: patch } } });
      }
      outputMap.push({ registrationId: registration.registrationId, stCode: registration.stCode, studentId: masterId.toString(), enrollmentId: enrollmentId.toString(), course: registration.course });
    }
    if (currentEnrollmentId) {
      activeMasterOps.push({ updateOne: { filter: { _id: masterId }, update: { $set: { activeEnrollmentId: currentEnrollmentId } } } });
      enrollmentStatusOps.push({ updateMany: {
        filter: { studentId: masterId, status: "ACTIVE", _id: { $ne: currentEnrollmentId } },
        update: { $set: { status: "PROMOTED" } }
      }});
      enrollmentStatusOps.push({ updateOne: {
        filter: { _id: currentEnrollmentId },
        update: { $set: { status: "ACTIVE" } }
      }});
    }
  }

  if (studentOps.length) await Student.bulkWrite(studentOps, { ordered: false });
  if (masterOps.length) await StudentMaster.bulkWrite(masterOps, { ordered: false });
  if (activeMasterOps.length) await StudentMaster.bulkWrite(activeMasterOps, { ordered: false });
  for (let index = 0; index < enrollmentOps.length; index += 500) {
    await StudentEnrollment.bulkWrite(enrollmentOps.slice(index, index + 500), { ordered: false });
  }
  if (enrollmentStatusOps.length) await StudentEnrollment.bulkWrite(enrollmentStatusOps, { ordered: false });
  return { studentsMatchedUpdated: matchedProfiles, newStudentsCreated: newProfiles, registrationsLinked, registrationsSeen, registrationMap: outputMap, flaggedRows };
}

async function syncFeeRows(rows = []) {
  if (!Array.isArray(rows) || rows.length > 1000) throw new Error("Fee batch must contain between 1 and 1,000 rows.");
  await ensureReceiptIndex();
  const ids = [...new Set(rows.map(item => clean(item.registrationId)).filter(Boolean))];
  const enrollments = await StudentEnrollment.find({ registrationId: { $in: ids } }).lean();
  const enrollmentById = new Map(enrollments.map(item => [String(item.registrationId), item]));
  const codes = [...new Set(rows.map(item => clean(item.stCode)).filter(Boolean))];
  const registrationsByCode = new Map();
  for (const row of rows) {
    const code = clean(row.stCode);
    const id = clean(row.registrationId);
    if (code && id) registrationsByCode.set(code, new Set([...(registrationsByCode.get(code) || []), id]));
  }
  const existing = await StudentFeePayment.find({ $or: [{ registrationId: { $in: ids } }, { stCode: { $in: codes } }] })
    .select("registrationId stNameKey stCode mrNo paymentDate amountPaid studentId enrollmentId courseCode").lean();
  const existingByKey = new Map();
  const existingByLooseKey = new Map();
  for (const item of existing) {
    const dateKey = asDate(item.paymentDate)?.toISOString().slice(0, 10) || "";
    const amountKey = Number(item.amountPaid).toFixed(2);
    const codeRegistrations = registrationsByCode.get(String(item.stCode || ""));
    const identity = String(item.registrationId || item.stNameKey || (codeRegistrations?.size === 1 ? [...codeRegistrations][0] : "")).toUpperCase();
    if (identity) existingByKey.set([identity, item.mrNo, dateKey, amountKey].join("|"), item);
    const looseKey = [String(item.stCode || ""), item.mrNo, dateKey, amountKey].join("|");
    if (!existingByLooseKey.has(looseKey)) existingByLooseKey.set(looseKey, item);
  }
  const operations = [];
  const unmatchedRows = [];
  let newReceiptsAdded = 0, existingReceiptsUpdatedOrSkipped = 0;
  const seenInBatch = new Set();
  for (const row of rows) {
    const registrationId = clean(row.registrationId);
    const enrollment = enrollmentById.get(registrationId);
    const paymentDate = asDate(row.paymentDate);
    const amountPaid = Number(row.amountPaid);
    const mrNo = clean(row.mrNo);
    if (!registrationId || !enrollment || !paymentDate || !mrNo || !Number.isFinite(amountPaid) || amountPaid < 0) {
      unmatchedRows.push({ row: row.rowNo, sheet: row.sourceSheet || "", studentId: registrationId || row.stCode || "", stCode: row.stCode || "", name: row.cleanName || "", course: row.course || "", mrNo, paymentDate: row.paymentDate || "", amountPaid: row.amountPaid ?? "", reason: !enrollment ? "No matching registration/enrollment was found." : "Missing or invalid receipt number, date, or amount." });
      continue;
    }
    const key = [registrationId, mrNo, paymentDate.toISOString().slice(0, 10), amountPaid.toFixed(2)].join("|");
    const priorReceipt = existingByKey.get(key);
    if (priorReceipt) {
      const courseCode = clean(enrollment.courseCode || row.course).toUpperCase();
      const repair = {};
      if (!priorReceipt.registrationId) repair.registrationId = registrationId;
      if (!priorReceipt.stNameKey) repair.stNameKey = registrationId;
      if (!priorReceipt.studentId || String(priorReceipt.studentId) !== String(enrollment.studentId)) repair.studentId = enrollment.studentId;
      if (!priorReceipt.enrollmentId || String(priorReceipt.enrollmentId) !== String(enrollment._id)) repair.enrollmentId = enrollment._id;
      if (!priorReceipt.courseCode) repair.courseCode = courseCode;
      if (!priorReceipt.stCode) repair.stCode = enrollment.stCode;
      if (Object.keys(repair).length) operations.push({ updateOne: { filter: { _id: priorReceipt._id }, update: { $set: repair } } });
      existingReceiptsUpdatedOrSkipped += 1;
      continue;
    }
    const looseKey = [clean(row.stCode), mrNo, paymentDate.toISOString().slice(0, 10), amountPaid.toFixed(2)].join("|");
    if (existingByLooseKey.has(looseKey) && (registrationsByCode.get(clean(row.stCode))?.size || 0) > 1) {
      unmatchedRows.push({ row: row.rowNo, sheet: row.sourceSheet || "", studentId: registrationId, stCode: row.stCode || "", name: row.cleanName || "", course: row.course || "", mrNo, paymentDate, amountPaid, reason: "An existing receipt has this reused St_Code but no registration identity; it was not reassigned to avoid cross-student payment mixing." });
      continue;
    }
    if (seenInBatch.has(key)) {
      existingReceiptsUpdatedOrSkipped += 1;
      continue;
    }
    seenInBatch.add(key);
    const courseCode = clean(enrollment.courseCode || row.course).toUpperCase();
    operations.push({ updateOne: {
      filter: { registrationId, mrNo, paymentDate, amountPaid },
      update: {
        $set: { studentId: enrollment.studentId, enrollmentId: enrollment._id, stCode: enrollment.stCode, registrationId, courseCode },
        $setOnInsert: { mrNo, paymentDate, amountPaid, rawPaymentDate: paymentDate, sourceSheet: clean(row.sourceSheet), sourceRowNo: Number(row.rowNo || 0), importBatchKey: "UNIFIED_WORKBOOK_IMPORT", stNameKey: registrationId, allocations: [], importWarnings: [] }
      },
      upsert: true
    }});
    newReceiptsAdded += 1;
  }
  for (let index = 0; index < operations.length; index += 1000) {
    try {
      await StudentFeePayment.bulkWrite(operations.slice(index, index + 1000), { ordered: false });
    } catch (error) {
      if (!error.writeErrors?.length && error.code !== 11000) throw error;
      const writeErrors = error.writeErrors || [];
      if (writeErrors.some(item => item.code !== 11000)) throw error;
      existingReceiptsUpdatedOrSkipped += writeErrors.length;
      newReceiptsAdded = Math.max(0, newReceiptsAdded - writeErrors.length);
    }
  }
  return { newReceiptsAdded, existingReceiptsUpdatedOrSkipped, unmatchedRows, feeRowsProcessed: rows.length };
}

async function finalizeFeeSummaries(rawStudentIds = []) {
  const studentIds = [...new Set(rawStudentIds.filter(validObjectId).map(id => String(id)))];
  if (!studentIds.length || studentIds.length > 500) throw new Error("Finalize batch must contain between 1 and 500 student IDs.");
  const objectIds = studentIds.map(id => new mongoose.Types.ObjectId(id));
  const enrollments = await StudentEnrollment.find({ studentId: { $in: objectIds } }).lean();
  if (!enrollments.length) return { studentsFinalized: 0, enrollmentsFinalized: 0 };
  const enrollmentIds = enrollments.map(item => item._id);
  const paymentTotals = await StudentFeePayment.aggregate([
    { $match: { enrollmentId: { $in: enrollmentIds } } },
    { $group: { _id: "$enrollmentId", totalPaid: { $sum: "$amountPaid" } } }
  ]);
  const paidByEnrollment = new Map(paymentTotals.map(item => [String(item._id), Number(item.totalPaid || 0)]));
  const enrollmentOps = [];
  const masterTotals = new Map();
  for (const enrollment of enrollments) {
    const totalFee = Number(enrollment.feeConfig?.grossFee || enrollment.summary?.totalFee || 0);
    const totalDue = Number(enrollment.feeConfig?.netPayableFee ?? enrollment.summary?.totalDue ?? 0);
    const totalPaid = paidByEnrollment.get(String(enrollment._id)) || 0;
    const balanceDue = Math.max(0, totalDue - totalPaid);
    const feeStatus = totalDue > 0 && balanceDue === 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Unpaid";
    enrollmentOps.push({ updateOne: {
      filter: { _id: enrollment._id },
      update: { $set: { summary: {
        ...(enrollment.summary || {}),
        totalFee, totalDue, totalPaid, balanceDue,
        nextDueDate: enrollment.summary?.nextDueDate || null,
        feeStatus
      } } }
    }});
    const key = String(enrollment.studentId);
    const total = masterTotals.get(key) || { totalFee: 0, discount: 0, totalPaid: 0, balanceDue: 0, courseCount: 0, hasConfiguredFee: false };
    total.totalFee += totalFee;
    total.discount += Number(enrollment.feeConfig?.discountAmount || 0);
    total.totalPaid += totalPaid;
    total.balanceDue += balanceDue;
    total.courseCount += 1;
    total.hasConfiguredFee ||= Boolean(enrollment.feeConfig) && enrollment.feeConfig.configured !== false && enrollment.feeConfig.feeRuleSource !== "UNCONFIGURED" && String(enrollment.courseCode || "").toUpperCase() !== "PREVIOUS-LEGACY";
    masterTotals.set(key, total);
  }
  for (let index = 0; index < enrollmentOps.length; index += 500) {
    await StudentEnrollment.bulkWrite(enrollmentOps.slice(index, index + 500), { ordered: false });
  }
  const masterOps = [...masterTotals.entries()].map(([id, total]) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(id) },
      update: { $set: { feeSummary: {
        totalFee: total.totalFee,
        discount: total.discount,
        totalPaid: total.totalPaid,
        balanceDue: total.balanceDue,
        feeStatus: total.hasConfiguredFee && total.balanceDue === 0 ? "Paid" : total.totalPaid > 0 ? "Partial" : "Unpaid",
        courseCount: total.courseCount,
        updatedAt: new Date()
      } } }
    }
  }));
  if (masterOps.length) await StudentMaster.bulkWrite(masterOps, { ordered: false });
  return { studentsFinalized: masterOps.length, enrollmentsFinalized: enrollmentOps.length };
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
    if (body.action === "students") {
      const result = await syncStudentGroups(body.groups || []);
      return NextResponse.json(result);
    }
    if (body.action === "fees") {
      const result = await syncFeeRows(body.rows || []);
      return NextResponse.json(result);
    }
    if (body.action === "finalize") {
      const result = await finalizeFeeSummaries(body.studentIds || []);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unsupported import batch action." }, { status: 400 });
  } catch (error) {
    console.error("[unified-student-import]", error);
    return NextResponse.json({ error: "Unified workbook batch failed.", detail: error.message }, { status: 500 });
  }
}
