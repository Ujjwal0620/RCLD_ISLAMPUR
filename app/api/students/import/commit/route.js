import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Student from "@/models/Student";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import ImportLog from "@/models/ImportLog";
import StudentImportStaging from "@/models/StudentImportStaging";
import {
  cleanImportText, sanitizeStudentCode, normalizeImportName,
  normalizePhoneNumbers, paymentCompositeKey, dateISO
} from "@/lib/student-import/universal-import-helpers.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;

const ROLES = new Set(["superadmin", "admin", "office-admin"]);
const MAX_CHUNK = 50;
const text = value => cleanImportText(value);
const addUnique = (items, value) => {
  const list = Array.isArray(items) ? [...items] : [];
  const clean = text(value);
  if (clean && !list.includes(clean)) list.push(clean);
  return list;
};
const courseCodeOf = value => {
  const code = text(value).normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return code || "PREVIOUS-LEGACY";
};
const registrationKey = (student, registration) => {
  const code = sanitizeStudentCode(registration.stCode);
  const course = courseCodeOf(registration.course || student.course);
  const date = dateISO(registration.admissionDate || registration.dateOfAdmission);
  const name = normalizeImportName(student.name || student.normalizedName);
  return [name, code, course, date || "UNDATED"].join("_").replace(/[^A-Z0-9_]+/gi, "_").toUpperCase();
};

async function ensureEnrollment(master, student, registration, importBatchId, sequence) {
  const stCode = sanitizeStudentCode(registration.stCode || student.primaryCode || student.codes?.[0]);
  if (!stCode) throw new Error("A registration needs a valid Student Code before it can be committed.");
  const courseName = text(registration.course || student.course) || "Previous Course (Legacy)";
  const courseCode = courseCodeOf(courseName);
  const admissionDate = registration.admissionDate || registration.dateOfAdmission || null;
  const registrationId = text(registration.registrationId) || registrationKey(student, { ...registration, stCode, course: courseName });
  let enrollment = await StudentEnrollment.findOne({
    studentId: master._id,
    $or: [
      { registrationId },
      { normalizedStCode: stCode, courseCode, admissionDate: admissionDate || null }
    ]
  });
  if (!enrollment) {
    enrollment = await StudentEnrollment.create({
      studentId: master._id,
      stCode,
      normalizedStCode: stCode,
      registrationId,
      normalizedFullName: normalizeImportName(student.name || student.normalizedName) || "UNKNOWN STUDENT",
      formNo: text(registration.formNo || student.formNo),
      qualification: text(registration.qualification || student.qualification),
      rawAddress: text(registration.address || student.address),
      rawStName: text(student.name),
      course: courseName,
      courseCode,
      courseName,
      courseCategory: "OTHER",
      semesterLabel: "LEGACY",
      admissionDate,
      earliestPaymentDate: registration.earliestPaymentDate || null,
      status: "LEGACY",
      feeConfig: {
        configured: false,
        feeRuleSource: "UNCONFIGURED",
        grossFee: 0,
        netPayableFee: 0,
        discountAmount: 0
      },
      summary: { totalFee: 0, totalDue: 0, totalPaid: 0, balanceDue: 0, feeStatus: "Unpaid" },
      sourceRowNo: student.rowNo || sequence + 1,
      importBatchKey: importBatchId,
      masterStudentId: master._id
    });
  }
  return enrollment;
}

