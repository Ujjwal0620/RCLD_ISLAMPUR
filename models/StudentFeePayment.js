import mongoose from "mongoose";

const AllocationSchema = new mongoose.Schema({
  installmentIndex: { type: Number, required: true },
  label: { type: String, default: "" },
  allocatedAmount: { type: Number, required: true, min: 0 }
}, { _id: false });

const StudentFeePaymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentMaster", required: true, index: true },
  masterStudentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentMaster", default: null, index: true },
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentEnrollment", required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null, index: true },
  stCode: { type: String, required: true, trim: true },
  sourceStCode: { type: String, default: "", trim: true },
  normalizedStCode: { type: String, default: "", trim: true, index: true },
  sourceRowKey: { type: String, default: "", trim: true, index: true },
  sourceBatchKey: { type: String, default: "", trim: true, index: true },
  registrationId: { type: String, default: "", trim: true, uppercase: true, index: true },
  financialYear: { type: String, default: "" },
  stNameKey: { type: String, default: "", index: true },
  courseCode: { type: String, default: "" },
  course: { type: String, default: "" },
  mrNo: { type: String, required: true, trim: true },
  normalizedMrNo: { type: String, default: "", trim: true, index: true },
  paymentMode: { type: String, default: "" },
  amountPaid: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, default: null },
  rawPaymentDate: { type: mongoose.Schema.Types.Mixed, default: null },
  importWarnings: { type: [String], default: [] },
  allocations: { type: [AllocationSchema], default: [] },
  sourceSheet: { type: String, default: "" },
  sourceRowNo: Number,
  importBatchKey: { type: String, default: "" }
}, { timestamps: true, collection: "student_fee_payments" });

StudentFeePaymentSchema.index({ studentId: 1, enrollmentId: 1, mrNo: 1, paymentDate: 1, amountPaid: 1 }, { name: "student_course_receipt_lookup" });
StudentFeePaymentSchema.index({ sourceRowKey: 1 }, { unique: true, partialFilterExpression: { sourceRowKey: { $type: "string", $gt: "" } }, name: "student_fee_source_row_unique" });


export default mongoose.models.StudentFeePayment || mongoose.model("StudentFeePayment", StudentFeePaymentSchema);