import mongoose from "mongoose";
import * as XLSX from "xlsx";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import Course from "@/models/Course";
import { normalizeHeader, normalizeName, normalizeStCode, normalizeReceiptNo, parseMoney, parseExcelDate, parsePhones } from "./normalization";
import { resolveCourseFeeConfig } from "./course-fee-rules";
import { buildInstallments, allocatePaymentsFIFO } from "./fee-allocation";

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

async function chooseUniqueLegacyStudent(candidates = []) {
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) return null;
  const ids = candidates.map(candidate => candidate._id);
  const masters = await StudentMaster.find({ legacyStudentIds: { $in: ids } })
    .select("_id legacyStudentIds").lean();
  const masterByStudentId = new Map();
  for (const master of masters) {
    for (const legacyId of master.legacyStudentIds || []) masterByStudentId.set(String(legacyId), String(master._id));
  }
  const matchedMasterIds = new Set(ids.map(id => masterByStudentId.get(String(id))).filter(Boolean));
  const allLinked = ids.every(id => masterByStudentId.has(String(id)));
  return allLinked && matchedMasterIds.size === 1 ? candidates[0] : null;
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
  const stCode = normalizeStCode(student.regnNo || student.enrollmentNo);
  let master = await StudentMaster.findOne({ legacyStudentIds: student._id });
  if (!master && stCode) {
    const variants = [stCode];
    if (/^\\d+$/.test(stCode)) {
      for (let zeroes = 1; zeroes <= 8; zeroes += 1) variants.push("0".repeat(zeroes) + stCode);
      variants.push(new RegExp("^\\s*0*" + stCode + "(?:\\.0+)?\\s*$", "i"));
    }
    const candidates = await StudentMaster.find({ $or: [
      { normalizedStCodes: stCode }, { stCodes: { $in: variants } },
      { primaryStCode: { $in: variants } }, { currentStCode: { $in: variants } }
    ] }).lean();
    let matches = candidates;
    if (matches.length > 1) {
      const name = normalizeName(student.applicantName || student.sourceStudentName || student.name);
      matches = matches.filter(item => normalizeName(item.fullName || item.normalizedFullName) === name);
    }
    if (matches.length === 1) master = await StudentMaster.findById(matches[0]._id);
  }
  if (!master) master = await createMasterFromStudent(student, stCode ? "" : "Student Code missing; profile was not matched to another person.");
  if (!master.legacyStudentIds.some(id => String(id) === String(student._id))) master.legacyStudentIds.push(student._id);
  master.address = student.address || master.address;
  if (["M", "F", "Other"].includes(student.sex)) master.gender = student.sex;
  master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...phoneList(student)])];
  master.qualification = student.sourceQualification || master.qualification;
  if (!master.photoUrl && student.photoUrl) master.photoUrl = student.photoUrl;
  if (stCode) {
    master.stCodes = [...new Set([...(master.stCodes || []), stCode])];
    master.normalizedStCodes = [...new Set([...(master.normalizedStCodes || []), stCode])];
  }
  await master.save();
  return master;
}

