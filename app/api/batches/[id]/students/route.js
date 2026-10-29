import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";

const StudentSchema = new mongoose.Schema({
  formNo:String, applicantName:String, mobileNumber:String, courseCode:String, courseName:String,
  batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null}, batchCode:String, status:String
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);

async function getId(params){return (await params)?.id;}

export async function GET(_req,{params}){
  try{
    await connectMongoDB();
    const id=await getId(params);
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid batch ID."},{status:400});
    const batch=await Batch.findById(id).lean();
    if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
    const [students,available]=await Promise.all([
      Student.find({$or:[{batchId:id},{batchId:new mongoose.Types.ObjectId(id)},{batchCode:String(batch.batchCode||"")}]}).sort({applicantName:1}).lean(),
      Student.find({
        $and:[
          {$or:[{batchId:null},{batchId:{$exists:false}}]},
          {$or:[
            {courseCode:String(batch.courseCode||"").toUpperCase()},
            {courseName:String(batch.courseName||"").trim()}
          ]}
        ],
        status:{$nin:["Cancelled","Dropped Out","Suspended"]}
      }).sort({applicantName:1}).lean()
    ]);
    return NextResponse.json({students,available,capacity:Number(batch.capacity||50),remaining:Math.max(0,Number(batch.capacity||50)-students.length)});
  }catch(error){return NextResponse.json({error:"Unable to load batch students.",detail:error.message},{status:500});}
}

export async function POST(req,{params}){
  try{
    await connectMongoDB();
    const id=await getId(params);
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid batch ID."},{status:400});
    const batch=await Batch.findById(id).lean();
    if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
    const body=await req.json();
    const ids=Array.isArray(body.studentIds)?[...new Set(body.studentIds.map(String))]:[];
    if(!ids.length)return NextResponse.json({error:"Select at least one student."},{status:400});
    if(ids.some(x=>!mongoose.Types.ObjectId.isValid(x)))return NextResponse.json({error:"One or more student IDs are invalid."},{status:400});
    const students=await Student.find({_id:{$in:ids}}).lean();
    if(students.length!==ids.length)return NextResponse.json({error:"One or more selected students were not found."},{status:404});
    const wrongCourse=students.find(s=>String(s.courseCode||"").toUpperCase()!==String(batch.courseCode||"").toUpperCase() && String(s.courseName||"").trim()!==String(batch.courseName||"").trim());
    if(wrongCourse)return NextResponse.json({error:"All selected students must belong to the batch course."},{status:409});
    const alreadyElsewhere=students.filter(s=>s.batchId && String(s.batchId)!==String(id));
    if(alreadyElsewhere.length)return NextResponse.json({error:"Some selected students are already assigned to another batch. Change their batch from the student profile first.",students:alreadyElsewhere.map(s=>({id:s._id,name:s.applicantName,batchCode:s.batchCode}))},{status:409});
    const currentCount=await Student.countDocuments({$or:[{batchId:id},{batchId:new mongoose.Types.ObjectId(id)},{batchCode:String(batch.batchCode||"")}]});
    const newCount=students.filter(s=>String(s.batchId||"")!==String(id)).length;
    if(currentCount+newCount>Number(batch.capacity||50))return NextResponse.json({error:`Batch capacity is ${batch.capacity||50}; only ${Math.max(0,Number(batch.capacity||50)-currentCount)} seats remain.`},{status:409});
    await Student.updateMany({_id:{$in:ids},$or:[{batchId:null},{batchId:{$exists:false}},{batchId:id}]},{$set:{batchId:batch._id,batchCode:batch.batchCode}});
    const assigned=await Student.find({$or:[{batchId:id},{batchId:new mongoose.Types.ObjectId(id)},{batchCode:String(batch.batchCode||"")}]}).sort({applicantName:1}).lean();
    return NextResponse.json({students:assigned,message:`${ids.length} student(s) assigned to ${batch.batchCode}.`});
  }catch(error){return NextResponse.json({error:"Unable to assign students.",detail:error.message},{status:400});}
}

export async function DELETE(req,{params}){
  try{
    await connectMongoDB();
    const id=await getId(params);
    const body=await req.json();
    const studentIds=Array.isArray(body.studentIds)?body.studentIds:[body.studentId];
    const ids=studentIds.filter(Boolean).map(String);
    if(!mongoose.Types.ObjectId.isValid(id)||!ids.length)return NextResponse.json({error:"Batch ID and student ID(s) are required."},{status:400});
    await Student.updateMany({_id:{$in:ids},batchId:id},{$set:{batchId:null,batchCode:""}});
    return NextResponse.json({message:"Selected students removed from this batch."});
  }catch(error){return NextResponse.json({error:"Unable to remove students from batch.",detail:error.message},{status:400});}
}
