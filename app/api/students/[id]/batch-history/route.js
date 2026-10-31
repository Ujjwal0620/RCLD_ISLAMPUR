import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";
import StudentBatchHistory from "@/models/StudentBatchHistory";
import {getSession} from "@/lib/auth";

const StudentSchema=new mongoose.Schema({
  applicantName:String,courseCode:String,courseName:String,status:String,
  batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null},batchCode:String
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const AttendanceSchema=new mongoose.Schema({
  studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},date:String,status:String,batch:String,subject:String
},{timestamps:true});
const StudentAttendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);

async function getId(params){return (await params)?.id;}
function clean(value){return String(value||"").trim();}
async function snapshotBatch(batch){
  if(!batch)return null;
  const facultyIds=(batch.facultyIds?.length?batch.facultyIds:[batch.facultyId]).filter(Boolean);
  const facultyNames=(batch.facultyNames?.length?batch.facultyNames:[batch.facultyName]).filter(Boolean);
  return {batchId:batch._id||null,batchCode:clean(batch.batchCode),name:clean(batch.name),courseId:batch.courseId||null,courseCode:clean(batch.courseCode),courseName:clean(batch.courseName),series:Array.isArray(batch.series)?batch.series:[],faculty:facultyIds.map((id,i)=>({employeeId:String(id),name:clean(facultyNames[i]||"")})),schedules:Array.isArray(batch.schedules)?batch.schedules:[],status:clean(batch.status)};
}
async function attendanceSnapshot(studentId,batchCode){
  const records=await StudentAttendance.find({studentId,batch:clean(batchCode)}).lean();
  const total=records.length,present=records.filter(x=>x.status==="Present").length,absent=records.filter(x=>x.status==="Absent").length,leave=records.filter(x=>x.status==="Leave").length;
  return {batchCode:clean(batchCode),total,present,absent,leave,percentage:total?Number(((present/total)*100).toFixed(2)):0};
}
async function guard(){
  const session=await getSession();
  if(!session?.employeeId)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
  if(!["superadmin","office-admin"].includes(session.role))return {error:NextResponse.json({error:"Only Super Admin or Office Admin can change student batch/status."},{status:403})};
  return {session};
}
export async function GET(req,{params}){
  try{
    const session=await getSession();if(!session?.employeeId)return NextResponse.json({error:"Unauthorized"},{status:401});
    await connectMongoDB();const id=await getId(params);
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const history=await StudentBatchHistory.find({studentId:id}).sort({occurredAt:-1}).lean();
    return NextResponse.json({history});
  }catch(error){return NextResponse.json({error:"Unable to load batch history.",detail:error.message},{status:500});}
}
export async function POST(req,{params}){
  const g=await guard();if(g.error)return g.error;
  try{
    await connectMongoDB();const studentId=await getId(params);
    if(!mongoose.Types.ObjectId.isValid(studentId))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const body=await req.json(),action=clean(body.action).toUpperCase(),remark=clean(body.remark);
    if(!["SHIFTED","DROPPED_OUT","REJOINED"].includes(action))return NextResponse.json({error:"Invalid student batch action."},{status:400});
    if(remark.length<3)return NextResponse.json({error:"A remark is required for this action."},{status:400});
    const student=await Student.findById(studentId).lean();if(!student)return NextResponse.json({error:"Student not found."},{status:404});
    const currentBatch=student.batchId?await Batch.findById(student.batchId).lean():null;
    const currentBatchCode=clean(student.batchCode)||clean(currentBatch?.batchCode);
    const fromSnapshot=await snapshotBatch(currentBatch),fromAttendance=await attendanceSnapshot(studentId,currentBatchCode);
    const actor=g.session.employeeId,actorRole=g.session.role;

    if(action==="DROPPED_OUT"){
      if(!currentBatch&&student.status==="Dropped Out")return NextResponse.json({error:"Student is already in Dropout status."},{status:409});
      await StudentBatchHistory.create({studentId,action,fromBatch:fromSnapshot,toBatch:null,remark,actor,actorRole,attendanceSnapshot:{from:fromAttendance}});
      await Student.findByIdAndUpdate(studentId,{$set:{status:"Dropped Out",batchId:null,batchCode:""}});
      return NextResponse.json({message:"Student moved to Dropout section.",status:"Dropped Out"});
    }
    if(action==="SHIFTED"){
      if(!currentBatch)return NextResponse.json({error:"Student is not currently assigned to a batch."},{status:409});
      const targetId=clean(body.toBatchId);
      if(!mongoose.Types.ObjectId.isValid(targetId))return NextResponse.json({error:"Select the target batch."},{status:400});
      if(String(currentBatch._id)===targetId)return NextResponse.json({error:"Student is already in this batch."},{status:409});
      const target=await Batch.findById(targetId).lean();
      if(!target||!["Draft","Active"].includes(target.status))return NextResponse.json({error:"Target batch is not available."},{status:409});
      const sameCourse=clean(student.courseCode).toUpperCase()===clean(target.courseCode).toUpperCase()||clean(student.courseName)===clean(target.courseName);
      if(!sameCourse)return NextResponse.json({error:"Target batch belongs to a different course."},{status:409});
      const capacity=Number(target.capacity||50),count=await Student.countDocuments({batchId:target._id,_id:{$ne:studentId}});
      if(count>=capacity)return NextResponse.json({error:"Target batch is already at capacity."},{status:409});
      const toSnapshot=await snapshotBatch(target),toAttendance=await attendanceSnapshot(studentId,clean(target.batchCode));
      await StudentBatchHistory.create({studentId,action,fromBatch:fromSnapshot,toBatch:toSnapshot,remark,actor,actorRole,attendanceSnapshot:{from:fromAttendance,to:toAttendance}});
      await Student.findByIdAndUpdate(studentId,{$set:{batchId:target._id,batchCode:target.batchCode,status:"Active"}});
      return NextResponse.json({message:"Student shifted successfully. Previous batch, faculty and attendance footprint has been preserved.",status:"Active",batchCode:target.batchCode});
    }
    if(student.status!=="Dropped Out")return NextResponse.json({error:"Only a dropped-out student can be rejoined."},{status:409});
    const lastDrop=await StudentBatchHistory.findOne({studentId,action:"DROPPED_OUT"}).sort({occurredAt:-1}).lean();
    const requestedBatchId=clean(body.toBatchId),restoreId=requestedBatchId||String(lastDrop?.fromBatch?.batchId||"");
    if(!mongoose.Types.ObjectId.isValid(restoreId))return NextResponse.json({error:"The previous batch is no longer available. Select a batch manually."},{status:409});
    const target=await Batch.findById(restoreId).lean();
    if(!target||!["Draft","Active"].includes(target.status))return NextResponse.json({error:"The previous batch is no longer active. Select another available batch."},{status:409});
    const count=await Student.countDocuments({batchId:target._id,_id:{$ne:studentId}});
    if(count>=Number(target.capacity||50))return NextResponse.json({error:"The batch is currently full. Select another batch."},{status:409});
    const toSnapshot=await snapshotBatch(target);
    await StudentBatchHistory.create({studentId,action,fromBatch:null,toBatch:toSnapshot,remark,actor,actorRole,attendanceSnapshot:{from:fromAttendance,to:await attendanceSnapshot(studentId,clean(target.batchCode))}});
    await Student.findByIdAndUpdate(studentId,{$set:{status:"Active",batchId:target._id,batchCode:target.batchCode}});
    return NextResponse.json({message:"Student rejoined the batch with previous academic footprint preserved.",status:"Active",batchCode:target.batchCode});
  }catch(error){return NextResponse.json({error:"Unable to update student batch status.",detail:error.message},{status:500});}
}