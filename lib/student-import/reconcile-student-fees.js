import * as XLSX from "xlsx";
import Student from "@/models/Student";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import StudentFeeImportReview from "@/models/StudentFeeImportReview";
import { parseExcelDate, normalizeHeader, normalizeStCode } from "./normalization";

const clean = value => String(value ?? "").trim();
const normalizePerson = value => clean(value).normalize("NFKC").toUpperCase()
  .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function parseStNameIdentity(rawValue) {
  const firstLine = clean(rawValue).split(/\r?\n/)[0].trim();
  const splitAt = firstLine.lastIndexOf("_");
  if (splitAt <= 0) return { cleanName: normalizePerson(firstLine), extractedStCode: "", stNameKey: "" };
  const cleanName = normalizePerson(firstLine.slice(0, splitAt));
  const extractedStCode = normalizeStCode(firstLine.slice(splitAt + 1));
  return {
    cleanName,
    extractedStCode,
    stNameKey: cleanName && extractedStCode ? cleanName + "_" + extractedStCode : ""
  };
}

function financialYearFor(date) {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? year : year - 1;
  return start + "-" + String(start + 1).slice(-2);
}

function receiptKey(row) {
  return [row.financialYear, row.mrNo, row.stNameKey, row.paymentDate ? row.paymentDate.toISOString().slice(0, 10) : "", Number(row.amountPaid).toFixed(2)].join("|");
}

function extractPhones(student) {
  return [...new Set([student.mobileNumber, student.phone, student.whatsappNumber, student.guardianContactNumber, student.sourcePhone]
    .join(",").split(/[,;/|]/).map(value => value.replace(/\D/g, "")).map(value => value.length > 10 ? value.slice(-10) : value)
    .filter(value => value.length === 10))];
}

function normalizeFather(value) {
  return normalizePerson(value)
    .replace(/\bKR\b/g, "KUMAR")
    .replace(/\bMD\b|\bMOHD\b/g, "MOHAMMAD")
    .replace(/\bSK\b/g, "SHEIKH")
    .replace(/\s+/g, " ").trim();
}

function dateOnly(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function getFinancialYearFromSheetOrDate(date, sheetName) {
  return financialYearFor(date) || clean(sheetName).match(/20\d{2}/)?.[0] || "";
}

function parseFeeWorksheet(workbook) {
  const found = [];
  for (const sheetName of workbook.SheetNames || []) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = grid.findIndex(row => {
      const headers = row.map(normalizeHeader);
      return ["stcode", "stname", "amtpaid", "mrno", "dop"].every(key => headers.includes(key));
    });
    if (headerIndex < 0) continue;
    const headers = grid[headerIndex].map(normalizeHeader);
    const at = key => headers.indexOf(key);
    for (let index = headerIndex + 1; index < grid.length; index += 1) {
      const values = grid[index];
      if (!values.some(value => clean(value))) continue;
      const get = key => at(key) >= 0 ? values[at(key)] : "";
      const identity = parseStNameIdentity(get("stname"));
      const paymentDate = parseExcelDate(get("dop"));
      const amountRaw = clean(get("amtpaid")).replace(/[₹,\s]/g, "");
      const amountPaid = Number(amountRaw);
      const mrNo = clean(get("mrno")).replace(/\.0+$/, "");
      const stCode = normalizeStCode(get("stcode"));
      found.push({
        sourceSheet: sheetName, sourceRowNo: index + 1, stCode,
        ...identity, mrNo, paymentDate,
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : NaN,
        financialYear: financialYearFor(paymentDate),
        rawRow: Object.fromEntries(headers.map((header, column) => [header || "column_" + column, values[column]]))
      });
    }
  }
  return found;
}

