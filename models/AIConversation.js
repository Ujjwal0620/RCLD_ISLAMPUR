import mongoose from "mongoose";

const AIMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, trim: true },
    model: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AIConversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "RCLD ERP AI Conversation", trim: true },
    messages: { type: [AIMessageSchema], default: [] },
    lastModel: { type: String, default: "" },
    contextVersion: { type: String, default: "rcld-erp-v1" },
  },
  { timestamps: true }
);

export default mongoose.models.AIConversation ||
  mongoose.model("AIConversation", AIConversationSchema);
