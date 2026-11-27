import mongoose from "mongoose";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import Course from "@/models/Course";
import { normalizeHeader, normalizeName, normalizeStCode, normalizeReceiptNo, parseMoney, parseExcelDate, parsePhones } from "./normalization";
import { resolveCourseFeeConfig, normalizeCourseCode } from "./course-fee-rules";
import { buildInstallments } from "./fee-allocation";

function getStudentModel() {
  if (mongoose.models.Student) return mongoose.models.Student;
  const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  return mongoose.model("Student", StudentSchema);
}
const clean = value => String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ").trim();
const safeDate = value => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; };
const dateKey = value => safeDate(value)?.toISOString().slice(0, 10) || "";


export function parsePaymentWorksheet(workbook) {
  const aliases = {
    stcode: ["stcode", "studentcode", "registrationcode", "regnno", "enrollmentno"],
    stname: ["stname", "studentname", "name"],
    stnamecr: ["stnamecr", "studentnamecr"],
    amtpaid: ["amtpaid", "amountpaid", "paidamount", "paymentamount", "amount"],
    mrno: ["mrno", "receiptno", "receiptnumber", "mrnumber", "receipt"],
    dop: ["dop", "dateofpayment", "paymentdate", "date"],
    course: ["course", "coursename", "coursecode"]
  };
  const columnIndex = (headers, key) => (aliases[key] || [key]).map(alias => headers.indexOf(alias)).find(index => index >= 0) ?? -1;
  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: true });
    const headerIndex = grid.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return ["amtpaid", "mrno", "dop"].every(key => columnIndex(headers, key) >= 0)
        && ["stcode", "stname", "stnamecr"].some(key => columnIndex(headers, key) >= 0);
    });
    if (headerIndex < 0) continue;
    const headers = grid[headerIndex].map(normalizeHeader);
    const at = key => columnIndex(headers, key);
    for (const merge of sheet["!merges"] || []) {
      if (merge.s.c !== merge.e.c || merge.s.r <= headerIndex || merge.e.r <= merge.s.r) continue;
      const value = grid[merge.s.r]?.[merge.s.c] ?? "";
      for (let rowIndex = merge.s.r + 1; rowIndex <= merge.e.r; rowIndex += 1) {
        const row = grid[rowIndex] || (grid[rowIndex] = []);
        if (row[merge.s.c] === "" || row[merge.s.c] === undefined) row[merge.s.c] = value;
      }
    }
    const rows = [];
    for (let index = headerIndex + 1; index < grid.length; index += 1) {
      const values = grid[index] || [];
      if (!values.some(value => clean(value))) continue;
      const get = key => at(key) >= 0 ? values[at(key)] : "";
      const stCode = normalizeStCode(get("stcode"));
      const name = normalizeName(get("stname"));
      const creditName = normalizeName(get("stnamecr"));
      const paymentDate = parseExcelDate(get("dop"));
      const amountPaid = parseMoney(get("amtpaid"));
      const mrNo = normalizeReceiptNo(get("mrno"));
      rows.push({
        stCode, sourceStCode: clean(get("stcode")), name, creditName,
        course: clean(get("course")), amountPaid, mrNo,
        paymentDate, rawPaymentDate: get("dop"), rawAmount: get("amtpaid"),
        sourceSheet: sheetName, sourceRowNo: index + 1,
        validAmount: Number.isFinite(amountPaid) && amountPaid >= 0,
        valid: Boolean((stCode || name || creditName) && paymentDate && mrNo && Number.isFinite(amountPaid) && amountPaid >= 0)
      });
    }
    return { sheetName, rows };
  }
  return { sheetName: "", rows: [] };
}

function phoneList(student) {
  return parsePhones([student.mobileNumber, student.guardianContactNumber, student.whatsappNumber, student.sourcePhone].filter(Boolean).join(","));
}

function chooseUniqueLegacyStudent(candidates = []) {
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) return null;
  const names = new Set(candidates.map(candidate =>
    normalizeName(candidate.applicantName || candidate.sourceStudentName || candidate.name)
  ).filter(Boolean));
  if (names.size !== 1) return null;
  return [...candidates].sort((left, right) => {
    const leftHasCode = normalizeStCode(left.normalizedStCode || left.regnNo || left.enrollmentNo) ? 1 : 0;
    const rightHasCode = normalizeStCode(right.normalizedStCode || right.regnNo || right.enrollmentNo) ? 1 : 0;
    return rightHasCode - leftHasCode
      || new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
  })[0];
}

async function createMasterFromStudent(student, warning = "") {
  const fullName = student.applicantName || student.sourceStudentName || "UNIDENTIFIED STUDENT " + String(student._id);
  const identityWarnings = [...new Set([...(student.identityWarnings || []), warning].filter(Boolean))];
  return StudentMaster.create({
    fullName,
    normalizedFullName: normalizeName(fullName),
    dob: safeDate(student.dateOfBirth),
    gender: ["M", "F", "Other"].includes(student.sex) ? student.sex : "Other",
    fatherName: student.fatherOrHusbandName || "",
    normalizedFatherName: normalizeName(student.fatherOrHusbandName),
    address: student.address || "",
    photoUrl: student.photoUrl || "",
    phoneNumbers: phoneList(student),
    qualification: student.sourceQualification || "",
    legacyStudentIds: [student._id],
    stCodes: normalizeStCode(student.regnNo || student.enrollmentNo) ? [normalizeStCode(student.regnNo || student.enrollmentNo)] : [],
    normalizedStCodes: normalizeStCode(student.regnNo || student.enrollmentNo) ? [normalizeStCode(student.regnNo || student.enrollmentNo)] : [],
    identityMatchMethod: identityWarnings.length ? "AMBIGUOUS_NEW_PROFILE" : "LEGACY_IMPORT",
    identityWarnings,
  });
}

async function getOrCreateMaster(student) {
  const stCode = normalizeStCode(student.normalizedStCode || student.regnNo || student.enrollmentNo);
  if (!stCode) return null;
  let master = await StudentMaster.findOne({
    legacyStudentIds: student._id, mergedIntoMasterId: null, isMerged: { $ne: true }
  });
  if (master) {
    const linkedCodes = new Set([
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode),
      ...(master.enrollments || []).map(item => item.stCode)
    ].map(normalizeStCode).filter(Boolean));
    if (linkedCodes.size && !linkedCodes.has(stCode)) return null;
  }
  if (!master) {
    const variants = [stCode];
    if (/^\d+$/.test(stCode)) {
      for (let zeroes = 1; zeroes <= 8; zeroes += 1) variants.push("0".repeat(zeroes) + stCode);
      variants.push(new RegExp("^\\s*0*" + stCode.split("").join("\\s*") + "(?:\\.0+)?\\s*$", "i"));
    }
    const candidates = await StudentMaster.find({
      mergedIntoMasterId: null, isMerged: { $ne: true },
      $or: [
        { normalizedStCodes: stCode }, { studentCodes: { $in: variants } },
        { stCodes: { $in: variants } }, { primaryStCode: { $in: variants } },
        { currentStCode: { $in: variants } }
      ]
    }).select("_id").lean();
    if (candidates.length > 1) return null;
    if (candidates.length === 1) master = await StudentMaster.findById(candidates[0]._id);
  }
  if (!master) master = await createMasterFromStudent(student);
  if (!master) return null;
  const incomingName = String(student.applicantName || student.sourceStudentName || student.name || "").trim();
  const normalizedName = normalizeName(incomingName);
  const currentCodes = new Set([
    ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
    master.primaryStCode, master.currentStCode
  ].map(normalizeStCode).filter(Boolean));
  const hasOtherCodes = [...currentCodes].some(code => code !== stCode);
  master.legacyStudentIds = [...new Set([...(master.legacyStudentIds || []).map(String), String(student._id)])];
  master.stCodes = [...new Set([...(master.stCodes || []), stCode])];
  master.studentCodes = [...new Set([...(master.studentCodes || []), stCode])];
  master.normalizedStCodes = [...new Set([...(master.normalizedStCodes || []), stCode])];
  if (!master.primaryStCode) master.primaryStCode = stCode;
  if (!master.currentStCode) master.currentStCode = stCode;
  if (!hasOtherCodes && incomingName) {
    master.fullName = incomingName;
    master.normalizedFullName = normalizedName;
  } else if (!master.fullName && incomingName) {
    master.fullName = incomingName;
    master.normalizedFullName = normalizedName;
  }
  if (incomingName) master.alternateNames = [...new Set([...(master.alternateNames || []), incomingName])];
  const phones = splitPhones(student.phone || student.mobile || student.contactNo);
  if (phones.length) master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...phones])];
  master.identityMatchMethod = "ST_CODE";
  master.identityWarnings = [];
  await master.save();
  return master;
}

