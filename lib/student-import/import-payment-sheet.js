import mongoose from "mongoose";
import * as XLSX from "xlsx";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import Course from "@/models/Course";
import { normalizeHeader, normalizeName, normalizeStCode, parseExcelDate, parsePhones } from "./normalization";
import { findIdentityMatch } from "./matching";
import { resolveCourseFeeConfig } from "./course-fee-rules";
import { buildInstallments, allocatePaymentsFIFO } from "./fee-allocation";

const StudentSchema = new mongoose.Schema({
  regnNo: String, applicantName: String, sourceStudentName: String, courseCode: String, courseName: String,
  dateOfBirth: String, fatherOrHusbandName: String, mobileNumber: String, guardianContactNumber: String,
  address: String, sourceQualification: String, photoUrl: String, status: String
}, { strict: false, timestamps: true });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
const clean = value => String(value ?? "").trim();
const safeDate = value => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; };
const dateKey = value => safeDate(value)?.toISOString().slice(0, 10) || "";
const money = value => {
  const parsed = Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function parsePaymentWorksheet(workbook) {
  for (const sheetName of workbook.SheetNames || []) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = grid.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return ["stcode", "stnamecr", "stname", "amtpaid", "mrno", "dop"].every(key => headers.includes(key));
    });
    if (headerIndex < 0) continue;
    const headers = grid[headerIndex].map(normalizeHeader);
    const at = key => headers.indexOf(key);
    const rows = [];
    for (let i = headerIndex + 1; i < grid.length; i += 1) {
      const values = grid[i];
      if (!values.some(value => clean(value))) continue;
      const get = key => at(key) >= 0 ? values[at(key)] : "";
      const stCode = normalizeStCode(get("stcode"));
      const name = normalizeName(get("stname"));
      const creditName = normalizeName(get("stnamecr"));
      const paymentDate = parseExcelDate(get("dop"));
      const amountPaid = money(get("amtpaid"));
      const rawMrNo = clean(get("mrno")).replace(/\.0$/, "");
      rows.push({
        stCode, name, creditName, amountPaid,
        mrNo: rawMrNo || "NO-MR-" + (i + 1),
        paymentDate, rawPaymentDate: get("dop"), rawAmount: get("amtpaid"), sourceSheet: sheetName, sourceRowNo: i + 1,
        valid: Boolean(stCode && (name || creditName) && paymentDate && clean(get("amtpaid")) && amountPaid >= 0)
      });
    }
    return { sheetName, rows };
  }
  return { sheetName: "", rows: [] };
}

function phoneList(student) {
  return parsePhones([student.mobileNumber, student.guardianContactNumber, student.whatsappNumber, student.sourcePhone].filter(Boolean).join(","));
}
function fatherTokensMatch(a, b) {
  const left = new Set(normalizeName(a).split(" ").filter(Boolean));
  const right = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return false;
  const overlap = [...left].filter(token => right.has(token)).length;
  return overlap / Math.min(left.size, right.size) >= 0.6;
}

async function createMasterFromStudent(student, warning = "") {
  return StudentMaster.create({
    fullName: student.applicantName || student.sourceStudentName || "Legacy Student",
    normalizedFullName: normalizeName(student.applicantName || student.sourceStudentName),
    dob: safeDate(student.dateOfBirth),
    fatherName: student.fatherOrHusbandName || "",
    normalizedFatherName: normalizeName(student.fatherOrHusbandName),
    address: student.address || "",
    photoUrl: student.photoUrl || "",
    phoneNumbers: phoneList(student),
    qualification: student.sourceQualification || "",
    legacyStudentIds: [student._id],
    stCodes: normalizeStCode(student.regnNo || student.enrollmentNo) ? [normalizeStCode(student.regnNo || student.enrollmentNo)] : [],
    identityMatchMethod: warning ? "AMBIGUOUS_NEW_PROFILE" : "LEGACY_IMPORT",
    identityWarnings: warning ? [warning] : [],
  });
}

