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

export async function GET(request) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = 50;
    const search = (searchParams.get("search") || "").trim();
    const sex = (searchParams.get("sex") || "").trim();
    const course = (searchParams.get("course") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const filter = {};
    if (search) {
      const rx = new RegExp(search, "i");
      filter.$or = [{ applicantName: rx }, { formNo: rx }, { mobileNumber: rx }, { courseName: rx }, { regnNo: rx }];
    }
    if (sex) filter.sex = sex;
    if (course) filter.courseName = course;
    if (status) filter.status = status;
    const [students, total] = await Promise.all([
      Student.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Student.countDocuments(filter)
    ]);
    return NextResponse.json({ students, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load students.", detail: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectMongoDB();
    const body = await request.json();
    const missing = ["formNo", "applicantName", "mobileNumber"].filter((key) => !String(body[key] || "").trim());
    if (missing.length) return NextResponse.json({ error: "Required fields: " + missing.join(", ") }, { status: 400 });
    const student = await Student.create({ ...body, formNo: String(body.formNo).trim(), applicantName: String(body.applicantName).trim(), mobileNumber: String(body.mobileNumber).trim() });
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.code === 11000 ? "Form No. already exists." : "Unable to register student.", detail: error.message }, { status: error?.code === 11000 ? 409 : 500 });
  }
}