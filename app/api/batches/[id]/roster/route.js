import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";

const StudentSchema=new mongoose.Schema({formNo:String,applicantName:String,mobileNumber:String,courseCode:String,courseName:String,batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch"},batchCode:String,status:String},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const FeeSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},totalFee:Number,discount:Number,admissionFee:Number,payments:Array},{timestamps:true});
const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
const AttendanceSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},date:String,status:String,subject:String,batch:String,markedBy:String},{timestamps:true});
const StudentAttendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);

export async function GET(req,{params}){
  try{
    await connectMongoDB();
    const {id}=await params;
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid batch ID."},{status:400});
    const batch=await Batch.findById(id).lean();if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
    const date=new URL(req.url).searchParams.get("date")||new Date().toISOString().slice(0,10);
    const batchFilter={$or:[{batchId:id},{batchId:new mongoose.Types.ObjectId(id)},{batchCode:String(batch.batchCode||"")} ]};
    const students=await Student.find(batchFilter).sort({applicantName:1}).lean();
    const ids=students.map(s=>s._id);
    const [fees,attendance]=await Promise.all([
      ids.length?StudentFee.find({studentId:{$in:ids}}).lean():[],
      ids.length?StudentAttendance.find({studentId:{$in:ids},date}).lean():[]
    ]);
    const feeMap=new Map(fees.map(f=>[String(f.studentId),f]));
    const attMap=new Map();
    attendance.forEach(a=>attMap.set(String(a.studentId),a));
    const roster=students.map(s=>{
      const f=feeMap.get(String(s._id))||{totalFee:0,discount:0,admissionFee:0,payments:[]};
      const payable=Math.max(0,Number(f.totalFee||0)+Number(f.admissionFee||0)-Number(f.discount||0));
      const paid=(f.payments||[]).reduce((sum,p)=>sum+Number(p.amount||0),0);
      const a=attMap.get(String(s._id));
      return {...s,fee:{totalFee:Number(f.totalFee||0),admissionFee:Number(f.admissionFee||0),discount:Number(f.discount||0),paid,due:Math.max(0,payable-paid)},attendance:a?{status:a.status,subject:a.subject||"",note:a.note||"",markedBy:a.markedBy||""}:null};
    });
    return NextResponse.json({batch,date,students:roster});
  }catch(error){return NextResponse.json({error:"Unable to load batch students.",detail:error.message},{status:500});}
}