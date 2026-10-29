import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";

const StudentSchema = new mongoose.Schema({
  formNo: { type: String, required: true, unique: true, trim: true },
  aecCode: String, regnNo: String, enrollmentNo: String, admissionDate: String, guardianContactNumber: String, dueAmount: mongoose.Schema.Types.Mixed, paymentStatus: mongoose.Schema.Types.Mixed, sourceCourseLabel: String, importSource: String, courseName: String, courseCode: String,
  applicantName: { type: String, required: true, trim: true }, nationality: String, dateOfBirth: String, sex: String,
  fatherOrHusbandName: String, address: String, pin: String, whatsappNumber: String,
  mobileNumber: { type: String, required: true, trim: true },
  qualifications: [{ examCourse: String, boardUniversity: String, collegeInstitute: String, year: String, percentage: String }],
  enclosures: { stampPhoto: Boolean, qualifyingCertificates: Boolean, matricAdmitCard: Boolean },
  declarationDate: String, declarationPlace: String, signatureApplicant: String, photoUrl: String,
  status: { type: String, default: "Registered" }
}, { timestamps: true });

const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

const DEFAULT_COURSES = ["CCA","DCA","ADCA","CCC","CAO","DWPD","DOM","DCST","DCAP","DHNT"];

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
    const registration = (searchParams.get("registration") || "").trim();
    const fromDate = (searchParams.get("fromDate") || "").trim();
    const toDate = (searchParams.get("toDate") || "").trim();

    const filter = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^{}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { applicantName: rx }, { formNo: rx }, { mobileNumber: rx },
        { courseName: rx }, { regnNo: rx }, { fatherOrHusbandName: rx },
        { aecCode: rx }, { whatsappNumber: rx }
      ];
    }
    if (sex) filter.sex = sex;
    if (course) filter.courseName = course;
    if (status && status !== "all") filter.status = status;
    else if (!status) filter.status = { $ne: "Cancelled" };
    if (registration === "assigned") filter.regnNo = { $exists: true, $nin: ["", null] };
    if (registration === "unassigned") filter.$and = [...(filter.$and || []), { $or: [{ regnNo: { $exists: false } }, { regnNo: "" }, { regnNo: null }] }];
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate + "T00:00:00.000Z");
      if (toDate) filter.createdAt.$lte = new Date(toDate + "T23:59:59.999Z");
    }

    const [students, total, dbCourses, statuses, sexes] = await Promise.all([
      Student.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Student.countDocuments(filter),
      Student.distinct("courseName"),
      Student.distinct("status"),
      Student.distinct("sex")
    ]);

    const courses = [...new Set([...DEFAULT_COURSES, ...dbCourses.filter(Boolean)])].sort();
    const filterStatuses = statuses.filter(Boolean).sort();
    const filterSexes = sexes.filter(Boolean).sort();

    return NextResponse.json({
      students,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      filterOptions: { courses, statuses: filterStatuses, sexes: filterSexes }
    });
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
    const student = await Student.create({
      ...body,
      formNo: String(body.formNo).trim(),
      applicantName: String(body.applicantName).trim(),
      mobileNumber: String(body.mobileNumber).trim()
    });
    if (body.courseCode || body.courseName) {
      const conditions = [];
      if (body.courseCode) conditions.push({ code: String(body.courseCode).trim().toUpperCase() });
      if (body.courseName) conditions.push({ name: String(body.courseName).trim() });
      const course = await Course.findOne({ $or: conditions }).lean();
      if (course) {
        const FeeSchema = new mongoose.Schema({ studentId:{type:mongoose.Schema.Types.ObjectId,unique:true,index:true,ref:"Student"}, totalFee:{type:Number,default:0}, discount:{type:Number,default:0}, admissionFee:{type:Number,default:0}, payments:Array, updatedBy:String }, {timestamps:true});
        const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);
        await StudentFee.findOneAndUpdate({studentId:student._id}, {$set:{totalFee:Number(course.fee||0),admissionFee:Number(course.admissionFee||0)}}, {upsert:true,new:true,setDefaultsOnInsert:true});
      }
    }
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error?.code === 11000 ? "Form No. already exists." : "Unable to register student.",
      detail: error.message
    }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
