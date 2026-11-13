import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";
import { getStudentAdmissionStatus } from "@/lib/student-admission-status";

const StudentSchema = new mongoose.Schema({
  formNo: { type: String, trim: true },
  aecCode: String, regnNo: String, enrollmentNo: String, admissionDate: String, guardianContactNumber: String, dueAmount: mongoose.Schema.Types.Mixed, paymentStatus: mongoose.Schema.Types.Mixed, sourceCourseLabel: String, importSource: String, courseName: String, courseCode: String, batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null }, batchCode: String,
  applicantName: { type: String, default: "", trim: true }, nationality: String, dateOfBirth: String, sex: String,
  fatherOrHusbandName: String, address: String, presentAddress: String, permanentAddress: String, sameAsPresentAddress: Boolean, postOffice: String, policeStation: String, nearestLandmark: String, district: String, state: String, permanentPostOffice: String, permanentNearestLandmark: String, permanentPin: String, permanentDistrict: String, permanentState: String, pin: String, whatsappNumber: String,
  mobileNumber: { type: String, default: "", trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  aadhaarNumber: { type: String, default: "", trim: true },
  referralId: { type: String, default: "" }, referralName: { type: String, default: "" }, marketingEmployeeId: { type: String, default: "" }, marketingEmployeeName: { type: String, default: "" },
  qualifications: [{ examCourse: String, boardUniversity: String, collegeInstitute: String, year: String, percentage: String }],
  enclosures: { stampPhoto: Boolean, qualifyingCertificates: Boolean, matricAdmitCard: Boolean },
  declarationDate: String, declarationPlace: String, signatureApplicant: String, signatureUrl: String, photoUrl: String,
  status: { type: String, default: "Admission Pending" }
}, { timestamps: true });

StudentSchema.index({ enrollmentNo: 1 }, { unique: true, partialFilterExpression: { enrollmentNo: { $type: "string", $gt: "" } } });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
let formNoIndexMigration;
async function removeLegacyFormNoUniqueIndex() {
  if (!formNoIndexMigration) {
    formNoIndexMigration = (async () => {
      const indexes = await Student.collection.indexes();
      const legacyIndex = indexes.find(index => index.name === "formNo_1" && index.unique);
      if (legacyIndex) await Student.collection.dropIndex(legacyIndex.name);
    })();
  }
  await formNoIndexMigration;
}
const CounterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
const Counter = mongoose.models.StudentCounter || mongoose.model("StudentCounter", CounterSchema, "student_counters");
async function nextStudentSequence(key) {
  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return counter.seq;
}
const ReferralSchema = new mongoose.Schema({}, { strict: false });
const Referral = mongoose.models.Referral || mongoose.model("Referral", ReferralSchema);

const DEFAULT_COURSES = ["CCA","DCA","ADCA","CCC","CAO","DWPD","DOM","DCST","DCAP","DHNT"];