async function commitOne(stage, importBatchId, decision) {
  const incoming = stage.student || {};
  const chosen = decision?.decision || stage.action;
  if (chosen === "SKIP") {
    await StudentImportStaging.updateOne({ _id: stage._id, committedAt: null }, {
      $set: { action: "SKIP", committedAt: new Date(), committedResult: { skipped: true } }
    });
    return { skipped: true };
  }

  let master = null;
  if (chosen === "LINK_EXISTING") {
    if (!mongoose.Types.ObjectId.isValid(decision?.masterId)) throw new Error("A valid existing Student Master ID is required for LINK_EXISTING.");
    master = await StudentMaster.findById(decision.masterId);
    if (!master || master.isMerged) throw new Error("Selected Student Master does not exist or is merged.");
  } else if (stage.matchedMasterId && chosen === "UPDATE") {
    master = await StudentMaster.findById(stage.matchedMasterId);
  } else if (stage.matchedLegacyStudentId && chosen === "UPDATE") {
    const legacy = await Student.findById(stage.matchedLegacyStudentId).lean();
    if (legacy) {
      master = await StudentMaster.findOne({ legacyStudentIds: legacy._id, mergedIntoMasterId: null });
      if (!master) {
        master = await StudentMaster.create({
          fullName: text(legacy.applicantName || legacy.name || incoming.name),
          normalizedFullName: normalizeImportName(legacy.applicantName || legacy.name || incoming.name),
          primaryStCode: sanitizeStudentCode(legacy.normalizedStCode || legacy.regnNo || incoming.primaryCode),
          currentStCode: sanitizeStudentCode(legacy.normalizedStCode || legacy.regnNo || incoming.primaryCode),
          legacyStudentIds: [legacy._id],
          identityMatchMethod: "IMPORT_LEGACY_LINK"
        });
      }
    }
  }

  if (!master) {
    if (chosen !== "NEW" && chosen !== "CREATE_NEW" && chosen !== "LINK_EXISTING") {
      throw new Error("This row requires an explicit CREATE_NEW, LINK_EXISTING or SKIP decision.");
    }
    const fullName = text(incoming.name);
    if (!fullName) throw new Error("Cannot create a student without a name.");
    master = new StudentMaster({
      fullName,
      normalizedFullName: normalizeImportName(fullName),
      identityMatchMethod: "UNIVERSAL_WORKBOOK_IMPORT"
    });
  }

  const fullName = text(incoming.name);
  if (fullName) {
    if (!master.fullName) master.fullName = fullName;
    master.normalizedFullName = normalizeImportName(master.fullName || fullName);
  }
  if (incoming.dob && !master.dob) master.dob = incoming.dob;
  if (text(incoming.sex) && !master.gender) master.gender = text(incoming.sex);
  if (text(incoming.fatherName) && !master.fatherName) {
    master.fatherName = text(incoming.fatherName);
    master.normalizedFatherName = normalizeImportName(incoming.fatherName);
  }
  if (text(incoming.address) && !master.address) master.address = text(incoming.address);
  const phoneData = normalizePhoneNumbers([incoming.phone, ...(incoming.alternatePhones || [])].filter(Boolean).join(","));
  const importedPhones = [...(phoneData.primaryPhone ? [phoneData.primaryPhone] : []), ...(phoneData.alternatePhones || [])];
  master.phones = [...new Set([...(master.phones || []), ...importedPhones])];
  master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...importedPhones])];
  if (text(incoming.formNo) && !master.formNo) master.formNo = text(incoming.formNo);
  if (text(incoming.qualification) && !master.qualification) master.qualification = text(incoming.qualification);

  const incomingCodes = [...new Set((incoming.codes || []).map(sanitizeStudentCode).filter(Boolean))];
  const resolvedCode = sanitizeStudentCode(stage.resolvedCurrentCode || incoming.primaryCode || incomingCodes[0]);
  master.allRegistrationCodes = [...new Set([...(master.allRegistrationCodes || []), ...incomingCodes])];
  master.studentCodes = [...new Set([...(master.studentCodes || []), ...incomingCodes])];
  master.normalizedStCodes = [...new Set([...(master.normalizedStCodes || []), ...incomingCodes])];
  master.stCodes = [...new Set([...(master.stCodes || []), ...incomingCodes])];
  master.previousCodes = [...new Set([...(master.previousCodes || []), ...(stage.codeHistory || []).map(sanitizeStudentCode).filter(Boolean)])];
  if (resolvedCode) {
    const oldCurrent = sanitizeStudentCode(master.currentStCode || master.primaryStCode);
    if (oldCurrent && oldCurrent !== resolvedCode) master.previousCodes = addUnique(master.previousCodes, oldCurrent);
    master.currentStCode = resolvedCode;
    if (!master.primaryStCode) master.primaryStCode = resolvedCode;
    master.codeUpdatedAt = new Date();
    master.codeSourceDate = stage.codeSourceDate || null;
  }
  master.importBatchId = importBatchId;
  if (stage.matchedLegacyStudentId) master.legacyStudentIds = [...new Set([...(master.legacyStudentIds || []).map(String), String(stage.matchedLegacyStudentId)])];
  await master.save();

  const registrationRows = Array.isArray(stage.registrations) ? stage.registrations : [];
  const registrations = registrationRows.length ? registrationRows : (resolvedCode ? [{
    stCode: resolvedCode, course: incoming.course, admissionDate: incoming.admissionDate,
    formNo: incoming.formNo, qualification: incoming.qualification, address: incoming.address
  }] : []);
  const enrollmentByCode = new Map();
  for (const registration of registrations) {
    const enrollment = await ensureEnrollment(master, incoming, registration, importBatchId, stage.sequence);
    enrollmentByCode.set(sanitizeStudentCode(registration.stCode || enrollment.stCode), enrollment);
    const embedded = {
      stCode: enrollment.stCode,
      admissionDate: enrollment.admissionDate,
      qualification: text(registration.qualification || incoming.qualification),
      rawAddress: text(registration.address || incoming.address),
      rawStName: text(incoming.name),
      registrationId: enrollment.registrationId,
      course: enrollment.courseName,
      dateOfAdmission: enrollment.admissionDate,
      earliestPaymentDate: registration.earliestPaymentDate || null,
      formNo: text(registration.formNo || incoming.formNo),
      isCurrent: enrollment.stCode === resolvedCode
    };
    if (!master.registrations.some(item => item.registrationId === embedded.registrationId)) master.registrations.push(embedded);
    if (!master.enrollments.some(item => item.registrationId === embedded.registrationId)) master.enrollments.push({ ...embedded, identitySource: "UNIVERSAL_WORKBOOK_IMPORT" });
  }
  if (resolvedCode) {
    const currentCandidates = master.registrations
      .filter(item => sanitizeStudentCode(item.stCode) === resolvedCode)
      .sort((a, b) => new Date(b.admissionDate || b.dateOfAdmission || 0).getTime() - new Date(a.admissionDate || a.dateOfAdmission || 0).getTime());
    const currentRegistration = currentCandidates[0] || null;
    master.registrations = master.registrations.map(item => ({
      ...item.toObject?.() || item,
      isCurrent: Boolean(currentRegistration && item.registrationId === currentRegistration.registrationId)
    }));
    master.enrollments = master.enrollments.map(item => ({
      ...item.toObject?.() || item,
      isCurrent: Boolean(currentRegistration && item.registrationId === currentRegistration.registrationId)
    }));
    if (currentRegistration) {
      master.currentRegistrationId = currentRegistration.registrationId;
      master.currentCourse = currentRegistration.course || "";
      master.currentAdmissionDate = currentRegistration.admissionDate || currentRegistration.dateOfAdmission || null;
      master.dateOfAdmission = master.currentAdmissionDate;
    }
  }
  if (!master.activeEnrollmentId && enrollmentByCode.size) {
    const selected = enrollmentByCode.get(resolvedCode) || enrollmentByCode.values().next().value;
    if (selected) master.activeEnrollmentId = selected._id;
  }
  await master.save();

  const paymentResults = { inserted: 0, duplicates: 0, skipped: 0 };
  for (let index = 0; index < (stage.payments || []).length; index += 1) {
    const payment = stage.payments[index];
    const code = sanitizeStudentCode(payment.sourceCode || resolvedCode);
    const amount = Number(payment.amountPaid);
    const mrNo = text(payment.mrNo);
    if (!code || !mrNo || !Number.isFinite(amount) || amount < 0) {
      paymentResults.skipped += 1;
      continue;
    }
    let enrollment = enrollmentByCode.get(code);
    if (!enrollment) {
      enrollment = await StudentEnrollment.findOne({ studentId: master._id, normalizedStCode: code }).sort({ admissionDate: -1 });
    }
    if (!enrollment) {
      enrollment = await ensureEnrollment(master, incoming, {
        stCode: code, course: incoming.course || "Previous Course (Legacy)",
        admissionDate: incoming.admissionDate || null
      }, importBatchId, stage.sequence);
      enrollmentByCode.set(code, enrollment);
    }
    const key = paymentCompositeKey(payment);
    if (!key) {
      paymentResults.skipped += 1;
      continue;
    }
    const existing = await StudentFeePayment.findOne({
      $or: [
        { normalizedPaymentKey: key },
        {
          $and: [
            { $or: [{ studentId: master._id }, { masterStudentId: master._id }] },
            { $or: [{ normalizedStCode: code }, { stCode: code }] },
            { mrNo, amountPaid: amount, paymentDate: payment.paymentDate || null }
          ]
        }
      ]
    }).select("_id").lean();
    if (existing) {
      paymentResults.duplicates += 1;
      continue;
    }
    const normalizedMrNo = mrNo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    await StudentFeePayment.create({
      studentId: master._id,
      masterStudentId: master._id,
      enrollmentId: enrollment._id,
      stCode: code,
      sourceStCode: text(payment.rawSourceCode || payment.sourceCode),
      normalizedStCode: code,
      sourceRowKey: importBatchId + ":" + stage.sequence + ":" + (payment.slot ?? index + 1),
      sourceBatchKey: importBatchId,
      registrationId: enrollment.registrationId,
      financialYear: "",
      stNameKey: text(incoming.name).toUpperCase(),
      sourceStudentName: text(incoming.name),
      courseCode: enrollment.courseCode,
      course: enrollment.courseName,
      mrNo,
      normalizedMrNo,
      normalizedPaymentKey: key,
      paymentMode: "",
      amountPaid: amount,
      paymentDate: payment.paymentDate || null,
      rawPaymentDate: payment.rawPaymentDate ?? payment.paymentDate ?? null,
      importWarnings: payment.warnings || [],
      sourceSheet: payment.sourceSheet || incoming.sourceSheet || "",
      sourceRowNo: incoming.rowNo,
      importBatchKey: importBatchId,
      importBatchId
    });
    paymentResults.inserted += 1;
  }

  if (stage.matchedLegacyStudentId) {
    await Student.updateOne({ _id: stage.matchedLegacyStudentId }, {
      $addToSet: {
        previousCodes: { $each: (stage.codeHistory || []).filter(Boolean) },
        allRegistrationCodes: { $each: incomingCodes }
      },
      $set: {
        importBatchId,
        ...(resolvedCode ? { normalizedStCode: resolvedCode } : {}),
        ...(fullName ? { applicantName: fullName, name: fullName } : {}),
        ...(text(incoming.address) ? { address: text(incoming.address) } : {}),
        ...(text(incoming.phone) ? { mobileNumber: text(incoming.phone) } : {})
      }
    });
  }

  await StudentImportStaging.updateOne({ _id: stage._id, committedAt: null }, {
    $set: {
      committedAt: new Date(),
      committedResult: { masterId: String(master._id), enrollmentCount: enrollmentByCode.size, payments: paymentResults }
    }
  });
  return { masterId: String(master._id), enrollmentCount: enrollmentByCode.size, payments: paymentResults };
}

