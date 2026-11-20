/**
 * One-time, conservative identity consolidation.
 *
 * Run a report first:
 *   node scripts/merge-student-master-profiles.js
 *
 * Apply the links/enrollments after reviewing the report:
 *   node scripts/merge-student-master-profiles.js --apply
 *
 * This script never deletes legacy Student documents. Their ObjectIds are referenced
 * by attendance, batches, fee records and other ERP modules. It links those records
 * to one StudentMaster identity and preserves every St_Code as an enrollment.
 */
import mongoose from "mongoose";
import StudentMaster from "../models/StudentMaster.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import { findIdentityMatch } from "../lib/student-import/matching.js";
import { normalizeName, normalizeStCode, parsePhones } from "../lib/student-import/normalization.js";

const apply = process.argv.includes("--apply");
const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

function phoneNumbers(student) {
  return parsePhones([
    student.mobileNumber, student.guardianContactNumber, student.whatsappNumber,
    student.sourcePhone, student.phoneNumber,
  ].filter(Boolean).join(","));
}
function identityRow(student) {
  return {
    fullName: student.applicantName || student.sourceStudentName || student.name || "",
    dob: student.dateOfBirth || student.dob || null,
    fatherName: student.fatherOrHusbandName || student.fatherName || "",
    phoneNumbers: phoneNumbers(student),
  };
}
function enrollmentCode(student) {
  return normalizeStCode(student.regnNo || student.enrollmentNo || student.studentCode);
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(process.env.MONGODB_URI);
  const students = await Student.find({}).sort({ createdAt: 1, _id: 1 }).lean();
  const existingMasters = await StudentMaster.find({}).lean();
  const groups = existingMasters.map(master => ({ ...master, _isExisting: true }));
  const assignments = [];
  let ambiguous = 0, createdGroups = 0;

  for (const student of students) {
    const alreadyLinked = groups.find(master => (master.legacyStudentIds || []).some(id => String(id) === String(student._id)));
    if (alreadyLinked) {
      assignments.push({ student, master: alreadyLinked, method: "ALREADY_LINKED" });
      continue;
    }
    const match = findIdentityMatch(identityRow(student), groups);
    if (match.match && !match.ambiguous) {
      assignments.push({ student, master: match.match, method: match.method });
      continue;
    }
    if (match.ambiguous) ambiguous += 1;
    const newGroup = {
      _id: "NEW-" + String(student._id),
      fullName: identityRow(student).fullName,
      normalizedFullName: normalizeName(identityRow(student).fullName),
      dob: identityRow(student).dob,
      fatherName: identityRow(student).fatherName,
      phoneNumbers: identityRow(student).phoneNumbers,
      legacyStudentIds: [],
      _isExisting: false,
      identityWarnings: match.ambiguous ? ["Ambiguous identity candidates; intentionally kept separate."] : [],
    };
    groups.push(newGroup);
    assignments.push({ student, master: newGroup, method: match.ambiguous ? "AMBIGUOUS_NEW_PROFILE" : "NEW_PROFILE" });
    createdGroups += 1;
  }

  const summary = {
    mode: apply ? "APPLY" : "DRY RUN",
    studentRecords: students.length,
    existingMasterProfiles: existingMasters.length,
    resultingMasterProfiles: groups.length,
    recordsToLink: assignments.filter(item => item.method !== "ALREADY_LINKED").length,
    newMasterProfiles: createdGroups,
    ambiguousRecordsKeptSeparate: ambiguous,
    enrollmentCodesFound: assignments.filter(item => enrollmentCode(item.student)).length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log("Dry run only. Review the counts, then rerun with --apply to persist.");
    return;
  }

  const realMasterIds = new Map();
  for (const group of groups) {
    if (group._isExisting) realMasterIds.set(String(group._id), group._id);
    else {
      const master = await StudentMaster.create({
        fullName: group.fullName || "Student",
        normalizedFullName: group.normalizedFullName,
        dob: group.dob || null,
        fatherName: group.fatherName || "",
        normalizedFatherName: normalizeName(group.fatherName),
        phoneNumbers: group.phoneNumbers || [],
        identityWarnings: group.identityWarnings || [],
        identityMatchMethod: group.identityWarnings?.length ? "AMBIGUOUS_NEW_PROFILE" : "CLEANUP_NEW_PROFILE",
        legacyStudentIds: [],
        stCodes: [],
      });
      realMasterIds.set(String(group._id), master._id);
    }
  }

  for (const { student, master: plannedMaster } of assignments) {
    const masterId = realMasterIds.get(String(plannedMaster._id));
    const master = await StudentMaster.findById(masterId);
    if (!master.legacyStudentIds.some(id => String(id) === String(student._id))) master.legacyStudentIds.push(student._id);
    const latestDate = new Date(student.admissionDate || student.createdAt || 0);
    const currentDate = new Date(master.updatedAt || master.createdAt || 0);
    if (latestDate >= currentDate) {
      master.address = student.address || master.address;
      master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...phoneNumbers(student)])];
      master.qualification = student.sourceQualification || master.qualification;
      if (!master.photoUrl && student.photoUrl) master.photoUrl = student.photoUrl;
    }
    await master.save();

    const stCode = enrollmentCode(student);
    if (!stCode) continue;
    const normalizedFullName = normalizeName(identityRow(student).fullName);
    let enrollment = await StudentEnrollment.findOne({ studentId: master._id, stCode, normalizedFullName });
    if (!enrollment) {
      await StudentEnrollment.updateMany({ studentId: master._id, status: "ACTIVE" }, { $set: { status: "PROMOTED" } });
      enrollment = await StudentEnrollment.create({
        studentId: master._id,
        legacyStudentId: student._id,
        stCode,
        normalizedFullName,
        formNo: student.formNo || "",
        courseCode: String(student.courseCode || "LEGACY").toUpperCase(),
        semesterLabel: student.sourceCourseLabel || student.courseCode || "LEGACY",
        admissionDate: student.admissionDate ? new Date(student.admissionDate) : null,
        status: "ACTIVE",
        feeConfig: { configured: false, feeRuleSource: "CLEANUP_REVIEW_REQUIRED" },
      });
    }
    master.activeEnrollmentId = enrollment._id;
    if (!master.stCodes.includes(stCode)) master.stCodes.push(stCode);
    await master.save();
  }
  console.log("Master identity links and enrollment history were saved. Legacy Student documents were intentionally retained.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
});
