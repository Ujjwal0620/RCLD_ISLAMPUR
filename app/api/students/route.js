import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import { linkImportedStudentRecords } from "@/lib/student-import/import-payment-sheet";
import { getStudentAdmissionStatus } from "@/lib/student-admission-status";

const StudentSchema = new mongoose.Schema({
  formNo: { type: String, trim: true },
  aecCode: String, regnNo: String, enrollmentNo: String, admissionDate: String, guardianContactNumber: String, dueAmount: mongoose.Schema.Types.Mixed, paymentStatus: mongoose.Schema.Types.Mixed, sourceCourseLabel: String, importSource: String, sourceStudentName: String, sourceSex: String, sourceQualification: String, sourceAddressRaw: String, sourcePhone: String, sourceRowKey: String, courseName: String, courseCode: String, batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null }, batchCode: String,
  applicantName: { type: String, default: "", trim: true }, nationality: String, dateOfBirth: String, sex: String,
  fatherOrHusbandName: String, address: String, presentAddress: String, permanentAddress: String, sameAsPresentAddress: Boolean, postOffice: String, policeStation: String, nearestLandmark: String, district: String, state: String, permanentPostOffice: String, permanentNearestLandmark: String, permanentPin: String, permanentDistrict: String, permanentState: String, pin: String, whatsappNumber: String,
  mobileNumber: { type: String, default: "", trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  aadhaarNumber: { type: String, default: "", trim: true },
  referralId: { type: String, default: "" }, referralName: { type: String, default: "" }, marketingEmployeeId: { type: String, default: "" }, marketingEmployeeName: { type: String, default: "" },
  qualifications: [{ examCourse: String, boardUniversity: String, collegeInstitute: String, year: String, percentage: String }],
  enclosures: { stampPhoto: Boolean, qualifyingCertificates: Boolean, matricAdmitCard: Boolean },
  declarationDate: String, declarationPlace: String, signatureApplicant: String, signatureUrl: String, photoUrl: String,
  currentSemester: Number, semesterStatus: { type: String, default: "Not Started" }, semesterHistory: { type: [mongoose.Schema.Types.Mixed], default: [] }, status: { type: String, default: "Admission Pending" }
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
    const escapeRegex = value => String(value).replace(/[.*+?^{}()|[\]\\$]/g, "\\$&");

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      const searchFields = [
        "applicantName","formNo","enrollmentNo","regnNo","aecCode","courseName","courseCode","batchCode",
        "mobileNumber","whatsappNumber","guardianContactNumber","email","aadhaarNumber","fatherOrHusbandName",
        "nationality","dateOfBirth","sex","status","address","presentAddress","permanentAddress","postOffice","policeStation",
        "nearestLandmark","district","state","pin","permanentPostOffice","permanentNearestLandmark","permanentPin",
        "permanentDistrict","permanentState","referralName","marketingEmployeeName","paymentStatus","declarationPlace",
        "sourceCourseLabel","importSource","sourceQualification","sourcePhone","signatureApplicant","declarationDate","referralId","marketingEmployeeId",
        "qualifications.examCourse","qualifications.boardUniversity","qualifications.collegeInstitute","qualifications.year","qualifications.percentage","admissionDate"
      ];
      filter.$or = searchFields.map(field => ({ [field]: rx }));
      // Historical registration codes still resolve to the same canonical master profile.
      const codeMatches = await StudentMaster.find({ stCodes: rx })
        .select("_id legacyStudentIds activeEnrollmentId").lean();
      if (codeMatches.length) {
        const activeCodeEnrollments = await StudentEnrollment.find({
          _id: { $in: codeMatches.map(master => master.activeEnrollmentId).filter(Boolean) }
        }).select("_id legacyStudentId").lean();
        const activeCodeMap = new Map(activeCodeEnrollments.map(item => [String(item._id), item]));
        const canonicalCodeIds = codeMatches.map(master =>
          activeCodeMap.get(String(master.activeEnrollmentId))?.legacyStudentId
          || master.legacyStudentIds?.[master.legacyStudentIds.length - 1]
        ).filter(Boolean);
        if (canonicalCodeIds.length) filter.$or.push({ _id: { $in: canonicalCodeIds } });
      }
      const numericSearch = Number(search);
      if (Number.isFinite(numericSearch) && search !== "") filter.$or.push({ dueAmount: numericSearch });
    }

    const textFilters = [
      "formNo","enrollmentNo","regnNo","aecCode","applicantName","fatherOrHusbandName","mobileNumber",
      "whatsappNumber","guardianContactNumber","email","aadhaarNumber","nationality","district","state","pin",
      "postOffice","policeStation","nearestLandmark","permanentDistrict","permanentState","permanentPin",
      "permanentPostOffice","permanentNearestLandmark","courseCode","batchCode","referralName","marketingEmployeeName",
      "paymentStatus","declarationPlace","sourceCourseLabel","importSource","sourceQualification","sourcePhone","address","presentAddress","permanentAddress",
      "signatureApplicant","declarationDate","referralId","marketingEmployeeId"
    ];
    for (const field of textFilters) {
      const value = (searchParams.get(field) || "").trim();
      if (value) filter[field] = new RegExp(escapeRegex(value), "i");
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
    const updatedFrom = searchParams.get("updatedFrom"), updatedTo = searchParams.get("updatedTo");
    if (updatedFrom || updatedTo) {
      filter.updatedAt = {};
      if (updatedFrom) filter.updatedAt.$gte = new Date(updatedFrom + "T00:00:00.000Z");
      if (updatedTo) filter.updatedAt.$lte = new Date(updatedTo + "T23:59:59.999Z");
    }
    const dateOfBirth = (searchParams.get("dateOfBirth") || "").trim();
    if (dateOfBirth) filter.dateOfBirth = dateOfBirth;

    const dueMin = searchParams.get("dueMin"), dueMax = searchParams.get("dueMax");
    if (dueMin !== null || dueMax !== null) {
      filter.dueAmount = {};
      if (dueMin !== null && dueMin !== "") filter.dueAmount.$gte = Number(dueMin);
      if (dueMax !== null && dueMax !== "") filter.dueAmount.$lte = Number(dueMax);
    }
    const admissionFrom = searchParams.get("admissionFrom"), admissionTo = searchParams.get("admissionTo");
    if (admissionFrom || admissionTo) {
      filter.admissionDate = {};
      if (admissionFrom) filter.admissionDate.$gte = admissionFrom;
      if (admissionTo) filter.admissionDate.$lte = admissionTo;
    }

    for (const [key, field] of [["sameAsPresentAddress","sameAsPresentAddress"],["stampPhoto","enclosures.stampPhoto"],["qualifyingCertificates","enclosures.qualifyingCertificates"],["matricAdmitCard","enclosures.matricAdmitCard"]]) {
      const value = searchParams.get(key);
      if (value === "true" || value === "false") filter[field] = value === "true";
    }
    for (const field of ["photoUrl","signatureUrl"]) {
      const key = field === "photoUrl" ? "hasPhoto" : "hasSignature";
      const value = searchParams.get(key);
      if (value === "yes") filter[field] = { $exists: true, $nin: ["", null] };
      if (value === "no") filter.$and = [...(filter.$and || []), { $or: [{ [field]: { $exists: false } }, { [field]: "" }, { [field]: null }] }];
    }

    if (searchParams.get("icardEligible") === "1") {
      // Keep the directory inclusive. The print templates can render optional
      // details as blanks/fallbacks; requiring every admission-form field hid
      // almost all existing students from the I-card directory.
      filter.$and = [
        ...(filter.$and || []),
        { applicantName: { $exists: true, $nin: ["", null] } },
        {
          $or: [
            { enrollmentNo: { $exists: true, $nin: ["", null] } },
            { studentId: { $exists: true, $nin: ["", null] } },
            { admissionNo: { $exists: true, $nin: ["", null] } },
            { regnNo: { $exists: true, $nin: ["", null] } },
            { formNo: { $exists: true, $nin: ["", null] } },
          ],
        },
        // Keep pending/cancelled records visible in the directory; printing is
        // separately disabled for these statuses in the UI and print helper.
      ];
    }

    const qualification = (searchParams.get("qualification") || "").trim();
    if (qualification) {
      const qualificationRx = new RegExp(escapeRegex(qualification), "i");
      filter.$and = [...(filter.$and || []), { $or: ["qualifications.examCourse","qualifications.boardUniversity","qualifications.collegeInstitute","qualifications.year","qualifications.percentage"].map(field => ({ [field]: qualificationRx })) }];
    }

    // Present one directory row per permanent master identity. Historical Student
    // documents remain stored because operational tables still reference their IDs.
    const masterProfiles = await StudentMaster.find({ legacyStudentIds: { $exists: true, $ne: [] } })
      .select("_id legacyStudentIds activeEnrollmentId").lean();
    if (masterProfiles.length) {
      const activeIds = masterProfiles.map(master => master.activeEnrollmentId).filter(Boolean);
      const activeEnrollments = await StudentEnrollment.find({ _id: { $in: activeIds } })
        .select("_id legacyStudentId").lean();
      const activeById = new Map(activeEnrollments.map(enrollment => [String(enrollment._id), enrollment]));
      const hiddenIds = [];
      for (const master of masterProfiles) {
        const linkedIds = (master.legacyStudentIds || []).map(String);
        const activeStudentId = activeById.get(String(master.activeEnrollmentId))?.legacyStudentId;
        const canonicalId = activeStudentId && linkedIds.includes(String(activeStudentId))
          ? String(activeStudentId)
          : linkedIds[linkedIds.length - 1];
        for (const linkedId of linkedIds) if (linkedId !== canonicalId) hiddenIds.push(linkedId);
      }
      if (hiddenIds.length) filter._id = { $nin: hiddenIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const studentQuery = Student.find(filter).sort({ createdAt: -1 });
    if (searchParams.get("globalSearch") === "1") studentQuery.select("applicantName formNo enrollmentNo mobileNumber courseCode courseName status");
    const [students, total, dbCourses, statuses, sexes, batchCodes] = await Promise.all([
      studentQuery.skip((page - 1) * limit).limit(limit).lean(),
      Student.countDocuments(filter),
      Student.distinct("courseName"),
      Student.distinct("status"),
      Student.distinct("sex"),
      Student.distinct("batchCode")
    ]);
    // Attach the canonical profile photo when one exists; otherwise resolve
    // the local ID-card photograph using the student's exact registration number.
    const pageStudentIds = students.map(student => student._id);
    const masterPhotoProfiles = pageStudentIds.length
      ? await StudentMaster.find({ legacyStudentIds: { $in: pageStudentIds } })
          .select("legacyStudentIds photoUrl stCodes").lean()
      : [];
    const masterPhotoByStudentId = new Map();
    for (const profile of masterPhotoProfiles) {
      for (const legacyId of profile.legacyStudentIds || []) {
        masterPhotoByStudentId.set(String(legacyId), profile);
      }
    }
    const enrichedStudents = students.map(student => {
      const profile = masterPhotoByStudentId.get(String(student._id));
      const registrationNo = String(student.regnNo || profile?.stCodes?.[0] || "").trim();
      const photoUrl = student.photoUrl || profile?.photoUrl || (
        registrationNo
          ? `/api/students/photo/${encodeURIComponent(registrationNo)}`
          : ""
      );
      return { ...student, photoUrl };
    });

    const courses = [...new Set([...DEFAULT_COURSES, ...dbCourses.filter(Boolean)])].sort();
    return NextResponse.json({
      students: enrichedStudents,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      filterOptions: { courses, statuses: statuses.filter(Boolean).sort(), sexes: sexes.filter(Boolean).sort(), batchCodes: batchCodes.filter(Boolean).sort() }
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
    const aadhaarNumber = String(body.aadhaarNumber || "").replace(/\D/g, "");
    const mobileNumber = String(body.mobileNumber || "").replace(/\D/g, "");
    const guardianContactNumber = String(body.guardianContactNumber || "").replace(/\D/g, "");
    const whatsappNumber = String(body.whatsappNumber || "").replace(/\D/g, "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) return NextResponse.json({ error: "Aadhaar number must contain exactly 12 digits." }, { status: 400 });
    if (mobileNumber && !/^\d{10}$/.test(mobileNumber)) return NextResponse.json({ error: "Mobile number must contain exactly 10 digits." }, { status: 400 });
    if (guardianContactNumber && !/^\d{10}$/.test(guardianContactNumber)) return NextResponse.json({ error: "Guardian mobile number must contain exactly 10 digits." }, { status: 400 });
    if (whatsappNumber && !/^\d{10}$/.test(whatsappNumber)) return NextResponse.json({ error: "WhatsApp number must contain exactly 10 digits." }, { status: 400 });
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
    const isKidsCourse = String(body.courseCode || "").toUpperCase() === "KIDS" || /coding\s*for\s*kids/i.test(String(body.courseName || ""));
    const initialSemester = Math.min(6, Math.max(1, Number(body.currentSemester) || 1));
    const student = await Student.create({
      ...body,
      currentSemester: isKidsCourse ? initialSemester : undefined,
      semesterStatus: isKidsCourse ? "Active" : "Not Started",
      semesterHistory: isKidsCourse ? [{ semester: initialSemester, status: "Active", admittedAt: body.admissionDate || new Date().toISOString().slice(0,10) }] : [],
      status: getStudentAdmissionStatus(body),
      email,
      aadhaarNumber,
      ...referralFields,
      formNo: String(body.formNo || "").trim() || undefined,
      regnNo: String(body.regnNo || "").trim(),
      enrollmentNo,
      aecCode: "RCLD/ISL-001",
      applicantName: String(body.applicantName || "").trim(),
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
        const FeeSchema = new mongoose.Schema({ studentId:{type:mongoose.Schema.Types.ObjectId,unique:true,index:true,ref:"Student"}, totalFee:{type:Number,default:0}, discount:{type:Number,default:0}, admissionFee:{type:Number,default:0}, registrationFee:{type:Number,default:0}, admissionDate:String, currentSemester:Number, semesterHistory:{type:[mongoose.Schema.Types.Mixed],default:[]}, payments:Array, updatedBy:String }, {timestamps:true});
        const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);
        const semesterPlan = isKidsCourse ? (course.semesterPlans || []).find(plan => Number(plan.semester) === initialSemester) : null;
        if (isKidsCourse && semesterPlan) await Student.collection.updateOne({ _id: student._id }, { $set: { semesterHistory: [{ semester: initialSemester, status: "Active", admittedAt: body.admissionDate || new Date().toISOString().slice(0,10), admissionFee: Number(semesterPlan.admissionFee), monthlyFee: Number(semesterPlan.monthlyFee), tuitionFee: Number(semesterPlan.tuitionFee), totalFee: Number(semesterPlan.totalFee), durationMonths: 6 }] } });
        await StudentFee.findOneAndUpdate({studentId:student._id}, {$set:{totalFee:Number(semesterPlan?.tuitionFee ?? course.fee ?? 0),admissionFee:Number(semesterPlan?.admissionFee ?? course.admissionFee ?? 0),registrationFee:Number(course.registrationFee||0),admissionDate:body.admissionDate||new Date().toISOString().slice(0,10),currentSemester:isKidsCourse?initialSemester:undefined,semesterHistory:isKidsCourse && semesterPlan?[{semester:initialSemester,admissionFee:Number(semesterPlan.admissionFee),monthlyFee:Number(semesterPlan.monthlyFee),tuitionFee:Number(semesterPlan.tuitionFee),totalFee:Number(semesterPlan.totalFee),admittedAt:body.admissionDate||new Date().toISOString().slice(0,10)}]:[]}}, {upsert:true,new:true,setDefaultsOnInsert:true});
      }
    }
    // Ensure newly admitted students also receive one durable master identity/enrollment.
    try {
      await linkImportedStudentRecords([student.toObject()]);
    } catch (identityError) {
      console.error("[student-master-link]", identityError);
    }
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error?.code === 11000 ? "A generated student number already exists. Please submit again." : "Unable to register student.",
      detail: error.message
    }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
