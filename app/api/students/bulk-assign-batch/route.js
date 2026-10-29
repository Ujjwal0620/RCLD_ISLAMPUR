import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";

const StudentSchema = new mongoose.Schema({
  applicantName:String, courseCode:String, courseName:String, batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null}, batchCode:String, status:String
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);

export async function GET() {
  try {
    await connectMongoDB();
    const batches=await Batch.find({status:{$in:["Draft","Active"]}}).sort({courseCode:1,batchCode:1}).lean();
    const ids=batches.map(b=>b._id);
    const counts=ids.length?await Student.aggregate([{$match:{batchId:{$in:ids}}},{$group:{_id:"$batchId",count:{$sum:1}}}]):[];
    const countMap=new Map(counts.map(x=>[String(x._id),x.count]));
    return NextResponse.json({batches:batches.map(b=>{const assigned=countMap.get(String(b._id))||0;const capacity=Number(b.capacity||50);return {...b,assignedCount:assigned,remaining:Math.max(0,capacity-assigned),available:assigned<capacity};})});
  } catch(error) {
    return NextResponse.json({error:"Unable to load available batches.",detail:error.message},{status:500});
  }
}

export async function POST(req) {
  try {
    await connectMongoDB();
    const body=await req.json();
    const ids=Array.isArray(body.studentIds)?[...new Set(body.studentIds.map(String))]:[];
    const batchId=String(body.batchId||"");
    if(!ids.length||!mongoose.Types.ObjectId.isValid(batchId)) return NextResponse.json({error:"Select students and an available batch."},{status:400});
    if(ids.some(x=>!mongoose.Types.ObjectId.isValid(x))) return NextResponse.json({error:"One or more student IDs are invalid."},{status:400});
    const batch=await Batch.findById(batchId).lean();
    if(!batch||!["Draft","Active"].includes(batch.status)) return NextResponse.json({error:"Selected batch is not available."},{status:409});
    const students=await Student.find({_id:{$in:ids}}).lean();
    if(students.length!==ids.length) return NextResponse.json({error:"One or more selected students were not found."},{status:404});
    const assigned=students.filter(s=>s.batchId);
    if(assigned.length) return NextResponse.json({error:"Some selected students are already assigned to a batch. Only unassigned students can be sent here.",students:assigned.map(s=>({id:s._id,name:s.applicantName,batchCode:s.batchCode}))},{status:409});
    const courseOk=students.every(s=>String(s.courseCode||"").toUpperCase()===String(batch.courseCode||"").toUpperCase()||String(s.courseName||"").trim()===String(batch.courseName||"").trim());
    if(!courseOk) return NextResponse.json({error:"All selected students must belong to the selected batch course."},{status:409});
    const current=await Student.countDocuments({batchId:batch._id});
    const capacity=Number(batch.capacity||50);
    if(current+students.length>capacity) return NextResponse.json({error:`Only ${Math.max(0,capacity-current)} seats are available in ${batch.batchCode}.`},{status:409});
    await Student.updateMany({_id:{$in:ids},$or:[{batchId:null},{batchId:{$exists:false}}]},{$set:{batchId:batch._id,batchCode:batch.batchCode}});
    return NextResponse.json({message:`${ids.length} student(s) sent to ${batch.batchCode}.`,batchId:batch._id,batchCode:batch.batchCode});
  } catch(error) {
    return NextResponse.json({error:"Unable to send students to batch.",detail:error.message},{status:500});
  }
}