async function findOrCreateEnrollment(master, student, stCode, name, forceLegacy = false, setActive = false) {
  const normalizedFullName = normalizeName(name || student.applicantName || student.sourceStudentName);
  const importedCourseCode = forceLegacy ? "LEGACY / PRE-2025"
    : String(student.sourceCourseLabel || student.courseCode || student.course || "LEGACY").trim().toUpperCase();
  const admissionDateForLookup = safeDate(student.admissionDate || student.dateOfAdmission);
  const stCodeVariants = [stCode];
  if (/^\d+$/.test(stCode)) {
    for (let zeroes = 1; zeroes <= 8; zeroes += 1) stCodeVariants.push("0".repeat(zeroes) + stCode);
    stCodeVariants.push(new RegExp("^\\s*0*" + stCode.split("").join("\\s*") + "(?:\\.0+)?\\s*$", "i"));
  }
  let enrollment = await StudentEnrollment.findOne({
    studentId: master._id, courseCode: importedCourseCode,
    admissionDate: admissionDateForLookup,
    $or: [{ normalizedStCode: stCode }, { stCode: { $in: stCodeVariants } }]
  });
  if (enrollment) {
    if (!enrollment.normalizedStCode) enrollment.normalizedStCode = stCode;
    if (normalizedFullName) enrollment.normalizedFullName = normalizedFullName;
    // A previous cleanup pass may have created a placeholder enrollment before
    // the workbook course/fee rules were available. Enrich it without overwriting
    // an already configured fee plan.
    if (!forceLegacy && !enrollment.feeConfig?.configured) {
      const rawCourseCode = String(student.sourceCourseLabel || student.courseCode || "LEGACY").trim().toUpperCase();
      const resolved = rawCourseCode !== "LEGACY" ? await resolveCourseFeeConfig(rawCourseCode, Course) : null;
      if (resolved?.feeConfig?.configured) {
        enrollment.courseCode = String(student.courseCode || rawCourseCode).trim().toUpperCase();
        enrollment.courseCategory = resolved.courseCategory;
        enrollment.semesterLabel = resolved.semesterLabel || enrollment.semesterLabel;
        enrollment.feeConfig = resolved.feeConfig;
        if (!enrollment.installments?.length) {
          enrollment.installments = buildInstallments({
            courseCode: rawCourseCode,
            admissionDate: safeDate(student.admissionDate),
            feeConfig: resolved.feeConfig,
            semesterLabel: resolved.semesterLabel,
          });
        }
      }
    }
    if (!master.stCodes.includes(stCode)) master.stCodes.push(stCode);
    if (setActive) {
      await StudentEnrollment.updateMany({ studentId: master._id, normalizedStCode: stCode, status: "ACTIVE", _id: { $ne: enrollment._id } }, { $set: { status: "PROMOTED" } });
      enrollment.status = "ACTIVE";
      master.activeEnrollmentId = enrollment._id;
    }
    await enrollment.save();
    await master.save();
    return enrollment;
  }
  const inheritedEnrollment = forceLegacy
    ? await StudentEnrollment.findOne({ studentId: master._id, normalizedStCode: stCode, courseCode: { $ne: "LEGACY" } }).sort({ admissionDate: -1, createdAt: -1 }).lean()
    : null;
  const rawCourseCode = String(
    (student.sourceCourseLabel && String(student.sourceCourseLabel).toUpperCase() !== "LEGACY" ? student.sourceCourseLabel : "")
    || student.courseCode || inheritedEnrollment?.courseCode || "LEGACY"
  ).trim().toUpperCase();
  const courseCode = String(student.courseCode && student.courseCode !== "LEGACY"
    ? student.courseCode : inheritedEnrollment?.courseCode || rawCourseCode || "LEGACY").trim().toUpperCase();
  const resolved = inheritedEnrollment && forceLegacy
    ? {
        courseCategory: inheritedEnrollment.courseCategory || "OTHER",
        semesterLabel: "LEGACY - " + (inheritedEnrollment.semesterLabel || inheritedEnrollment.courseCode),
        feeConfig: inheritedEnrollment.feeConfig || { feeRuleSource: "INHERITED_ENROLLMENT", configured: false, grossFee: 0, netPayableFee: 0 }
      }
    : rawCourseCode !== "LEGACY" ? await resolveCourseFeeConfig(rawCourseCode, Course) : {
        courseCategory: "OTHER", semesterLabel: "LEGACY",
        feeConfig: { feeRuleSource: "UNCONFIGURED", configured: false, grossFee: 0, netPayableFee: 0 }
      };
  const admissionDate = safeDate(student.admissionDate) || inheritedEnrollment?.admissionDate || null;
  const installments = inheritedEnrollment && forceLegacy
    ? (inheritedEnrollment.installments || []).map(item => ({
        ...(typeof item.toObject === "function" ? item.toObject() : item),
        amountPaid: 0, status: Number(item.amountDue || 0) === 0 ? "WAIVED" : "PENDING", receiptRefs: [],
      }))
    : resolved.feeConfig.configured
      ? buildInstallments({ courseCode: rawCourseCode, admissionDate: admissionDate || new Date(), feeConfig: resolved.feeConfig, semesterLabel: resolved.semesterLabel })
      : [];
  if (setActive || !forceLegacy) {
    await StudentEnrollment.updateMany({ studentId: master._id, normalizedStCode: stCode, status: "ACTIVE" }, { $set: { status: "PROMOTED" } });
  }
  enrollment = await StudentEnrollment.create({
    studentId: master._id, legacyStudentId: student._id, stCode, normalizedStCode: stCode, normalizedFullName,
    formNo: student.formNo || "", courseCode, courseCategory: resolved.courseCategory,
    semesterLabel: resolved.semesterLabel || rawCourseCode,
    admissionDate, status: forceLegacy && !setActive ? "LEGACY" : "ACTIVE",
    feeConfig: resolved.feeConfig,
    installments,
  });
  if (!forceLegacy || setActive) master.activeEnrollmentId = enrollment._id;
  if (!master.stCodes.includes(stCode)) master.stCodes.push(stCode);
  await master.save();
  return enrollment;
}