async function getOrCreateMasterForStudent(student) {
  let master = await StudentMaster.findOne({ legacyStudentIds: student._id });
  const name = student.applicantName || student.sourceStudentName || student.name || "Unknown Student";
  const normalizedName = normalizePerson(name);
  const dob = student.dateOfBirth || student.dob;
  if (!master) {
    const father = normalizeFather(student.fatherOrHusbandName || student.fatherName);
    const phones = extractPhones(student);
    const possibleMasters = await StudentMaster.find({ normalizedFullName: normalizedName }).lean();
    const safeMatches = possibleMasters.filter(candidate => {
      const candidateDob = dateOnly(candidate.dob);
      const incomingDob = dateOnly(dob);
      if (candidateDob && incomingDob && candidateDob !== incomingDob) return false;
      const sameDob = Boolean(candidateDob && incomingDob && candidateDob === incomingDob);
      const candidateFather = normalizeFather(candidate.fatherName);
      const sameFather = Boolean(father && candidateFather && father === candidateFather);
      const samePhone = phones.some(phone => (candidate.phoneNumbers || []).map(value => String(value).replace(/\\D/g, "").slice(-10)).includes(phone));
      return sameDob || sameFather || samePhone;
    });
    if (safeMatches.length === 1) {
      master = await StudentMaster.findById(safeMatches[0]._id);
      if (!master.legacyStudentIds.some(id => String(id) === String(student._id))) master.legacyStudentIds.push(student._id);
      const incomingCode = normalizeStCode(student.regnNo || student.enrollmentNo);
      if (incomingCode && !master.stCodes.includes(incomingCode)) master.stCodes.push(incomingCode);
      master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...phones])];
      await master.save();
    }
  }
  if (!master) {
    master = await StudentMaster.create({
      fullName: name,
      normalizedFullName: normalizePerson(name),
      dob: dob && !Number.isNaN(new Date(dob).getTime()) ? new Date(dob) : null,
      gender: student.sex || student.gender || "",
      fatherName: student.fatherOrHusbandName || student.fatherName || "",
      normalizedFatherName: normalizeFather(student.fatherOrHusbandName || student.fatherName),
      address: student.address || student.presentAddress || "",
      photoUrl: student.photoUrl || "",
      phoneNumbers: extractPhones(student),
      qualification: student.sourceQualification || student.qualification || "",
      stCodes: [normalizeStCode(student.regnNo || student.enrollmentNo)].filter(Boolean),
      legacyStudentIds: [student._id],
      identityMatchMethod: "FEE_RECONCILIATION_ADDITIVE"
    });
  } else {
    const code = normalizeStCode(student.regnNo || student.enrollmentNo);
    if (code && !(master.stCodes || []).includes(code)) {
      master.stCodes = [...(master.stCodes || []), code];
      await master.save();
    }
  }
  return master;
}

export async function linkStudentRecordsSafely(studentDocuments = []) {
  const ordered = [...studentDocuments].sort((a, b) =>
    String(a.admissionDate || a.dateOfAdmission || "").localeCompare(String(b.admissionDate || b.dateOfAdmission || ""))
  );
  let linked = 0;
  for (const student of ordered) {
    const master = await getOrCreateMasterForStudent(student);
    const stCode = normalizeStCode(student.regnNo || student.enrollmentNo);
    if (stCode) await getOrCreateEnrollment(master, student, stCode,
      student.applicantName || student.sourceStudentName || student.name, false);
    linked += 1;
  }
  return { linked };
}

async function getOrCreateEnrollment(master, student, stCode, cleanName, legacy = false) {
  const normalizedFullName = normalizePerson(cleanName || student.applicantName || student.sourceStudentName);
  let enrollment = await StudentEnrollment.findOne({ studentId: master._id, stCode, normalizedFullName });
  if (enrollment) return enrollment;
  const courseCode = legacy ? "LEGACY / PRE-2025"
    : String(student.sourceCourseLabel || student.courseCode || student.course || "LEGACY").trim().toUpperCase();
  const admissionDate = student.admissionDate || student.dateOfAdmission || null;
  enrollment = await StudentEnrollment.create({
    studentId: master._id, legacyStudentId: student._id || null, stCode,
    normalizedFullName, formNo: student.formNo || "",
    courseCode, semesterLabel: legacy ? "LEGACY / PRE-2025" : (student.sourceCourseLabel || courseCode),
    admissionDate: admissionDate && !Number.isNaN(new Date(admissionDate).getTime()) ? new Date(admissionDate) : null,
    status: legacy ? "LEGACY" : "ACTIVE",
    feeConfig: { feeRuleSource: "FEE_RECONCILIATION", configured: false, grossFee: 0, netPayableFee: 0 },
    installments: []
  });
  if (!legacy) {
    const existingActive = await StudentEnrollment.findOne({ studentId: master._id, status: "ACTIVE", _id: { $ne: enrollment._id } });
    if (existingActive) {
      // Keep the newest admission active; earlier enrollment history is retained.
      const oldDate = existingActive.admissionDate ? new Date(existingActive.admissionDate) : new Date(0);
      const newDate = enrollment.admissionDate ? new Date(enrollment.admissionDate) : new Date(0);
      if (newDate >= oldDate) {
        existingActive.status = "PROMOTED";
        await existingActive.save();
        master.activeEnrollmentId = enrollment._id;
      } else {
        enrollment.status = "PROMOTED";
        await enrollment.save();
      }
    } else {
      master.activeEnrollmentId = enrollment._id;
    }
    await master.save();
  }
  return enrollment;
}

