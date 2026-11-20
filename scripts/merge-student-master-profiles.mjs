/**
 * One-time, conservative StudentMaster consolidation.
 *
 * Dry run:
 *   node --env-file=.env scripts/merge-student-master-profiles.mjs
 *
 * Apply after reviewing the dry-run counts:
 *   node --env-file=.env scripts/merge-student-master-profiles.mjs --apply
 *
 * Legacy Student documents are deliberately retained because attendance, batches,
 * payments and other operational records may reference their ObjectIds. The API
 * presents one canonical directory profile per StudentMaster identity.
 */
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
const normalizeName = value => String(value ?? "").trim().normalize("NFKC")
  .replace(/_\d+\s*$/, "").toUpperCase().replace(/\s+/g, " ")
  .replace(/[',.]+$/, "").trim();
const normalizeFather = value => normalizeName(value).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const phones = value => [...new Set(String(value ?? "").split(/[,;/|]/)
  .map(item => item.replace(/\D/g, "")).map(item => item.length > 10 ? item.slice(-10) : item)
  .filter(item => item.length === 10))];
const tokenOverlap = (a, b) => {
  const left = new Set(normalizeFather(a).split(" ").filter(Boolean));
  const right = new Set(normalizeFather(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return false;
  return [...left].filter(token => right.has(token)).length / Math.min(left.size, right.size) >= 0.6;
};
const similarity = (left, right) => {
  const a = normalizeName(left), b = normalizeName(right);
  if (a === b) return 1;
  if (!a || !b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
};
const dateKey = value => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};
function findIdentityMatch(row, candidates) {
  const name = normalizeName(row.fullName), father = normalizeFather(row.fatherName);
  const dob = dateKey(row.dob), rowPhones = new Set(row.phoneNumbers || []);
  const exact = [], spelling = [];
  for (const candidate of candidates) {
    const candidateName = normalizeName(candidate.fullName || candidate.normalizedFullName);
    const candidateFather = normalizeFather(candidate.fatherName);
    const sameDob = Boolean(dob && dateKey(candidate.dob) === dob);
    const sameFather = Boolean(father && candidateFather && (father === candidateFather || tokenOverlap(father, candidateFather)));
    const samePhone = (candidate.phoneNumbers || []).some(phone => rowPhones.has(phone));
    if (candidateName === name && (sameDob || sameFather || samePhone)) {
      exact.push(candidate); continue;
    }
    if (sameDob && father && candidateFather && father === candidateFather && similarity(name, candidateName) >= 0.85) spelling.push(candidate);
  }
  const matches = exact.length ? exact : spelling;
  const distinct = [];
  for (const candidate of matches) {
    const duplicate = distinct.some(other => {
      const sameName = normalizeName(candidate.fullName || candidate.normalizedFullName) === normalizeName(other.fullName || other.normalizedFullName);
      const sameDob = Boolean(dateKey(candidate.dob) && dateKey(candidate.dob) === dateKey(other.dob));
      const sameFather = tokenOverlap(candidate.fatherName, other.fatherName);
      const candidatePhones = new Set(candidate.phoneNumbers || []);
      const samePhone = (other.phoneNumbers || []).some(phone => candidatePhones.has(phone));
      return sameName && (sameDob || sameFather || samePhone);
    });
    if (!duplicate) distinct.push(candidate);
  }
  if (distinct.length === 1) return { match: distinct[0], ambiguous: false };
  return { match: null, ambiguous: distinct.length > 1 };
}
const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const MasterSchema = new mongoose.Schema({
  fullName: String, normalizedFullName: String, dob: Date, fatherName: String, normalizedFatherName: String,
  address: String, photoUrl: String, stCodes: [String], phoneNumbers: [String], qualification: String,
  activeEnrollmentId: mongoose.Schema.Types.ObjectId, legacyStudentIds: [mongoose.Schema.Types.ObjectId],
  identityMatchMethod: String, identityWarnings: [String],
}, { strict: false, timestamps: true, collection: "student_master_profiles" });
const EnrollmentSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId, legacyStudentId: mongoose.Schema.Types.ObjectId,
  stCode: String, normalizedFullName: String, formNo: String, courseCode: String,
  semesterLabel: String, admissionDate: Date, status: String, feeConfig: mongoose.Schema.Types.Mixed,
  installments: [mongoose.Schema.Types.Mixed], summary: mongoose.Schema.Types.Mixed,
}, { strict: false, timestamps: true, collection: "student_enrollments" });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
const StudentMaster = mongoose.models.StudentMaster || mongoose.model("StudentMaster", MasterSchema);
const StudentEnrollment = mongoose.models.StudentEnrollment || mongoose.model("StudentEnrollment", EnrollmentSchema);

const identityOf = student => ({
  fullName: student.applicantName || student.sourceStudentName || student.name || "UNIDENTIFIED STUDENT " + String(student._id),
  dob: student.dateOfBirth || student.dob || null,
  fatherName: student.fatherOrHusbandName || student.fatherName || "",
  phoneNumbers: phones([student.mobileNumber, student.guardianContactNumber, student.whatsappNumber, student.sourcePhone].filter(Boolean).join(",")),
});
const stCodeOf = student => String(student.regnNo || student.enrollmentNo || student.studentCode || "").replace(/\.0$/, "").trim();

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required. Use --env-file=.env.");
  await mongoose.connect(process.env.MONGODB_URI);
  const students = await Student.find({}).sort({ admissionDate: 1, createdAt: 1, _id: 1 }).lean();
  const existing = await StudentMaster.find({}).lean();
  const groups = existing.map(master => ({ ...master, _existing: true }));
  const assignments = [];
  let ambiguous = 0, newGroups = 0;
  for (const student of students) {
    const linked = groups.find(master => (master.legacyStudentIds || []).some(id => String(id) === String(student._id)));
    if (linked) { assignments.push({ student, group: linked, method: "ALREADY_LINKED" }); continue; }
    const match = findIdentityMatch(identityOf(student), groups);
    if (match.match) { assignments.push({ student, group: match.match, method: "IDENTITY_MATCH" }); continue; }
    if (match.ambiguous) ambiguous += 1;
    const group = {
      _id: "NEW-" + String(student._id), ...identityOf(student),
      normalizedFullName: normalizeName(identityOf(student).fullName),
      legacyStudentIds: [], stCodes: [], _existing: false,
      identityWarnings: match.ambiguous ? ["Ambiguous identity candidates; not merged automatically."] : [],
    };
    groups.push(group);
    assignments.push({ student, group, method: match.ambiguous ? "AMBIGUOUS_NEW_PROFILE" : "NEW_PROFILE" });
    newGroups += 1;
  }
  console.log(JSON.stringify({
    mode: apply ? "APPLY" : "DRY RUN", studentRecords: students.length,
    existingMasterProfiles: existing.length, resultingMasterProfiles: groups.length,
    recordsToLink: assignments.filter(item => item.method !== "ALREADY_LINKED").length,
    newMasterProfiles: newGroups, ambiguousRecordsKeptSeparate: ambiguous,
    registrationCodes: assignments.filter(item => stCodeOf(item.student)).length,
  }, null, 2));
  if (!apply) { console.log("No database writes were made. Review the report, then rerun with --apply."); return; }

  let enrollmentIndexes = [];
  try { enrollmentIndexes = await StudentEnrollment.collection.indexes(); }
  catch (error) { if (error.code !== 26 && error.codeName !== "NamespaceNotFound") throw error; }
  const oldEnrollmentIndex = enrollmentIndexes.find(index => index.unique
    && index.key?.stCode === 1 && index.key?.normalizedFullName === 1 && !index.key?.studentId);
  if (oldEnrollmentIndex) await StudentEnrollment.collection.dropIndex(oldEnrollmentIndex.name);
  await StudentEnrollment.collection.createIndex(
    { studentId: 1, stCode: 1, normalizedFullName: 1 },
    { unique: true, name: "studentId_1_stCode_1_normalizedFullName_1" }
  );

  const idMap = new Map();
  for (const group of groups) {
    if (group._existing) idMap.set(String(group._id), group._id);
    else {
      const master = await StudentMaster.create({
        fullName: group.fullName || "Student",
        normalizedFullName: group.normalizedFullName,
        dob: group.dob || null, fatherName: group.fatherName || "",
        normalizedFatherName: normalizeFather(group.fatherName),
        phoneNumbers: group.phoneNumbers || [], identityWarnings: group.identityWarnings || [],
        identityMatchMethod: group.identityWarnings?.length ? "AMBIGUOUS_NEW_PROFILE" : "CLEANUP_NEW_PROFILE",
        legacyStudentIds: [], stCodes: [],
      });
      idMap.set(String(group._id), master._id);
    }
  }
  for (const { student, group } of assignments) {
    const master = await StudentMaster.findById(idMap.get(String(group._id)));
    if (!master.legacyStudentIds.some(id => String(id) === String(student._id))) master.legacyStudentIds.push(student._id);
    master.address = student.address || master.address;
    master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...identityOf(student).phoneNumbers])];
    master.qualification = student.sourceQualification || master.qualification;
    if (!master.photoUrl && student.photoUrl) master.photoUrl = student.photoUrl;
    const stCode = stCodeOf(student);
    if (stCode) {
      if (!master.stCodes.includes(stCode)) master.stCodes.push(stCode);
      const normalizedFullName = normalizeName(identityOf(student).fullName);
      let enrollment = await StudentEnrollment.findOne({ studentId: master._id, stCode, normalizedFullName });
      if (!enrollment) {
        await StudentEnrollment.updateMany({ studentId: master._id, status: "ACTIVE" }, { $set: { status: "PROMOTED" } });
        enrollment = await StudentEnrollment.create({
          studentId: master._id, legacyStudentId: student._id, stCode, normalizedFullName,
          formNo: student.formNo || "", courseCode: String(student.courseCode || "LEGACY").toUpperCase(),
          semesterLabel: student.sourceCourseLabel || student.courseCode || "LEGACY",
          admissionDate: student.admissionDate ? new Date(student.admissionDate) : null,
          status: "ACTIVE", feeConfig: { configured: false, feeRuleSource: "CLEANUP_REVIEW_REQUIRED" },
        });
      }
      master.activeEnrollmentId = enrollment._id;
    }
    await master.save();
  }
  console.log("Consolidation complete. Legacy Student documents were retained; one master identity now links their enrollments.");
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { if (mongoose.connection.readyState) await mongoose.disconnect(); });
