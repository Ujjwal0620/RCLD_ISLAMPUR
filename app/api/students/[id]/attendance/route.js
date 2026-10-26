import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: "Student" },
  date: { type: String, required: true },
  status: { type: String, enum: ["Present", "Absent", "Leave"], required: true },
  subject: String,
  batch: String,
  note: String,
  markedBy: String,
}, { timestamps: true });
AttendanceSchema.index({ studentId: 1, date: 1, subject: 1 }, { unique: true });

const StudentAttendance = mongoose.models.StudentAttendance || mongoose.model("StudentAttendance", AttendanceSchema);

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    const records = await StudentAttendance.find({ studentId: id }).sort({ date: -1 }).limit(200).lean();
    const present = records.filter(r => r.status === "Present").length;
    const absent = records.filter(r => r.status === "Absent").length;
    const leave = records.filter(r => r.status === "Leave").length;
    const total = present + absent + leave;
    return NextResponse.json({
      records,
      summary: { total, present, absent, leave, percentage: total ? Math.round((present / total) * 10000) / 100 : 0 }
    });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load attendance.", detail: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    const body = await request.json();
    if (!body.date || !["Present","Absent","Leave"].includes(body.status)) {
      return NextResponse.json({ error: "Date and a valid attendance status are required." }, { status: 400 });
    }
    const record = await StudentAttendance.findOneAndUpdate(
      { studentId: id, date: body.date, subject: body.subject || "" },
      { $set: { status: body.status, batch: body.batch || "", note: body.note || "", markedBy: body.markedBy || "superadmin" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ record }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to save attendance.", detail: error.message }, { status: 500 });
  }
}
