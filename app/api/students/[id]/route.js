import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";
import Batch from "@/models/Batch";

const StudentSchema = new mongoose.Schema({
  formNo:{type:String,required:true,unique:true,trim:true},
  aecCode:String,regnNo:String,enrollmentNo:String,admissionDate:String,guardianContactNumber:String,dueAmount:mongoose.Schema.Types.Mixed,paymentStatus:mongoose.Schema.Types.Mixed,sourceCourseLabel:String,importSource:String,courseName:String,courseCode:String,batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null},batchCode:String,
  applicantName:{type:String,default:"",trim:true},nationality:String,dateOfBirth:String,sex:String,
  fatherOrHusbandName:String,address:String,presentAddress:String,permanentAddress:String,sameAsPresentAddress:Boolean,postOffice:String,policeStation:String,nearestLandmark:String,district:String,state:String,permanentPostOffice:String,permanentNearestLandmark:String,permanentPin:String,permanentDistrict:String,permanentState:String,pin:String,whatsappNumber:String,
  mobileNumber:{type:String,default:"",trim:true},
  email:{type:String,default:"",trim:true,lowercase:true}, aadhaarNumber:{type:String,default:"",trim:true},
  referralId:{type:String,default:""},referralName:{type:String,default:""},marketingEmployeeId:{type:String,default:""},marketingEmployeeName:{type:String,default:""},
  qualifications:[{examCourse:String,boardUniversity:String,collegeInstitute:String,year:String,percentage:String}],
  enclosures:{stampPhoto:Boolean,qualifyingCertificates:Boolean,matricAdmitCard:Boolean},
  declarationDate:String,declarationPlace:String,signatureApplicant:String,signatureUrl:String,photoUrl:String,
  status:{type:String,default:"Registered"}
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
function hasStudentDetailsForAdmission(s = {}) { const present=s.presentAddress||s.address; const permanent=s.sameAsPresentAddress?Boolean(String(present||"").trim()):["permanentAddress","permanentPostOffice","permanentState","permanentDistrict","permanentPin","permanentNearestLandmark"].every(k=>String(s[k]||"").trim()); const q=Array.isArray(s.qualifications)?s.qualifications[0]:null; return [s.applicantName,s.fatherOrHusbandName,s.dateOfBirth,s.sex,s.nationality,present,s.postOffice,s.policeStation,s.state,s.district,s.pin,s.nearestLandmark,s.mobileNumber,s.guardianContactNumber,s.whatsappNumber,s.email,s.aadhaarNumber,q?.examCourse,q?.collegeInstitute,q?.boardUniversity,q?.year,q?.percentage].every(v=>String(v||"").trim())&&permanent; }
const ReferralSchema=new mongoose.Schema({}, {strict:false});
const Referral=mongoose.models.Referral||mongoose.model("Referral",ReferralSchema);
async function idOf(params){return (await params)?.id}

export async function GET(req,{params}){
  try{await connectMongoDB();const id=await idOf(params);
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const student=await Student.findById(id).lean();
    if(!student)return NextResponse.json({error:"Student not found."},{status:404});
    return NextResponse.json({student});
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
      "formNo","aecCode","regnNo","enrollmentNo","admissionDate","guardianContactNumber","dueAmount","paymentStatus","sourceCourseLabel","importSource","courseName","courseCode","applicantName","nationality","dateOfBirth","sex","fatherOrHusbandName",
      "address","presentAddress","permanentAddress","sameAsPresentAddress","postOffice","policeStation","nearestLandmark","district","state","permanentPostOffice","permanentNearestLandmark","permanentPin","permanentDistrict","permanentState","pin","whatsappNumber","guardianContactNumber","mobileNumber","email","aadhaarNumber","referralId","referralName","marketingEmployeeId","marketingEmployeeName","qualifications","batchId","batchCode",
      "enclosures","declarationDate","declarationPlace","signatureApplicant","signatureUrl","photoUrl","status"
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
    const aadhaarNumber=String(body.aadhaarNumber ?? "").replace(/\\D/g, "");
    if(email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid email address."},{status:400});
    if(aadhaarNumber && !/^\\d{12}$/.test(aadhaarNumber))return NextResponse.json({error:"Aadhaar number must contain exactly 12 digits."},{status:400});
    const mobileNumber=String(body.mobileNumber ?? "").replace(/\\D/g,"");
    const guardian=String(body.guardianContactNumber||"").replace(/\\D/g,"");
    const whatsapp=String(body.whatsappNumber||"").replace(/\\D/g,"");
    if(body.mobileNumber!==undefined && mobileNumber && !/^\\d{10}$/.test(mobileNumber))return NextResponse.json({error:"Mobile number must contain exactly 10 digits."},{status:400});
    if(body.guardianContactNumber!==undefined && guardian && !/^\\d{10}$/.test(guardian))return NextResponse.json({error:"Guardian mobile number must contain exactly 10 digits."},{status:400});
    if(body.whatsappNumber!==undefined && whatsapp && !/^\\d{10}$/.test(whatsapp))return NextResponse.json({error:"WhatsApp number must contain exactly 10 digits."},{status:400});
    if(body.mobileNumber!==undefined)update.mobileNumber=mobileNumber;
    if(body.signatureUrl && !String(body.signatureUrl).startsWith("https://res.cloudinary.com/"))return NextResponse.json({error:"Student signature must be uploaded to Cloudinary."},{status:400});
    update.email=email;update.aadhaarNumber=aadhaarNumber;
    if(body.referralId!==undefined){
      if(!body.referralId){update.referralId="";update.referralName="";update.marketingEmployeeId="";update.marketingEmployeeName="";}
      else{if(!mongoose.Types.ObjectId.isValid(String(body.referralId)))return NextResponse.json({error:"Invalid referral selection."},{status:400});const referral=await Referral.findOne({_id:body.referralId,status:"Active"}).lean();if(!referral)return NextResponse.json({error:"Selected referral is no longer active."},{status:400});update.referralId=String(referral._id);update.referralName=referral.name;update.marketingEmployeeId=referral.marketingEmployeeId;update.marketingEmployeeName=referral.marketingEmployeeName;}
    }
    const mergedStudent={...current,...update};
    if(!hasStudentDetailsForAdmission(mergedStudent))update.status="Admission Pending";
    else if(current.status==="Admission Pending")update.status="Registered";
    const student=await Student.findByIdAndUpdate(id,update,{new:true,runValidators:true}).lean();
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