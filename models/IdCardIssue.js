import mongoose from "mongoose";

const IdCardIssueSchema = new mongoose.Schema({
  idCardNumber: { type: String, required: true, trim: true, unique: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, unique: true, index: true },
  formNo: { type: String, default: "" },
  applicantName: { type: String, default: "" },
  photoUrl: { type: String, default: "" },
  course: { type: String, default: "" },
  batch: { type: String, default: "" },
  mobile: { type: String, default: "" },
  issuedAt: { type: Date, default: Date.now },
  lastDownloadedAt: { type: Date, default: null },
  status: { type: String, enum: ["Downloaded"], default: "Downloaded" },
}, { timestamps: true, collection: "idCardIssues" });

export default mongoose.models.IdCardIssue || mongoose.model("IdCardIssue", IdCardIssueSchema);
