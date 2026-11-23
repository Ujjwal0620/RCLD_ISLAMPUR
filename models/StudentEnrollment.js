import mongoose from "mongoose";

const ReceiptRefSchema = new mongoose.Schema({
  mrNo: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  paymentDate: { type: Date, default: null },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentFeePayment", default: null }
}, { _id: false });

const InstallmentSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  label: { type: String, required: true },
  feeType: { type: String, enum: ["ADMISSION", "ANNUAL_RENEWAL", "MONTHLY"], required: true },
  dueDate: { type: Date, default: null },
  amountDue: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["PAID", "PARTIAL", "PENDING", "WAIVED"], default: "PENDING" },
  receiptRefs: { type: [ReceiptRefSchema], default: [] }
}, { _id: false });

const StudentEnrollmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentMaster", required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null, index: true },
  legacyStudentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null, index: true },
  stCode: { type: String, required: true, trim: true },
  normalizedFullName: { type: String, required: true, index: true },
  formNo: { type: String, default: "" },
  courseCode: { type: String, required: true, trim: true, uppercase: true, index: true },
  courseCategory: { type: String, enum: ["ROBOTICS", "CODING_FOR_KIDS", "DOM", "OTHER"], default: "OTHER" },
  semesterLabel: { type: String, default: "LEGACY" },
  admissionDate: { type: Date, default: null },
  status: { type: String, enum: ["ACTIVE", "PROMOTED", "COMPLETED", "LEGACY"], default: "ACTIVE" },
  feeConfig: {
    admissionFee: { type: Number, default: 0 },
    monthlyInstallment: { type: Number, default: 0 },
    durationMonths: { type: Number, default: 0 },
    admissionIncluded: { type: Boolean, default: false },
    grossFee: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    netPayableFee: { type: Number, default: 0 },
    registrationFee: { type: Number, default: 0 },
    labCharges: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    feeRuleSource: { type: String, default: "COURSE_MASTER" },
    configured: { type: Boolean, default: true }
  },
  installments: { type: [InstallmentSchema], default: [] },
  summary: {
    totalDue: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    nextDueDate: { type: Date, default: null },
    feeStatus: { type: String, enum: ["Paid", "Partial", "Unpaid"], default: "Unpaid" }
  },
  sourceRowNo: Number,
  importBatchKey: { type: String, default: "" }
}, { timestamps: true, collection: "student_enrollments" });

StudentEnrollmentSchema.index({ studentId: 1, stCode: 1, normalizedFullName: 1, courseCode: 1 }, { unique: true, name: "student_course_enrollment_unique" });
StudentEnrollmentSchema.index({ stCode: 1 });
StudentEnrollmentSchema.index({ studentId: 1, admissionDate: 1 });

export default mongoose.models.StudentEnrollment || mongoose.model("StudentEnrollment", StudentEnrollmentSchema);
