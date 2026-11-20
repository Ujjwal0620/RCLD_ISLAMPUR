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

function getStudentModel() {
  if (mongoose.models.Student) return mongoose.models.Student;
  const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  return mongoose.model("Student", StudentSchema);
}
const clean = value => String(value ?? "").trim();
const safeDate = value => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null; };
const dateKey = value => safeDate(value)?.toISOString().slice(0, 10) || "";


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
        paymentDate, rawPaymentDate: get("dop"), rawAmount: get("amtpaid"), validAmount,
        sourceSheet: sheetName, sourceRowNo: i + 1,
        valid: Boolean(stCode && (name || creditName) && paymentDate && validAmount)
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
    fatherName: student.fatherOrHusbandName || "",
    normalizedFatherName: normalizeName(student.fatherOrHusbandName),
    address: student.address || "",
    photoUrl: student.photoUrl || "",
    phoneNumbers: phoneList(student),
    qualification: student.sourceQualification || "",
    legacyStudentIds: [student._id],
    stCodes: normalizeStCode(student.regnNo || student.enrollmentNo) ? [normalizeStCode(student.regnNo || student.enrollmentNo)] : [],
    identityMatchMethod: identityWarnings.length ? "AMBIGUOUS_NEW_PROFILE" : "LEGACY_IMPORT",
    identityWarnings,
  });
}

async function getOrCreateMaster(student, candidateStudents = []) {
  let master = await StudentMaster.findOne({ legacyStudentIds: student._id });
  if (master) {
    master.address = student.address || master.address;
    master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...phoneList(student)])];
    master.qualification = student.sourceQualification || master.qualification;
    if (!master.photoUrl && student.photoUrl) master.photoUrl = student.photoUrl;
    const existingCode = normalizeStCode(student.regnNo || student.enrollmentNo);
    if (existingCode && !master.stCodes.includes(existingCode)) master.stCodes.push(existingCode);
    await master.save();
    return master;
  }
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