export async function POST(request) {
  let lockToken = "";
  let importBatchId = "";
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to commit this import." }, { status: 401 });
    if (!ROLES.has(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to commit student imports." }, { status: 403 });
    }
    await connectMongoDB();
    const body = await request.json();
    importBatchId = text(body.importBatchId);
    const chunkSize = Math.max(1, Math.min(MAX_CHUNK, Number(body.chunkSize) || MAX_CHUNK));
    if (!importBatchId) return NextResponse.json({ error: "importBatchId is required." }, { status: 400 });

    const existingLog = await ImportLog.findOne({ importBatchId }).lean();
    if (!existingLog) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    if (String(session.role || "").toLowerCase() !== "superadmin" && String(existingLog.actorId || "") !== String(session.sub)) {
      return NextResponse.json({ error: "You cannot commit another user's import batch." }, { status: 403 });
    }
    if (["COMPLETED", "CANCELLED"].includes(existingLog.status)) {
      return NextResponse.json({ error: "This import batch is already " + existingLog.status.toLowerCase() + ".", status: existingLog.status }, { status: 409 });
    }

    lockToken = randomUUID();
    const lockExpiredAt = new Date(Date.now() - 10 * 60 * 1000);
    const lockedLog = await ImportLog.findOneAndUpdate({
      importBatchId,
      status: { $in: ["PREVIEW_READY", "COMMITTING"] },
      $or: [{ commitLockAt: null }, { commitLockAt: { $lt: lockExpiredAt } }]
    }, {
      $set: { status: "COMMITTING", commitLockToken: lockToken, commitLockAt: new Date(), startedAt: existingLog.startedAt || new Date() }
    }, { new: true });
    if (!lockedLog) return NextResponse.json({ error: "This import is currently being committed by another request. Refresh status and retry." }, { status: 409 });

    const decisions = new Map((Array.isArray(body.decisions) ? body.decisions : []).map(item => [Number(item.sequence), item]));
    const stages = await StudentImportStaging.find({ importBatchId, committedAt: null }).sort({ sequence: 1 }).limit(chunkSize).lean();
    const needsDecision = stages.filter(stage => ["CONFLICT", "REVIEW"].includes(stage.action) && !["CREATE_NEW", "LINK_EXISTING", "SKIP"].includes(decisions.get(stage.sequence)?.decision));
    if (needsDecision.length) {
      return NextResponse.json({
        error: "Resolve every conflict in this chunk before committing it.",
        requiresDecision: needsDecision.map(stage => ({
          sequence: stage.sequence, action: stage.action, studentName: stage.student?.name || "",
          codes: stage.student?.codes || [], conflicts: stage.conflicts || [], warnings: stage.warnings || []
        }))
      }, { status: 409 });
    }

    const results = [];
    for (const stage of stages) {
      const decision = decisions.get(stage.sequence);
      results.push({ sequence: stage.sequence, ...(await commitOne(stage, importBatchId, decision)) });
      await ImportLog.updateOne({ importBatchId, commitLockToken: lockToken }, { $inc: { committedGroups: 1 } });
    }
    const pendingGroups = await StudentImportStaging.countDocuments({ importBatchId, committedAt: null });
    const finalStatus = pendingGroups === 0 ? "COMPLETED" : "COMMITTING";
    await ImportLog.updateOne({ importBatchId, commitLockToken: lockToken }, {
      $set: {
        status: finalStatus,
        ...(pendingGroups === 0 ? { completedAt: new Date() } : {}),
        lastError: ""
      }
    });
    return NextResponse.json({
      importBatchId, processed: results.length, results,
      pendingGroups, status: finalStatus, hasMore: pendingGroups > 0
    });
  } catch (error) {
    console.error("[student-import-commit]", error);
    if (importBatchId) await ImportLog.updateOne({ importBatchId, ...(lockToken ? { commitLockToken: lockToken } : {}) }, {
      $set: { lastError: error.message || "Import commit failed.", status: "COMMITTING" }
    }).catch(() => {});
    return NextResponse.json({ error: "Student import commit failed.", detail: error.message }, { status: 500 });
  } finally {
    if (importBatchId && lockToken) {
      await ImportLog.updateOne({ importBatchId, commitLockToken: lockToken }, {
        $set: { commitLockToken: "", commitLockAt: null }
      }).catch(() => {});
    }
  }
}
