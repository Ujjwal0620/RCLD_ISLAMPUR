import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Student from "@/models/Student";
import IdCardCounter from "@/models/IdCardCounter";

export const runtime = "nodejs";

const ICardIssueEventSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  idCardNo: { type: String, required: true },
  action: { type: String, enum: ["download", "print"], required: true },
  issuedAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false, collection: "student_icard_issue_events" });

const ICardIssueEvent = mongoose.models.StudentICardIssueEvent
  || mongoose.model("StudentICardIssueEvent", ICardIssueEventSchema);

function formatIdCardNumber(sequence) {
  return `RCLD/ID-NO/${String(sequence).padStart(4, "0")}`;
}

export async function POST(request, { params }) {
  let session;
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    }

    let action = "download";
    try {
      const body = await request.json();
      if (body?.action === "print") action = "print";
    } catch {
      // Older clients without a request body are treated as downloads.
    }

    session = await mongoose.startSession();
    let result;

    // Counter increment and student update commit together. MongoDB retries
    // transient transaction conflicts, so simultaneous requests for one
    // student reuse the first assigned number instead of consuming extras.
    await session.withTransaction(async () => {
      const student = await Student.findById(id)
        .select("_id idCardNumber idCardNo isDownloaded")
        .session(session)
        .lean();

      if (!student) {
        const error = new Error("Student not found.");
        error.status = 404;
        throw error;
      }

      let idCardNumber = String(student.idCardNumber || student.idCardNo || "").trim();

      if (!idCardNumber) {
        const counter = await IdCardCounter.findOneAndUpdate(
          { _id: "student_id_card" },
          { $inc: { sequence: 1 } },
          { upsert: true, new: true, session, setDefaultsOnInsert: false },
        ).lean();

        const sequence = Number(counter?.sequence);
        if (!Number.isSafeInteger(sequence) || sequence < 1) {
          throw new Error("Unable to allocate the next ID-card sequence.");
        }
        idCardNumber = formatIdCardNumber(sequence);
      }

      const update = {
        idCardNumber,
        idCardNo: idCardNumber,
      };
      if (action === "download") update.isDownloaded = true;

      const updatedStudent = await Student.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, session, runValidators: true },
      ).select("_id idCardNumber isDownloaded").lean();

      if (!updatedStudent) throw new Error("Unable to save the student's ID-card details.");

      await new ICardIssueEvent({
        studentId: student._id,
        idCardNo: idCardNumber,
        action,
        issuedAt: new Date(),
      }).save({ session });

      result = {
        idCardNumber: updatedStudent.idCardNumber,
        idCardNo: updatedStudent.idCardNumber,
        isDownloaded: Boolean(updatedStudent.isDownloaded),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[student-icard-number]", error);
    return NextResponse.json(
      { error: error.message === "Student not found." ? error.message : "Unable to save student ID-card details." },
      { status: error.status || 500 },
    );
  } finally {
    if (session) await session.endSession();
  }
}
