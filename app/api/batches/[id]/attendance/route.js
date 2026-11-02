import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import BackOfficeTask from "@/models/BackOfficeTask";
import Batch from "@/models/Batch";

const StudentSchema=new mongoose.Schema({batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch"},batchCode:String},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const AttendanceSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},date:String,status:String,subject:String,batch:String,note:String,markedBy:String},{timestamps:true});
AttendanceSchema.index({studentId:1,date:1,subject:1},{unique:true});
const StudentAttendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);

export async function POST(req,{params}){
  try{
    await connectMongoDB();
    const {id}=await params;const body=await req.json();
    const session=await getSession();if(!session?.employeeId)return NextResponse.json({error:"Unauthorized."},{status:401});
    if(!mongoose.Types.ObjectId.isValid(id)||!body.date||!Array.isArray(body.records))return NextResponse.json({error:"Batch, date and attendance records are required."},{status:400});
    const batch=await Batch.findById(id).lean();if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
    const manager=["superadmin","office-admin"].includes(session.role);
    if(!manager){
      const day=new Date(body.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",timeZone:"Asia/Kolkata"});
      const regular=(batch.schedules||[]).some(s=>s.day===day&&String(s.facultyId||"")===String(session.employeeId));
      const substitute=await BackOfficeTask.exists({batchId:String(batch._id),taskDate:body.date,$or:[{assignedTo:String(session.employeeId)},{ "assignments.employeeId":String(session.employeeId)}]});
      if(!regular&&!substitute)return NextResponse.json({error:"You are not assigned to this batch class for the selected date."},{status:403});
    }
    const students=await Student.find({batchId:id,_id:{$in:body.records.map(x=>x.studentId).filter(x=>mongoose.Types.ObjectId.isValid(String(x)))}}).lean();
    const allowed=new Set(students.map(s=>String(s._id)));
    const records=body.records.filter(x=>allowed.has(String(x.studentId))&&["Present","Absent","Leave"].includes(x.status));
    await Promise.all(records.map(x=>StudentAttendance.findOneAndUpdate(
      {studentId:x.studentId,date:body.date,subject:x.subject||""},
      {$set:{status:x.status,batch:batch.batchCode||"",subject:x.subject||"",note:x.note||"",markedBy:String(session.employeeId)}},
      {upsert:true,new:true,setDefaultsOnInsert:true}
    )));
    return NextResponse.json({message:`${records.length} attendance record(s) saved.`,saved:records.length});
  }catch(error){return NextResponse.json({error:"Unable to save batch attendance.",detail:error.message},{status:500});}
}