async function getOrCreateMaster(student, candidateStudents = []) {
  let master = await StudentMaster.findOne({ legacyStudentIds: student._id });
  if (master) return master;
  const identityRow = {
    fullName: student.applicantName || student.sourceStudentName,
    dob: student.dateOfBirth,
    fatherName: student.fatherOrHusbandName,
    phoneNumbers: phoneList(student),
  };
  const masterCandidates = await StudentMaster.find({
    $or: [
      { normalizedFullName: normalizeName(identityRow.fullName) },
      ...(safeDate(student.dateOfBirth) ? [{ dob: safeDate(student.dateOfBirth) }] : []),
    ],
  }).lean();
  const masterMatch = findIdentityMatch(identityRow, masterCandidates);
  if (masterMatch.match && !masterMatch.ambiguous) {
    master = await StudentMaster.findById(masterMatch.match._id);
  } else {
    const legacyCandidates = candidateStudents
      .filter(candidate => String(candidate._id) !== String(student._id))
      .map(candidate => ({
        _id: candidate._id,
        fullName: candidate.applicantName || candidate.sourceStudentName,
        dob: candidate.dateOfBirth,
        fatherName: candidate.fatherOrHusbandName,
        phoneNumbers: phoneList(candidate),
      }));
    const legacyMatch = findIdentityMatch(identityRow, legacyCandidates);
    if (legacyMatch.match && !legacyMatch.ambiguous) {
      master = await StudentMaster.findOne({ legacyStudentIds: legacyMatch.match._id });
      if (!master) {
        const matchedStudent = candidateStudents.find(candidate => String(candidate._id) === String(legacyMatch.match._id));
        if (matchedStudent) master = await createMasterFromStudent(matchedStudent);
      }
    }
    if (!master) {
      master = await createMasterFromStudent(student,
        masterMatch.ambiguous || legacyMatch.ambiguous ? "Possible identity collision; candidate profiles were not merged." : "");
    }
  }
  if (!master.legacyStudentIds.some(id => String(id) === String(student._id))) master.legacyStudentIds.push(student._id);
  master.address = student.address || master.address;
  master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...phoneList(student)])];
  master.qualification = student.sourceQualification || master.qualification;
  if (!master.photoUrl && student.photoUrl) master.photoUrl = student.photoUrl;
  const currentCode = normalizeStCode(student.regnNo || student.enrollmentNo);
  if (currentCode && !master.stCodes.includes(currentCode)) master.stCodes.push(currentCode);
  await master.save();
  return master;
}