export async function GET(request) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") || 50)));
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
        "applicantName","formNo","enrollmentNo","regnNo","aecCode","courseName","courseCode","batchCode",
        "mobileNumber","whatsappNumber","guardianContactNumber","email","aadhaarNumber","fatherOrHusbandName",
        "nationality","dateOfBirth","sex","address","presentAddress","permanentAddress","postOffice","policeStation",
        "nearestLandmark","district","state","pin","permanentPostOffice","permanentNearestLandmark","permanentPin",
        "permanentDistrict","permanentState","referralName","marketingEmployeeName","paymentStatus","declarationPlace",
        "qualifications.examCourse","qualifications.boardUniversity","qualifications.collegeInstitute","qualifications.year"
      ].map(field => ({ [field]: rx }));
    }
    const textFilters = [
      "formNo","enrollmentNo","regnNo","aecCode","applicantName","fatherOrHusbandName","mobileNumber",
      "whatsappNumber","guardianContactNumber","email","aadhaarNumber","nationality","district","state","pin",
      "postOffice","policeStation","nearestLandmark","permanentDistrict","permanentState","permanentPin",
      "permanentPostOffice","permanentNearestLandmark","courseCode","batchCode","referralName",
      "marketingEmployeeName","paymentStatus","declarationPlace"
    ];
    const escapeRegex = value => String(value).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    for (const field of textFilters) {
      const value = (searchParams.get(field) || "").trim();
      if (value) filter[field] = new RegExp(escapeRegex(value), "i");
    }
    const dateOfBirth = (searchParams.get("dateOfBirth") || "").trim();
    if (dateOfBirth) filter.dateOfBirth = dateOfBirth;
    const dueMin = searchParams.get("dueMin");
    const dueMax = searchParams.get("dueMax");
    if (dueMin !== null || dueMax !== null) {
      filter.dueAmount = {};
      if (dueMin !== null && dueMin !== "") filter.dueAmount.$gte = Number(dueMin);
      if (dueMax !== null && dueMax !== "") filter.dueAmount.$lte = Number(dueMax);
    }
    const admissionFrom = searchParams.get("admissionFrom");
    const admissionTo = searchParams.get("admissionTo");
    if (admissionFrom || admissionTo) {
      filter.admissionDate = {};
      if (admissionFrom) filter.admissionDate.$gte = admissionFrom;
      if (admissionTo) filter.admissionDate.$lte = admissionTo;
    }
    const qualification = (searchParams.get("qualification") || "").trim();
    if (qualification) {
      const qualificationRx = new RegExp(escapeRegex(qualification), "i");
      filter.$or = [...(filter.$or || []), ...["qualifications.examCourse","qualifications.boardUniversity","qualifications.collegeInstitute","qualifications.year","qualifications.percentage"].map(field => ({ [field]: qualificationRx }))];
    }
    if (sex) filter.sex = sex;
    if (course) filter.courseName = course;"), "i");
    }
    const dateOfBirth = (searchParams.get("dateOfBirth") || "").trim();
    if (dateOfBirth) filter.dateOfBirth = dateOfBirth;
    const dueMin = searchParams.get("dueMin");
    const dueMax = searchParams.get("dueMax");
    if (dueMin !== null || dueMax !== null) {
      filter.dueAmount = {};
      if (dueMin !== null && dueMin !== "") filter.dueAmount.$gte = Number(dueMin);
      if (dueMax !== null && dueMax !== "") filter.dueAmount.$lte = Number(dueMax);
    }
    const admissionFrom = searchParams.get("admissionFrom");
    const admissionTo = searchParams.get("admissionTo");
    if (admissionFrom || admissionTo) {
      filter.admissionDate = {};
      if (admissionFrom) filter.admissionDate.$gte = admissionFrom;
      if (admissionTo) filter.admissionDate.$lte = admissionTo;
    }
    const qualification = (searchParams.get("qualification") || "").trim();
    if (qualification) filter.$or = [...(filter.$or || []), ...["qualifications.examCourse","qualifications.boardUniversity","qualifications.collegeInstitute","qualifications.year","qualifications.percentage"].map(field => ({[field]: new RegExp(qualification.replace(/[.*+?^{}()|[\\]\\\\]/g, "\\\\    if (sex) filter.sex = sex;
    if (course) filter.courseName = course;"), "i")}))];

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
    const email = String(body.email || "").trim().toLowerCase();
    const aadhaarNumber = String(body.aadhaarNumber || "").replace(/\\D/g, "");
    const mobileNumber = String(body.mobileNumber || "").replace(/\\D/g, "");
    const guardianContactNumber = String(body.guardianContactNumber || "").replace(/\\D/g, "");
    const whatsappNumber = String(body.whatsappNumber || "").replace(/\\D/g, "");
    if (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (aadhaarNumber && !/^\\d{12}$/.test(aadhaarNumber)) return NextResponse.json({ error: "Aadhaar number must contain exactly 12 digits." }, { status: 400 });
    if (mobileNumber && !/^\\d{10}$/.test(mobileNumber)) return NextResponse.json({ error: "Mobile number must contain exactly 10 digits." }, { status: 400 });
    if (guardianContactNumber && !/^\\d{10}$/.test(guardianContactNumber)) return NextResponse.json({ error: "Guardian mobile number must contain exactly 10 digits." }, { status: 400 });
    if (whatsappNumber && !/^\\d{10}$/.test(whatsappNumber)) return NextResponse.json({ error: "WhatsApp number must contain exactly 10 digits." }, { status: 400 });
    if (body.signatureUrl && !String(body.signatureUrl).startsWith("https://res.cloudinary.com/")) return NextResponse.json({ error: "Student signature must be uploaded to Cloudinary." }, { status: 400 });
    await removeLegacyFormNoUniqueIndex();
    const enrollmentSequence = await nextStudentSequence("student-enrollment");
    const enrollmentNo = "RCLD/ISL/" + String(enrollmentSequence).padStart(6, "0");
    let referralFields = { referralId: "", referralName: "", marketingEmployeeId: "", marketingEmployeeName: "" };
    if (body.referralId) {
      if (!mongoose.Types.ObjectId.isValid(String(body.referralId))) return NextResponse.json({ error: "Invalid referral selection." }, { status: 400 });
      const referral = await Referral.findOne({ _id: body.referralId, status: "Active" }).lean();
      if (!referral) return NextResponse.json({ error: "Selected referral is no longer active. Refresh the referral list." }, { status: 400 });
      referralFields = { referralId: String(referral._id), referralName: referral.name, marketingEmployeeId: referral.marketingEmployeeId, marketingEmployeeName: referral.marketingEmployeeName };
    }
    const student = await Student.create({
      ...body,
      status: getStudentAdmissionStatus(body),
      email,
      aadhaarNumber,
      ...referralFields,
      formNo: String(body.formNo || "").trim() || undefined,
      regnNo: String(body.regnNo || "").trim(),
      enrollmentNo,
      aecCode: "RCLD/ISL-001",
      applicantName: String(body.applicantName).trim(),
      mobileNumber,
      guardianContactNumber,
      whatsappNumber
    });
    if (body.courseCode || body.courseName) {
      const conditions = [];
      if (body.courseCode) conditions.push({ code: String(body.courseCode).trim().toUpperCase() });
      if (body.courseName) conditions.push({ name: String(body.courseName).trim() });
      const course = await Course.findOne({ $or: conditions }).lean();
      if (course) {
        const FeeSchema = new mongoose.Schema({ studentId:{type:mongoose.Schema.Types.ObjectId,unique:true,index:true,ref:"Student"}, totalFee:{type:Number,default:0}, discount:{type:Number,default:0}, admissionFee:{type:Number,default:0}, registrationFee:{type:Number,default:0}, admissionDate:String, payments:Array, updatedBy:String }, {timestamps:true});
        const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);
        await StudentFee.findOneAndUpdate({studentId:student._id}, {$set:{totalFee:Number(course.fee||0),admissionFee:Number(course.admissionFee||0),registrationFee:Number(course.registrationFee||0),admissionDate:body.admissionDate||new Date().toISOString().slice(0,10)}}, {upsert:true,new:true,setDefaultsOnInsert:true});
      }
    }
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error?.code === 11000 ? "A generated student number already exists. Please submit again." : "Unable to register student.",
      detail: error.message
    }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
