import mongoose from "mongoose";

const ImportLogSchema = new mongoose.Schema({
  importBatchId: { type: String, required: true, unique: true, index: true },
  importType: { type: String, default: "UNIVERSAL_STUDENT_WORKBOOK" },
  sourceFileName: { type: String, default: "" },
  sourceFileHash: { type: String, default: "", index: true },
  actorId: { type: String, default: "" },
  actorRole: { type: String, default: "" },
  status: { type: String, enum: ["PREVIEW_READY", "COMMITTING", "COMPLETED", "FAILED", "CANCELLED"], default: "PREVIEW_READY", index: true },
  layoutType: { type: String, default: "" },
  mapping: { type: mongoose.Schema.Types.Mixed, default: {} },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  warnings: { type: [mongoose.Schema.Types.Mixed], default: [] },
  conflictCount: { type: Number, default: 0 },
  totalGroups: { type: Number, default: 0 },
  committedGroups: { type: Number, default: 0 },
  totalChunks: { type: Number, default: 0 },
  completedChunks: { type: [Number], default: [] },
  lastError: { type: String, default: "" },
  commitLockToken: { type: String, default: "" },
  commitLockAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true, collection: "import_logs" });

ImportLogSchema.index({ status: 1, createdAt: -1 });
export default mongoose.models.ImportLog || mongoose.model("ImportLog", ImportLogSchema);
