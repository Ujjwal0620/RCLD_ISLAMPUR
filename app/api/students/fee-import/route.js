import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import StudentMaster from "@/models/StudentMaster";
import Student from "@/models/Student";
import Course from "@/models/Course";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import { normalizeHeader, normalizeName, normalizeFatherName, normalizeStCode, parsePhones, parseExcelDate } from "@/lib/student-import/normalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = value => String(value ?? "").trim();
const normCourse = value => clean(value).normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const amount = value => {
  if (value === null || value === undefined || clean(value) === "") return null;
  const parsed = Number(String(value).replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const dateSort = (a, b) => (b ? new Date(b).getTime() : 0) - (a ? new Date(a).getTime() : 0);
const feeStatus = (payable, paid) => payable <= 0 || paid >= payable ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
const financialYear = date => {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? year : year - 1;
  return start + "-" + String(start + 1).slice(-2);
};
const cleanStudentName = (name, code) => {
  const raw = clean(name);
  const suffix = code ? "_" + String(code).trim() : "";
  return (suffix && raw.toUpperCase().endsWith(suffix.toUpperCase()) ? raw.slice(0, -suffix.length) : raw).trim();
};
function readRows(sheet) {
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = grid.slice(0, 30).findIndex(row => row.map(normalizeHeader).includes("stcode"));
  if (headerIndex < 0) return [];
  const headers = grid[headerIndex].map(normalizeHeader);
  return grid.slice(headerIndex + 1).map((values, index) => {
    const get = name => {
      const column = headers.indexOf(normalizeHeader(name));
      return column < 0 ? "" : values[column];
    };
    return { rowNo: headerIndex + index + 2, get, values };
  }).filter(row => row.values.some(value => clean(value)));
}
function sameIdentity(master, row) {
  if (normalizeName(master.fullName || master.normalizedFullName) !== row.cleanNameKey) return false;
  const oldPhones = new Set((master.phoneNumbers || []).map(value => clean(value).replace(/\D/g, "").slice(-10)).filter(value => value.length === 10));
  const phoneMatch = row.phones.some(phone => oldPhones.has(phone));
  const dobMatch = Boolean(row.dob && master.dob && new Date(row.dob).toISOString().slice(0, 10) === new Date(master.dob).toISOString().slice(0, 10));
  const fatherMatch = Boolean(row.fatherKey && row.fatherKey === normalizeFatherName(master.fatherName || ""));
  return phoneMatch || (dobMatch && fatherMatch);
}
async function findOrCreateMaster(row) {
  const candidates = await StudentMaster.find({ normalizedFullName: row.cleanNameKey }).limit(50);
  const matches = candidates.filter(master => sameIdentity(master, row));
  if (matches.length > 1) return { reason: "Name and identity details match multiple student profiles; manual merge is required." };
  if (matches.length === 1) return { master: matches[0], created: false };
  const master = await StudentMaster.create({
    fullName: row.cleanName,
    normalizedFullName: row.cleanNameKey,
    dob: row.dob,
    gender: row.gender,
    fatherName: row.fatherName,
    normalizedFatherName: row.fatherKey,
    address: row.address,
    phoneNumbers: row.phones,
    qualification: row.qualification,
    formNo: row.formNo,
    identityMatchMethod: "WORKBOOK_NAME_PHONE_OR_DOB_FATHER"
  });
  return { master, created: true };
}
async function findCourse(raw, courses) {
  const key = normCourse(raw);
  if (!key) return null;
  const matches = courses.filter(course =>
    [course.code, course.name, ...(course.aliases || []), ...(course.courseAliases || [])]
      .some(alias => normCourse(alias) === key || normCourse(alias).replace(/\s/g, "") === key.replace(/\s/g, ""))
  );
  return matches.length === 1 ? matches[0] : null;
}
async function ensureReceiptIndex() {
  const indexes = await StudentFeePayment.collection.indexes();
  const existing = indexes.find(index => index.unique
    && Object.keys(index.key || {}).length === 4
    && ["stCode", "mrNo", "paymentDate", "amountPaid"].every(key => Object.prototype.hasOwnProperty.call(index.key, key)));
  if (!existing) {
    await StudentFeePayment.collection.createIndex(
      { stCode: 1, mrNo: 1, paymentDate: 1, amountPaid: 1 },
      { unique: true, name: "stcode_receipt_date_amount_unique", partialFilterExpression: { stCode: { $type: "string", $gt: "" }, mrNo: { $type: "string", $gt: "" }, paymentDate: { $type: "date" }, amountPaid: { $type: "number" } } }
    );
  }
}
function parseStudentRow(source) {
  const code = normalizeStCode(source.get("St_Code"));
  const cleanName = cleanStudentName(source.get("St_Name"), code);
  return {
    rowNo: source.rowNo,
    stCode: code,
    cleanName,
    cleanNameKey: normalizeName(cleanName),
    dob: parseExcelDate(source.get("D_O_B")),
    gender: clean(source.get("Sex")),
    fatherName: clean(source.get("St_Father")),
    fatherKey: normalizeFatherName(source.get("St_Father")),
    address: clean(source.get("Address")),
    phones: parsePhones(source.get("Ph_no")),
    qualification: clean(source.get("Qualification")),
    formNo: clean(source.get("Form_no")).replace(/\.0+$/, ""),
    dateOfAdmission: parseExcelDate(source.get("D_O_A")),
    course: clean(source.get("Course"))
  };
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to upload student and fee records." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to import student and fee records." }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose an Excel workbook." }, { status: 400 });
    if (!/\.(xlsx|xls)$/i.test(String(file.name || ""))) return NextResponse.json({ error: "Upload an .xlsx or .xls workbook containing Student Data and a fee sheet." }, { status: 400 });
    if (Number(file.size || 0) > 15 * 1024 * 1024) return NextResponse.json({ error: "The file must be smaller than 15 MB." }, { status: 413 });

    await connectMongoDB();
    await ensureReceiptIndex();
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    const studentSheetName = (workbook.SheetNames || []).find(name => normalizeHeader(name) === "studentdata");
    const feeSheetName = (workbook.SheetNames || []).find(name => name !== studentSheetName);
    if (!studentSheetName || !feeSheetName) return NextResponse.json({ error: "Workbook must contain Student Data and one fee sheet." }, { status: 400 });

    const studentSourceRows = readRows(workbook.Sheets[studentSheetName]);
    const feeSourceRows = readRows(workbook.Sheets[feeSheetName]);
    const requiredStudentHeaders = ["stcode", "stname", "dob", "sex", "stfather", "address", "phno", "qualification", "formno", "doa", "course"];
    const studentGrid = XLSX.utils.sheet_to_json(workbook.Sheets[studentSheetName], { header: 1, defval: "", raw: true });
    const studentHeaders = studentGrid.slice(0, 30).flat().map(normalizeHeader);
    if (!requiredStudentHeaders.every(header => studentHeaders.includes(header))) {
      return NextResponse.json({ error: "Student Data is missing one or more required columns: St_Code, St_Name, D_O_B, Sex, St_Father, Address, Ph_no, Qualification, Form_no, D_O_A, Course." }, { status: 400 });
    }
    if (!feeSourceRows.length) return NextResponse.json({ error: "The fee sheet has no data rows." }, { status: 400 });

    const courses = await Course.find({}).lean();
    const courseByCode = new Map();
    const touchedMasters = new Map();
    const codeMap = new Map();
    const studentDataByName = new Map();
    const unmatchedRows = [];
    let studentsUpdated = 0;
    let newEnrollmentsLinked = 0;
    let newReceiptsAdded = 0;
    let duplicateReceiptsSkipped = 0;
    let studentRowsProcessed = 0;

    // First pass: resolve every current registration from Student Data.
    for (const source of studentSourceRows) {
      const row = parseStudentRow(source);
      if (!row.stCode || !row.cleanNameKey) {
        unmatchedRows.push({ row: row.rowNo, studentId: row.stCode, course: row.course, reason: "Student Data row has no St_Code or student name." });
        continue;
      }
      studentRowsProcessed += 1;
      let legacyStudent = await Student.findOne({ $or: [{ regnNo: row.stCode }, { enrollmentNo: row.stCode }] });
      const resolved = await findOrCreateMaster(row);
      if (!resolved.master) {
        unmatchedRows.push({ row: row.rowNo, studentId: row.stCode, course: row.course, reason: resolved.reason });
        continue;
      }
      const master = resolved.master;
      if (!legacyStudent && master.legacyStudentIds?.length) {
        legacyStudent = await Student.findById(master.legacyStudentIds[master.legacyStudentIds.length - 1]);
      }
      if (!legacyStudent && !(master.legacyStudentIds || []).length) {
        const courseForStudent = await findCourse(row.course, courses);
        legacyStudent = await Student.create({
          regnNo: row.stCode, enrollmentNo: row.stCode, formNo: row.formNo,
          applicantName: row.cleanName, name: row.cleanName, sourceStudentName: row.cleanName,
          dateOfBirth: row.dob ? row.dob.toISOString().slice(0, 10) : "",
          dob: row.dob ? row.dob.toISOString().slice(0, 10) : "",
          sex: row.gender, gender: row.gender,
          fatherOrHusbandName: row.fatherName, fatherName: row.fatherName,
          address: row.address, presentAddress: row.address,
          mobileNumber: row.phones[0] || "", whatsappNumber: row.phones[1] || "",
          sourcePhone: row.phones.join(", "), qualification: row.qualification,
          sourceQualification: row.qualification,
          admissionDate: row.dateOfAdmission ? row.dateOfAdmission.toISOString().slice(0, 10) : "",
          dateOfAdmission: row.dateOfAdmission ? row.dateOfAdmission.toISOString().slice(0, 10) : "",
          courseName: courseForStudent?.name || row.course,
          courseCode: courseForStudent?.code || normCourse(row.course).replace(/\\s/g, "-"),
          course: row.course, sourceCourseLabel: row.course,
          sourceSex: row.gender, sourceAddressRaw: row.address,
          status: "Active", hasPhoto: false
        });
      }
      if (legacyStudent && !(master.legacyStudentIds || []).some(id => String(id) === String(legacyStudent._id))) {
        master.legacyStudentIds.push(legacyStudent._id);
      }
      const incomingDate = row.dateOfAdmission;
      const existingDate = master.currentAdmissionDate || master.dateOfAdmission || null;
      const isNewerOrEqual = Boolean(incomingDate && (!existingDate || incomingDate.getTime() >= new Date(existingDate).getTime()));
      const isNewCode = !(master.enrollments || []).some(item => String(item.stCode) === row.stCode);
      if (isNewCode) {
        master.enrollments.push({
          stCode: row.stCode, course: row.course || "Previous Course (Legacy)",
          dateOfAdmission: incomingDate, formNo: row.formNo, isCurrent: false, identitySource: "STUDENT_DATA"
        });
        newEnrollmentsLinked += 1;
      } else {
        const entry = master.enrollments.find(item => String(item.stCode) === row.stCode);
        if (entry) {
          if (!entry.course && row.course) entry.course = row.course;
          if (!entry.dateOfAdmission && incomingDate) entry.dateOfAdmission = incomingDate;
          if (!entry.formNo && row.formNo) entry.formNo = row.formNo;
        }
      }
      if (!(master.stCodes || []).includes(row.stCode)) master.stCodes.push(row.stCode);

      // Fill blank identity fields only; do not touch photo, ID card, or populated manual fields.
      if (!master.fullName) master.fullName = row.cleanName;
      if (!master.normalizedFullName) master.normalizedFullName = row.cleanNameKey;
      if (!master.dob && row.dob) master.dob = row.dob;
      if (!master.gender && row.gender) master.gender = row.gender;
      if (!master.fatherName && row.fatherName) master.fatherName = row.fatherName;
      if (!master.normalizedFatherName && row.fatherKey) master.normalizedFatherName = row.fatherKey;
      if (!master.address && row.address) master.address = row.address;
      if (!master.qualification && row.qualification) master.qualification = row.qualification;
      if (!master.formNo && row.formNo) master.formNo = row.formNo;
      if (isNewerOrEqual) {
        master.currentStCode = row.stCode;
        master.currentCourse = row.course;
        master.currentAdmissionDate = incomingDate;
        master.dateOfAdmission = incomingDate;
        master.formNo = row.formNo || master.formNo;
        if (row.address) master.address = row.address;
        if (row.phones.length) master.phoneNumbers = row.phones;
        if (row.qualification) master.qualification = row.qualification;
        if (row.dob && !master.dob) master.dob = row.dob;
        if (row.gender && !master.gender) master.gender = row.gender;
      } else if (row.phones.length) {
        master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...row.phones])];
      }
      master.enrollments.sort((a, b) => dateSort(a.dateOfAdmission, b.dateOfAdmission));
      master.enrollments.forEach((item, index) => { item.isCurrent = index === 0; });
      if (master.enrollments[0]) {
        master.currentStCode = master.enrollments[0].stCode;
        master.currentCourse = master.enrollments[0].course;
        master.currentAdmissionDate = master.enrollments[0].dateOfAdmission || master.currentAdmissionDate;
        master.dateOfAdmission = master.currentAdmissionDate;
      }
      await master.save();
      touchedMasters.set(String(master._id), master);
      codeMap.set(row.stCode, { master, row, course: row.course, dateOfAdmission: row.dateOfAdmission, formNo: row.formNo, isLegacy: false });
      const sameName = studentDataByName.get(row.cleanNameKey) || [];
      if (!sameName.some(item => String(item.master._id) === String(master._id))) sameName.push({ master, row });
      studentDataByName.set(row.cleanNameKey, sameName);

      const courseDoc = await findCourse(row.course, courses);
      if (courseDoc) courseByCode.set(row.stCode, courseDoc);
      const enrollmentCode = courseDoc?.code || (row.course ? normCourse(row.course).replace(/\s/g, "-") : "UNKNOWN");
      let enrollment = await StudentEnrollment.findOne({ studentId: master._id, stCode: row.stCode, normalizedFullName: row.cleanNameKey, courseCode: enrollmentCode });
      if (!enrollment) {
        const fee = courseDoc ? Number(courseDoc.fee || 0) : 0;
        enrollment = await StudentEnrollment.create({
          studentId: master._id, legacyStudentId: legacyStudent?._id || master.legacyStudentIds?.[master.legacyStudentIds.length - 1] || null,
          stCode: row.stCode, normalizedFullName: row.cleanNameKey,
          formNo: row.formNo, courseId: courseDoc?._id || null, courseCode: enrollmentCode,
          courseName: row.course || "Previous Course (Legacy)", semesterLabel: row.course || "Previous Course (Legacy)",
          admissionDate: row.dateOfAdmission, status: "ACTIVE",
          feeConfig: {
            admissionFee: Number(courseDoc?.admissionFee || 0),
            monthlyInstallment: Number(courseDoc?.monthlyInstallment || courseDoc?.monthlyFee || 0),
            durationMonths: Number(courseDoc?.durationMonths || 0),
            admissionIncluded: Boolean(courseDoc?.admissionIncludedInTotal),
            grossFee: fee, discountAmount: 0, netPayableFee: fee,
            registrationFee: Number(courseDoc?.registrationFee || 0),
            labCharges: Number(courseDoc?.labCharges || 0), otherCharges: Number(courseDoc?.otherCharges || 0),
            feeRuleSource: courseDoc ? "COURSE_MASTER" : "NO_FEE_RULE", configured: Boolean(courseDoc)
          },
          summary: { totalFee: fee, totalDue: fee, totalPaid: 0, balanceDue: fee, feeStatus: feeStatus(fee, 0) }
        });
        newEnrollmentsLinked += 1;
      } else {
        if (!enrollment.legacyStudentId && legacyStudent?._id) enrollment.legacyStudentId = legacyStudent._id;
        if (!enrollment.admissionDate && row.dateOfAdmission) enrollment.admissionDate = row.dateOfAdmission;
        if (!enrollment.formNo && row.formNo) enrollment.formNo = row.formNo;
        if (!enrollment.courseName && row.course) enrollment.courseName = row.course;
        await enrollment.save();
      }
    }

    // Legacy codes: only link when the exact cleaned name identifies one unique Student Data profile.
    const feeRows = feeSourceRows.map(source => {
      const code = normalizeStCode(source.get("St_Code"));
      const cleanName = cleanStudentName(source.get("St_Name_cr") || source.get("St_Name"), code);
      return {
        rowNo: source.rowNo, stCode: code, cleanName, cleanNameKey: normalizeName(cleanName),
        mrNo: clean(source.get("MR_No")).replace(/\.0+$/, ""),
        amountPaid: amount(source.get("Amt_Paid")),
        paymentDate: parseExcelDate(source.get("D_O_P"))
      };
    }).filter(row => row.stCode);
    const earliestPaymentByCode = new Map();
    for (const row of feeRows) if (row.paymentDate) {
      const old = earliestPaymentByCode.get(row.stCode);
      if (!old || row.paymentDate < old) earliestPaymentByCode.set(row.stCode, row.paymentDate);
    }
    for (const row of feeRows) {
      if (codeMap.has(row.stCode)) continue;
      const matches = studentDataByName.get(row.cleanNameKey) || [];
      const uniqueMasters = [...new Map(matches.map(item => [String(item.master._id), item])).values()];
      if (uniqueMasters.length !== 1) {
        if (!unmatchedRows.some(item => item.studentId === row.stCode && /legacy/i.test(item.reason || ""))) {
          unmatchedRows.push({ row: row.rowNo, studentId: row.stCode, course: "Previous Course (Legacy)", reason: uniqueMasters.length ? "Legacy St_Code has a non-unique exact name match in Student Data; left unlinked for manual merge." : "Legacy St_Code has no exact-name match in Student Data; left unlinked." });
        }
        continue;
      }
      const { master, row: sourceStudent } = uniqueMasters[0];
      const legacyDate = earliestPaymentByCode.get(row.stCode) || null;
      const legacy = { master, row: sourceStudent, course: "Previous Course (Legacy)", dateOfAdmission: legacyDate, formNo: "", isLegacy: true };
      codeMap.set(row.stCode, legacy);
      if (!(master.stCodes || []).includes(row.stCode)) master.stCodes.push(row.stCode);
      if (!(master.enrollments || []).some(item => String(item.stCode) === row.stCode)) {
        master.enrollments.push({ stCode: row.stCode, course: "Previous Course (Legacy)", dateOfAdmission: legacyDate, formNo: "", isCurrent: false, identitySource: "FEE_SHEET_NAME_MATCH" });
        newEnrollmentsLinked += 1;
      }
      master.enrollments.sort((a, b) => dateSort(a.dateOfAdmission, b.dateOfAdmission));
      master.enrollments.forEach((item, index) => { item.isCurrent = index === 0; });
      if (master.enrollments[0]) {
        master.currentStCode = master.enrollments[0].stCode;
        master.currentCourse = master.enrollments[0].course;
        master.currentAdmissionDate = master.enrollments[0].dateOfAdmission || master.currentAdmissionDate;
        master.dateOfAdmission = master.currentAdmissionDate;
      }
      await master.save();
      touchedMasters.set(String(master._id), master);
      const legacyStudent = await Student.findOne({ $or: [{ regnNo: row.stCode }, { enrollmentNo: row.stCode }] });
      if (legacyStudent && !(master.legacyStudentIds || []).some(id => String(id) === String(legacyStudent._id))) {
        master.legacyStudentIds.push(legacyStudent._id);
        await master.save();
      }
      const codeEnrollment = await StudentEnrollment.findOne({ studentId: master._id, stCode: row.stCode });
      if (!codeEnrollment) {
        await StudentEnrollment.create({
          studentId: master._id, legacyStudentId: legacyStudent?._id || null,
          stCode: row.stCode, normalizedFullName: sourceStudent.cleanNameKey,
          courseCode: "PREVIOUS-LEGACY", courseName: "Previous Course (Legacy)", semesterLabel: "Previous Course (Legacy)",
          admissionDate: legacyDate, status: "LEGACY",
          feeConfig: { grossFee: 0, discountAmount: 0, netPayableFee: 0, feeRuleSource: "NO_FEE_RULE", configured: false },
          summary: { totalFee: 0, totalDue: 0, totalPaid: 0, balanceDue: 0, feeStatus: "Unpaid" }
        });
      }
    }

    const enrollmentCache = new Map();
    for (const row of feeRows) {
      const link = codeMap.get(row.stCode);
      if (!link) continue;
      if (row.amountPaid === null || row.amountPaid < 0 || !row.mrNo || !row.paymentDate) {
        unmatchedRows.push({ row: row.rowNo, studentId: row.stCode, course: link.course, reason: "Fee row requires a valid non-negative Amt_Paid, MR_No and D_O_P." });
        continue;
      }
      const master = link.master;
      const courseDoc = link.isLegacy ? null : await findCourse(link.course, courses);
      const courseCode = courseDoc?.code || (link.isLegacy ? "PREVIOUS-LEGACY" : normCourse(link.course).replace(/\s/g, "-"));
      const cacheKey = String(master._id) + "|" + row.stCode;
      let enrollment = enrollmentCache.get(cacheKey);
      if (!enrollment) {
        enrollment = await StudentEnrollment.findOne({ studentId: master._id, stCode: row.stCode }).sort({ admissionDate: -1 });
        if (!enrollment) {
          enrollment = await StudentEnrollment.create({
            studentId: master._id, stCode: row.stCode, normalizedFullName: normalizeName(master.fullName),
            courseCode, courseName: link.course, semesterLabel: link.course,
            admissionDate: link.dateOfAdmission || earliestPaymentByCode.get(row.stCode) || null,
            status: link.isLegacy ? "LEGACY" : "ACTIVE",
            feeConfig: { grossFee: Number(courseDoc?.fee || 0), discountAmount: 0, netPayableFee: Number(courseDoc?.fee || 0), feeRuleSource: courseDoc ? "COURSE_MASTER" : "NO_FEE_RULE", configured: Boolean(courseDoc) },
            summary: { totalFee: Number(courseDoc?.fee || 0), totalDue: Number(courseDoc?.fee || 0), totalPaid: 0, balanceDue: Number(courseDoc?.fee || 0), feeStatus: "Unpaid" }
          });
        }
        enrollmentCache.set(cacheKey, enrollment);
      }
      const filter = { stCode: row.stCode, mrNo: row.mrNo, paymentDate: row.paymentDate, amountPaid: row.amountPaid };
      const paymentValues = {
        studentId: master._id, enrollmentId: enrollment._id, courseId: courseDoc?._id || null,
        stCode: row.stCode, financialYear: financialYear(row.paymentDate),
        stNameKey: normalizeName(master.fullName) + "_" + row.stCode,
        courseCode, mrNo: row.mrNo, amountPaid: row.amountPaid, paymentDate: row.paymentDate,
        rawPaymentDate: row.paymentDate, sourceSheet: feeSheetName, sourceRowNo: row.rowNo,
        importWarnings: link.isLegacy ? ["Legacy course; no current course fee rule was mapped."] : [],
        allocations: []
      };
      try {
        const result = await StudentFeePayment.updateOne(filter, { $setOnInsert: paymentValues }, { upsert: true, runValidators: true });
        if (result.upsertedCount) newReceiptsAdded += 1;
        else duplicateReceiptsSkipped += 1;
      } catch (error) {
        if (error?.code === 11000) duplicateReceiptsSkipped += 1;
        else throw error;
      }
    }

    // Recalculate only touched profiles, retaining all old enrollments and receipts.
    for (const master of touchedMasters.values()) {
      const enrollments = await StudentEnrollment.find({ studentId: master._id });
      for (const enrollment of enrollments) {
        const payments = await StudentFeePayment.find({ enrollmentId: enrollment._id }).select("amountPaid").lean();
        const paid = payments.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
        const gross = Number(enrollment.feeConfig?.grossFee || 0);
        const discount = Number(enrollment.feeConfig?.discountAmount || 0);
        const payable = Math.max(0, gross - discount);
        enrollment.summary = { ...(enrollment.summary?.toObject?.() || enrollment.summary || {}), totalFee: gross, totalDue: payable, totalPaid: paid, balanceDue: Math.max(0, payable - paid), feeStatus: feeStatus(payable, paid) };
        enrollment.feeConfig.netPayableFee = payable;
        await enrollment.save();
      }
      const refreshed = await StudentEnrollment.find({ studentId: master._id }).select("feeConfig summary").lean();
      const totalFee = refreshed.reduce((sum, item) => sum + Number(item.feeConfig?.grossFee || 0), 0);
      const discount = refreshed.reduce((sum, item) => sum + Number(item.feeConfig?.discountAmount || 0), 0);
      const totalPaid = refreshed.reduce((sum, item) => sum + Number(item.summary?.totalPaid || 0), 0);
      const balanceDue = refreshed.reduce((sum, item) => sum + Number(item.summary?.balanceDue || 0), 0);
      master.feeSummary = { totalFee, discount, totalPaid, balanceDue, feeStatus: feeStatus(Math.max(0, totalFee - discount), totalPaid), courseCount: refreshed.length, updatedAt: new Date() };
      await master.save();
      studentsUpdated += 1;
    }

    return NextResponse.json({
      message: "Student history and fee receipts imported without deleting existing records.",
      studentSheet: studentSheetName, feeSheet: feeSheetName,
      studentRowsProcessed, feeRowsProcessed: feeRows.length,
      studentsUpdated, newEnrollmentsLinked, newReceiptsAdded, duplicateReceiptsSkipped,
      unmatchedRows
    });
  } catch (error) {
    const detail = String(error?.message || "Unknown error");
    const indexConflict = error?.code === 11000 || /E11000|duplicate key/i.test(detail);
    return NextResponse.json({
      error: indexConflict
        ? "A unique receipt index could not be created because duplicate receipt identities already exist. Existing data was not deleted; resolve the reported duplicate keys before importing."
        : "Unable to import student history and fee receipts.",
      detail
    }, { status: indexConflict ? 409 : 500 });
  }
}
