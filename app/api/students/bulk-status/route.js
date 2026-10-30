import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";
import StudentBatchHistory from "@/models/StudentBatchHistory";

const StudentSchema=new mongoose.Schema({
  status:String,batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null},batchCode:String
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);

const AttendanceSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},date:String,status:String,subject:String,batch:String,note:String,markedBy:String},{timestamps:true});
const StudentAttendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);

const STATUS_OPTIONS=["Registered","Admission Pending","Active","Course Completed","Dropped Out","Cancelled","Suspended","Alumni"];

async function batchSnapshot(batchId){
  if(!batchId||!mongoose.Types.ObjectId.isValid(String(batchId)))return null;
  const batch=await Batch.findById(batchId).lean();
  if(!batch)return null;
  const facultyIds=Array.isArray(batch.facultyIds)&&batch.facultyIds.length?batch.facultyIds:[batch.facultyId].filter(Boolean);
  const facultyNames=Array.isArray(batch.facultyNames)&&batch.facultyNames.length?batch.facultyNames:[batch.facultyName].filter(Boolean);
  return {
    batchId:batch._id,batchCode:batch.batchCode||"",name:batch.name||"",
    courseId:batch.courseId||null,courseCode:batch.courseCode||"",courseName:batch.courseName||"",
    series:Array.isArray(batch.series)?batch.series:[],
    faculty:facultyIds.map((id,i)=>({employeeId:String(id),name:facultyNames[i]||""})),
    schedules:Array.isArray(batch.schedules)?batch.schedules:[],
    status:batch.status||""
  };
}

export async function POST(req){
  try{
    await connectMongoDB();
    const body=await req.json();
    const ids=Array.isArray(body.studentIds)?[...new Set(body.studentIds.map(String))].filter(id=>mongoose.Types.ObjectId.isValid(id)):[];
    const status=String(body.status||"").trim();
    const remark=String(body.remark||"").trim();
    if(!ids.length)return NextResponse.json({error:"Select at least one student."},{status:400});
    if(!STATUS_OPTIONS.includes(status))return NextResponse.json({error:"Choose a valid student status."},{status:400});
    if(!remark)return NextResponse.json({error:"A remark is required for a bulk status change."},{status:400});

    const students=await Student.find({_id:{$in:ids}}).lean();
    if(!students.length)return NextResponse.json({error:"No selected students were found."},{status:404});

    let changed=0,historyCreated=0;
    for(const student of students){
      if(String(student.status||"Registered")===status)continue;

      if(status==="Dropped Out" && student.batchId){
        const fromBatch=await batchSnapshot(student.batchId);
        const attendance=await StudentAttendance.find({studentId:student._id,batch:student.batchCode||""}).lean();
        const total=attendance.length;
        const present=attendance.filter(a=>a.status==="Present").length;
        const absent=attendance.filter(a=>a.status==="Absent").length;
        const leave=attendance.filter(a=>a.status==="Leave").length;
        await StudentBatchHistory.create({
          studentId:student._id,action:"DROPPED_OUT",fromBatch,toBatch:null,remark,
          actor:body.actor||"superadmin",actorRole:body.actorRole||"superadmin",
          attendanceSnapshot:{total,present,absent,leave,percentage:total?Math.round((present/total)*100):0}
        });
        await Student.updateOne({_id:student._id},{$set:{status,batchId:null,batchCode:""}});
        historyCreated++;
      }else{
        await Student.updateOne({_id:student._id},{$set:{status}});
      }
      changed++;
    }

    return NextResponse.json({message:`${changed} student(s) updated to "${status}".`,updated:changed,historyCreated});
  }catch(error){
    return NextResponse.json({error:"Unable to complete bulk status change.",detail:error.message},{status:500});
  }
}
