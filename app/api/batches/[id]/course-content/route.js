import {NextResponse} from "next/server";
import mongoose from "mongoose";
import {connectMongoDB} from "@/lib/mongodb";
import Batch from "@/models/Batch";
import CourseContent from "@/models/CourseContent";
import BatchContentProgress from "@/models/BatchContentProgress";
import {getSession} from "@/lib/auth";
import BackOfficeTask from "@/models/BackOfficeTask";
async function idOf(params){return (await params)?.id}
async function ensure(id){
 const batch=await Batch.findById(id).lean();if(!batch)return null;
 let progress=await BatchContentProgress.findOne({batchId:batch._id}).lean();
 if(!progress){
  const master=await CourseContent.findOne({courseId:batch.courseId,active:true}).lean();
  if(!master)return {batch,progress:null};
  progress=(await BatchContentProgress.create({batchId:batch._id,batchCode:batch.batchCode,courseId:batch.courseId,courseCode:batch.courseCode,courseContentId:master._id,modules:master.modules.map(m=>({contentModuleId:m._id,moduleNo:m.moduleNo,module:m.module,topics:m.topics.map(t=>({contentTopicId:t._id,sNo:t.sNo,topic:t.topic,completed:false,completedDate:"",completedBy:""}))}))})).toObject();
 }
 return {batch,progress};
}
export async function GET(_req,{params}){try{await connectMongoDB();const id=await idOf(params);if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid batch ID."},{status:400});const data=await ensure(id);if(!data)return NextResponse.json({error:"Batch not found."},{status:404});return NextResponse.json(data)}catch(e){return NextResponse.json({error:"Unable to load batch course content.",detail:e.message},{status:500})}}
export async function PATCH(req,{params}){try{await connectMongoDB();const id=await idOf(params);const b=await req.json();const session=await getSession();if(!session?.employeeId)return NextResponse.json({error:"Unauthorized."},{status:401});const data=await ensure(id);if(!data?.progress)return NextResponse.json({error:"No course content is mapped to this batch course."},{status:404});const manager=["superadmin","office-admin"].includes(session.role);const workDate=String(b.date||new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}));if(!manager){const day=new Date(workDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",timeZone:"Asia/Kolkata"});const assigned=(data.batch.schedules||[]).some(s=>s.day===day&&String(s.facultyId||"")===String(session.employeeId));const substitute=await BackOfficeTask.exists({batchId:String(data.batch._id),taskDate:workDate,$or:[{assignedTo:String(session.employeeId)},{ "assignments.employeeId":String(session.employeeId)}]});if(!assigned&&!substitute)return NextResponse.json({error:"You are not assigned to this batch class for the selected date."},{status:403});}const progress=await BatchContentProgress.findOne({batchId:id});let found=false;for(const m of progress.modules){for(const t of m.topics||[]){if(String(t.contentTopicId)===String(b.contentTopicId)){t.completed=Boolean(b.completed);t.completedDate=t.completed?(b.completedDate||new Date().toISOString().slice(0,10)):"";t.completedBy=t.completed?(session.name||session.employeeId):"";found=true}}}if(!found)return NextResponse.json({error:"Topic not found in this batch."},{status:404});progress.markModified("modules");await progress.save();return NextResponse.json({progress:progress.toObject()})}catch(e){return NextResponse.json({error:"Unable to update topic completion.",detail:e.message},{status:400})}}
