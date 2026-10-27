import mongoose from "mongoose";

const AIKnowledgeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    category: { type: String, default: "project", index: true },
    content: { type: String, required: true },
    source: { type: String, default: "RCLD ERP" },
    active: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0 },
    keywords: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.AIKnowledge ||
  mongoose.model("AIKnowledge", AIKnowledgeSchema);
