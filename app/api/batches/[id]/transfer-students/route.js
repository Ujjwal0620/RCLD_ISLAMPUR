import {NextResponse} from "next/server";
import mongoose from "mongoose";
import {connectMongoDB} from "@/lib/mongodb";
import {getSession} from "@/lib/auth";
import Batch from "@/models/Batch";
import StudentBatchHistory from "@/models/StudentBatchHistory";

const StudentSchema=new mongoose.Schema({
  applicantName:String,courseCode:String,courseName:String,status:String,
  batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null},batchCode:String
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const AttendanceSchema=new mongoose.Schema({studentId:mongoose.Schema.Types.ObjectId,date:String,status:String,batch:String,subject:String},{timestamps:true});
const StudentAttendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);

function snapshot(batch){
  const ids=(batch.facultyIds?.length?batch.facultyIds:[batch.facultyId]).filter(Boolean);
  const names=(batch.facultyNames?.length?batch.facultyNames:[batch.facultyName]).filter(Boolean);
  return {batchId:batch._id,batchCode:String(batch.batchCode||""),name:String(batch.name||""),courseId:batch.courseId||null,courseCode:String(batch.courseCode||""),courseName:String(batch.courseName||""),series:Array.isArray(batch.series)?batch.series:[],faculty:ids.map((id,i)=>({employeeId:String(id),name:String(names[i]||"")})),schedules:Array.isArray(batch.schedules)?batch.schedules:[],status:String(batch.status||"")};
}
async function attendanceSnapshot(studentId,batchCode){
  const rows=await StudentAttendance.find({studentId,batch:String(batchCode||"")}).lean();
  const total=rows.length,present=rows.filter(x=>x.status==="Present").length,absent=rows.filter(x=>x.status==="Absent").length,leave=rows.filter(x=>x.status==="Leave").length;
  return {batchCode:String(batchCode||""),total,present,absent,leave,percentage:total?Number((present/total*100).toFixed(2)):0};
}
export async function POST(req,{params}){
  try{
    const session=await getSession();
    if(!session?.employeeId)return NextResponse.json({error:"Unauthorized"},{status:401});
    if(!["superadmin","office-admin"].includes(session.role))return NextResponse.json({error:"Only Super Admin or Office Admin can transfer students."},{status:403});
    await connectMongoDB();
    const {id:sourceId}=await params;
    const body=await req.json();
    const ids=Array.isArray(body.studentIds)?[...new Set(body.studentIds.map(String))]:[];
    const targetId=String(body.toBatchId||"");
    const remark=String(body.remark||"").trim();
    if(!mongoose.Types.ObjectId.isValid(sourceId)||!mongoose.Types.ObjectId.isValid(targetId))return NextResponse.json({error:"Select a valid destination batch."},{status:400});
    if(!ids.length)return NextResponse.json({error:"Select at least one student."},{status:400});
    if(ids.some(x=>!mongoose.Types.ObjectId.isValid(x)))return NextResponse.json({error:"One or more student IDs are invalid."},{status:400});
    if(remark.length<3)return NextResponse.json({error:"Enter a transfer remark (at least 3 characters)."},{status:400});
    const [source,target,students]=await Promise.all([Batch.findById(sourceId).lean(),Batch.findById(targetId).lean(),Student.find({_id:{$in:ids}}).lean()]);
    if(!source||!target)return NextResponse.json({error:"Source or destination batch was not found."},{status:404});
    if(String(source._id)===String(target._id))return NextResponse.json({error:"Choose a different destination batch."},{status:400});
    if(!["Draft","Active"].includes(target.status))return NextResponse.json({error:"Destination batch is not available."},{status:409});
    const sameCourse=String(source.courseCode||"").toUpperCase()===String(target.courseCode||"").toUpperCase()||String(source.courseName||"").trim()===String(target.courseName||"").trim();
    if(!sameCourse)return NextResponse.json({error:"Destination batch must belong to the same course."},{status:409});
    if(students.length!==ids.length)return NextResponse.json({error:"One or more selected students were not found."},{status:404});
    const invalid=students.filter(s=>String(s.batchId||"")!==String(source._id));
    if(invalid.length)return NextResponse.json({error:"Some selected students are no longer assigned to this source batch. Refresh and try again.",students:invalid.map(s=>({id:String(s._id),name:s.applicantName}))},{status:409});
    const targetCount=await Student.countDocuments({batchId:target._id});
    const capacity=Number(target.capacity||50);
    if(targetCount+students.length>capacity)return NextResponse.json({error:"Destination batch capacity exceeded. "+Math.max(0,capacity-targetCount)+" seat(s) are available."},{status:409});
    const from=snapshot(source),to=snapshot(target),actor=String(session.employeeId),actorRole=String(session.role);
    const history=[];
    for(const student of students){
      const [fromAttendance,toAttendance]=await Promise.all([attendanceSnapshot(student._id,source.batchCode),attendanceSnapshot(student._id,target.batchCode)]);
      history.push({studentId:student._id,action:"SHIFTED",fromBatch:from,toBatch:to,remark,actor,actorRole,attendanceSnapshot:{from:fromAttendance,to:toAttendance}});
    }
    await StudentBatchHistory.insertMany(history);
    const update=await Student.updateMany({_id:{$in:ids},batchId:source._id},{$set:{batchId:target._id,batchCode:target.batchCode,status:"Active"}});
    if(update.modifiedCount!==ids.length)return NextResponse.json({error:"Not all students were transferred. Please refresh both batch registers and review movement history."},{status:409});
    return NextResponse.json({message:`${ids.length} student(s) transferred to ${target.batchCode}. Previous batch, faculty and attendance snapshots were saved.`,transferred:ids.length,targetBatchCode:target.batchCode});
  }catch(error){return NextResponse.json({error:"Unable to transfer selected students.",detail:error.message},{status:500});}
}
