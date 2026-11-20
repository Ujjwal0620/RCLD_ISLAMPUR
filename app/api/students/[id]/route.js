import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import { getStudentAdmissionStatus } from "@/lib/student-admission-status";

const StudentSchema = new mongoose.Schema({
  formNo:{type:String,default:"",trim:true},
  aecCode:String,regnNo:String,enrollmentNo:String,admissionDate:String,guardianContactNumber:String,dueAmount:mongoose.Schema.Types.Mixed,paymentStatus:mongoose.Schema.Types.Mixed,sourceCourseLabel:String,importSource:String,sourceStudentName:String,sourceSex:String,sourceQualification:String,sourceAddressRaw:String,sourcePhone:String,sourceRowKey:String,courseName:String,courseCode:String,batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null},batchCode:String,
  applicantName:{type:String,default:"",trim:true},nationality:String,dateOfBirth:String,sex:String,
  fatherOrHusbandName:String,address:String,presentAddress:String,permanentAddress:String,sameAsPresentAddress:Boolean,postOffice:String,policeStation:String,nearestLandmark:String,district:String,state:String,permanentPostOffice:String,permanentNearestLandmark:String,permanentPin:String,permanentDistrict:String,permanentState:String,pin:String,whatsappNumber:String,
  mobileNumber:{type:String,default:"",trim:true},
  email:{type:String,default:"",trim:true,lowercase:true}, aadhaarNumber:{type:String,default:"",trim:true},
  referralId:{type:String,default:""},referralName:{type:String,default:""},marketingEmployeeId:{type:String,default:""},marketingEmployeeName:{type:String,default:""},
  qualifications:[{examCourse:String,boardUniversity:String,collegeInstitute:String,year:String,percentage:String}],
  enclosures:{stampPhoto:Boolean,qualifyingCertificates:Boolean,matricAdmitCard:Boolean},
  declarationDate:String,declarationPlace:String,signatureApplicant:String,signatureUrl:String,photoUrl:String,
  currentSemester:{type:Number,min:1,max:6},semesterStatus:{type:String,enum:["Not Started","Active","Completed"],default:"Not Started"},semesterHistory:{type:[mongoose.Schema.Types.Mixed],default:[]},
  status:{type:String,default:"Admission Pending"}
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const ReferralSchema=new mongoose.Schema({}, {strict:false});
const Referral=mongoose.models.Referral||mongoose.model("Referral",ReferralSchema);
async function idOf(params){return (await params)?.id}

export async function GET(req,{params}){
  try{await connectMongoDB();const id=await idOf(params);
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const student=await Student.findById(id).lean();
    if(!student)return NextResponse.json({error:"Student not found."},{status:404});

    const masterProfile = await StudentMaster.findOne({ legacyStudentIds: student._id }).lean();
    const enrollmentQuery = masterProfile ? { studentId: masterProfile._id } : { legacyStudentId: student._id };
    const enrollments = await StudentEnrollment.find(enrollmentQuery).sort({ admissionDate: 1, createdAt: 1 }).lean();
    const activeEnrollment = masterProfile
      ? (enrollments.find(item => String(item._id) === String(masterProfile.activeEnrollmentId))
        || enrollments.find(item => item.status === "ACTIVE")
        || enrollments[enrollments.length - 1]
        || null)
      : null;
    const canonicalStudentId = activeEnrollment?.legacyStudentId || student._id;
    const canonicalStudent = String(canonicalStudentId) === String(student._id)
      ? student
      : (await Student.findById(canonicalStudentId).lean()) || student;
    const enrollmentIds = enrollments.map(item => item._id);
    const linkedStudentIds = masterProfile?.legacyStudentIds?.length
      ? masterProfile.legacyStudentIds : [student._id];
    const allEnrollmentCodes = [...new Set([
      ...(masterProfile?.stCodes || []),
      ...enrollments.map(item => String(item.stCode || "")),
    ].filter(Boolean))];
    const paymentQuery = masterProfile
      ? { $or: [
          { studentId: masterProfile._id },
          { studentId: { $in: linkedStudentIds } },
          { enrollmentId: { $in: enrollmentIds } },
          { studentId: masterProfile._id, stCode: { $in: allEnrollmentCodes } },
        ] }
      : { $or: [{ studentId: student._id }, { enrollmentId: { $in: enrollmentIds } }] };
    const importedPayments = enrollmentIds.length || masterProfile
      ? await StudentFeePayment.find(paymentQuery).sort({ paymentDate: 1, mrNo: 1 }).lean()
      : [];
    const enrollmentMap = new Map(enrollments.map(item => [String(item._id), item]));
    const enrollmentByCode = new Map(enrollments.map(item => [String(item.stCode || ""), item]));
    const enrollmentCourseCodes = [...new Set(enrollments.map(item => String(item.courseCode || "").toUpperCase()).filter(Boolean))];
    const courseDocuments = enrollmentCourseCodes.length
      ? await Course.find({ code: { $in: enrollmentCourseCodes } }).select("code name").lean()
      : [];
    const courseNameMap = new Map(courseDocuments.map(course => [String(course.code).toUpperCase(), course.name]));
    const paymentHistory = importedPayments.map(payment => {
      const enrollment = enrollmentMap.get(String(payment.enrollmentId))
        || enrollmentByCode.get(String(payment.stCode || "")) || {};
      return {
        ...payment,
        courseCode: enrollment.courseCode || "",
        courseName: enrollment.courseName || courseNameMap.get(String(enrollment.courseCode || "").toUpperCase()) || enrollment.courseCode || "Legacy / Unknown Course",
        semesterLabel: enrollment.semesterLabel || "LEGACY",
        installmentApplied: (payment.allocations || []).map(item => item.label + ": ₹" + Number(item.allocatedAmount || 0).toLocaleString("en-IN")).join(", ") || (payment.importWarnings?.length ? "Needs review: " + payment.importWarnings.join(" ") : "Legacy receipt / not allocated"),
      };
    });
    const receiptKey = payment => {
      const date = payment.paymentDate || payment.date;
      const dateKey = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toISOString().slice(0, 10) : "";
      return [String(payment.mrNo || payment.receiptNo || payment.reference || ""),
        String(payment.stCode || ""), dateKey, Number(payment.amountPaid ?? payment.amount ?? 0).toFixed(2)].join("|");
    };
    const knownReceiptKeys = new Set(paymentHistory.map(receiptKey));
    const FeeSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, payments: [mongoose.Schema.Types.Mixed] }, { strict: false });
    const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);
    const [legacyFees, linkedStudentDocs] = await Promise.all([
      StudentFee.find({ studentId: { $in: linkedStudentIds } }).lean(),
      Student.find({ _id: { $in: linkedStudentIds } }).select("_id regnNo enrollmentNo courseCode courseName").lean(),
    ]);
    const linkedStudentMap = new Map(linkedStudentDocs.map(item => [String(item._id), item]));
    for (const legacyFee of legacyFees) {
      const linkedStudent = linkedStudentMap.get(String(legacyFee.studentId)) || student;
      for (const payment of legacyFee.payments || []) {
        const legacyReceipt = {
          _id: payment._id, paymentDate: payment.date || null, mrNo: payment.receiptNo || payment.reference || "—",
          stCode: linkedStudent.regnNo || linkedStudent.enrollmentNo || "—", amountPaid: Number(payment.amount || 0),
          courseCode: linkedStudent.courseCode || "", courseName: linkedStudent.courseName || linkedStudent.courseCode || "—",
          semesterLabel: payment.semester ? "SEM-" + payment.semester : "Current",
          installmentApplied: (payment.items || []).map(item => (item.purpose || item.type || "Fee") + ": ₹" + Number(item.amount || 0).toLocaleString("en-IN")).join(", ") || payment.paymentType || "Course fee",
          sourceSheet: "ERP Fee Ledger",
        };
        const key = receiptKey(legacyReceipt);
        if (knownReceiptKeys.has(key)) continue;
        knownReceiptKeys.add(key);
        paymentHistory.push(legacyReceipt);
      }
    }
    const receiptTime = payment => {
      const value = payment.paymentDate || payment.date;
      if (!value) return Number.MAX_SAFE_INTEGER;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
    };
    paymentHistory.sort((a, b) => receiptTime(a) - receiptTime(b)
      || String(a.mrNo || "").localeCompare(String(b.mrNo || "")));
    const enrichedStudent = {
      ...canonicalStudent,
      photoUrl: masterProfile?.photoUrl || canonicalStudent.photoUrl || "",
      masterProfile,
      enrollments,
      activeEnrollment,
      paymentHistory,
    };
    return NextResponse.json({ student: enrichedStudent, masterProfile, enrollments, paymentHistory });
  }catch(error){return NextResponse.json({error:"Unable to load student.",detail:error.message},{status:500});}
}