async function consolidateDuplicateEnrollments() {
  const duplicateGroups = await StudentEnrollment.aggregate([
    { $match: { mergedIntoEnrollmentId: null, normalizedStCode: { $type: "string", $gt: "" } } },
    { $group: {
      _id: {
        studentId: "$studentId",
        normalizedStCode: "$normalizedStCode",
        courseCode: "$courseCode",
        admissionDate: "$admissionDate"
      },
      count: { $sum: 1 },
      ids: { $push: "$_id" }
    } },
    { $match: { count: { $gt: 1 } } }
  ]);
  let mergedGroups = 0, receiptsRelinked = 0;
  for (const group of duplicateGroups) {
    const records = await StudentEnrollment.find({ _id: { $in: group.ids }, mergedIntoEnrollmentId: null }).sort({ createdAt: 1 }).lean();
    const ranked = [...records].sort((left, right) =>
      Number(Boolean(right.feeConfig?.configured)) - Number(Boolean(left.feeConfig?.configured))
      || (right.installments?.length || 0) - (left.installments?.length || 0)
      || new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
    );
    const canonical = ranked[0];
    for (const duplicate of ranked.slice(1)) {
      const receipts = await StudentFeePayment.find({ studentId: canonical.studentId, enrollmentId: duplicate._id }).select("_id").lean();
      if (receipts.length) {
        const operations = receipts.map(receipt => ({
          updateOne: {
            filter: { _id: receipt._id },
            update: { $set: { studentId: canonical.studentId, masterStudentId: canonical.studentId, enrollmentId: canonical._id } }
          }
        }));
        await StudentFeePayment.bulkWrite(operations, { ordered: false });
        receiptsRelinked += receipts.length;
      }
      const activeMaster = await StudentMaster.findOne({ activeEnrollmentId: duplicate._id }).select("_id").lean();
      if (activeMaster) await StudentMaster.updateOne(
        { _id: activeMaster._id },
        { $set: { activeEnrollmentId: canonical._id } }
      );
      // Keep the historical enrollment document. It is hidden from active lookups by its merge pointer.
      await StudentEnrollment.updateOne(
        { _id: duplicate._id },
        { $set: { mergedIntoEnrollmentId: canonical._id, status: "MERGED" } }
      );
      mergedGroups += 1;
    }
  }
  return { mergedGroups, receiptsRelinked };
}

let paymentIndexMigration;
async function ensurePaymentIndexes() {
  if (!paymentIndexMigration) {
    paymentIndexMigration = (async () => {
      const indexes = await StudentFeePayment.collection.indexes().catch(error => {
        if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
        throw error;
      });
      const oldReceipts = await StudentFeePayment.find({
        mrNo: { $exists: true, $nin: [null, ""] },
        $or: [{ stCode: { $exists: true, $nin: [null, ""] } }, { normalizedStCode: { $exists: true, $nin: [null, ""] } }]
      }).select("_id stCode normalizedStCode mrNo normalizedMrNo").lean();
      const normalizedOps = oldReceipts.flatMap(item => {
        const normalizedStCode = normalizeStCode(item.stCode || item.normalizedStCode);
        const normalizedMrNo = normalizeReceiptNo(item.mrNo || item.normalizedMrNo);
        const set = {};
        if (normalizedStCode && normalizedStCode !== item.normalizedStCode) set.normalizedStCode = normalizedStCode;
        if (normalizedMrNo && normalizedMrNo !== item.normalizedMrNo) set.normalizedMrNo = normalizedMrNo;
        return Object.keys(set).length ? [{ updateOne: { filter: { _id: item._id }, update: { $set: set } } }] : [];
      });
      for (let offset = 0; offset < normalizedOps.length; offset += 500) await StudentFeePayment.bulkWrite(normalizedOps.slice(offset, offset + 500), { ordered: false });
      if (!indexes.some(index => index.name === "student_fee_source_row_unique")) {
        const duplicateSourceKeys = await StudentFeePayment.collection.aggregate([
          { $match: { sourceRowKey: { $type: "string", $gt: "" } } },
          { $group: { _id: "$sourceRowKey", count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } }, { $limit: 1 }
        ]).toArray();
        if (!duplicateSourceKeys.length) await StudentFeePayment.collection.createIndex(
          { sourceRowKey: 1 }, {
            unique: true, name: "student_fee_source_row_unique",
            partialFilterExpression: { sourceRowKey: { $type: "string", $gt: "" } }
          }
        );
      }
      let current = await StudentFeePayment.collection.indexes().catch(() => []);
      const expectedKey = { normalizedStCode: 1, normalizedMrNo: 1, paymentDate: 1 };
      const existingIndex = current.find(index => index.name === "normalized_stcode_receipt_date_unique");
      if (existingIndex && JSON.stringify(existingIndex.key) !== JSON.stringify(expectedKey)) {
        await StudentFeePayment.collection.dropIndex("normalized_stcode_receipt_date_unique");
        current = await StudentFeePayment.collection.indexes().catch(() => []);
      }
      if (!current.some(index => index.name === "normalized_stcode_receipt_date_unique")) {
        const duplicates = await StudentFeePayment.collection.aggregate([
          { $match: { importBatchKey: "UNIFIED_WORKBOOK_IMPORT", normalizedStCode: { $type: "string", $gt: "" }, normalizedMrNo: { $type: "string", $gt: "" }, paymentDate: { $type: "date" } } },
          { $group: { _id: { code: "$normalizedStCode", mrNo: "$normalizedMrNo", date: "$paymentDate" }, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } }, { $limit: 1 }
        ]).toArray();
        if (!duplicates.length) await StudentFeePayment.collection.createIndex(
          expectedKey, {
            unique: true, name: "normalized_stcode_receipt_date_unique",
            partialFilterExpression: {
              importBatchKey: "UNIFIED_WORKBOOK_IMPORT",
              normalizedStCode: { $type: "string", $gt: "" },
              normalizedMrNo: { $type: "string", $gt: "" },
              paymentDate: { $type: "date" }
            }
          }
        );
      }
    })().catch(error => { paymentIndexMigration = null; throw error; });
  }
  return paymentIndexMigration;
}

