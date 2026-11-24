import mongoose from "mongoose";

const RegistrationSchema = new mongoose.Schema({
  stCode: { type: String, required: true, trim: true },
  registrationId: { type: String, required: true, trim: true, uppercase: true },
  course: { type: String, default: "Previous Course (Legacy)", trim: true },
  dateOfAdmission: { type: Date, default: null },
  earliestPaymentDate: { type: Date, default: null },
  formNo: { type: String, default: "", trim: true },
  isCurrent: { type: Boolean, default: false }
}, { _id: false });

const EnrollmentHistorySchema = new mongoose.Schema({
  stCode: { type: String, required: true, trim: true },
  registrationId: { type: String, default: "", trim: true, uppercase: true },
  course: { type: String, default: "Previous Course (Legacy)", trim: true },
  dateOfAdmission: { type: Date, default: null },
  earliestPaymentDate: { type: Date, default: null },
  formNo: { type: String, default: "", trim: true },
  isCurrent: { type: Boolean, default: false },
  identitySource: { type: String, default: "WORKBOOK" }
}, { _id: false });

const StudentMasterSchema = new mongoose.Schema({
  fullName: { type: String, default: "", trim: true },
  normalizedFullName: { type: String, default: "", index: true },
  dob: { type: Date, default: null },
  gender: { type: String, default: "" },
  fatherName: { type: String, default: "", trim: true },
  normalizedFatherName: { type: String, default: "", index: true },
  address: { type: String, default: "" },
  photoUrl: { type: String, default: "" },
  hasPhoto: { type: Boolean, default: false },
  stCodes: { type: [String], default: [] },
  registrations: { type: [RegistrationSchema], default: [] },
  enrollments: { type: [EnrollmentHistorySchema], default: [] },
  currentStCode: { type: String, default: "", trim: true },
  currentRegistrationId: { type: String, default: "", trim: true, uppercase: true },
  currentCourse: { type: String, default: "", trim: true },
  currentAdmissionDate: { type: Date, default: null },
  dateOfAdmission: { type: Date, default: null },
  formNo: { type: String, default: "", trim: true },
  phoneNumbers: { type: [String], default: [] },
  qualification: { type: String, default: "" },
  activeEnrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentEnrollment", default: null },
  legacyStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
  identityMatchMethod: { type: String, default: "IMPORT" },
  identityWarnings: { type: [String], default: [] },
  feeSummary: {
    totalFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    feeStatus: { type: String, enum: ["Paid", "Partial", "Unpaid"], default: "Unpaid" },
    courseCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: null }
  }
}, { timestamps: true, collection: "student_master_profiles" });

StudentMasterSchema.index({ stCodes: 1 });
StudentMasterSchema.index({ "registrations.registrationId": 1 });
StudentMasterSchema.index({ phoneNumbers: 1 });
StudentMasterSchema.index({ normalizedFullName: 1, dob: 1 });
StudentMasterSchema.index({ normalizedFullName: 1, normalizedFatherName: 1 });

export default mongoose.models.StudentMaster || mongoose.model("StudentMaster", StudentMasterSchema);