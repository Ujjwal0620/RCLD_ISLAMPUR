import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  formNo: { type: String, required: true, unique: true, trim: true },
  kitIssueNo: String, aecCode: String, regnNo: String, courseName: String, courseCode: String,
  demandDraftNo: String, amount: String, demandDraftDate: String, bank: String,
  applicantName: { type: String, required: true, trim: true }, nationality: String, dateOfBirth: String, sex: String,
  fatherOrHusbandName: String, address: String, pin: String, stdCode: String, telephoneNumber: String,
  mobileNumber: { type: String, required: true, trim: true },
  qualifications: [{ examCourse: String, boardUniversity: String, collegeInstitute: String, year: String, percentage: String }],
  gdcaSem2: String, gdcaSem3: String,
  enclosures: { stampPhoto: Boolean, qualifyingCertificates: Boolean, demandDraft: Boolean },
  declarationDate: String, declarationPlace: String, signatureApplicant: String, photoUrl: String,
  status: { type: String, default: "Registered" }
}, { timestamps: true });

const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    }
    const student = await Student.findById(id).lean();
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    return NextResponse.json({ student });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load student.", detail: error.message }, { status: 500 });
  }
}