async function consolidateDuplicateEnrollments() {
  const duplicateGroups = await StudentEnrollment.aggregate([
    { $group: {
      _id: { studentId: "$studentId", stCode: "$stCode", normalizedFullName: "$normalizedFullName" },
      count: { $sum: 1 }, ids: { $push: "$_id" }
    } },
    { $match: { count: { $gt: 1 } } }
  ]);
  for (const group of duplicateGroups) {
    const records = await StudentEnrollment.find({ _id: { $in: group.ids } }).sort({ createdAt: 1 }).lean();
    const ranked = [...records].sort((a, b) =>
      Number(Boolean(b.feeConfig?.configured)) - Number(Boolean(a.feeConfig?.configured))
      || (b.installments?.length || 0) - (a.installments?.length || 0)
      || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    const canonical = ranked[0];
    for (const duplicate of ranked.slice(1)) {
      const receipts = await StudentFeePayment.find({ enrollmentId: duplicate._id }).lean();
      for (const receipt of receipts) {
        const existing = await StudentFeePayment.findOne({
          mrNo: receipt.mrNo, stCode: receipt.stCode,
          paymentDate: receipt.paymentDate || null, amountPaid: receipt.amountPaid,
        }).select("_id").lean();
        if (existing && String(existing._id) !== String(receipt._id)) {
          await StudentFeePayment.deleteOne({ _id: receipt._id });
        } else {
          await StudentFeePayment.updateOne({ _id: receipt._id }, {
            $set: { studentId: canonical.studentId, enrollmentId: canonical._id }
          });
        }
      }
      await StudentMaster.updateOne(
        { activeEnrollmentId: duplicate._id },
        { $set: { activeEnrollmentId: canonical._id } }
      );
      await StudentEnrollment.deleteOne({ _id: duplicate._id });
    }
  }
}

let enrollmentIndexMigration;
export async function ensureEnrollmentIndexes() {
  if (!enrollmentIndexMigration) {
    enrollmentIndexMigration = (async () => {
      await consolidateDuplicateEnrollments();
      let indexes = [];
      try { indexes = await StudentEnrollment.collection.indexes(); }
      catch (error) {
        if (error.code !== 26 && error.codeName !== "NamespaceNotFound") throw error;
      }
      const obsolete = indexes.find(index => index.unique
        && index.key?.stCode === 1
        && index.key?.normalizedFullName === 1
        && !index.key?.studentId);
      if (obsolete) await StudentEnrollment.collection.dropIndex(obsolete.name);
      await StudentEnrollment.collection.createIndex(
        { studentId: 1, stCode: 1, normalizedFullName: 1 },
        { unique: true, name: "studentId_1_stCode_1_normalizedFullName_1" }
      );
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
  await ensureEnrollmentIndexes();
  const Student = getStudentModel();
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

  for (const sourceRow of parsed.rows) {
    const warnings = [];
    if (!sourceRow.stCode) warnings.push("St_Code missing; a synthetic legacy code was assigned.");
    if (!sourceRow.name && !sourceRow.creditName) warnings.push("Student name missing; receipt retained under an unidentified legacy profile.");
    if (!sourceRow.paymentDate) warnings.push("D.O.P. missing or invalid; raw source date retained and receipt not FIFO-allocated.");
    if (!sourceRow.validAmount) warnings.push("Amt_Paid is missing or invalid; receipt retained with amount 0 for review.");
    if (warnings.length) {
      invalid += 1;
      errors.push({ row: sourceRow.sourceRowNo, warnings });
    }
    const syntheticCode = "UNMATCHED-" + String(parsed.sheetName || "FEE").replace(/[^A-Z0-9]/gi, "").slice(0, 12) + "-" + sourceRow.sourceRowNo;
    const row = {
      ...sourceRow,
      stCode: sourceRow.stCode || syntheticCode,
      name: sourceRow.name || sourceRow.creditName || "UNIDENTIFIED RECEIPT " + sourceRow.sourceRowNo,
      creditName: sourceRow.creditName || sourceRow.name || "UNIDENTIFIED RECEIPT " + sourceRow.sourceRowNo,
      mrNo: sourceRow.mrNo || "NO-MR-" + sourceRow.sourceRowNo,
      amountPaid: Number.isFinite(Number(sourceRow.amountPaid)) ? Number(sourceRow.amountPaid) : 0,
    };

    const byCode = normalizedStudents.filter(student => student.normalizedCode === row.stCode);
    const byCodeAndName = byCode.filter(student => student.normalizedName === row.name);
    const byCodeAndCreditName = byCode.filter(student => student.normalizedName === row.creditName);
    let matched = await chooseUniqueLegacyStudent(byCodeAndName);
    if (!matched && row.creditName) matched = await chooseUniqueLegacyStudent(byCodeAndCreditName);
    if (!matched && byCode.length === 1) matched = byCode[0];
    const matchedByCode = Boolean(matched);
    const ambiguousCodeAndName = !matched && (byCodeAndName.length > 1 || byCodeAndCreditName.length > 1);

    if (!matched) {
      const byName = normalizedStudents.filter(student => student.normalizedName === row.creditName);
      matched = await chooseUniqueLegacyStudent(byName);
    }

    if (!matched) {
      if (ambiguousCodeAndName) warnings.push("Multiple students share this St_Code and name; receipt retained in a separate review profile.");
      const created = await Student.create({
        regnNo: row.stCode, applicantName: row.creditName,
        sourceStudentName: row.creditName, courseCode: "LEGACY",
        courseName: "Legacy / Unknown Course", status: "Registered",
        importSource: sourceName + " - legacy fee row", sourceRowNo: row.sourceRowNo,
        identityWarnings: warnings,
      });
      matched = { ...created.toObject(), normalizedName: normalizeName(created.applicantName), normalizedCode: row.stCode };
      normalizedStudents.push(matched);
      createdLegacy += 1;
      unmatched += 1;
    }

    const master = await getOrCreateMaster(matched);
    const enrollment = await findOrCreateEnrollment(master, matched, row.stCode, row.name || row.creditName, !matchedByCode, false);
    const paymentDate = row.paymentDate || null;
    const existing = await StudentFeePayment.findOne({
      mrNo: row.mrNo, stCode: row.stCode, paymentDate, amountPaid: row.amountPaid,
    }).select("_id studentId enrollmentId").lean();
    if (existing) {
      const previousEnrollmentId = existing.enrollmentId;
      const linkNeedsRepair = String(existing.studentId) !== String(master._id)
        || String(existing.enrollmentId) !== String(enrollment._id);
      if (linkNeedsRepair) {
        await StudentFeePayment.updateOne({ _id: existing._id }, {
          $set: { studentId: master._id, enrollmentId: enrollment._id, stCode: row.stCode }
        });
        if (previousEnrollmentId) await rebuildEnrollmentLedger(previousEnrollmentId);
      }
      duplicates += 1;
      await rebuildEnrollmentLedger(enrollment._id);
      continue;
    }
    try {
      await StudentFeePayment.create({
        studentId: master._id, enrollmentId: enrollment._id, stCode: row.stCode,
        mrNo: row.mrNo, amountPaid: row.amountPaid, paymentDate,
        rawPaymentDate: row.rawPaymentDate,
        importWarnings: warnings,
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
