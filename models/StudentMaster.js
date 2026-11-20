import mongoose from "mongoose";

const StudentMasterSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  normalizedFullName: { type: String, required: true, index: true },
  dob: { type: Date, default: null },
  gender: { type: String, enum: ["M", "F", "Other", ""], default: "" },
  fatherName: { type: String, default: "", trim: true },
  normalizedFatherName: { type: String, default: "", index: true },
  address: { type: String, default: "" },
  phoneNumbers: { type: [String], default: [] },
  qualification: { type: String, default: "" },
  activeEnrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentEnrollment", default: null },
  legacyStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
  identityMatchMethod: { type: String, default: "IMPORT" },
  identityWarnings: { type: [String], default: [] }
}, { timestamps: true, collection: "student_master_profiles" });

StudentMasterSchema.index({ normalizedFullName: 1, dob: 1 });
StudentMasterSchema.index({ normalizedFullName: 1, normalizedFatherName: 1 });

export default mongoose.models.StudentMaster || mongoose.model("StudentMaster", StudentMasterSchema);