let enrollmentIndexMigration;
export async function ensureEnrollmentIndexes() {
  if (!enrollmentIndexMigration) {
    enrollmentIndexMigration = (async () => {
      const collection = StudentEnrollment.collection;
      let indexes = [];
      try { indexes = await collection.indexes(); }
      catch (error) {
        if (error.code !== 26 && error.codeName !== "NamespaceNotFound") throw error;
      }

      // The model declares no unique index itself. The only supported unique
      // constraint is the four-field active-enrollment natural key below.
      // Old deployments may retain differently named unique indexes, so remove
      // every non-_id unique index before canonicalizing and merging documents.
      const removedUniqueIndexes = [];
      for (const index of indexes) {
        if (!index.unique || index.name === "_id_") continue;
        await collection.dropIndex(index.name);
        removedUniqueIndexes.push({ name: index.name, key: index.key, partialFilterExpression: index.partialFilterExpression || null });
      }

      // Normalize stored values using the same rules used by the import path.
      // Use the native collection to avoid the model's find middleware hiding
      // merged/archived rows during migration.
      const rawRows = await collection.find({}).project({
        _id: 1, studentId: 1, stCode: 1, normalizedStCode: 1, courseCode: 1,
        admissionDate: 1, mergedIntoEnrollmentId: 1
      }).toArray();
      const normalizeCourse = value => normalizeCourseCode(value || "") || String(value || "").normalize("NFKC").trim().toUpperCase();
      const normalizationOps = [];
      for (const row of rawRows) {
        const normalizedCode = normalizeStCode(row.normalizedStCode || row.stCode);
        const normalizedCourse = normalizeCourse(row.courseCode);
        const normalizedAdmission = row.admissionDate == null ? null : new Date(row.admissionDate);
        const set = {};
        if (normalizedCode && row.normalizedStCode !== normalizedCode) set.normalizedStCode = normalizedCode;
        if (row.stCode !== String(row.stCode || "").trim()) set.stCode = String(row.stCode || "").trim();
        if (row.courseCode !== normalizedCourse) set.courseCode = normalizedCourse;
        if (row.admissionDate == null && row.admissionDate !== null) set.admissionDate = null;
        else if (row.admissionDate != null) {
          if (Number.isNaN(normalizedAdmission.getTime())) set.admissionDate = null;
          else if (!(row.admissionDate instanceof Date) || row.admissionDate.getTime() !== normalizedAdmission.getTime()) {
            set.admissionDate = normalizedAdmission;
          }
        }
        if (row.studentId && typeof row.studentId !== "object" && mongoose.Types.ObjectId.isValid(String(row.studentId))) {
          set.studentId = new mongoose.Types.ObjectId(String(row.studentId));
        }
        if (Object.keys(set).length) normalizationOps.push({ updateOne: { filter: { _id: row._id }, update: { $set: set } } });
      }
      for (let offset = 0; offset < normalizationOps.length; offset += 500) {
        await collection.bulkWrite(normalizationOps.slice(offset, offset + 500), { ordered: false });
      }

      const consolidation = await consolidateDuplicateEnrollments();
      const expectedEnrollmentKey = { studentId: 1, normalizedStCode: 1, courseCode: 1, admissionDate: 1 };
      const expectedEnrollmentPartial = {
        mergedIntoEnrollmentId: null,
        normalizedStCode: { $type: "string", $gt: "" }
      };
      await collection.createIndex(expectedEnrollmentKey, {
        unique: true,
        name: "student_code_course_admission_unique",
        partialFilterExpression: expectedEnrollmentPartial
      });
      const finalIndexes = await collection.indexes();
      const uniqueIndexes = finalIndexes.filter(index => index.unique && index.name !== "_id_");
      if (uniqueIndexes.length !== 1
        || JSON.stringify(uniqueIndexes[0].key) !== JSON.stringify(expectedEnrollmentKey)
        || JSON.stringify(uniqueIndexes[0].partialFilterExpression) !== JSON.stringify(expectedEnrollmentPartial)) {
        throw new Error("Enrollment index migration verification failed: " + JSON.stringify(uniqueIndexes));
      }
      console.info("[student-import] enrollment index migration", {
        ...consolidation,
        normalizedDocuments: normalizationOps.length,
        removedUniqueIndexes,
        finalUniqueIndex: uniqueIndexes[0]
      });
    })().catch(error => {
      enrollmentIndexMigration = null;
      throw error;
    });
  }
  return enrollmentIndexMigration;
}

export async function linkImportedStudentRecords(studentDocuments = []) {
  await ensureEnrollmentIndexes();
  let linked = 0;
  const warnings = [];
  const orderedStudents = [...studentDocuments].sort((left, right) =>
    String(left.admissionDate || "").localeCompare(String(right.admissionDate || ""))
  );
  for (const student of orderedStudents) {
    const stCode = normalizeStCode(student.normalizedStCode || student.regnNo || student.enrollmentNo);
    if (!stCode) {
      warnings.push({ row: student.sourceRowNo || "", stCode: "", reason: "Student Code is blank; record was not linked." });
      continue;
    }
    const master = await getOrCreateMaster(student);
    if (!master) {
      warnings.push({ row: student.sourceRowNo || "", stCode, reason: "Multiple or conflicting Master profiles claim this Student Code; no name-based guess was made." });
      continue;
    }
    const enrollment = await findOrCreateEnrollment(master, student, stCode,
      student.applicantName || student.sourceStudentName || student.name, false, true);
    if (!enrollment) {
      warnings.push({ row: student.sourceRowNo || "", stCode, reason: "Could not create or resolve a course enrollment for this Student Code." });
      continue;
    }
    linked += 1;
  }
  return { linked, warnings };
}

function selectEnrollmentForPayment(candidates = [], paymentDate, courseValue = "") {
  let matches = [...candidates];
  const course = normalizeName(courseValue);
  if (course) {
    const byCourse = matches.filter(item => normalizeName(item.courseName || item.courseCode || item.course) === course
      || normalizeStCode(item.courseCode) === normalizeStCode(courseValue));
    if (byCourse.length) matches = byCourse;
  }
  if (!matches.length) return { enrollment: null, reason: "No enrollment exists for this Student Code." };
  const paymentTime = paymentDate ? new Date(paymentDate).getTime() : NaN;
  if (matches.length === 1) {
    const admission = safeDate(matches[0].admissionDate);
    if (admission && Number.isFinite(paymentTime) && admission.getTime() > paymentTime) {
      return { enrollment: null, reason: "Payment date is before the only available course admission date." };
    }
    return { enrollment: matches[0], reason: "" };
  }
  if (!Number.isFinite(paymentTime)) return { enrollment: null, reason: "Multiple course enrollments exist and the payment date is invalid." };
  matches = matches.filter(item => !safeDate(item.admissionDate) || safeDate(item.admissionDate).getTime() <= paymentTime);
  if (!matches.length) return { enrollment: null, reason: "Payment date is earlier than every available course admission." };
  if (matches.length > 1 && matches.some(item => !safeDate(item.admissionDate))) {
    return { enrollment: null, reason: "Multiple enrollments exist and at least one has no admission date; course mapping is ambiguous." };
  }
  const dated = matches.filter(item => safeDate(item.admissionDate));
  if (!dated.length) return { enrollment: null, reason: "Multiple undated course enrollments are ambiguous." };
  const latest = Math.max(...dated.map(item => safeDate(item.admissionDate).getTime()));
  const latestMatches = dated.filter(item => safeDate(item.admissionDate).getTime() === latest);
  return latestMatches.length === 1
    ? { enrollment: latestMatches[0], reason: "" }
    : { enrollment: null, reason: "Multiple courses share the latest admission date for this payment." };
}

