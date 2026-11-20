import mongoose from "mongoose";

const AllocationSchema = new mongoose.Schema({
  installmentIndex: { type: Number, required: true },
  label: { type: String, default: "" },
  allocatedAmount: { type: Number, required: true, min: 0 }
}, { _id: false });

const StudentFeePaymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentMaster", required: true, index: true },
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentEnrollment", required: true, index: true },
  stCode: { type: String, required: true, trim: true },
  mrNo: { type: String, required: true, trim: true },
  amountPaid: { type: Number, required: true, min: 0 },
  paymentDate: { type: Date, required: true },
  allocations: { type: [AllocationSchema], default: [] },
  sourceSheet: { type: String, default: "" },
  sourceRowNo: Number,
  importBatchKey: { type: String, default: "" }
}, { timestamps: true, collection: "student_fee_payments" });

StudentFeePaymentSchema.index(
  { mrNo: 1, stCode: 1, paymentDate: 1, amountPaid: 1 },
  { unique: true }
);

export default mongoose.models.StudentFeePayment || mongoose.model("StudentFeePayment", StudentFeePaymentSchema);
