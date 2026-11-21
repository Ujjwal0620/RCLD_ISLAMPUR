import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Student from "@/models/Student";

export const runtime = "nodejs";

// One shared MongoDB counter assigns a permanent serial across all students.
const ICardIssueEventSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  idCardNo: { type: String, required: true },
  action: { type: String, enum: ["download", "print"], required: true },
  issuedAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false, collection: "student_icard_issue_events" });

// Use an event collection (rather than a unique card-number collection) so
// every reprint and re-download can be recorded against the same card number.
const ICardIssueEvent = mongoose.models.StudentICardIssueEvent
  || mongoose.model("StudentICardIssueEvent", ICardIssueEventSchema);

function getCounterSequence(counterDocument) {
  const sequence = Number(counterDocument?.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("MongoDB did not return a valid ID-card sequence.");
  }
  return sequence;
}

export async function POST(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    }

    const student = await Student.findById(id).select("_id idCardNo").lean();
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    let action = "download";
    try {
      const body = await request.json();
      if (body?.action === "print") action = "print";
    } catch {
      // Older clients without a request body are treated as downloads.
    }

    // A student keeps the first card number ever assigned. Printing or
    // downloading the same student's card must never consume another serial.
    let idCardNo = String(student.idCardNo || "").trim();

    if (!idCardNo) {
      // MongoDB's native atomic increment keeps numbering global across
      // requests, serverless instances, and application restarts.
      const counters = mongoose.connection.collection("system_counters");
      const counterResult = await counters.findOneAndUpdate(
        { _id: "student_icard_number" },
        { $inc: { sequence: 1 } },
        { upsert: true, returnDocument: "after" },
      );
      // MongoDB Node driver v5 returns { value }, while v6 returns the document.
      const counterDocument = counterResult?.value ?? counterResult;
      const sequence = getCounterSequence(counterDocument);
      const candidate = `RCLD/ID-NO/${String(sequence).padStart(4, "0")}`;

      // Conditional assignment prevents two simultaneous requests for the
      // same student from replacing one another's permanent card number.
      const assigned = await Student.findOneAndUpdate(
        {
          _id: student._id,
          $or: [
            { idCardNo: { $exists: false } },
            { idCardNo: null },
            { idCardNo: "" },
          ],
        },
        { $set: { idCardNo: candidate } },
        { new: true, projection: { idCardNo: 1 } },
      ).lean();

      if (assigned?.idCardNo) {
        idCardNo = String(assigned.idCardNo);
      } else {
        // Another request may have assigned the number first.
        const latestStudent = await Student.findById(student._id).select("idCardNo").lean();
        idCardNo = String(latestStudent?.idCardNo || "").trim();
        if (!idCardNo) throw new Error("Unable to save the student's ID-card number.");
      }
    }

    // Keep an immutable history row for every download/print, including
    // repeat actions that intentionally reuse the student's permanent number.
    await ICardIssueEvent.create({
      studentId: student._id,
      idCardNo,
      action,
      issuedAt: new Date(),
    });

    return NextResponse.json({ idCardNo });
  } catch (error) {
    console.error("[student-icard-number]", error);
    return NextResponse.json(
      { error: "Unable to generate the student ID-card number." },
      { status: 500 },
    );
  }
}