export async function recalculateImportedStudentCodes(codes = []) {
  const normalizedCodes = [...new Set(codes.map(normalizeStCode).filter(Boolean))];
  if (!normalizedCodes.length) return { duplicatePaymentDocumentsFound: 0, ambiguousCodes: [] };
  const variants = normalizedCodes.flatMap(code => {
    const values = [code];
    if (/^\d+$/.test(code)) {
      for (let zeroes = 1; zeroes <= 8; zeroes += 1) values.push("0".repeat(zeroes) + code);
      values.push(new RegExp("^\\s*0*" + code.split("").join("\\s*") + "(?:\\.0+)?\\s*$", "i"));
    }
    return values;
  });
  const Student = getStudentModel();
  const [students, enrollments, payments, masters] = await Promise.all([
    Student.find({ $or: [{ normalizedStCode: { $in: normalizedCodes } }, { regnNo: { $in: variants } }, { enrollmentNo: { $in: variants } }] }).lean(),
    StudentEnrollment.find({ mergedIntoEnrollmentId: null, $or: [{ normalizedStCode: { $in: normalizedCodes } }, { stCode: { $in: variants } }] }).lean(),
    StudentFeePayment.find({ $or: [{ normalizedStCode: { $in: normalizedCodes } }, { stCode: { $in: variants } }] }).lean(),
    StudentMaster.find({ mergedIntoMasterId: null, isMerged: { $ne: true }, $or: [
      { normalizedStCodes: { $in: normalizedCodes } }, { stCodes: { $in: variants } },
      { primaryStCode: { $in: variants } }, { currentStCode: { $in: variants } },
      { "registrations.stCode": { $in: variants } }, { "enrollments.stCode": { $in: variants } }
    ] }).lean()
  ]);
  const LegacyFeeSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, payments: [mongoose.Schema.Types.Mixed] }, { strict: false });
  const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", LegacyFeeSchema);
  const legacyFees = students.length ? await StudentFee.find({ studentId: { $in: students.map(item => item._id) } }).lean() : [];
  const linkedMasters = students.length ? await StudentMaster.find({ legacyStudentIds: { $in: students.map(item => item._id) }, mergedIntoMasterId: null, isMerged: { $ne: true } }).lean() : [];
  const allMasters = [...new Map([...masters, ...linkedMasters].map(item => [String(item._id), item])).values()];
  const studentById = new Map(students.map(item => [String(item._id), item]));
  const codeOwnerCounts = new Map();
  for (const master of allMasters) {
    const masterCodes = new Set([
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode),
      ...(master.enrollments || []).map(item => item.stCode),
      ...(master.legacyStudentIds || []).map(id => {
        const linked = studentById.get(String(id));
        return linked?.normalizedStCode || linked?.regnNo || linked?.enrollmentNo;
      })
    ].map(normalizeStCode).filter(Boolean));
    for (const code of masterCodes) codeOwnerCounts.set(code, (codeOwnerCounts.get(code) || 0) + 1);
  }
  const ambiguousCodes = [...codeOwnerCounts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
  const latestPaymentByKey = new Map();
  let duplicatePaymentDocumentsFound = 0;
  const importedReceiptKeys = new Set();
  for (const payment of payments) {
    const code = normalizeStCode(payment.normalizedStCode || payment.stCode);
    const receipt = normalizeReceiptNo(payment.normalizedMrNo || payment.mrNo);
    const date = dateKey(payment.paymentDate);
    const key = [code, receipt || String(payment._id), date].join("|");
    if (code && receipt) importedReceiptKeys.add([code, receipt, date].join("|"));
    const prior = latestPaymentByKey.get(key);
    if (!prior) latestPaymentByKey.set(key, payment);
    else {
      duplicatePaymentDocumentsFound += 1;
      if (new Date(payment.updatedAt || payment.createdAt || 0) > new Date(prior.updatedAt || prior.createdAt || 0)) latestPaymentByKey.set(key, payment);
    }
  }
  const paidByCode = new Map();
  const paidByEnrollment = new Map();
  for (const payment of latestPaymentByKey.values()) {
    const code = normalizeStCode(payment.normalizedStCode || payment.stCode);
    const paid = Number(payment.amountPaid || 0);
    paidByCode.set(code, (paidByCode.get(code) || 0) + paid);
    if (payment.enrollmentId) paidByEnrollment.set(code + "|" + String(payment.enrollmentId), paid);
  }
  const legacyPaidByCode = new Map();
  const legacyFeeByCode = new Map();
  const legacyReceiptKeys = new Set();
  const courseFeePurposes = new Set(["course fee", "admission fee", "installment", "tuition fee"]);
  for (const fee of legacyFees) {
    const linkedStudent = studentById.get(String(fee.studentId));
    const code = normalizeStCode(linkedStudent?.normalizedStCode || linkedStudent?.regnNo || linkedStudent?.enrollmentNo);
    if (!code || !normalizedCodes.includes(code)) continue;
    const previousFee = legacyFeeByCode.get(code);
    if (!previousFee || new Date(fee.updatedAt || fee.createdAt || 0) > new Date(previousFee.updatedAt || previousFee.createdAt || 0)) legacyFeeByCode.set(code, fee);
    for (const payment of fee.payments || []) {
      const receipt = normalizeReceiptNo(payment.receiptNo || payment.reference);
      const date = dateKey(safeDate(payment.date));
      const key = [code, receipt || String(payment._id || ""), date].join("|");
      if ((receipt && importedReceiptKeys.has(key)) || legacyReceiptKeys.has(key)) continue;
      legacyReceiptKeys.add(key);
      const items = Array.isArray(payment.items) ? payment.items : [];
      const hasPurpose = items.some(item => {
        const purpose = String(item.purpose || item.type || "").trim().toLowerCase();
        return purpose && purpose !== "other";
      });
      let amount = 0;
      if (hasPurpose) {
        amount = items.filter(item => courseFeePurposes.has(String(item.purpose || item.type || "").trim().toLowerCase()))
          .reduce((sum, item) => { const value = parseMoney(item.amount); return sum + (Number.isFinite(value) ? value : 0); }, 0);
      } else {
        const noteMatch = String(payment.note || "").match(/Fee sections:\s*([\s\S]*)$/i);
        if (noteMatch) {
          amount = noteMatch[1].split(/;\s*/).reduce((sum, part) => {
            const item = part.match(/^(.*?):\s*₹([\d,.]+)(?:\s*\((.*?)\))?$/);
            return item && courseFeePurposes.has(item[1].trim().toLowerCase())
              ? sum + Number(item[2].replace(/,/g, "")) : sum;
          }, 0);
        } else {
          const type = String(payment.paymentType || "").toLowerCase();
          amount = ["late fine", "lab charge", "registration fee"].some(label => type.includes(label))
            ? 0 : (Number.isFinite(parseMoney(payment.amount)) ? parseMoney(payment.amount) : 0);
        }
      }
      legacyPaidByCode.set(code, (legacyPaidByCode.get(code) || 0) + Math.max(0, amount));
    }
  }
  for (const [code, paid] of legacyPaidByCode) paidByCode.set(code, (paidByCode.get(code) || 0) + paid);
  const enrollmentByCode = new Map();
  for (const enrollment of enrollments) {
    const code = normalizeStCode(enrollment.normalizedStCode || enrollment.stCode);
    enrollmentByCode.set(code, [...(enrollmentByCode.get(code) || []), enrollment]);
  }
  const studentByCode = new Map();
  for (const student of students) {
    const code = normalizeStCode(student.normalizedStCode || student.regnNo || student.enrollmentNo);
    studentByCode.set(code, [...(studentByCode.get(code) || []), student]);
  }
  const studentOps = [], enrollmentOps = [];
  const feeByCode = new Map(), paidSummaryByCode = new Map(), discountByCode = new Map();
  for (const code of normalizedCodes) {
    if (ambiguousCodes.includes(code)) continue;
    const related = enrollmentByCode.get(code) || [];
    const enrollmentFeeTotal = related.reduce((sum, item) => sum + Number(item.feeConfig?.netPayableFee ?? item.summary?.totalDue ?? item.feeConfig?.grossFee ?? item.summary?.totalFee ?? 0), 0);
    const hasEnrollmentFee = related.some(item => item.feeConfig?.configured !== false && Boolean(item.feeConfig)
      && item.feeConfig.feeRuleSource !== "UNCONFIGURED" && String(item.courseCode || "").toUpperCase() !== "PREVIOUS-LEGACY");
    const legacyFee = legacyFeeByCode.get(code);
    const legacyGross = Number(legacyFee?.totalFee || 0), legacyDiscount = Number(legacyFee?.discount || 0);
    const legacyPayable = Math.max(0, legacyGross - legacyDiscount);
    const totalFee = hasEnrollmentFee || enrollmentFeeTotal > 0 ? enrollmentFeeTotal : legacyPayable;
    const totalPaid = Number(paidByCode.get(code) || 0);
    const balanceDue = Math.max(0, totalFee - totalPaid);
    const configured = hasEnrollmentFee || enrollmentFeeTotal > 0 || legacyPayable > 0;
    const feeStatus = configured && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
    feeByCode.set(code, totalFee);
    paidSummaryByCode.set(code, totalPaid);
    discountByCode.set(code, hasEnrollmentFee ? related.reduce((sum, item) => sum + Number(item.feeConfig?.discountAmount || 0), 0) : legacyDiscount);
    for (const student of studentByCode.get(code) || []) studentOps.push({
      updateOne: { filter: { _id: student._id }, update: { $set: {
        normalizedStCode: code, totalFee, totalPaid, feeSummaryUpdatedAt: new Date(), dueAmount: balanceDue,
        paymentStatus: feeStatus, feeStatus
      } } }
    });
    const current = related.find(item => item.status === "ACTIVE")
      || [...related].sort((left, right) => (safeDate(right.admissionDate)?.getTime() || 0) - (safeDate(left.admissionDate)?.getTime() || 0))[0];
    const allocated = related.reduce((sum, item) => sum + Number(paidByEnrollment.get(code + "|" + String(item._id)) || 0), 0);
    const unallocated = Math.max(0, totalPaid - allocated);
    for (const enrollment of related) {
      const configuredFee = Boolean(enrollment.feeConfig) && enrollment.feeConfig.configured !== false
        && enrollment.feeConfig.feeRuleSource !== "UNCONFIGURED"
        && String(enrollment.courseCode || "").toUpperCase() !== "PREVIOUS-LEGACY";
      const useLegacyFee = !hasEnrollmentFee && current && String(current._id) === String(enrollment._id) && legacyPayable > 0;
      const payable = configuredFee
        ? Number(enrollment.feeConfig?.netPayableFee ?? enrollment.summary?.totalDue ?? enrollment.feeConfig?.grossFee ?? enrollment.summary?.totalFee ?? 0)
        : useLegacyFee ? legacyPayable : Number(enrollment.summary?.totalDue || 0);
      const paid = Number(paidByEnrollment.get(code + "|" + String(enrollment._id)) || 0)
        + (current && String(current._id) === String(enrollment._id) ? unallocated : 0);
      const due = Math.max(0, payable - paid);
      const status = (configuredFee || useLegacyFee) && due <= 0 ? "Paid" : paid > 0 ? "Partial" : "Not Paid";
      enrollmentOps.push({ updateOne: { filter: { _id: enrollment._id }, update: { $set: { summary: {
        ...(enrollment.summary || {}),
        totalFee: useLegacyFee ? legacyGross : Number(enrollment.feeConfig?.grossFee ?? enrollment.summary?.totalFee ?? payable),
        totalDue: payable, totalPaid: paid, balanceDue: due,
        feeStatus: status, nextDueDate: enrollment.summary?.nextDueDate || null
      } } } } });
    }
  }
  for (let offset = 0; offset < studentOps.length; offset += 500) await Student.bulkWrite(studentOps.slice(offset, offset + 500), { ordered: false });
  for (let offset = 0; offset < enrollmentOps.length; offset += 500) await StudentEnrollment.bulkWrite(enrollmentOps.slice(offset, offset + 500), { ordered: false });
  const masterOps = [];
  for (const master of allMasters) {
    const codesForMaster = [...new Set([
      ...(master.normalizedStCodes || []), ...(master.studentCodes || []), ...(master.stCodes || []),
      master.primaryStCode, master.currentStCode,
      ...(master.registrations || []).map(item => item.stCode), ...(master.enrollments || []).map(item => item.stCode),
      ...(master.legacyStudentIds || []).map(id => {
        const linked = studentById.get(String(id));
        return linked?.normalizedStCode || linked?.regnNo || linked?.enrollmentNo;
      })
    ].map(normalizeStCode).filter(code => normalizedCodes.includes(code) && !ambiguousCodes.includes(code)))];
    if (!codesForMaster.length) continue;
    const totalPaid = codesForMaster.reduce((sum, code) => sum + Number(paidSummaryByCode.get(code) || 0), 0);
    const totalFee = codesForMaster.reduce((sum, code) => sum + Number(feeByCode.get(code) || 0), 0);
    const discount = codesForMaster.reduce((sum, code) => sum + Number(discountByCode.get(code) || 0), 0);
    const balanceDue = Math.max(0, totalFee - totalPaid);
    const configured = codesForMaster.some(code => (enrollmentByCode.get(code) || []).some(item => item.feeConfig?.configured !== false && Boolean(item.feeConfig))
      || Number(feeByCode.get(code) || 0) > 0);
    const feeStatus = configured && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
    masterOps.push({ updateOne: { filter: { _id: master._id }, update: { $set: { feeSummary: {
      totalFee, discount, totalPaid, balanceDue, feeStatus,
      courseCount: codesForMaster.reduce((sum, code) => sum + (enrollmentByCode.get(code) || []).length, 0),
      updatedAt: new Date()
    } } } } });
  }
  for (let offset = 0; offset < masterOps.length; offset += 500) await StudentMaster.bulkWrite(masterOps.slice(offset, offset + 500), { ordered: false });
  return { duplicatePaymentDocumentsFound, ambiguousCodes };
}

