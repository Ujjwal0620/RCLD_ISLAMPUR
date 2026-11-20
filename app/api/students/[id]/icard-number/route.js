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

export async function POST(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    }

    const student = await Student.findById(id).select("_id").lean();
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const counter = await Counter.findOneAndUpdate(
      { _id: "student_icard_number" },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const idCardNo = String(counter.sequence);
    await Student.updateOne({ _id: student._id }, { $set: { idCardNo } });

    return NextResponse.json({ idCardNo });
  } catch (error) {
    console.error("[student-icard-number]", error);
    return NextResponse.json({ error: "Unable to generate the next ID-card number." }, { status: 500 });
  }
}