async function findOrCreateEnrollment(master, student, stCode, name, forceLegacy = false, setActive = false) {
  const normalizedFullName = normalizeName(name || student.applicantName || student.sourceStudentName);
  const importedCourseCode = forceLegacy ? "LEGACY / PRE-2025"
    : String(student.sourceCourseLabel || student.courseCode || student.course || "LEGACY").trim().toUpperCase();
  const admissionDateForLookup = safeDate(student.admissionDate || student.dateOfAdmission);
  let enrollment = await StudentEnrollment.findOne({
    studentId: master._id, normalizedFullName, courseCode: importedCourseCode,
    admissionDate: admissionDateForLookup,
    $or: [{ normalizedStCode: stCode }, { stCode: { $in: [stCode, new RegExp("^0*" + stCode + "$")] } }]
  });
  if (enrollment) {
    if (!enrollment.normalizedStCode) enrollment.normalizedStCode = stCode;
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
      await StudentEnrollment.updateMany({ studentId: master._id, status: "ACTIVE", _id: { $ne: enrollment._id } }, { $set: { status: "PROMOTED" } });
      enrollment.status = "ACTIVE";
      master.activeEnrollmentId = enrollment._id;
    }
    await enrollment.save();
    await master.save();
    return enrollment;
  }
  const inheritedEnrollment = forceLegacy
    ? await StudentEnrollment.findOne({ studentId: master._id, courseCode: { $ne: "LEGACY" } }).sort({ admissionDate: -1, createdAt: -1 }).lean()
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
    await StudentEnrollment.updateMany({ studentId: master._id, status: "ACTIVE" }, { $set: { status: "PROMOTED" } });
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
    { $match: { mergedIntoEnrollmentId: null } },
    { $group: {
      _id: {
        studentId: "$studentId",
        normalizedStCode: "$normalizedStCode",
        normalizedFullName: "$normalizedFullName",
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
      const receipts = await StudentFeePayment.find({ enrollmentId: duplicate._id }).select("_id").lean();
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
      await StudentMaster.updateOne(
        { activeEnrollmentId: duplicate._id },
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

let enrollmentIndexMigration;
export async function ensureEnrollmentIndexes() {
  if (!enrollmentIndexMigration) {
    enrollmentIndexMigration = (async () => {
      const legacyEnrollments = await StudentEnrollment.find({
        $or: [{ normalizedStCode: { $exists: false } }, { normalizedStCode: "" }]
      }).select("_id stCode").lean();
      for (let offset = 0; offset < legacyEnrollments.length; offset += 500) {
        const operations = legacyEnrollments.slice(offset, offset + 500).map(item => ({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { normalizedStCode: normalizeStCode(item.stCode) } }
          }
        })).filter((operation, index) => Boolean(legacyEnrollments[offset + index].stCode));
        if (operations.length) await StudentEnrollment.bulkWrite(operations, { ordered: false });
      }

      const consolidation = await consolidateDuplicateEnrollments();
      let indexes = [];
      try { indexes = await StudentEnrollment.collection.indexes(); }
      catch (error) {
        if (error.code !== 26 && error.codeName !== "NamespaceNotFound") throw error;
      }
      const obsolete = indexes.filter(index => index.unique
        && index.key?.studentId === 1
        && index.key?.stCode === 1
        && index.key?.normalizedFullName === 1
        && !index.key?.courseCode
        && !index.key?.admissionDate);
      for (const index of obsolete) await StudentEnrollment.collection.dropIndex(index.name);
      const refreshed = await StudentEnrollment.collection.indexes().catch(() => []);
      if (!refreshed.some(index => index.name === "student_code_course_admission_unique")) {
        await StudentEnrollment.collection.createIndex(
          { studentId: 1, normalizedStCode: 1, normalizedFullName: 1, courseCode: 1, admissionDate: 1 },
          {
            unique: true,
            name: "student_code_course_admission_unique",
            partialFilterExpression: { mergedIntoEnrollmentId: null }
          }
        );
      }
      console.info("[student-import] enrollment index migration", consolidation);
    })().catch(error => {
      enrollmentIndexMigration = null;
      throw error;
    });
  }
  return enrollmentIndexMigration;
}

export async function linkImportedStudentRecords(studentDocuments = []) {
  await ensureEnrollmentIndexes();
  const Student = getStudentModel();
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
  const allocation = allocatePaymentsFIFO(cleanInstallments, payments.filter(payment => payment.paymentDate));
  if (allocation.installments.length) {
    enrollment.installments = allocation.installments;
    const totalDue = allocation.installments.reduce((sum, item) => sum + Number(item.amountDue || 0), 0);
    const totalPaid = allocation.installments.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
    const balanceDue = Math.max(0, totalDue - totalPaid);
    const hasConfiguredFee = enrollment.feeConfig?.configured !== false && Boolean(enrollment.feeConfig);
    const feeStatus = hasConfiguredFee && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
    enrollment.summary = { totalDue, totalPaid, balanceDue, feeStatus, nextDueDate: allocation.installments.find(item => item.status === "PENDING" || item.status === "PARTIAL")?.dueDate || null };
    await enrollment.save();
    const operations = allocation.payments.map(payment => ({
      updateOne: { filter: { _id: payment._id }, update: { $set: { allocations: payment.allocations } } }
    }));
    if (operations.length) await StudentFeePayment.bulkWrite(operations, { ordered: false });
  } else {
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
    const totalDue = Number(enrollment.feeConfig?.netPayableFee || 0);
    const balanceDue = Math.max(0, totalDue - totalPaid);
    const hasConfiguredFee = enrollment.feeConfig?.configured !== false && Boolean(enrollment.feeConfig);
    const feeStatus = hasConfiguredFee && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
    enrollment.summary = { totalDue, totalPaid, balanceDue, feeStatus, nextDueDate: null };
    await enrollment.save();
  }
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

async function recalculateImportedStudentCodes(codes = []) {
  const normalizedCodes = [...new Set(codes.map(normalizeStCode).filter(Boolean))];
  if (!normalizedCodes.length) return;
  const variants = normalizedCodes.flatMap(code => {
    const values = [code];
    if (/^\d+$/.test(code)) {
      for (let zeroes = 1; zeroes <= 8; zeroes += 1) values.push("0".repeat(zeroes) + code);
      values.push(new RegExp("^\\s*0*" + code + "(?:\\.0+)?\\s*$", "i"));
    }
    return values;
  });
  const Student = getStudentModel();
  const [students, enrollments, payments, masters] = await Promise.all([
    Student.find({ $or: [{ normalizedStCode: { $in: normalizedCodes } }, { regnNo: { $in: variants } }, { enrollmentNo: { $in: variants } }] }).lean(),
    StudentEnrollment.find({ mergedIntoEnrollmentId: null, $or: [{ normalizedStCode: { $in: normalizedCodes } }, { stCode: { $in: variants } }] }).lean(),
    StudentFeePayment.find({ $or: [{ normalizedStCode: { $in: normalizedCodes } }, { stCode: { $in: variants } }] }).lean(),
    StudentMaster.find({ $or: [{ normalizedStCodes: { $in: normalizedCodes } }, { stCodes: { $in: variants } }] }).lean()
  ]);
  const latestPaymentByKey = new Map();
  let duplicatePaymentDocumentsFound = 0;
  for (const payment of payments) {
    const code = normalizeStCode(payment.normalizedStCode || payment.stCode);
    const receipt = normalizeReceiptNo(payment.mrNo);
    const date = dateKey(payment.paymentDate);
    const key = [code, receipt || String(payment._id), date].join("|");
    const prior = latestPaymentByKey.get(key);
    if (!prior) latestPaymentByKey.set(key, payment);
    else {
      duplicatePaymentDocumentsFound += 1;
      if (new Date(payment.updatedAt || payment.createdAt || 0) > new Date(prior.updatedAt || prior.createdAt || 0)) latestPaymentByKey.set(key, payment);
    }
  }
  const paidByCode = new Map();
  for (const payment of latestPaymentByKey.values()) {
    const code = normalizeStCode(payment.normalizedStCode || payment.stCode);
    paidByCode.set(code, (paidByCode.get(code) || 0) + Number(payment.amountPaid || 0));
  }
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
  const studentOps = [];
  for (const code of normalizedCodes) {
    const related = enrollmentByCode.get(code) || [];
    const totalFee = related.reduce((sum, item) => sum + Number(item.feeConfig?.netPayableFee ?? item.summary?.totalDue ?? item.feeConfig?.grossFee ?? item.summary?.totalFee ?? 0), 0);
    const totalPaid = Number(paidByCode.get(code) || 0);
    const balanceDue = Math.max(0, totalFee - totalPaid);
    const configured = related.some(item => item.feeConfig?.configured !== false && Boolean(item.feeConfig));
    const feeStatus = configured && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
    for (const student of studentByCode.get(code) || []) studentOps.push({
      updateOne: { filter: { _id: student._id }, update: { $set: {
        normalizedStCode: code, totalPaid, dueAmount: balanceDue,
        paymentStatus: feeStatus, feeStatus
      } } }
    });
  }
  for (let offset = 0; offset < studentOps.length; offset += 500) {
    await Student.bulkWrite(studentOps.slice(offset, offset + 500), { ordered: false });
  }
  const masterOps = [];
  for (const master of masters) {
    const codesForMaster = [...new Set([
      ...(master.normalizedStCodes || []), ...(master.stCodes || []), master.primaryStCode, master.currentStCode
    ].map(normalizeStCode).filter(code => normalizedCodes.includes(code)))];
    const totalPaid = codesForMaster.reduce((sum, code) => sum + Number(paidByCode.get(code) || 0), 0);
    const totalFee = codesForMaster.reduce((sum, code) => sum + (enrollmentByCode.get(code) || []).reduce((fee, item) =>
      fee + Number(item.feeConfig?.netPayableFee ?? item.summary?.totalDue ?? item.feeConfig?.grossFee ?? item.summary?.totalFee ?? 0), 0), 0);
    const balanceDue = Math.max(0, totalFee - totalPaid);
    const configured = codesForMaster.some(code => (enrollmentByCode.get(code) || []).some(item => item.feeConfig?.configured !== false && Boolean(item.feeConfig)));
    const feeStatus = configured && balanceDue <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Not Paid";
    masterOps.push({ updateOne: { filter: { _id: master._id }, update: { $set: { feeSummary: {
      totalFee, totalPaid, balanceDue, feeStatus, updatedAt: new Date()
    } } } } });
  }
  for (let offset = 0; offset < masterOps.length; offset += 500) {
    await StudentMaster.bulkWrite(masterOps.slice(offset, offset + 500), { ordered: false });
  }
  return { duplicatePaymentDocumentsFound };
}

export async function importPaymentWorksheet(workbook, { sourceName = "RCLD Import" } = {}) {
  await ensureEnrollmentIndexes();
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
    sourcePaymentTotal += Number(row.amountPaid || 0);
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
  const receiptQuery = validRows.map(row => ({
    normalizedStCode: row.matchedCode,
    mrNo: row.mrNo,
    paymentDate: row.paymentDate
  }));
  const existingPayments = receiptQuery.length
    ? await StudentFeePayment.find({ $or: receiptQuery }).lean()
    : [];
  const existingByKey = new Map();
  for (const payment of existingPayments) {
    const key = [normalizeStCode(payment.normalizedStCode || payment.stCode), normalizeReceiptNo(payment.mrNo), dateKey(payment.paymentDate)].join("|");
    if (!existingByKey.has(key)) existingByKey.set(key, payment);
  }

  const sourceBatchKey = String(sourceName || "RCLD Import").trim();
  const seenKeys = new Set();
  const newDocs = [];
  const updates = new Map();
  const affectedEnrollmentIds = new Set();
  let duplicates = 0, updated = 0, matchedPaymentTotal = 0;
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
      mrNo: row.mrNo, paymentDate: row.paymentDate, amountPaid: row.amountPaid,
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
    affectedEnrollmentIds.add(String(enrollment._id));
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
      const persisted = await StudentFeePayment.find({ $or: chunk.map(item => ({
        normalizedStCode: item.normalizedStCode, mrNo: item.mrNo, paymentDate: item.paymentDate
      })) }).lean();
      const persistedKeys = new Set(persisted.map(item => [normalizeStCode(item.normalizedStCode || item.stCode), normalizeReceiptNo(item.mrNo), dateKey(item.paymentDate)].join("|")));
      const missing = chunk.filter(item => !persistedKeys.has([item.normalizedStCode, item.mrNo, dateKey(item.paymentDate)].join("|")));
      if (missing.length) {
        try { imported += (await StudentFeePayment.insertMany(missing, { ordered: false })).length; }
        catch (retryError) {
          const retryErrors = retryError.writeErrors || retryError.result?.writeErrors || [];
          if (retryError.code !== 11000 && !(retryErrors.length && retryErrors.every(item => item.code === 11000))) throw retryError;
        }
      }
      duplicates += chunk.length - missing.length;
    }
  }

  for (const enrollmentId of affectedEnrollmentIds) await rebuildEnrollmentLedger(new mongoose.Types.ObjectId(enrollmentId));
  const summary = await recalculateImportedStudentCodes(affectedCodes);
  const unmatchedAmount = unmatchedPayments.reduce((sum, row) => {
    const amount = parseMoney(row.amountPaid);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const databasePayments = await StudentFeePayment.find({ sourceBatchKey }).select("amountPaid sourceRowKey normalizedStCode mrNo paymentDate").lean();
  const databasePaymentTotal = databasePayments.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0);
  const databasePaymentRows = new Set(databasePayments.map(item => item.sourceRowKey || [item.normalizedStCode, item.mrNo, dateKey(item.paymentDate)].join("|"))).size;
  const reconciliationMatches = databasePaymentRows === validRows.length - unmatchedPayments.filter(item => Number.isFinite(parseMoney(item.amountPaid))).length
    && Math.abs(databasePaymentTotal - matchedPaymentTotal) < 0.01;
  return {
    sheetName: parsed.sheetName, total: parsed.rows.length, imported, updated, duplicates,
    unmatched: unmatchedPayments.length, invalid, createdLegacy: 0, unmatchedPayments,
    sourcePaymentTotal, matchedPaymentTotal, unmatchedPaymentTotal: unmatchedAmount,
    databasePaymentRows, databasePaymentTotal, reconciliationMatches,
    duplicatePaymentDocumentsFound: summary.duplicatePaymentDocumentsFound,
    errors: unmatchedPayments.slice(0, 100)
  };
}

