import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";

const StudentSchema = new mongoose.Schema({
  formNo:String, applicantName:String, courseCode:String, courseName:String, sourceCourseLabel:String,
  batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null}, batchCode:String,
  status:String, sex:String, regnNo:String, mobileNumber:String, whatsappNumber:String,
  createdAt:Date
},{strict:false,timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);

const escapeRx=(value)=>String(value||"").replace(/[.*+?^{}()|[\]\\]/g,"\\$&");

function buildFilter(body){
  const filter={};
  const search=String(body.search||"").trim();
  if(search){
    const rx=new RegExp(escapeRx(search),"i");
    filter.$or=[
      {applicantName:rx},{formNo:rx},{mobileNumber:rx},{courseName:rx},
      {courseCode:rx},{regnNo:rx},{fatherOrHusbandName:rx},{aecCode:rx},{whatsappNumber:rx}
    ];
  }
  if(body.sex) filter.sex=String(body.sex);
  if(body.course) filter.courseName=String(body.course);
  if(body.status && body.status!=="all") filter.status=String(body.status);
  else if(!body.status) filter.status={$ne:"Cancelled"};
  if(body.registration==="assigned") filter.regnNo={$exists:true,$nin:["",null]};
  if(body.registration==="unassigned") filter.$and=[...(filter.$and||[]),{$or:[{regnNo:{$exists:false}},{regnNo:""},{regnNo:null}]}];
  if(body.fromDate||body.toDate){
    filter.createdAt={};
    if(body.fromDate) filter.createdAt.$gte=new Date(String(body.fromDate)+"T00:00:00.000Z");
    if(body.toDate) filter.createdAt.$lte=new Date(String(body.toDate)+"T23:59:59.999Z");
  }
  return filter;
}

export async function POST(req){
  try{
    await connectMongoDB();
    const body=await req.json();
    const action=String(body.action||"");
    if(!["delete","status"].includes(action)) return NextResponse.json({error:"Invalid bulk action."},{status:400});
    const ids=Array.isArray(body.studentIds)?[...new Set(body.studentIds.map(String).filter(mongoose.Types.ObjectId.isValid))]:[];
    let filter=ids.length?{_id:{$in:ids}}:buildFilter(body);
    if(body.selectAllMatching===true && !ids.length) filter=buildFilter(body);

    const count=await Student.countDocuments(filter);
    if(!count) return NextResponse.json({error:"No students matched the bulk action."},{status:404});

    if(action==="status"){
      const nextStatus=String(body.status||"").trim();
      const allowed=["Registered","Admission Pending","Active","Course Completed","Alumni","Suspended","Cancelled"];
      if(!allowed.includes(nextStatus)) return NextResponse.json({error:"That status must be handled through the dedicated batch/dropout workflow."},{status:400});
      const result=await Student.updateMany(filter,{$set:{status:nextStatus}});
      return NextResponse.json({message:`${result.modifiedCount} student(s) updated to ${nextStatus}.`,matched:result.matchedCount,updated:result.modifiedCount,status:nextStatus});
    }

    const students=await Student.find(filter).select("_id").lean();
    const studentIds=students.map(s=>s._id);
    const result=await Student.deleteMany({_id:{$in:studentIds}});
    // Keep permanent deletion consistent by removing dependent StudentFee records too.
    const FeeSchema=new mongoose.Schema({studentId:mongoose.Schema.Types.ObjectId},{strict:false});
    const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
    await StudentFee.deleteMany({studentId:{$in:studentIds}});
    return NextResponse.json({message:`${result.deletedCount} student(s) permanently deleted.`,deleted:result.deletedCount});
  }catch(error){
    return NextResponse.json({error:"Unable to complete bulk student action.",detail:error.message},{status:500});
  }
}