export async function PATCH(req,{params}){
  try{
    await connectMongoDB();
    const id=await idOf(params);
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const body=await req.json();
    const current=await Student.findById(id).lean();
    if(!current)return NextResponse.json({error:"Student not found."},{status:404});
    if(body.batchId!==undefined && String(body.batchId||"")!==String(current.batchId||"")) return NextResponse.json({error:"Use the Batch Movement workflow to shift, drop out, or rejoin a student so the complete footprint is preserved."},{status:409});
    if(body.status!==undefined && String(body.status||"")!==String(current.status||"")) return NextResponse.json({error:"Use the Batch Movement workflow for status changes so every movement receives a remark and audit footprint."},{status:409});
    const allowed=[
      "formNo","aecCode","regnNo","enrollmentNo","admissionDate","guardianContactNumber","dueAmount","paymentStatus","sourceCourseLabel","importSource","sourceStudentName","sourceSex","sourceQualification","sourceAddressRaw","sourcePhone","sourceRowKey","courseName","courseCode","applicantName","nationality","dateOfBirth","sex","fatherOrHusbandName",
      "address","presentAddress","permanentAddress","sameAsPresentAddress","postOffice","policeStation","nearestLandmark","district","state","permanentPostOffice","permanentNearestLandmark","permanentPin","permanentDistrict","permanentState","pin","whatsappNumber","guardianContactNumber","mobileNumber","email","aadhaarNumber","referralId","referralName","marketingEmployeeId","marketingEmployeeName","qualifications","batchId","batchCode",
      "enclosures","declarationDate","declarationPlace","signatureApplicant","signatureUrl","photoUrl","currentSemester","semesterStatus","semesterHistory","status"
    ];
    const update={};
    for(const k of allowed)if(body[k]!==undefined)update[k]=body[k];
    if(update.batchId!==undefined){
      if(update.batchId===null || String(update.batchId).trim()===""){ update.batchId=null; update.batchCode=""; }
      else {
        if(!mongoose.Types.ObjectId.isValid(update.batchId))return NextResponse.json({error:"Invalid batch ID."},{status:400});
        const targetBatch=await Batch.findById(update.batchId).lean();
        if(!targetBatch)return NextResponse.json({error:"Selected batch not found."},{status:404});
        const currentStudent=await Student.findById(id).select("courseCode courseName batchId").lean();
        const sameCourse=(String(currentStudent?.courseCode||"").toUpperCase()===String(targetBatch.courseCode||"").toUpperCase())||(String(currentStudent?.courseName||"").trim()===String(targetBatch.courseName||"").trim());
        if(!sameCourse)return NextResponse.json({error:"Student course does not match the selected batch course."},{status:409});
        const count=await Student.countDocuments({batchId:update.batchId,_id:{$ne:id}});
        if(count>=Number(targetBatch.capacity||50))return NextResponse.json({error:"Selected batch is already at capacity."},{status:409});
        update.batchId=targetBatch._id; update.batchCode=targetBatch.batchCode;
      }
    }
    if(update.formNo!==undefined) delete update.formNo;
    if(update.enrollmentNo!==undefined) delete update.enrollmentNo;
    update.aecCode = "RCLD/ISL-001";
    if(update.applicantName!==undefined)update.applicantName=String(update.applicantName).trim();
    if(update.mobileNumber!==undefined)update.mobileNumber=String(update.mobileNumber).trim();
    const email=String(body.email ?? "").trim().toLowerCase();
    const aadhaarNumber=String(body.aadhaarNumber ?? "").replace(/\D/g, "");
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid email address."},{status:400});
    if(aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber))return NextResponse.json({error:"Aadhaar number must contain exactly 12 digits."},{status:400});
    const mobileNumber=String(body.mobileNumber ?? "").replace(/\D/g,"");
    const guardian=String(body.guardianContactNumber||"").replace(/\D/g,"");
    const whatsapp=String(body.whatsappNumber||"").replace(/\D/g,"");
    if(body.mobileNumber!==undefined && mobileNumber && !/^\d{10}$/.test(mobileNumber))return NextResponse.json({error:"Mobile number must contain exactly 10 digits."},{status:400});
    if(body.guardianContactNumber!==undefined && guardian && !/^\d{10}$/.test(guardian))return NextResponse.json({error:"Guardian mobile number must contain exactly 10 digits."},{status:400});
    if(body.whatsappNumber!==undefined && whatsapp && !/^\d{10}$/.test(whatsapp))return NextResponse.json({error:"WhatsApp number must contain exactly 10 digits."},{status:400});
    if(body.mobileNumber!==undefined)update.mobileNumber=mobileNumber;
    if(body.photoUrl && !String(body.photoUrl).startsWith("https://res.cloudinary.com/"))return NextResponse.json({error:"Student photo must be uploaded to Cloudinary."},{status:400});
    if(body.signatureUrl && !String(body.signatureUrl).startsWith("https://res.cloudinary.com/"))return NextResponse.json({error:"Student signature must be uploaded to Cloudinary."},{status:400});
    if(body.email!==undefined)update.email=email;
    if(body.aadhaarNumber!==undefined)update.aadhaarNumber=aadhaarNumber;
    if(body.referralId!==undefined){
      if(!body.referralId){update.referralId="";update.referralName="";update.marketingEmployeeId="";update.marketingEmployeeName="";}
      else{if(!mongoose.Types.ObjectId.isValid(String(body.referralId)))return NextResponse.json({error:"Invalid referral selection."},{status:400});const referral=await Referral.findOne({_id:body.referralId,status:"Active"}).lean();if(!referral)return NextResponse.json({error:"Selected referral is no longer active."},{status:400});update.referralId=String(referral._id);update.referralName=referral.name;update.marketingEmployeeId=referral.marketingEmployeeId;update.marketingEmployeeName=referral.marketingEmployeeName;}
    }
    const mergedStudent={...current,...update};
    const admissionFieldsChanged = ["courseCode", "courseName", "paymentStatus", "dueAmount", "admissionDate"].some((field) => body[field] !== undefined);
    if (admissionFieldsChanged && ["Admission Pending", "Registered", "Active", ""].includes(String(current.status || ""))) {
      update.status = getStudentAdmissionStatus(mergedStudent);
    }
    const student=await Student.findByIdAndUpdate(id,update,{new:true,runValidators:true}).lean();
    if (student) {
      const masterFields = {
        fullName: student.applicantName || student.sourceStudentName || "Student",
        normalizedFullName: String(student.applicantName || student.sourceStudentName || "Student")
          .normalize("NFKC").replace(/_\d+\s*$/, "").toUpperCase().replace(/\s+/g, " ").replace(/[',.]+$/, "").trim(),
        dob: student.dateOfBirth && !Number.isNaN(new Date(student.dateOfBirth).getTime()) ? new Date(student.dateOfBirth) : undefined,
        fatherName: student.fatherOrHusbandName || "",
        normalizedFatherName: String(student.fatherOrHusbandName || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim(),
        address: student.presentAddress || student.address || student.permanentAddress || "",
        phoneNumbers: [...new Set([student.mobileNumber, student.guardianContactNumber, student.whatsappNumber]
          .map(value => String(value || "").replace(/\D/g, "").slice(-10))
          .filter(value => value.length === 10))],
        qualification: student.sourceQualification || "",
        ...(update.photoUrl !== undefined ? { photoUrl: update.photoUrl } : {}),
      };
      const stCode = String(student.regnNo || student.enrollmentNo || "").replace(/\.0$/, "").trim();
      const master = await StudentMaster.findOne({ legacyStudentIds: student._id });
      if (master) {
        const nonEmptyMasterFields = Object.fromEntries(Object.entries(masterFields).filter(([key, value]) =>
          key !== "phoneNumbers" && value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0)
        ));
        Object.assign(master, nonEmptyMasterFields);
        if (masterFields.phoneNumbers.length) {
          master.phoneNumbers = [...new Set([...(master.phoneNumbers || []), ...masterFields.phoneNumbers])];
        }
        if (stCode && !master.stCodes.includes(stCode)) master.stCodes.push(stCode);
        await master.save();
      } else {
        await StudentMaster.create({
          ...masterFields,
          legacyStudentIds: [student._id],
          stCodes: stCode ? [stCode] : [],
          identityMatchMethod: "PROFILE_PATCH",
        });
      }
    }
    if(student && (update.courseCode!==undefined || update.courseName!==undefined)){
      const conditions=[];
      if(student.courseCode) conditions.push({code:String(student.courseCode).trim().toUpperCase()});
      if(student.courseName) conditions.push({name:String(student.courseName).trim()});
      if(conditions.length){
        const course=await Course.findOne({$or:conditions}).lean();
        if(course){
          const FeeSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,unique:true,index:true,ref:"Student"},totalFee:{type:Number,default:0},discount:{type:Number,default:0},admissionFee:{type:Number,default:0},registrationFee:{type:Number,default:0},admissionDate:String,payments:Array,updatedBy:String},{timestamps:true});
          const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
          await StudentFee.findOneAndUpdate({studentId:student._id},{$set:{totalFee:Number(course.fee||0),admissionFee:Number(course.admissionFee||0),registrationFee:Number(course.registrationFee||0),admissionDate:student.admissionDate||new Date().toISOString().slice(0,10)}},{upsert:true,new:true,setDefaultsOnInsert:true});
        }
      }
    }
    if(!student)return NextResponse.json({error:"Student not found."},{status:404});
    return NextResponse.json({student,message:"Student updated."});
  }catch(error){
    return NextResponse.json({
      error:error?.code===11000?"Form number already exists.":"Unable to update student.",
      detail:error.message
    },{status:error?.code===11000?409:400});
  }
}

export async function DELETE(req,{params}){
  try{
    await connectMongoDB();const id=await idOf(params);
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const student=await Student.findByIdAndDelete(id).lean();
    if(!student)return NextResponse.json({error:"Student not found."},{status:404});
    return NextResponse.json({student,message:"Student permanently deleted from the database."});
  }catch(error){return NextResponse.json({error:"Unable to delete student.",detail:error.message},{status:400});}
}