async function findOrCreateEnrollment(master, student, stCode, name, forceLegacy = false, setActive = false) {
  const normalizedFullName = normalizeName(name || student.applicantName || student.sourceStudentName);
  let enrollment = await StudentEnrollment.findOne({ studentId: master._id, stCode, normalizedFullName });
  if (enrollment) {
    if (!master.stCodes.includes(stCode)) master.stCodes.push(stCode);
    if (setActive) {
      await StudentEnrollment.updateMany({ studentId: master._id, status: "ACTIVE", _id: { $ne: enrollment._id } }, { $set: { status: "PROMOTED" } });
      enrollment.status = "ACTIVE";
      master.activeEnrollmentId = enrollment._id;
      await enrollment.save();
    }
    await master.save();
    return enrollment;
  }
  const rawCourseCode = forceLegacy ? "LEGACY" : String(student.sourceCourseLabel || student.courseCode || "LEGACY").trim().toUpperCase();
  const courseCode = forceLegacy ? "LEGACY" : String(student.courseCode || rawCourseCode || "LEGACY").trim().toUpperCase();
  const resolved = rawCourseCode !== "LEGACY" ? await resolveCourseFeeConfig(rawCourseCode, Course) : {
    courseCategory: "OTHER", semesterLabel: "LEGACY",
    feeConfig: { feeRuleSource: "UNCONFIGURED", configured: false, grossFee: 0, netPayableFee: 0 }
  };
  const admissionDate = student.admissionDate ? new Date(student.admissionDate) : null;
  const installments = resolved.feeConfig.configured
    ? buildInstallments({ courseCode: rawCourseCode, admissionDate, feeConfig: resolved.feeConfig, semesterLabel: resolved.semesterLabel })
    : [];
  if (setActive || !forceLegacy) {
    await StudentEnrollment.updateMany({ studentId: master._id, status: "ACTIVE" }, { $set: { status: "PROMOTED" } });
  }
  enrollment = await StudentEnrollment.create({
    studentId: master._id, legacyStudentId: student._id, stCode, normalizedFullName,
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

export async function linkImportedStudentRecords(studentDocuments = []) {
  let linked = 0;
  const allStudents = await Student.find({}).lean();
  const byName = new Map();
  const byDob = new Map();
  for (const candidate of allStudents) {
    const name = normalizeName(candidate.applicantName || candidate.sourceStudentName);
    const dob = dateKey(candidate.dateOfBirth);
    if (name) byName.set(name, [...(byName.get(name) || []), candidate]);
    if (dob) byDob.set(dob, [...(byDob.get(dob) || []), candidate]);
  }
  const orderedStudents = [...studentDocuments].sort((a, b) => String(a.admissionDate || "").localeCompare(String(b.admissionDate || "")));
  for (const student of orderedStudents) {
    const name = normalizeName(student.applicantName || student.sourceStudentName);
    const dob = dateKey(student.dateOfBirth);
    const candidateMap = new Map();
    for (const candidate of [...(byName.get(name) || []), ...(dob ? byDob.get(dob) || [] : [])]) {
      candidateMap.set(String(candidate._id), candidate);
    }
    const master = await getOrCreateMaster(student, [...candidateMap.values()]);
    linked += 1;
  }

  // Create an enrollment for every historical Student record now linked to a master.
  // Chronological processing makes the newest valid registration the active one.
  const importedIds = studentDocuments.map(student => student._id);
  const linkedMasters = await StudentMaster.find({ legacyStudentIds: { $in: importedIds } }).lean();
  for (const masterRecord of linkedMasters) {
    const master = await StudentMaster.findById(masterRecord._id);
    const legacyRecords = await Student.find({ _id: { $in: master.legacyStudentIds } })
      .sort({ admissionDate: 1, createdAt: 1 }).lean();
    for (const legacyStudent of legacyRecords) {
      const stCode = normalizeStCode(legacyStudent.regnNo || legacyStudent.enrollmentNo);
      if (stCode) await findOrCreateEnrollment(master, legacyStudent, stCode,
        legacyStudent.applicantName || legacyStudent.sourceStudentName, false, true);
    }
  }
  return { linked };
}

async function rebuildEnrollmentLedger(enrollmentId) {
  const enrollment = await StudentEnrollment.findById(enrollmentId);
  if (!enrollment) return;
  const payments = await StudentFeePayment.find({ enrollmentId }).sort({ paymentDate: 1, mrNo: 1 }).lean();
  const cleanInstallments = (enrollment.installments || []).map(item => ({
    ...(typeof item.toObject === "function" ? item.toObject() : item),
    amountPaid: 0,
    status: Number(item.amountDue || 0) === 0 ? "WAIVED" : "PENDING",
    receiptRefs: [],
  }));
  const allocation = allocatePaymentsFIFO(cleanInstallments, payments);
  if (allocation.installments.length) {
    enrollment.installments = allocation.installments;
    const totalDue = allocation.installments.reduce((sum, item) => sum + Number(item.amountDue || 0), 0);
    const totalPaid = allocation.installments.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
    enrollment.summary = { totalDue, totalPaid, balanceDue: Math.max(0, totalDue - totalPaid), nextDueDate: allocation.installments.find(item => item.status === "PENDING" || item.status === "PARTIAL")?.dueDate || null };
    await enrollment.save();
    const operations = allocation.payments.map(payment => ({
      updateOne: { filter: { _id: payment._id }, update: { $set: { allocations: payment.allocations } } }
    }));
    if (operations.length) await StudentFeePayment.bulkWrite(operations, { ordered: false });
  } else {
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
    enrollment.summary = { totalDue: Number(enrollment.feeConfig?.netPayableFee || 0), totalPaid, balanceDue: Math.max(0, Number(enrollment.feeConfig?.netPayableFee || 0) - totalPaid), nextDueDate: null };
    await enrollment.save();
  }
}

export async function importPaymentWorksheet(workbook, { sourceName = "RCLD Import" } = {}) {
  const parsed = parsePaymentWorksheet(workbook);
  if (!parsed.rows.length) return { sheetName: "", total: 0, imported: 0, duplicates: 0, unmatched: 0, invalid: 0, errors: ["No payment worksheet with the required receipt columns was found."] };

  const allStudents = await Student.find({}).lean();
  const normalizedStudents = allStudents.map(student => ({
    ...student,
    normalizedName: normalizeName(student.applicantName || student.sourceStudentName),
    normalizedCode: normalizeStCode(student.regnNo || student.enrollmentNo),
  }));
  let imported = 0, duplicates = 0, unmatched = 0, invalid = 0, createdLegacy = 0;
  const errors = [];

  for (const row of parsed.rows) {
    if (!row.valid) { invalid += 1; errors.push({ row: row.sourceRowNo, reason: "Missing St_Code/name/date or invalid amount." }); continue; }
    const byCode = normalizedStudents.filter(student => student.normalizedCode === row.stCode);
    let matched = byCode.find(student => student.normalizedName === row.name);
    if (!matched && row.creditName) matched = byCode.find(student => student.normalizedName === row.creditName);
    if (!matched && byCode.length === 1) matched = byCode[0];
    const matchedByCode = Boolean(matched);

    if (!matched) {
      const legacyName = row.creditName || row.name;
      const byName = normalizedStudents.filter(student => student.normalizedName === legacyName);
      if (byName.length === 1) matched = byName[0];
    }

    if (!matched) {
      const legacyName = row.creditName || row.name;
      const possible = normalizedStudents.filter(student => student.normalizedName === legacyName);
      if (possible.length === 1) matched = possible[0];
    }

    if (!matched) {
      const created = await Student.create({
        regnNo: row.stCode, applicantName: row.creditName || row.name,
        sourceStudentName: row.creditName || row.name, courseCode: "LEGACY",
        courseName: "Legacy / Unknown Course", status: "Registered",
        importSource: sourceName + " - legacy fee row", sourceRowNo: row.sourceRowNo,
      });
      matched = { ...created.toObject(), normalizedName: normalizeName(created.applicantName), normalizedCode: row.stCode };
      normalizedStudents.push(matched);
      createdLegacy += 1;
    }

    const master = await getOrCreateMaster(matched);
    const enrollment = await findOrCreateEnrollment(master, matched, row.stCode, row.name || row.creditName, !matchedByCode, false);
    const paymentDate = row.paymentDate;
    const existing = await StudentFeePayment.findOne({
      mrNo: row.mrNo, stCode: row.stCode, paymentDate, amountPaid: row.amountPaid,
    }).select("_id").lean();
    if (existing) { duplicates += 1; await rebuildEnrollmentLedger(enrollment._id); continue; }
    try {
      await StudentFeePayment.create({
        studentId: master._id, enrollmentId: enrollment._id, stCode: row.stCode,
        mrNo: row.mrNo, amountPaid: row.amountPaid, paymentDate,
        allocations: [], sourceSheet: parsed.sheetName, sourceRowNo: row.sourceRowNo,
        importBatchKey: sourceName,
      });
      imported += 1;
      await rebuildEnrollmentLedger(enrollment._id);
    } catch (error) {
      if (error?.code === 11000) duplicates += 1;
      else throw error;
    }
  }

  return { sheetName: parsed.sheetName, total: parsed.rows.length, imported, duplicates, unmatched, invalid, createdLegacy, errors: errors.slice(0, 100) };
}
