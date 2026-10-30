import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";

const StudentSchema = new mongoose.Schema({
  applicantName:String, courseCode:String, courseName:String, sourceCourseLabel:String,
  formNo:String, mobileNumber:String, sex:String, status:String,
  batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null}, batchCode:String
},{strict:false,timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);

const escapeRx=value=>String(value||"").replace(/[.*+?^{}()|[\]\\]/g,"\\$&");

function normalizeCourse(value){
  const v=String(value||"").trim().toUpperCase();
  if(!v)return "";
  if(/^SM(?:[-_ ]|$)/.test(v)||v.includes("CODING FOR KIDS"))return "KIDS";
  if(/^DOM(?:[-_ ]|$)/.test(v)||v.includes("DIPLOMA IN OFFICE MANAGEMENT"))return "DOM";
  if(/^DCST(?:[-_ ]|$)/.test(v))return "DCST";
  if(/^DCA(?:[-_ ]|$)/.test(v))return "DCA";
  return v.replace(/\s+/g,"");
}

export async function GET(){
  try{
    await connectMongoDB();
    const batches=await Batch.find({status:{$in:["Draft","Active"]}}).sort({courseCode:1,batchCode:1}).lean();
    const ids=batches.map(b=>b._id);
    const counts=ids.length?await Student.aggregate([{$match:{$or:[{batchId:{$in:ids}},{batchCode:{$in:batches.map(b=>b.batchCode).filter(Boolean)}}]}},{$group:{_id:"$batchId",count:{$sum:1}}}]):[];
    const countMap=new Map(counts.map(x=>[String(x._id),x.count]));
    return NextResponse.json({batches:batches.map(b=>{
      const assigned=countMap.get(String(b._id))||0;
      const capacity=Number(b.capacity||50);
      return {...b,assignedCount:assigned,remaining:Math.max(0,capacity-assigned),available:assigned<capacity};
    })});
  }catch(error){
    return NextResponse.json({error:"Unable to load available batches.",detail:error.message},{status:500});
  }
}

export async function POST(req){
  try{
    await connectMongoDB();
    const body=await req.json();
    const ids=Array.isArray(body.studentIds)?[...new Set(body.studentIds.map(String))]:[];
    const batchId=String(body.batchId||"");
    if((!ids.length&&body.selectAllMatching!==true)||!mongoose.Types.ObjectId.isValid(batchId))return NextResponse.json({error:"Select students and an available batch."},{status:400});
    if(ids.some(x=>!mongoose.Types.ObjectId.isValid(x)))return NextResponse.json({error:"One or more student IDs are invalid."},{status:400});

    const batch=await Batch.findById(batchId).lean();
    if(!batch||!["Draft","Active"].includes(batch.status))return NextResponse.json({error:"Selected batch is not available."},{status:409});

    let students=[];
    if(body.selectAllMatching===true&&ids.length===0){
      const filter={batchId:null,batchCode:{$in:["",null]}};
      const search=String(body.search||"").trim();
      if(search){
        const rx=new RegExp(escapeRx(search),"i");
        filter.$or=[{applicantName:rx},{courseName:rx},{courseCode:rx},{sourceCourseLabel:rx},{mobileNumber:rx},{formNo:rx}];
      }
      if(body.course)filter.courseName=String(body.course);
      if(body.status&&body.status!=="all")filter.status=String(body.status);
      if(body.sex)filter.sex=String(body.sex);
      if(body.registration==="assigned")return NextResponse.json({error:"The selected registration filter does not contain unassigned students."},{status:409});
      students=await Student.find(filter).lean();
    }else{
      students=await Student.find({_id:{$in:ids}}).lean();
    }

    if(!students.length)return NextResponse.json({error:"No unassigned students match the current selection."},{status:404});
    if(!body.selectAllMatching&&students.length!==ids.length)return NextResponse.json({error:"One or more selected students were not found."},{status:404});

    const assigned=students.filter(s=>s.batchId||String(s.batchCode||"").trim());
    if(assigned.length)return NextResponse.json({error:"Some selected students are already assigned to a batch. Refresh the registry and select only unassigned students.",students:assigned.map(s=>({id:s._id,name:s.applicantName,batchCode:s.batchCode}))},{status:409});

    const targetCourse=normalizeCourse(batch.courseCode||batch.courseName);
    const mismatched=students.filter(s=>{
      const values=[s.courseCode,s.courseName,s.sourceCourseLabel].map(normalizeCourse).filter(Boolean);
      return values.length>0&&!values.includes(targetCourse);
    });
    if(mismatched.length)return NextResponse.json({error:`Selected student course does not match ${batch.courseCode||batch.courseName}.`,students:mismatched.map(s=>({id:s._id,name:s.applicantName,course:s.courseCode||s.courseName||s.sourceCourseLabel||"Unknown"}))},{status:409});

    const current=await Student.countDocuments({$or:[{batchId:batch._id},{batchCode:batch.batchCode}]});
    const capacity=Number(batch.capacity||50);
    if(current+students.length>capacity)return NextResponse.json({error:`Only ${Math.max(0,capacity-current)} seats are available in ${batch.batchCode}.`},{status:409});

    const studentIds=students.map(s=>s._id);
    const updateResult=await Student.updateMany(
      {_id:{$in:studentIds},$and:[
        {$or:[{batchId:null},{batchId:{$exists:false}}]},
        {$or:[{batchCode:""},{batchCode:null},{batchCode:{$exists:false}}]}
      ]},
      {$set:{batchId:batch._id,batchCode:batch.batchCode}}
    );

    if(updateResult.modifiedCount!==students.length){
      const refreshed=await Student.find({_id:{$in:studentIds}}).select("_id applicantName batchId batchCode").lean();
      const failed=refreshed.filter(s=>String(s.batchId||"")!==String(batch._id)||String(s.batchCode||"")!==String(batch.batchCode));
      if(failed.length)return NextResponse.json({error:"Some students could not be assigned. Please refresh and try again.",students:failed},{status:409});
    }

    return NextResponse.json({message:`${students.length} student(s) sent to ${batch.batchCode}.`,updated:students.length,batchId:batch._id,batchCode:batch.batchCode});
  }catch(error){
    return NextResponse.json({error:"Unable to send students to batch.",detail:error.message},{status:500});
  }
}
