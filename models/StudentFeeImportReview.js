import mongoose from "mongoose";

const StudentFeeImportReviewSchema = new mongoose.Schema({
  reviewKey: { type: String, required: true, unique: true, index: true },
  sourceSheet: { type: String, default: "" },
  sourceRowNo: Number,
  financialYear: { type: String, default: "" },
  stCode: { type: String, default: "" },
  stNameKey: { type: String, default: "" },
  cleanName: { type: String, default: "" },
  extractedStCode: { type: String, default: "" },
  mrNo: { type: String, default: "" },
  paymentDate: { type: Date, default: null },
  amountPaid: { type: Number, default: 0 },
  rawRow: { type: mongoose.Schema.Types.Mixed, default: {} },
  reason: { type: String, default: "UNMATCHED" },
  status: { type: String, enum: ["PENDING", "RESOLVED"], default: "PENDING" },
  resolvedStudentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentMaster", default: null },
  resolvedEnrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentEnrollment", default: null }
}, { timestamps: true, collection: "student_fee_import_reviews" });

export default mongoose.models.StudentFeeImportReview
  || mongoose.model("StudentFeeImportReview", StudentFeeImportReviewSchema);
