import mongoose from "mongoose";

const IdCardCounterSchema = new mongoose.Schema({
  _id: { type: String, default: "student_id_card" },
  lastIssuedNumber: { type: Number, default: 0, min: 0 },
}, {
  versionKey: false,
  collection: "id_card_counters",
});

export default mongoose.models.IdCardCounter
  || mongoose.model("IdCardCounter", IdCardCounterSchema);
