import {NextResponse} from "next/server";
import mongoose from "mongoose";
import {connectMongoDB} from "@/lib/mongodb";
import {getSession} from "@/lib/auth";
import StudentBatchHistory from "@/models/StudentBatchHistory";
import Batch from "@/models/Batch";

const StudentSchema=new mongoose.Schema({
  applicantName:String,mobileNumber:String,courseCode:String,courseName:String,batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null},batchCode:String,status:String
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const AttendanceSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},date:String,status:String,batch:String,subject:String},{timestamps:true});
const StudentAttendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);

function facultySnapshot(batch){
  if(!batch)return [];
  const ids=batch.facultyIds?.length?batch.facultyIds:[batch.facultyId].filter(Boolean);
  const names=batch.facultyNames?.length?batch.facultyNames:[batch.facultyName].filter(Boolean);
  return ids.map((employeeId,i)=>({employeeId:String(employeeId||""),name:String(names[i]||"")})).filter(x=>x.employeeId||x.name);
}
function snapshot(batch){
  if(!batch)return null;
  return {
    batchId:batch._id||null,batchCode:batch.batchCode||"",name:batch.name||"",
    courseId:batch.courseId||null,courseCode:batch.courseCode||"",courseName:batch.courseName||"",
    series:batch.series||[],faculty:facultySnapshot(batch),schedules:batch.schedules||[],status:batch.status||""
  };
}
async function guard(){
  const session=await getSession();
  if(!session?.employeeId)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
  if(!["superadmin","office-admin"].includes(session.role))return {error:NextResponse.json({error:"Only Super Admin or Office Admin can change batch movement."},{status:403})};
  return {session};
}

export async function POST(req,{params}){
  const g=await guard();if(g.error)return g.error;
  try{
    await connectMongoDB();const {id}=await params;const body=await req.json();
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const student=await Student.findById(id).lean();if(!student)return NextResponse.json({error:"Student not found."},{status:404});
    const action=String(body.action||"").toUpperCase();
    const remark=String(body.remark||"").trim();
    if(!remark)return NextResponse.json({error:"A remark is required for every dropout or batch shift."},{status:400});
    const fromBatch=student.batchId?await Batch.findById(student.batchId).lean():null;
    if(action==="DROPPED_OUT"){
      if(!fromBatch)return NextResponse.json({error:"Student is not currently assigned to a batch."},{status:409});
      const attendance=await StudentAttendance.find({studentId:id,batch:String(fromBatch.batchCode||"")}).lean();
      const attendanceSnapshot={total:attendance.length,present:attendance.filter(x=>x.status==="Present").length,absent:attendance.filter(x=>x.status==="Absent").length,leave:attendance.filter(x=>x.status==="Leave").length};
      const history=await StudentBatchHistory.create({
        studentId:id,action:"DROPPED_OUT",fromBatch:snapshot(fromBatch),toBatch:null,remark,
        actor:g.session.employeeId,actorRole:g.session.role,attendanceSnapshot
      });
      await Student.findByIdAndUpdate(id,{$set:{batchId:null,batchCode:"",status:"Dropped Out"}});
      return NextResponse.json({history,message:"Student dropped out and movement history saved."});
    }
    if(action==="SHIFTED"){
      const toId=String(body.toBatchId||"");
      if(!mongoose.Types.ObjectId.isValid(toId))return NextResponse.json({error:"Select a valid destination batch."},{status:400});
      if(String(student.batchId||"")===toId)return NextResponse.json({error:"Destination batch must be different from the current batch."},{status:409});
      const toBatch=await Batch.findById(toId).lean();if(!toBatch)return NextResponse.json({error:"Destination batch not found."},{status:404});
      if(!["Draft","Active"].includes(toBatch.status))return NextResponse.json({error:"Student can only be shifted to an active or draft batch."},{status:409});
      const sameCourse=(String(student.courseCode||"").toUpperCase()===String(toBatch.courseCode||"").toUpperCase())||(String(student.courseName||"").trim()===String(toBatch.courseName||"").trim());
      if(!sameCourse)return NextResponse.json({error:"Student course does not match the destination batch."},{status:409});
      const count=await Student.countDocuments({batchId:toId,_id:{$ne:id}});
      if(count>=Number(toBatch.capacity||50))return NextResponse.json({error:"Destination batch is already at capacity."},{status:409});
      const attendance=fromBatch?await StudentAttendance.find({studentId:id,batch:String(fromBatch.batchCode||"")}).lean():[];
      const attendanceSnapshot={total:attendance.length,present:attendance.filter(x=>x.status==="Present").length,absent:attendance.filter(x=>x.status==="Absent").length,leave:attendance.filter(x=>x.status==="Leave").length};
      const history=await StudentBatchHistory.create({
        studentId:id,action:"SHIFTED",fromBatch:snapshot(fromBatch),toBatch:snapshot(toBatch),remark,
        actor:g.session.employeeId,actorRole:g.session.role,attendanceSnapshot
      });
      await Student.findByIdAndUpdate(id,{$set:{batchId:toBatch._id,batchCode:toBatch.batchCode,status:"Active"}});
      return NextResponse.json({history,message:"Student shifted successfully. The previous batch and faculty footprint has been preserved."});
    }
    return NextResponse.json({error:"Unsupported movement action."},{status:400});
  }catch(e){return NextResponse.json({error:"Unable to complete student movement.",detail:e.message},{status:400});}
}
