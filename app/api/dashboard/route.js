import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
const StudentSchema = new mongoose.Schema({}, { strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
export async function GET() {
  try {
    await connectMongoDB();
    const [students, registered, recent] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ status: "Registered" }),
      Student.find({}).sort({ createdAt: -1 }).limit(5).select("formNo applicantName courseName mobileNumber status createdAt").lean()
    ]);
    return NextResponse.json({ students, registered, recent });
  } catch (error) {
    return NextResponse.json({ students: 0, registered: 0, recent: [], error: "Dashboard data unavailable." });
  }
}