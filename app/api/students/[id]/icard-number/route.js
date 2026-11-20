import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Student from "@/models/Student";

export const runtime = "nodejs";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
}, { versionKey: false, collection: "system_counters" });

const Counter = mongoose.models.StudentIcardCounter
  || mongoose.model("StudentIcardCounter", CounterSchema);

const ICardIssueSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  idCardNo: { type: String, required: true, unique: true },
  action: { type: String, enum: ["download", "print"], required: true },
  issuedAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false, collection: "student_icard_issue_logs" });

const ICardIssue = mongoose.models.StudentICardIssue
  || mongoose.model("StudentICardIssue", ICardIssueSchema);

export async function POST(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    }

    const student = await Student.findById(id).select("_id").lean();
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    let action = "download";
    try {
      const body = await request.json();
      if (body?.action === "print") action = "print";
    } catch {
      // Older clients without a request body are treated as downloads.
    }

    // Use MongoDB's native collection update so the sequence is persisted
    // atomically in the shared database across requests and server restarts.
    const counters = mongoose.connection.collection("system_counters");
    const counterResult = await counters.findOneAndUpdate(
      { _id: "student_icard_number" },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    // MongoDB Node driver v5 returns { value }, while v6 returns the document.
    const counterDocument = counterResult?.value ?? counterResult;
    const sequence = Number(counterDocument?.sequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      throw new Error("MongoDB did not return a valid ID-card sequence.");
    }

    const idCardNo = `RCLD/ID-NO/${String(sequence).padStart(4, "0")}`;

    await Student.updateOne({ _id: student._id }, { $set: { idCardNo } });
    await ICardIssue.create({
      studentId: student._id,
      idCardNo,
      action,
      issuedAt: new Date(),
    });

    return NextResponse.json({ idCardNo });
  } catch (error) {
    console.error("[student-icard-number]", error);
    return NextResponse.json({ error: "Unable to generate the next ID-card number." }, { status: 500 });
  }
}
