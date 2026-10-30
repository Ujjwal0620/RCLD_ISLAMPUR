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
    const normalizeCourse = (value) => {
      const v = String(value || "").trim().toUpperCase();
      if (!v) return "";
      if (/^SM(?:[-_ ]|$)/.test(v) || v.includes("CODING FOR KIDS")) return "KIDS";
      if (/^DOM(?:[-_ ]|$)/.test(v) || v.includes("DIPLOMA IN OFFICE MANAGEMENT")) return "DOM";
      if (/^DCST(?:[-_ ]|$)/.test(v)) return "DCST";
      if (/^DCA(?:[-_ ]|$)/.test(v)) return "DCA";
      return v.replace(/\s+/g, "");
    };

    const assigned=students.filter(s=>s.batchId||String(s.batchCode||"").trim());
    if(assigned.length) return NextResponse.json({
      error:"Some selected students are already assigned to a batch. Refresh the registry and select only students marked Unassigned.",
      students:assigned.map(s=>({id:s._id,name:s.applicantName,batchCode:s.batchCode}))
    },{status:409});

    const targetCourse=normalizeCourse(batch.courseCode||batch.courseName);
    const mismatched=students.filter(s=>{
      const values=[s.courseCode,s.courseName,s.sourceCourseLabel].map(normalizeCourse).filter(Boolean);
      return values.length>0 && !values.includes(targetCourse);
    });
    if(mismatched.length) return NextResponse.json({
      error:`Selected student course does not match ${batch.courseCode||batch.courseName}.`,
      students:mismatched.map(s=>({id:s._id,name:s.applicantName,course:s.courseCode||s.courseName||s.sourceCourseLabel||"Unknown"}))
    },{status:409});

    const current=await Student.countDocuments({$or:[{batchId:batch._id},{batchCode:batch.batchCode}]});
    const capacity=Number(batch.capacity||50);
    if(current+students.length>capacity) return NextResponse.json({error:`Only ${Math.max(0,capacity-current)} seats are available in ${batch.batchCode}.`},{status:409});

    const updateResult=await Student.updateMany(
      {_id:{$in:ids},$and:[
        {$or:[{batchId:null},{batchId:{$exists:false}}]},
        {$or:[{batchCode:""},{batchCode:null},{batchCode:{$exists:false}}]}
      ]},
      {$set:{batchId:batch._id,batchCode:batch.batchCode}}
    );

    if(updateResult.modifiedCount!==ids.length) {
      const refreshed=await Student.find({_id:{$in:ids}}).select("_id applicantName batchId batchCode").lean();
      const failed=refreshed.filter(s=>String(s.batchId||"")!==String(batch._id)||String(s.batchCode||"")!==String(batch.batchCode));
      if(failed.length) return NextResponse.json({error:"Some students could not be assigned. Please refresh and try again.",students:failed},{status:409});
    }

    return NextResponse.json({message:`${ids.length} student(s) sent to ${batch.batchCode}.`,updated:ids.length,batchId:batch._id,batchCode:batch.batchCode});
  } catch(error) {
    return NextResponse.json({error:"Unable to send students to batch.",detail:error.message},{status:500});
  }
}
