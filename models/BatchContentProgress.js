import mongoose from "mongoose";
const BatchContentProgressSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  batchCode: String,
  courseId: mongoose.Schema.Types.ObjectId,
  courseCode: String,
  courseContentId: mongoose.Schema.Types.ObjectId,
  modules: { type: Array, default: [] }
}, { timestamps: true });
export default mongoose.models.BatchContentProgress || mongoose.model("BatchContentProgress", BatchContentProgressSchema);
