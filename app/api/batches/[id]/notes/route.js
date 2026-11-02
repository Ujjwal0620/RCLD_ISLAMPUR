import {NextResponse} from "next/server";
import mongoose from "mongoose";
import {connectMongoDB} from "@/lib/mongodb";
import {getSession} from "@/lib/auth";
import {cloudinary,cloudinaryConfigured} from "@/lib/cloudinary";
import Batch from "@/models/Batch";
import BatchContentProgress from "@/models/BatchContentProgress";
import BackOfficeTask from "@/models/BackOfficeTask";

export const runtime="nodejs";

export async function POST(req,{params}){
 try{
  await connectMongoDB();
  const id=(await params)?.id;
  if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid batch ID."},{status:400});
  const session=await getSession();
  if(!session?.employeeId)return NextResponse.json({error:"Unauthorized."},{status:401});
  const form=await req.formData();
  const file=form.get("file"),topicId=String(form.get("topicId")||""),workDate=String(form.get("date")||new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}));
  if(!file||typeof file.arrayBuffer!=="function"||!topicId)return NextResponse.json({error:"Choose a notes file and topic."},{status:400});
  if(file.size>15*1024*1024)return NextResponse.json({error:"Notes file must be 15 MB or smaller."},{status:413});
  const extension=String(file.name||"").split(".").pop().toLowerCase();
  if(!["pdf","doc","docx","ppt","pptx","jpg","jpeg","png"].includes(extension))return NextResponse.json({error:"Upload PDF, Word, PowerPoint or image notes only."},{status:415});
  const batch=await Batch.findById(id).lean();
  if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
  const manager=["superadmin","office-admin"].includes(session.role);
  if(!manager){
   const day=new Date(workDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",timeZone:"Asia/Kolkata"});
   const assigned=(batch.schedules||[]).some(s=>s.day===day&&String(s.facultyId||"")===String(session.employeeId));
   const substitute=await BackOfficeTask.exists({batchId:String(batch._id),taskDate:workDate,$or:[{assignedTo:String(session.employeeId)},{ "assignments.employeeId":String(session.employeeId)}]});
   if(!assigned&&!substitute)return NextResponse.json({error:"You are not assigned to this batch class for the selected date."},{status:403});
  }
  if(!cloudinaryConfigured)return NextResponse.json({error:"Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."},{status:503});
  const progress=await BatchContentProgress.findOne({batchId:batch._id});
  if(!progress)return NextResponse.json({error:"Batch course progress is not initialized. Open Course Content first and try again."},{status:404});
  let topic=null;
  for(const module of progress.modules||[])for(const item of module.topics||[])if(String(item.contentTopicId)===topicId)topic=item;
  if(!topic)return NextResponse.json({error:"Topic not found in this batch course."},{status:404});
  const buffer=Buffer.from(await file.arrayBuffer());
  const mime=file.type||"application/octet-stream";
  const dataUri="data:"+mime+";base64,"+buffer.toString("base64");
  const uploaded=await cloudinary.uploader.upload(dataUri,{folder:"rcld/batch-notes",resource_type:"auto",use_filename:true,unique_filename:true});
  if(!Array.isArray(topic.notes))topic.notes=[];
  topic.notes.push({name:file.name||"Class notes",url:uploaded.secure_url,publicId:uploaded.public_id,uploadedAt:new Date(),uploadedBy:session.name||session.employeeId,date:workDate});
  progress.markModified("modules");
  await progress.save();
  return NextResponse.json({progress:progress.toObject(),note:{name:file.name,url:uploaded.secure_url,publicId:uploaded.public_id}},{status:201});
 }catch(error){return NextResponse.json({error:"Unable to upload class notes.",detail:error.message},{status:500});}
}
