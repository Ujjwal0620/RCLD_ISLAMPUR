import mongoose from "mongoose";

const StudentImportPaymentClaimSchema = new mongoose.Schema({
  paymentKey: { type: String, required: true, unique: true, index: true },
  importBatchId: { type: String, required: true, index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentFeePayment", default: null },
  claimedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
}, { timestamps: true, collection: "student_import_payment_claims" });

export default mongoose.models.StudentImportPaymentClaim
  || mongoose.model("StudentImportPaymentClaim", StudentImportPaymentClaimSchema);