export async function importPaymentWorksheet(workbook, { sourceName = "RCLD Import" } = {}) {
  await ensureEnrollmentIndexes();
  await ensurePaymentIndexes();
  const Student = getStudentModel();
  const parsed = parsePaymentWorksheet(workbook);
  if (!parsed.rows.length) return {
    sheetName: parsed.sheetName, total: 0, imported: 0, updated: 0,
    duplicates: 0, unmatched: 0, invalid: 0, unmatchedPayments: [],
    sourcePaymentTotal: 0, matchedPaymentTotal: 0, databasePaymentTotal: 0,
    reconciliationMatches: false,
    errors: [{ reason: "No payment worksheet with the required receipt columns was found." }]
  };

  const allStudents = await Student.find({}).lean();
  const normalizedStudents = allStudents.map(student => ({
    ...student,
    normalizedName: normalizeName(student.applicantName || student.sourceStudentName),
    normalizedCode: normalizeStCode(student.normalizedStCode || student.regnNo || student.enrollmentNo)
  }));
  const studentsByCode = new Map();
  const studentsByName = new Map();
  for (const student of normalizedStudents) {
    if (student.normalizedCode) studentsByCode.set(student.normalizedCode, [...(studentsByCode.get(student.normalizedCode) || []), student]);
    if (student.normalizedName) studentsByName.set(student.normalizedName, [...(studentsByName.get(student.normalizedName) || []), student]);
  }

  const unmatchedPayments = [];
  const validRows = [];
  let invalid = 0, sourcePaymentTotal = 0;
  for (const row of parsed.rows) {
    const parsedSourceAmount = parseMoney(row.rawAmount ?? row.amountPaid);
    if (Number.isFinite(parsedSourceAmount)) sourcePaymentTotal += parsedSourceAmount;
    if (!row.valid) {
      invalid += 1;
      unmatchedPayments.push({
        row: row.sourceRowNo, stCode: row.stCode, name: row.name || row.creditName,
        amountPaid: row.rawAmount, mrNo: row.mrNo, paymentDate: row.rawPaymentDate,
        reason: !row.stCode && !row.name && !row.creditName ? "Student Code and student name are missing."
          : !row.paymentDate ? "Payment date is blank or invalid."
          : !row.mrNo ? "Receipt number is blank."
          : "Payment amount is blank, invalid, or negative."
      });
      continue;
    }
    let candidates = row.stCode ? (studentsByCode.get(row.stCode) || []) : [];
    let matched = candidates.length === 1 ? candidates[0] : await chooseUniqueLegacyStudent(candidates);
    let matchMethod = "STUDENT_CODE";
    if (!candidates.length) {
      const names = [...new Set([row.name, row.creditName].filter(Boolean))];
      const nameCandidates = names.flatMap(name => studentsByName.get(name) || []);
      const candidateCodes = [...new Set(nameCandidates.map(item => item.normalizedCode).filter(Boolean))];
      if (candidateCodes.length === 1) {
        candidates = studentsByCode.get(candidateCodes[0]) || [];
        matched = candidates.length === 1 ? candidates[0] : await chooseUniqueLegacyStudent(candidates);
        matchMethod = "UNIQUE_NAME_FALLBACK";
      }
    }
    if (!matched) {
      unmatchedPayments.push({
        row: row.sourceRowNo, stCode: row.stCode, name: row.name || row.creditName,
        amountPaid: row.amountPaid, mrNo: row.mrNo, paymentDate: row.paymentDate,
        reason: row.stCode && (studentsByCode.get(row.stCode) || []).length > 1
          ? "Multiple legacy student records share this Student Code and cannot be safely distinguished."
          : row.stCode && (studentsByCode.get(row.stCode) || []).length === 0
            ? "Student Code was not found and normalized name fallback did not identify exactly one Student Code."
            : "Normalized name maps to multiple Student Codes or multiple legacy records."
      });
      continue;
    }
    validRows.push({ ...row, matchedStudent: matched, matchedCode: matched.normalizedCode, matchMethod });
  }

  const affectedCodes = [...new Set(validRows.map(row => row.matchedCode).filter(Boolean))];
  const mastersByStudent = new Map();
  const masters = await StudentMaster.find({ legacyStudentIds: { $in: validRows.map(row => row.matchedStudent._id) } }).lean();
  for (const master of masters) for (const id of master.legacyStudentIds || []) mastersByStudent.set(String(id), master);
  const masterForRow = new Map();
  for (const row of validRows) {
    const student = row.matchedStudent;
    const master = mastersByStudent.get(String(student._id)) || await getOrCreateMaster(student);
    mastersByStudent.set(String(student._id), master);
    masterForRow.set(String(student._id), master);
  }

  const enrollmentByCode = new Map();
  const masterIds = [...new Set([...masterForRow.values()].map(item => String(item._id)))].map(id => new mongoose.Types.ObjectId(id));
  const existingEnrollments = await StudentEnrollment.find({
    studentId: { $in: masterIds },
    mergedIntoEnrollmentId: null
  }).lean();
  for (const enrollment of existingEnrollments) {
    const code = normalizeStCode(enrollment.normalizedStCode || enrollment.stCode);
    enrollmentByCode.set(code, [...(enrollmentByCode.get(code) || []), enrollment]);
  }

  const existingCodes = [...new Set(validRows.map(row => row.matchedCode))];
  const codeVariantsForReceipt = code => {
    const variants = [code];
    if (/^\d+$/.test(code)) {
      for (let zeroes = 1; zeroes <= 8; zeroes += 1) variants.push("0".repeat(zeroes) + code);
      variants.push(new RegExp("^\\s*0*" + code.split("").join("\\s*") + "(?:\\.0+)?\\s*$", "i"));
    }
    return variants;
  };
  const receiptQuery = validRows.map(row => ({
    $or: [
      { normalizedStCode: row.matchedCode },
      { stCode: { $in: codeVariantsForReceipt(row.matchedCode) } }
    ],
    normalizedMrNo: row.mrNo,
    paymentDate: row.paymentDate
  }));
  const existingPayments = receiptQuery.length
    ? await StudentFeePayment.find({ $or: receiptQuery }).lean()
    : [];
  const existingByKey = new Map();
  for (const payment of existingPayments) {
    const key = [normalizeStCode(payment.normalizedStCode || payment.stCode), normalizeReceiptNo(payment.normalizedMrNo || payment.mrNo), dateKey(payment.paymentDate)].join("|");
    if (!existingByKey.has(key)) existingByKey.set(key, payment);
  }

  const sourceBatchKey = "LEGACY_" + createHash("sha256").update(JSON.stringify({ sourceName, sheetName: parsed.sheetName, rows: parsed.rows.map(row => [row.stCode, row.sourceStCode, row.mrNo, dateKey(row.paymentDate), row.rawAmount, row.sourceRowNo]) })).digest("hex");
  const seenKeys = new Set();
  const newDocs = [];
  const updates = new Map();
  let duplicates = 0, updated = 0, matchedPaymentTotal = 0, acceptedRows = 0;
  for (const row of validRows) {
    const code = row.matchedCode;
    const receiptKey = [code, normalizeReceiptNo(row.mrNo), dateKey(row.paymentDate)].join("|");
    if (seenKeys.has(receiptKey)) {
      unmatchedPayments.push({
        row: row.sourceRowNo, stCode: row.stCode, name: row.name || row.creditName,
        amountPaid: row.amountPaid, mrNo: row.mrNo, paymentDate: row.paymentDate,
        reason: "Duplicate Student Code + receipt number + payment date appears more than once in this workbook."
      });
      duplicates += 1;
      continue;
    }
    seenKeys.add(receiptKey);
    const master = masterForRow.get(String(row.matchedStudent._id));
    let candidates = enrollmentByCode.get(code) || [];
    candidates = candidates.filter(item => String(item.studentId) === String(master._id));
    const chosen = selectEnrollmentForPayment(candidates, row.paymentDate, row.course);
    let enrollment = chosen.enrollment;
    if (!enrollment && candidates.length === 0) {
      const studentForCourse = row.course ? { ...row.matchedStudent, sourceCourseLabel: row.course, courseCode: row.course } : row.matchedStudent;
      enrollment = await findOrCreateEnrollment(master, studentForCourse, code, row.name || row.creditName, false, false);
      enrollmentByCode.set(code, [...candidates, enrollment.toObject ? enrollment.toObject() : enrollment]);
    } else if (!enrollment && candidates.length === 1 && chosen.reason.includes("before")) {
      enrollment = await findOrCreateEnrollment(master, row.matchedStudent, code, row.name || row.creditName, true, true);
      enrollmentByCode.set(code, [...candidates, enrollment.toObject ? enrollment.toObject() : enrollment]);
    }
    if (!enrollment) {
      unmatchedPayments.push({
        row: row.sourceRowNo, stCode: row.stCode, name: row.name || row.creditName,
        amountPaid: row.amountPaid, mrNo: row.mrNo, paymentDate: row.paymentDate,
        reason: chosen.reason || "Course enrollment could not be determined without guessing."
      });
      continue;
    }
    const sourceRowKey = [sourceBatchKey, parsed.sheetName, row.sourceRowNo, receiptKey].join("|");
    const prior = existingByKey.get(receiptKey);
    const paymentValues = {
      studentId: master._id, masterStudentId: master._id, enrollmentId: enrollment._id,
      stCode: code, normalizedStCode: code, sourceStCode: row.sourceStCode,
      registrationId: enrollment.registrationId || "", stNameKey: enrollment.registrationId || "",
      courseCode: enrollment.courseCode || "", course: enrollment.courseName || enrollment.course || "",
      mrNo: row.mrNo, normalizedMrNo: normalizeReceiptNo(row.mrNo), paymentDate: row.paymentDate, amountPaid: row.amountPaid,
      rawPaymentDate: row.rawPaymentDate, sourceSheet: parsed.sheetName, sourceRowNo: row.sourceRowNo,
      importBatchKey: "UNIFIED_WORKBOOK_IMPORT", sourceBatchKey, sourceRowKey,
      allocations: prior?.allocations || [], importWarnings: prior?.importWarnings || []
    };
    if (prior) {
      const patch = {};
      for (const [field, value] of Object.entries(paymentValues)) {
        if (value === "" || value === null || value === undefined || field === "allocations" || field === "importWarnings") continue;
        if (String(prior[field] ?? "") !== String(value)) patch[field] = value;
      }
      if (Object.keys(patch).length) updates.set(String(prior._id), { updateOne: { filter: { _id: prior._id }, update: { $set: patch } } });
      updated += Object.keys(patch).length ? 1 : 0;
      duplicates += Object.keys(patch).length ? 0 : 1;
    } else {
      newDocs.push({ _id: new mongoose.Types.ObjectId(), ...paymentValues });
    }
    acceptedRows += 1;
    matchedPaymentTotal += Number(row.amountPaid || 0);
  }

  const updateOps = [...updates.values()];
  for (let offset = 0; offset < updateOps.length; offset += 500) await StudentFeePayment.bulkWrite(updateOps.slice(offset, offset + 500), { ordered: false });
  let imported = 0;
  for (let offset = 0; offset < newDocs.length; offset += 500) {
    const chunk = newDocs.slice(offset, offset + 500);
    try {
      imported += (await StudentFeePayment.insertMany(chunk, { ordered: false })).length;
    } catch (error) {
      const writeErrors = error.writeErrors || error.result?.writeErrors || [];
      if (error.code !== 11000 && !(writeErrors.length && writeErrors.every(item => item.code === 11000))) throw error;
      const persisted = await StudentFeePayment.find({ $or: chunk.flatMap(item => [
        { normalizedStCode: item.normalizedStCode, normalizedMrNo: item.normalizedMrNo, paymentDate: item.paymentDate },
        { stCode: { $in: codeVariantsForReceipt(item.normalizedStCode) }, mrNo: item.mrNo, paymentDate: item.paymentDate }
      ]) }).lean();
      const persistedByKey = new Map(persisted.map(item => [
        [normalizeStCode(item.normalizedStCode || item.stCode), normalizeReceiptNo(item.normalizedMrNo || item.mrNo), dateKey(item.paymentDate)].join("|"), item
      ]));
      const repairs = [];
      const missing = [];
      for (const item of chunk) {
        const key = [item.normalizedStCode, item.normalizedMrNo || item.mrNo, dateKey(item.paymentDate)].join("|");
        const prior = persistedByKey.get(key);
        if (prior) repairs.push({ updateOne: { filter: { _id: prior._id }, update: { $set: {
          studentId: item.studentId, masterStudentId: item.masterStudentId, enrollmentId: item.enrollmentId,
          stCode: item.stCode, normalizedStCode: item.normalizedStCode, sourceStCode: item.sourceStCode,
          registrationId: item.registrationId, courseCode: item.courseCode, course: item.course,
          amountPaid: item.amountPaid, normalizedMrNo: item.normalizedMrNo, sourceBatchKey: item.sourceBatchKey, sourceRowKey: item.sourceRowKey,
          sourceSheet: item.sourceSheet, sourceRowNo: item.sourceRowNo, importBatchKey: item.importBatchKey
        } } } });
        else missing.push(item);
      }
      if (repairs.length) {
        await StudentFeePayment.bulkWrite(repairs, { ordered: false });
        duplicates += repairs.length;
        updated += repairs.length;
      }
      if (missing.length) {
        try { imported += (await StudentFeePayment.insertMany(missing, { ordered: false })).length; }
        catch (retryError) {
          const retryErrors = retryError.writeErrors || retryError.result?.writeErrors || [];
          if (retryError.code !== 11000 && !(retryErrors.length && retryErrors.every(item => item.code === 11000))) throw retryError;
          const finalRows = await StudentFeePayment.find({ sourceRowKey: { $in: missing.map(item => item.sourceRowKey) } }).select("sourceRowKey").lean();
          const saved = new Set(finalRows.map(item => item.sourceRowKey));
          const unresolved = missing.filter(item => !saved.has(item.sourceRowKey));
          if (unresolved.length) throw new Error("Fee receipt duplicate recovery could not confirm " + unresolved.length + " rows.");
          duplicates += missing.length;
        }
      }
    }
  }

  const summary = await recalculateImportedStudentCodes(affectedCodes);
  const unmatchedAmount = unmatchedPayments.reduce((sum, row) => {
    const amount = parseMoney(row.amountPaid);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const databasePayments = await StudentFeePayment.find({ sourceBatchKey }).select("amountPaid sourceRowKey normalizedStCode mrNo paymentDate").lean();
  const databasePaymentTotal = databasePayments.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
  const databasePaymentRows = new Set(databasePayments.map(item => item.sourceRowKey || [item.normalizedStCode, item.mrNo, dateKey(item.paymentDate)].join("|"))).size;
  const reconciliationMatches = databasePaymentRows === acceptedRows
    && Math.abs(databasePaymentTotal - matchedPaymentTotal) < 0.01
    && Math.abs(sourcePaymentTotal - (databasePaymentTotal + unmatchedAmount)) < 0.01;
  return {
    sheetName: parsed.sheetName, total: parsed.rows.length, imported, updated, duplicates,
    unmatched: unmatchedPayments.length, invalid, createdLegacy: 0, unmatchedPayments,
    sourcePaymentTotal, matchedPaymentTotal, unmatchedPaymentTotal: unmatchedAmount,
    databasePaymentRows, databasePaymentTotal, acceptedRows, reconciliationMatches,
    duplicatePaymentDocumentsFound: summary.duplicatePaymentDocumentsFound,
    errors: unmatchedPayments.slice(0, 100)
  };
}

