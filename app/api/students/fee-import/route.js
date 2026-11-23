import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Student from "@/models/Student";
import StudentMaster from "@/models/StudentMaster";
import Course from "@/models/Course";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import { normalizeHeader, normalizeStCode, normalizeName, parseExcelDate } from "@/lib/student-import/normalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let indexesReady;
async function ensureFeeImportIndexes() {
  if (!indexesReady) indexesReady = (async () => {
    const enrollmentIndexes = await StudentEnrollment.collection.indexes();
    const oldEnrollmentIndex = enrollmentIndexes.find(index =>
      index.unique && Object.keys(index.key || {}).join(",") === "studentId,stCode,normalizedFullName"
    );
    if (oldEnrollmentIndex) await StudentEnrollment.collection.dropIndex(oldEnrollmentIndex.name);
    await StudentEnrollment.collection.createIndex(
      { studentId: 1, stCode: 1, normalizedFullName: 1, courseCode: 1 },
      { unique: true, name: "student_course_enrollment_unique" }
    );

    const paymentIndexes = await StudentFeePayment.collection.indexes();
    const oldPaymentIndex = paymentIndexes.find(index =>
      index.unique && Object.keys(index.key || {}).join(",") === "mrNo,stCode,paymentDate,amountPaid"
    );
    if (oldPaymentIndex) await StudentFeePayment.collection.dropIndex(oldPaymentIndex.name);
    await StudentFeePayment.collection.createIndex(
      { studentId: 1, enrollmentId: 1, mrNo: 1, paymentDate: 1, amountPaid: 1 },
      { name: "student_course_receipt_lookup" }
    );
  })().catch(error => { indexesReady = null; throw error; });
  await indexesReady;
}

const HEADER_ALIASES = {
  studentId: ["studentid", "studentcode", "registrationcode", "registrationno", "regnno", "regno", "stcode", "enrollmentno", "admissionno"],
  studentName: ["studentname", "name", "stname", "applicantname"],
  phone: ["phone", "mobile", "mobileno", "mobilenumber", "contact", "contactno", "whatsappnumber"],
  course: ["course", "coursename", "coursecode", "program", "programname", "courselabel"],
  totalFee: ["totalfee", "coursefee", "grossfee", "feeamount", "fee"],
  discount: ["discount", "discountamount", "concession"],
  paidAmount: ["paidamount", "amountpaid", "amtpaid", "paymentamount", "paid", "amount"],
  dueAmount: ["dueamount", "balancedue", "balance", "remainingfee"],
  receiptNo: ["receiptno", "receipt", "mrno", "receipt number", "referenceno", "transactionid"],
  paymentDate: ["paymentdate", "dop", "dateofpayment", "date"],
  paymentMode: ["paymentmode", "mode", "paymentmethod", "method"],
  courseStatus: ["coursestatus", "enrollmentstatus", "status"]
};

const clean = value => String(value ?? "").trim();
const normCourse = value => clean(value).normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const numberValue = value => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const normalizePhone = value => clean(value).replace(/\D/g, "").slice(-10);
const feeStatus = (payable, paid) => paid >= payable && payable > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
const financialYear = date => {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? year : year - 1;
  return start + "-" + String(start + 1).slice(-2);
};
function findWorksheet(workbook) {
  for (const sheetName of workbook.SheetNames || []) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = grid.slice(0, 30).findIndex(row => {
      const keys = row.map(normalizeHeader);
      const hasCourse = HEADER_ALIASES.course.some(alias => keys.includes(normalizeHeader(alias)));
      const hasIdentity = HEADER_ALIASES.studentId.some(alias => keys.includes(normalizeHeader(alias)))
        || (HEADER_ALIASES.studentName.some(alias => keys.includes(normalizeHeader(alias))) && HEADER_ALIASES.phone.some(alias => keys.includes(normalizeHeader(alias))));
      const hasFee = ["totalFee", "discount", "paidAmount", "dueAmount", "receiptNo"].some(field =>
        HEADER_ALIASES[field].some(alias => keys.includes(normalizeHeader(alias)))
      );
      return hasCourse && hasIdentity && hasFee;
    });
    if (headerIndex < 0) continue;
    const headers = grid[headerIndex].map(normalizeHeader);
    const indexes = {};
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      indexes[field] = headers.findIndex(header => aliases.some(alias => normalizeHeader(alias) === header));
    }
    const rows = [];
    for (let index = headerIndex + 1; index < grid.length; index += 1) {
      const values = grid[index];
      if (!values.some(value => clean(value))) continue;
      const get = field => indexes[field] >= 0 ? values[indexes[field]] : "";
      rows.push({
        rowNo: index + 1,
        studentId: normalizeStCode(get("studentId")),
        studentName: clean(get("studentName")),
        phone: normalizePhone(get("phone")),
        courseRaw: clean(get("course")),
        totalFee: numberValue(get("totalFee")),
        discount: numberValue(get("discount")),
        paidAmount: numberValue(get("paidAmount")),
        dueAmount: numberValue(get("dueAmount")),
        receiptNo: clean(get("receiptNo")).replace(/\.0+$/, ""),
        paymentDate: parseExcelDate(get("paymentDate")),
        paymentMode: clean(get("paymentMode")),
        courseStatus: clean(get("courseStatus")),
        raw: values
      });
    }
    return { sheetName, rows };
  }
  return null;
}
function courseStatusFromRow(value, existing) {
  const status = clean(value).toLowerCase();
  if (/complete|passed|alumni|finished/.test(status)) return "COMPLETED";
  if (/enroll|active|ongoing|running/.test(status)) return "ACTIVE";
  return existing === "COMPLETED" ? "COMPLETED" : "ACTIVE";
}
function stableReceipt(row, studentId, courseCode) {
  const signature = [studentId, courseCode, row.paymentDate?.toISOString().slice(0, 10) || "", Number(row.paidAmount || 0).toFixed(2)].join("|");
  return "XLS-" + createHash("sha256").update(signature).digest("hex").slice(0, 20).toUpperCase();
}