export async function reconcileStudentFees(workbook, { sourceName = "Fee reconciliation import" } = {}) {
  const rows = parseFeeWorksheet(workbook);
  if (!rows.length) return { feeSheetFound: false, totalRows: 0, linkedReceipts: 0, duplicates: 0, legacyReceiptsLinked: 0, ambiguousReceiptsFlagged: 0, invalidRows: 0, errors: ["No fee worksheet found."] };

  const students = await Student.find({}).lean();
  const identities = students.map(student => ({
    student,
    cleanName: normalizePerson((student.sourceStudentName || student.applicantName || student.name || "").split(/\r?\n/)[0].replace(/_\d+\s*$/, "")),
    stCode: normalizeStCode(student.regnNo || student.enrollmentNo),
    dob: dateOnly(student.dateOfBirth || student.dob),
    father: normalizeFather(student.fatherOrHusbandName || student.fatherName),
    phones: extractPhones(student)
  }));
  const profileByStudentId = new Map();
  let linkedReceipts = 0, duplicates = 0, legacyReceiptsLinked = 0, ambiguousReceiptsFlagged = 0, invalidRows = 0;

  for (const row of rows) {
    if (!row.stNameKey || !row.extractedStCode || !row.mrNo || !row.paymentDate || !Number.isFinite(row.amountPaid) || row.amountPaid < 0) {
      invalidRows += 1;
      const reviewKey = "INVALID|" + receiptKey(row) + "|" + row.sourceSheet + "|" + row.sourceRowNo;
      await StudentFeeImportReview.updateOne({ reviewKey }, { $setOnInsert: { reviewKey, ...row, reason: "INVALID_FEE_ROW" } }, { upsert: true });
      continue;
    }

    // St_Name is the identity source. The visible St_Code column is deliberately not used for matching.
    const candidates = identities.filter(item => item.stCode === row.extractedStCode && item.cleanName === row.cleanName);
    let matchedStudent = candidates.length === 1 ? candidates[0].student : null;
    let legacy = false;

    if (!matchedStudent && row.paymentDate < new Date(Date.UTC(2025, 3, 1))) {
      const nameMatches = identities.filter(item => item.cleanName === row.cleanName);
      const masterMatches = [];
      for (const item of nameMatches) {
        const master = await getOrCreateMasterForStudent(item.student);
        if (!masterMatches.some(existing => String(existing._id) === String(master._id))) masterMatches.push(master);
      }
      if (masterMatches.length === 1 && nameMatches.length) {
        matchedStudent = nameMatches[0].student;
        legacy = true;
      }
    }

    if (!matchedStudent) {
      ambiguousReceiptsFlagged += 1;
      const reason = candidates.length > 1 ? "AMBIGUOUS_STCODE_AND_NAME" : "UNMATCHED_OR_AMBIGUOUS_RECEIPT";
      const reviewKey = "REVIEW|" + receiptKey(row);
      await StudentFeeImportReview.updateOne({ reviewKey }, { $setOnInsert: { reviewKey, ...row, reason } }, { upsert: true });
      continue;
    }

    const master = await getOrCreateMasterForStudent(matchedStudent);
    const stCode = row.extractedStCode;
    const enrollment = await getOrCreateEnrollment(master, matchedStudent, stCode, row.cleanName, legacy);
    const key = receiptKey(row);
    const existing = await StudentFeePayment.findOne({
      financialYear: row.financialYear,
      mrNo: row.mrNo,
      stNameKey: row.stNameKey,
      paymentDate: row.paymentDate,
      amountPaid: row.amountPaid
    }).select("_id studentId enrollmentId").lean();

    if (existing) {
      if (String(existing.studentId) !== String(master._id) || String(existing.enrollmentId) !== String(enrollment._id)) {
        await StudentFeePayment.updateOne({ _id: existing._id }, { $set: { studentId: master._id, enrollmentId: enrollment._id, stCode, financialYear: row.financialYear, stNameKey: row.stNameKey, courseCode: enrollment.courseCode } });
      }
      duplicates += 1;
      continue;
    }

    try {
      await StudentFeePayment.create({
        studentId: master._id, enrollmentId: enrollment._id, stCode, mrNo: row.mrNo,
        amountPaid: row.amountPaid, paymentDate: row.paymentDate, rawPaymentDate: row.paymentDate,
        financialYear: row.financialYear, stNameKey: row.stNameKey, courseCode: enrollment.courseCode,
        importWarnings: [], allocations: [], sourceSheet: row.sourceSheet,
        sourceRowNo: row.sourceRowNo, importBatchKey: sourceName
      });
      linkedReceipts += 1;
      if (legacy) legacyReceiptsLinked += 1;
    } catch (error) {
      if (error?.code === 11000) duplicates += 1;
      else throw error;
    }
  }

  const masters = await StudentMaster.find({}).lean();
  const multiSemesterStudentsMerged = masters.filter(master => (master.stCodes || []).length > 1).length;
  return {
    feeSheetFound: true, totalRows: rows.length, unifiedStudents: masters.length,
    multiSemesterStudentsMerged, linkedReceipts, duplicates, legacyReceiptsLinked,
    ambiguousReceiptsFlagged, invalidRows
  };
}
