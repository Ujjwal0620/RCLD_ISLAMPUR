import * as XLSX from "xlsx";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import StudentFeeImportReview from "@/models/StudentFeeImportReview";
import { parseExcelDate, normalizeHeader, normalizeStCode } from "./normalization";

const clean = value => String(value ?? "").trim();
const normalizeName = value => clean(value).normalize("NFKC").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const normalizeCourse = value => clean(value).toUpperCase().replace(/[^A-Z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();
const parseIdentity = value => {
  const firstLine = clean(value).split(/\r?\n/)[0].trim();
  const splitAt = firstLine.lastIndexOf("_");
  if (splitAt <= 0) return { cleanName: normalizeName(firstLine), extractedStCode: "", stNameKey: "" };
  const cleanName = normalizeName(firstLine.slice(0, splitAt));
  const extractedStCode = normalizeStCode(firstLine.slice(splitAt + 1));
  return { cleanName, extractedStCode, stNameKey: cleanName && extractedStCode ? cleanName + "_" + extractedStCode : "" };
};
const financialYear = date => {
  if (!date) return "";
  const y = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? y : y - 1;
  return start + "-" + String(start + 1).slice(-2);
};
const dayKey = date => date ? new Date(date).toISOString().slice(0, 10) : "";
const receiptKey = row => [row.financialYear, row.mrNo, row.stNameKey, dayKey(row.paymentDate), Number(row.amountPaid).toFixed(2)].join("|");

function readSheetRows(workbook, requiredHeaders) {
  for (const sheetName of workbook.SheetNames || []) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = grid.findIndex(row => requiredHeaders.every(key => row.map(normalizeHeader).includes(key)));
    if (headerIndex < 0) continue;
    const headers = grid[headerIndex].map(normalizeHeader);
    const getIndex = key => headers.indexOf(key);
    return {
      sheetName,
      rows: grid.slice(headerIndex + 1).map((values, offset) => ({
        rowNo: headerIndex + offset + 2,
        get: key => getIndex(key) < 0 ? "" : values[getIndex(key)]
      }))
    };
  }
  return null;
}

async function flagReview(row, reason) {
  const reviewKey = "FEE_ONLY|" + receiptKey(row) + "|" + reason;
  await StudentFeeImportReview.updateOne({ reviewKey }, { $setOnInsert: {
    reviewKey, ...row, reason, status: "PENDING"
  } }, { upsert: true });
}

export async function reconcileStudentFeesOnly(workbook, { sourceName = "Fee-only reconciliation" } = {}) {
  const studentSheet = readSheetRows(workbook, ["stcode", "stname", "course"]);
  const feeSheet = readSheetRows(workbook, ["stcode", "stname", "amtpaid", "mrno", "dop"]);
  if (!studentSheet || !feeSheet) {
    return {
      feeSheetFound: Boolean(feeSheet), studentDataSheetFound: Boolean(studentSheet),
      linkedReceipts: 0, duplicates: 0, ambiguousReceiptsFlagged: 0,
      errors: ["Both Student Data (St_Code, St_Name, Course) and fee receipt (St_Code, St_Name, Amt_Paid, MR_No, D_O_P) worksheets are required. No student or enrollment records were changed."]
    };
  }

  const referenceByKey = new Map();
  for (const sourceRow of studentSheet.rows) {
    const identity = parseIdentity(sourceRow.get("stname"));
    if (!identity.stNameKey) continue;
    const list = referenceByKey.get(identity.stNameKey) || [];
    list.push({
      ...identity,
      sourceStCode: normalizeStCode(sourceRow.get("stcode")),
      courseCode: clean(sourceRow.get("course")).toUpperCase(),
      sourceRowNo: sourceRow.rowNo
    });
    referenceByKey.set(identity.stNameKey, list);
  }

  const masters = await StudentMaster.find({}).lean();
  let linkedReceipts = 0, duplicates = 0, legacyReceiptsLinked = 0, ambiguousReceiptsFlagged = 0, invalidRows = 0;
  for (const sourceRow of feeSheet.rows) {
    const identity = parseIdentity(sourceRow.get("stname"));
    const paymentDate = parseExcelDate(sourceRow.get("dop"));
    const amountPaid = Number(clean(sourceRow.get("amtpaid")).replace(/[₹,\s]/g, ""));
    const row = {
      sourceSheet: feeSheet.sheetName, sourceRowNo: sourceRow.rowNo,
      ...identity, stCode: normalizeStCode(sourceRow.get("stcode")),
      mrNo: clean(sourceRow.get("mrno")).replace(/\.0+$/, ""),
      amountPaid, paymentDate, financialYear: financialYear(paymentDate),
      rawRow: { St_Code: sourceRow.get("stcode"), St_Name: sourceRow.get("stname"), Amt_Paid: sourceRow.get("amtpaid"), MR_No: sourceRow.get("mrno"), D_O_P: sourceRow.get("dop") }
    };
    if (!row.stNameKey || !row.extractedStCode || !row.mrNo || !paymentDate || !Number.isFinite(amountPaid) || amountPaid < 0) {
      invalidRows += 1;
      await flagReview(row, "INVALID_FEE_ROW");
      continue;
    }

    const refs = referenceByKey.get(row.stNameKey) || [];
    if (refs.length !== 1 || refs[0].extractedStCode !== row.extractedStCode) {
      ambiguousReceiptsFlagged += 1;
      await flagReview(row, refs.length > 1 ? "AMBIGUOUS_STUDENT_DATA_ROW" : "STUDENT_DATA_ROW_NOT_FOUND");
      continue;
    }
    const ref = refs[0];
    if (ref.sourceStCode && ref.sourceStCode !== row.extractedStCode) {
      ambiguousReceiptsFlagged += 1;
      await flagReview(row, "STUDENT_DATA_STCODE_COLUMN_MISMATCH");
      continue;
    }
    const profiles = masters.filter(master =>
      (master.stCodes || []).map(normalizeStCode).includes(row.extractedStCode)
      && normalizeName(master.fullName) === row.cleanName
    );
    if (profiles.length !== 1) {
      ambiguousReceiptsFlagged += 1;
      await flagReview(row, profiles.length ? "AMBIGUOUS_EXISTING_STUDENT_PROFILE" : "EXISTING_STUDENT_PROFILE_NOT_FOUND");
      continue;
    }

    const master = profiles[0];
    const allEnrollments = await StudentEnrollment.find({ studentId: master._id, stCode: row.extractedStCode }).lean();
    const courseKey = normalizeCourse(ref.courseCode);
    const enrollments = allEnrollments.filter(item => normalizeCourse(item.courseCode) === courseKey);
    if (enrollments.length !== 1) {
      ambiguousReceiptsFlagged += 1;
      await flagReview(row, enrollments.length ? "AMBIGUOUS_EXISTING_ENROLLMENT" : "EXISTING_COURSE_ENROLLMENT_NOT_FOUND");
      continue;
    }
    const enrollment = enrollments[0];
    const courseCode = enrollment.courseCode;
    let existing = await StudentFeePayment.findOne({
      mrNo: row.mrNo, stCode: row.extractedStCode,
      paymentDate: row.paymentDate, amountPaid: row.amountPaid
    }).select("_id studentId enrollmentId").lean();
    if (!existing) {
      existing = await StudentFeePayment.findOne({
        financialYear: row.financialYear, mrNo: row.mrNo,
        stNameKey: row.stNameKey, paymentDate: row.paymentDate,
        amountPaid: row.amountPaid
      }).select("_id studentId enrollmentId").lean();
    }
    if (existing) {
      await StudentFeePayment.updateOne({ _id: existing._id }, { $set: {
        studentId: master._id, enrollmentId: enrollment._id,
        stCode: row.extractedStCode, financialYear: row.financialYear,
        stNameKey: row.stNameKey, courseCode
      } });
      duplicates += 1;
      continue;
    }
    try {
      await StudentFeePayment.create({
        studentId: master._id, enrollmentId: enrollment._id,
        stCode: row.extractedStCode, mrNo: row.mrNo, amountPaid,
        paymentDate, rawPaymentDate: paymentDate, financialYear: row.financialYear,
        stNameKey: row.stNameKey, courseCode, importWarnings: [],
        allocations: [], sourceSheet: row.sourceSheet,
        sourceRowNo: row.sourceRowNo, importBatchKey: sourceName
      });
      linkedReceipts += 1;
      if (paymentDate < new Date(Date.UTC(2025, 3, 1))) legacyReceiptsLinked += 1;
    } catch (error) {
      if (error?.code === 11000) duplicates += 1;
      else throw error;
    }
  }
  return {
    feeSheetFound: true, studentDataSheetFound: true,
    studentReferenceRows: studentSheet.rows.length, totalRows: feeSheet.rows.length,
    linkedReceipts, duplicates, legacyReceiptsLinked,
    ambiguousReceiptsFlagged, invalidRows,
    studentRecordsModified: 0, studentMasterRecordsModified: 0,
    enrollmentRecordsModified: 0
  };
}