async function findStudent(row) {
  if (row.studentId) {
    const masters = await StudentMaster.find({ stCodes: row.studentId }).limit(3).lean();
    if (masters.length === 1) return { master: masters[0], reason: "" };
    if (masters.length > 1) return { reason: "Student ID matches multiple permanent profiles." };

    const numeric = /^\d+$/.test(row.studentId) ? Number(row.studentId) : null;
    const legacy = await Student.find({
      $or: [
        { regnNo: row.studentId }, { enrollmentNo: row.studentId },
        ...(numeric === null ? [] : [{ regnNo: numeric }, { enrollmentNo: numeric }])
      ]
    }).limit(3).lean();
    if (legacy.length !== 1) return { reason: legacy.length ? "Student ID matches multiple legacy records." : "Student ID was not found." };
    let master = await StudentMaster.findOne({ legacyStudentIds: legacy[0]._id }).lean();
    if (!master) {
      master = await StudentMaster.create({
        fullName: legacy[0].applicantName || legacy[0].name || row.studentName || "Student",
        normalizedFullName: normalizeName(legacy[0].applicantName || legacy[0].name || row.studentName || "Student"),
        dob: legacy[0].dateOfBirth || legacy[0].dob || null,
        fatherName: legacy[0].fatherOrHusbandName || legacy[0].fatherName || "",
        address: legacy[0].address || legacy[0].presentAddress || "",
        photoUrl: legacy[0].photoUrl || "",
        phoneNumbers: [legacy[0].mobileNumber, legacy[0].phone, legacy[0].whatsappNumber].map(normalizePhone).filter(Boolean),
        stCodes: [row.studentId],
        legacyStudentIds: [legacy[0]._id],
        identityMatchMethod: "FEE_IMPORT_REGISTRATION_CODE"
      });
      master = master.toObject();
    }
    return { master, legacy: legacy[0], reason: "" };
  }

  if (!row.studentName || !row.phone) return { reason: "Student ID is blank; normalized student name and phone are both required for fallback matching." };
  const name = normalizeName(row.studentName);
  const masters = await StudentMaster.find({ normalizedFullName: name, phoneNumbers: row.phone }).limit(3).lean();
  if (masters.length === 1) return { master: masters[0], reason: "" };
  return { reason: masters.length ? "Name and phone match multiple permanent profiles." : "No student matched the supplied name and phone." };
}

