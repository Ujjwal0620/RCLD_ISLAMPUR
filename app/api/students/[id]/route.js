import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";

const StudentSchema = new mongoose.Schema({
  formNo:{type:String,required:true,unique:true,trim:true},
  aecCode:String,regnNo:String,enrollmentNo:String,admissionDate:String,guardianContactNumber:String,dueAmount:mongoose.Schema.Types.Mixed,paymentStatus:mongoose.Schema.Types.Mixed,sourceCourseLabel:String,importSource:String,courseName:String,courseCode:String,
  applicantName:{type:String,required:true,trim:true},nationality:String,dateOfBirth:String,sex:String,
  fatherOrHusbandName:String,address:String,pin:String,whatsappNumber:String,
  mobileNumber:{type:String,required:true,trim:true},
  qualifications:[{examCourse:String,boardUniversity:String,collegeInstitute:String,year:String,percentage:String}],
  enclosures:{stampPhoto:Boolean,qualifyingCertificates:Boolean,matricAdmitCard:Boolean},
  declarationDate:String,declarationPlace:String,signatureApplicant:String,photoUrl:String,
  status:{type:String,default:"Registered"}
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
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
    const allowed=[
      "formNo","aecCode","regnNo","enrollmentNo","admissionDate","guardianContactNumber","dueAmount","paymentStatus","sourceCourseLabel","importSource","courseName","courseCode","applicantName","nationality","dateOfBirth","sex","fatherOrHusbandName",
      "address","pin","whatsappNumber","mobileNumber","qualifications",
      "enclosures","declarationDate","declarationPlace","signatureApplicant","photoUrl","status"
    ];
    const update={};
    for(const k of allowed)if(body[k]!==undefined)update[k]=body[k];
    if(update.formNo!==undefined)update.formNo=String(update.formNo).trim();
    if(update.applicantName!==undefined)update.applicantName=String(update.applicantName).trim();
    if(update.mobileNumber!==undefined)update.mobileNumber=String(update.mobileNumber).trim();
    if(!String(update.applicantName ?? "existing").trim() || !String(update.mobileNumber ?? "existing").trim()){
      return NextResponse.json({error:"Applicant name and mobile are required."},{status:400});
    }
    const student=await Student.findByIdAndUpdate(id,update,{new:true,runValidators:true}).lean();
    if(student && (update.courseCode!==undefined || update.courseName!==undefined)){
      const conditions=[];
      if(student.courseCode) conditions.push({code:String(student.courseCode).trim().toUpperCase()});
      if(student.courseName) conditions.push({name:String(student.courseName).trim()});
      if(conditions.length){
        const course=await Course.findOne({$or:conditions}).lean();
        if(course){
          const FeeSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,unique:true,index:true,ref:"Student"},totalFee:{type:Number,default:0},discount:{type:Number,default:0},admissionFee:{type:Number,default:0},payments:Array,updatedBy:String},{timestamps:true});
          const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
          await StudentFee.findOneAndUpdate({studentId:student._id},{$set:{totalFee:Number(course.fee||0),admissionFee:Number(course.admissionFee||0)}},{upsert:true,new:true,setDefaultsOnInsert:true});
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