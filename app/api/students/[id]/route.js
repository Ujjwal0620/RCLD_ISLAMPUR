import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Student from "@/models/Student";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";


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
    const enrollments = await StudentEnrollment.find(enrollmentQuery).sort({ admissionDate: -1, createdAt: -1 }).lean();
    const activeEnrollment = masterProfile
      ? (enrollments.find(item => String(item.registrationId || "") === String(masterProfile.currentRegistrationId || ""))
        || enrollments.find(item => String(item._id) === String(masterProfile.activeEnrollmentId))
        || enrollments.find(item => String(item.stCode || "") === String(masterProfile.currentStCode || ""))
        || enrollments.find(item => item.status === "ACTIVE")
        || enrollments[0]
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
    const FeeSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, payments: [mongoose.Schema.Types.Mixed] }, { strict: false });
    const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);
    const enrollmentCourseCodes = [...new Set(enrollments.map(item => String(item.courseCode || "").toUpperCase()).filter(Boolean))];
    const [importedPayments, courseDocuments, legacyData] = await Promise.all([
      enrollmentIds.length || masterProfile
        ? StudentFeePayment.find(paymentQuery).sort({ paymentDate: 1, mrNo: 1 }).lean()
        : Promise.resolve([]),
      enrollmentCourseCodes.length
        ? Course.find({ code: { $in: enrollmentCourseCodes } }).select("code name").lean()
        : Promise.resolve([]),
      Promise.all([
        StudentFee.find({ studentId: { $in: linkedStudentIds } }).lean(),
        Student.find({ _id: { $in: linkedStudentIds } }).select("_id regnNo enrollmentNo courseCode courseName").lean(),
      ]),
    ]);
    const [legacyFees, linkedStudentDocs] = legacyData;
    const enrollmentMap = new Map(enrollments.map(item => [String(item._id), item]));
    const enrollmentByCode = new Map();
    for (const item of enrollments) {
      const code = String(item.stCode || "");
      if (code) enrollmentByCode.set(code, [...(enrollmentByCode.get(code) || []), item]);
    }
    const enrollmentByRegistration = new Map(enrollments.filter(item => item.registrationId).map(item => [String(item.registrationId), item]));
    const registrationByNameCode = new Map(enrollments.filter(item => item.registrationId).map(item => [String(item.registrationId).toUpperCase(), item]));
    const courseNameMap = new Map(courseDocuments.map(course => [String(course.code).toUpperCase(), course.name]));
    const paymentHistory = importedPayments.map(payment => {
      const derivedRegistrationId = String(payment.registrationId || payment.stNameKey || "").toUpperCase();
      const codeCandidates = enrollmentByCode.get(String(payment.stCode || "")) || [];
      const enrollment = enrollmentMap.get(String(payment.enrollmentId))
        || enrollmentByRegistration.get(derivedRegistrationId)
        || registrationByNameCode.get(derivedRegistrationId)
        || (codeCandidates.length === 1 ? codeCandidates[0] : {});
      return {
        ...payment,
        registrationId: payment.registrationId || enrollment.registrationId || derivedRegistrationId,
        courseCode: payment.courseCode || enrollment.courseCode || "",
        courseName: enrollment.courseName || courseNameMap.get(String(payment.courseCode || enrollment.courseCode || "").toUpperCase()) || payment.courseCode || enrollment.courseCode || "Previous Course (Legacy)",
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
    const enrichedEnrollments = enrollments.map(item => ({
      ...item,
      courseName: item.courseName || courseNameMap.get(String(item.courseCode || "").toUpperCase()) || item.courseCode || "Previous Course (Legacy)"
    }));
    const enrichedStudent = {
      ...canonicalStudent,
      applicantName: masterProfile?.fullName || canonicalStudent.applicantName,
      regnNo: masterProfile?.currentStCode || activeEnrollment?.stCode || canonicalStudent.regnNo,
      enrollmentNo: masterProfile?.currentStCode || activeEnrollment?.stCode || canonicalStudent.enrollmentNo,
      courseName: masterProfile?.currentCourse || activeEnrollment?.courseName || canonicalStudent.courseName,
      courseCode: activeEnrollment?.courseCode || canonicalStudent.courseCode,
      dateOfAdmission: masterProfile ? (masterProfile.currentAdmissionDate || null) : (activeEnrollment?.admissionDate || canonicalStudent.dateOfAdmission),
      formNo: masterProfile?.formNo || activeEnrollment?.formNo || canonicalStudent.formNo,
      dateOfBirth: masterProfile?.dob || canonicalStudent.dateOfBirth,
      address: masterProfile?.address || canonicalStudent.address,
      presentAddress: masterProfile?.address || canonicalStudent.presentAddress,
      mobileNumber: masterProfile?.phoneNumbers?.[0] || canonicalStudent.mobileNumber,
      whatsappNumber: masterProfile?.phoneNumbers?.[1] || canonicalStudent.whatsappNumber,
      qualification: masterProfile?.qualification || canonicalStudent.qualification,
      phoneNumbers: masterProfile?.phoneNumbers || [],
      photoUrl: masterProfile?.photoUrl || canonicalStudent.photoUrl || ((canonicalStudent.regnNo || activeEnrollment?.stCode || masterProfile?.stCodes?.[0]) ? `/api/students/photo/${encodeURIComponent(String(canonicalStudent.regnNo || activeEnrollment?.stCode || masterProfile?.stCodes?.[0]).trim())}` : ""),
      masterProfile,
      enrollments: enrichedEnrollments,
      activeEnrollment: enrichedEnrollments.find(item => String(item._id) === String(activeEnrollment?._id)) || activeEnrollment,
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
      "enclosures","declarationDate","declarationPlace","signatureApplicant","signatureUrl","photoUrl","hasPhoto","currentSemester","semesterStatus","semesterHistory","status"
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
    if(update.photoUrl !== undefined) update.hasPhoto = Boolean(String(update.photoUrl || "").trim());
    if(update.applicantName!==undefined)update.applicantName=String(update.applicantName).trim();
    if(update.mobileNumber!==undefined)update.mobileNumber=String(update.mobileNumber).trim();
    const email=String(body.email ?? "").trim().toLowerCase();
    const aadhaarNumber=String(body.aadhaarNumber ?? "").replace(/\D/g, "");
    const mobileNumber=String(body.mobileNumber ?? "").replace(/\D/g,"");
    const guardian=String(body.guardianContactNumber||"").replace(/\D/g,"");
    const whatsapp=String(body.whatsappNumber||"").replace(/\D/g,"");
    if(body.mobileNumber!==undefined)update.mobileNumber=mobileNumber;
    if(body.email!==undefined)update.email=email;
    if(body.aadhaarNumber!==undefined)update.aadhaarNumber=aadhaarNumber;
    if(body.referralId!==undefined){
      if(!body.referralId){update.referralId="";update.referralName="";update.marketingEmployeeId="";update.marketingEmployeeName="";}
      else{if(!mongoose.Types.ObjectId.isValid(String(body.referralId)))return NextResponse.json({error:"Invalid referral selection."},{status:400});const referral=await Referral.findOne({_id:body.referralId,status:"Active"}).lean();if(!referral)return NextResponse.json({error:"Selected referral is no longer active."},{status:400});update.referralId=String(referral._id);update.referralName=referral.name;update.marketingEmployeeId=referral.marketingEmployeeId;update.marketingEmployeeName=referral.marketingEmployeeName;}
    }
    const student=await Student.findByIdAndUpdate(id,update,{new:true,runValidators:false}).lean();
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
        ...(update.photoUrl !== undefined ? { photoUrl: update.photoUrl, hasPhoto: update.hasPhoto } : {}),
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