async function findCourse(raw, courses, aliasMap) {
  const key = normCourse(raw);
  const ids = aliasMap.get(key) || [];
  if (ids.length === 1) return ids[0];
  if (ids.length > 1) return null;
  const compact = key.replace(/\s/g, "");
  const compactMatches = courses.filter(course =>
    [course.code, course.name, ...(course.aliases || []), ...(course.courseAliases || [])]
      .some(alias => normCourse(alias).replace(/\s/g, "") === compact)
  );
  return compactMatches.length === 1 ? compactMatches[0] : null;
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to upload fee records." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to import student fees." }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose an Excel or CSV file." }, { status: 400 });
    if (!/\.(xlsx|xls|csv)$/i.test(String(file.name || ""))) return NextResponse.json({ error: "Only .xlsx, .xls and .csv files are supported." }, { status: 400 });
    if (Number(file.size || 0) > 15 * 1024 * 1024) return NextResponse.json({ error: "The file must be smaller than 15 MB." }, { status: 413 });

    await connectMongoDB();
    await ensureFeeImportIndexes();
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    const worksheet = findWorksheet(workbook);
    if (!worksheet) return NextResponse.json({ error: "No fee worksheet found. Include Student ID (or Student Name + Phone), Course, and at least one fee column." }, { status: 400 });

    const courses = await Course.find({}).lean();
    const aliasMap = new Map();
    for (const course of courses) {
      for (const alias of [course.code, course.name, ...(course.aliases || []), ...(course.courseAliases || [])]) {
        const key = normCourse(alias);
        if (!key) continue;
        const list = aliasMap.get(key) || [];
        if (!list.some(item => String(item._id) === String(course._id))) list.push(course);
        aliasMap.set(key, list);
      }
    }

    const unmatchedRows = [];
    const studentCourseCounts = new Map();
    const touchedEnrollments = new Map();
    let createdPayments = 0, updatedPayments = 0, processed = 0;
    for (const row of worksheet.rows) {
      processed += 1;
      if (!row.courseRaw) { unmatchedRows.push({ row: row.rowNo, studentId: row.studentId, course: "", reason: "Course name/code is blank." }); continue; }
      const match = await findStudent(row);
      if (!match.master) { unmatchedRows.push({ row: row.rowNo, studentId: row.studentId, course: row.courseRaw, reason: match.reason }); continue; }
      const course = await findCourse(row.courseRaw, courses, aliasMap);
      if (!course) { unmatchedRows.push({ row: row.rowNo, studentId: row.studentId, course: row.courseRaw, reason: "Course name/code is unknown or maps to more than one course." }); continue; }

      const master = match.master;
      const stCode = row.studentId || normalizeStCode(master.stCodes?.[0]) || ("MASTER-" + String(master._id).slice(-8));
      const normalizedFullName = normalizeName(master.fullName || row.studentName);
      let enrollment = await StudentEnrollment.findOne({
        studentId: master._id, stCode, normalizedFullName, courseCode: course.code
      });
      if (!enrollment) {
        enrollment = await StudentEnrollment.create({
          studentId: master._id,
          courseId: course._id,
          legacyStudentId: match.legacy?._id || master.legacyStudentIds?.[0] || null,
          stCode, normalizedFullName,
          courseCode: course.code,
          courseCategory: String(course.category || "").toUpperCase().includes("DOM") ? "DOM" : "OTHER",
          semesterLabel: course.code,
          admissionDate: null,
          status: courseStatusFromRow(row.courseStatus, ""),
          feeConfig: {
            admissionFee: Number(course.admissionFee || 0),
            monthlyInstallment: Number(course.monthlyInstallment || course.monthlyFee || 0),
            durationMonths: Number(course.durationMonths || 0),
            admissionIncluded: Boolean(course.admissionIncludedInTotal),
            grossFee: Number(course.fee || 0),
            discountAmount: 0,
            netPayableFee: Number(course.fee || 0),
            registrationFee: Number(course.registrationFee || 0),
            labCharges: Number(course.labCharges || 0),
            otherCharges: Number(course.otherCharges || 0),
            feeRuleSource: "FEE_EXCEL_IMPORT",
            configured: true
          },
          installments: [],
          summary: { totalDue: Number(course.fee || 0), totalPaid: 0, balanceDue: Number(course.fee || 0), feeStatus: "Unpaid" }
        });
      }

      const grossFee = row.totalFee !== null ? row.totalFee : Number(enrollment.feeConfig?.grossFee ?? course.fee ?? 0);
      const discount = row.discount !== null ? row.discount : Number(enrollment.feeConfig?.discountAmount || 0);
      const netPayable = Math.max(0, grossFee - Math.max(0, discount));
      const nextStatus = courseStatusFromRow(row.courseStatus, enrollment.status);
      enrollment.courseId = course._id;
      enrollment.courseCode = course.code;
      enrollment.status = nextStatus;
      enrollment.feeConfig = {
        ...(enrollment.feeConfig?.toObject?.() || enrollment.feeConfig || {}),
        grossFee,
        discountAmount: Math.max(0, discount),
        netPayableFee: netPayable,
        feeRuleSource: "FEE_EXCEL_IMPORT",
        configured: true
      };
      await enrollment.save();

      let paymentCreated = false;
      if (row.paidAmount !== null && row.paidAmount > 0) {
        if (row.paymentDate === null && !row.receiptNo) {
          unmatchedRows.push({ row: row.rowNo, studentId: stCode, course: course.code, reason: "Paid amount has neither a receipt number nor a valid payment date." });
        } else {
          const mrNo = row.receiptNo || stableReceipt(row, master._id, course.code);
          let existing = await StudentFeePayment.findOne({
            studentId: master._id, enrollmentId: enrollment._id, mrNo
          }).select("_id").lean();
          if (!existing && row.paymentDate) {
            existing = await StudentFeePayment.findOne({
              studentId: master._id, enrollmentId: enrollment._id,
              paymentDate: row.paymentDate, amountPaid: row.paidAmount
            }).select("_id").lean();
          }
          const paymentValues = {
            studentId: master._id, enrollmentId: enrollment._id, courseId: course._id,
            stCode, financialYear: financialYear(row.paymentDate),
            stNameKey: normalizedFullName + "_" + stCode,
            courseCode: course.code, mrNo,
            amountPaid: row.paidAmount, paymentDate: row.paymentDate,
            rawPaymentDate: row.paymentDate, paymentMode: row.paymentMode,
            importWarnings: [], allocations: [],
            sourceSheet: worksheet.sheetName, sourceRowNo: row.rowNo,
            importBatchKey: String(file.name || "fee-upload").slice(0, 180)
          };
          if (existing) {
            await StudentFeePayment.updateOne({ _id: existing._id }, { $set: paymentValues });
            updatedPayments += 1;
          } else {
            await StudentFeePayment.create(paymentValues);
            createdPayments += 1;
            paymentCreated = true;
          }
        }
      }

      const key = String(master._id);
      const summary = studentCourseCounts.get(key) || { master, courses: new Set() };
      summary.courses.add(String(course._id));
      studentCourseCounts.set(key, summary);
      touchedEnrollments.set(String(enrollment._id), enrollment);
      if (row.dueAmount !== null && Math.abs(row.dueAmount - Math.max(0, netPayable - Number(enrollment.summary?.totalPaid || 0))) > 1) {
        // Report-only validation: imported due is not allowed to override the ledger calculation.
        unmatchedRows.push({ row: row.rowNo, studentId: stCode, course: course.code, reason: "Excel Due Amount differs from the calculated course balance; ledger balance was recalculated from receipts." });
      }
    }

    for (const enrollment of touchedEnrollments.values()) {
      const payments = await StudentFeePayment.find({ enrollmentId: enrollment._id }).select("amountPaid paymentDate").lean();
      const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
      const grossFee = Number(enrollment.feeConfig?.grossFee || 0);
      const discount = Number(enrollment.feeConfig?.discountAmount || 0);
      const payable = Math.max(0, grossFee - discount);
      const balanceDue = Math.max(0, payable - totalPaid);
      const status = feeStatus(payable, totalPaid);
      await StudentEnrollment.updateOne({ _id: enrollment._id }, {
        $set: {
          "feeConfig.netPayableFee": payable,
          "summary.totalDue": payable,
          "summary.totalPaid": totalPaid,
          "summary.balanceDue": balanceDue,
          "summary.feeStatus": status
        }
      });
    }

    const updatedStudents = [];
    for (const { master, courses: courseIds } of studentCourseCounts.values()) {
      const allEnrollments = await StudentEnrollment.find({ studentId: master._id }).select("feeConfig summary status").lean();
      const totalFee = allEnrollments.reduce((sum, item) => sum + Number(item.feeConfig?.grossFee || 0), 0);
      const discount = allEnrollments.reduce((sum, item) => sum + Number(item.feeConfig?.discountAmount || 0), 0);
      const totalPaid = allEnrollments.reduce((sum, item) => sum + Number(item.summary?.totalPaid || 0), 0);
      const balanceDue = allEnrollments.reduce((sum, item) => sum + Number(item.summary?.balanceDue ?? Math.max(0, Number(item.feeConfig?.netPayableFee || 0) - Number(item.summary?.totalPaid || 0))), 0);
      const payable = Math.max(0, totalFee - discount);
      const status = feeStatus(payable, totalPaid);
      const feeSummary = { totalFee, discount, totalPaid, balanceDue, feeStatus: status, courseCount: allEnrollments.length, updatedAt: new Date() };
      await StudentMaster.updateOne({ _id: master._id }, { $set: { feeSummary } });
      const legacyIds = master.legacyStudentIds || [];
      if (legacyIds.length) await Student.updateMany({ _id: { $in: legacyIds } }, { $set: { dueAmount: balanceDue, paymentStatus: status } });
      updatedStudents.push({ studentId: String(master._id), name: master.fullName, coursesMapped: courseIds.size, feeSummary });
    }

    return NextResponse.json({
      message: "Course-wise fee import completed. Fee totals were recalculated separately for each student and course.",
      worksheet: worksheet.sheetName,
      totalRowsProcessed: processed,
      studentsUpdated: updatedStudents,
      newFeeRecordsCreated: createdPayments,
      existingFeeRecordsUpdated: updatedPayments,
      unmatchedRows
    });
  } catch (error) {
    console.error("[student-fee-import] Import failed:", error?.message || "Unknown error");
    return NextResponse.json({ error: "Unable to import course-wise fee records.", detail: error?.message || "Unknown error" }, { status: 500 });
  }
}
