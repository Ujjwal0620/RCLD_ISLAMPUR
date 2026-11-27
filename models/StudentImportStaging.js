import mongoose from "mongoose";

const StudentImportStagingSchema = new mongoose.Schema({
  importBatchId: { type: String, required: true, index: true },
  sequence: { type: Number, required: true },
  groupKey: { type: String, required: true },
  action: { type: String, enum: ["NEW", "UPDATE", "CONFLICT", "REVIEW", "SKIP"], default: "REVIEW" },
  matchedMasterId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentMaster", default: null },
  matchedLegacyStudentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
  resolvedCurrentCode: { type: String, default: "" },
  codeHistory: { type: [String], default: [] },
  codeSourceDate: { type: Date, default: null },
  student: { type: mongoose.Schema.Types.Mixed, default: {} },
  registrations: { type: [mongoose.Schema.Types.Mixed], default: [] },
  payments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  warnings: { type: [String], default: [] },
  conflicts: { type: [mongoose.Schema.Types.Mixed], default: [] },
  committedAt: { type: Date, default: null },
  committedResult: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true, collection: "student_import_staging" });

StudentImportStagingSchema.index({ importBatchId: 1, sequence: 1 }, { unique: true });
StudentImportStagingSchema.index({ importBatchId: 1, groupKey: 1 });
export default mongoose.models.StudentImportStaging || mongoose.model("StudentImportStaging", StudentImportStagingSchema);
