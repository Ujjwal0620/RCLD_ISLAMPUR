import {NextResponse} from "next/server";
import mongoose from "mongoose";
import {connectMongoDB} from "@/lib/mongodb";
import {getSession,canManageAttendance} from "@/lib/auth";
import Attendance from "@/models/EmployeeAttendance";

const E=mongoose.models.Employee||mongoose.model("Employee",new mongoose.Schema({name:String,employeeId:String,status:String,offDays:[String]}));
const nowDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
const mins=(a,b)=>a&&b?Math.max(0,Math.round((new Date(b)-new Date(a))/60000)):0;
function calculateTimes(record,at=new Date()){
 const out=(record?.outTimes||[]).map(x=>({start:x.start,end:x.end,minutes:Number(x.minutes||0),reason:x.reason||"",type:x.type||"Personal"}));
 const total=record?.punchIn?(record.punchOut?mins(record.punchIn,record.punchOut):mins(record.punchIn,at)):0;
 const personal=out.reduce((n,x)=>n+(x.end?Number(x.minutes||0):mins(x.start,at)),0);
 return {totalMinutes:total,workMinutes:Math.max(0,total-personal)};
}
function hasOpenOut(record){return (record?.outTimes||[]).some(x=>!x.end);}

export async function GET(req){
 const s=await getSession();if(!s)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{await connectMongoDB();const q=new URL(req.url).searchParams,date=q.get("date")||nowDate(),target=canManageAttendance(s.role)&&q.get("employeeId")?q.get("employeeId"):s.sub;
  const employee=await E.findById(target).select("name employeeId offDays").lean(),record=await Attendance.findOne({employeeId:target,date}).lean();
  return NextResponse.json({date,employee,record:record?{...record,...calculateTimes(record)}:null,session:s});
 }catch(e){return NextResponse.json({error:"Unable to load attendance.",detail:e.message},{status:500});}
}
export async function POST(req){
 const s=await getSession();if(!s)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{await connectMongoDB();const b=await req.json(),action=b.action,target=canManageAttendance(s.role)&&b.employeeId?b.employeeId:s.sub,date=b.date||nowDate();let record=await Attendance.findOne({employeeId:target,date});
  if(action==="punchIn"){
   if(record?.punchIn)return NextResponse.json({error:"Punch in already recorded."},{status:409});
   record=await Attendance.findOneAndUpdate({employeeId:target,date},{$set:{punchIn:new Date(),status:"Present",updatedBy:s.employeeId},$setOnInsert:{employeeId:target,date,createdBy:s.employeeId,outTimes:[],breaks:[]}},{upsert:true,new:true});
  }else if(action==="punchOut"){
   if(!record?.punchIn)return NextResponse.json({error:"Punch in is required first."},{status:400});
   if(record.punchOut)return NextResponse.json({error:"Punch out already recorded."},{status:409});
   if(hasOpenOut(record))return NextResponse.json({error:"Please press Return and close the active out-time before punching out."},{status:409});
   const punchOut=new Date(),times=calculateTimes(record,punchOut);
   record=await Attendance.findByIdAndUpdate(record._id,{$set:{punchOut,totalMinutes:times.totalMinutes,workMinutes:times.workMinutes,updatedBy:s.employeeId}},{new:true});
  }else if(action==="startOut"){
   if(!record?.punchIn||record.punchOut)return NextResponse.json({error:"You must be punched in and not punched out."},{status:400});
   if(hasOpenOut(record))return NextResponse.json({error:"An out-time is already active. Press Return first."},{status:409});
   const reason=String(b.reason||"").trim();if(!reason)return NextResponse.json({error:"Reason is mandatory."},{status:400});
   record=await Attendance.findByIdAndUpdate(record._id,{$push:{outTimes:{start:new Date(),reason,type:b.type==="Official"?"Official":"Personal",minutes:0}},$set:{updatedBy:s.employeeId}},{new:true});
  }else if(action==="endOut"){
   if(!record?.punchIn)return NextResponse.json({error:"Punch in is required."},{status:400});
   const activeIndex=(record.outTimes||[]).findIndex(x=>!x.end);if(activeIndex<0)return NextResponse.json({error:"No active out-time."},{status:400});
   const returnTime=new Date();record.outTimes[activeIndex].end=returnTime;record.outTimes[activeIndex].minutes=mins(record.outTimes[activeIndex].start,returnTime);
   const times=calculateTimes(record,returnTime);record.totalMinutes=times.totalMinutes;record.workMinutes=times.workMinutes;record.updatedBy=s.employeeId;record=await record.save();
  }else if(action==="setStatus"){
   if(!canManageAttendance(s.role))return NextResponse.json({error:"Access denied."},{status:403});
   record=await Attendance.findOneAndUpdate({employeeId:target,date},{$set:{status:b.status,remarks:b.remarks||"",employeeId:target,date,updatedBy:s.employeeId},$setOnInsert:{createdBy:s.employeeId}},{upsert:true,new:true});
  }else return NextResponse.json({error:"Unsupported action."},{status:400});
  const fresh=await Attendance.findById(record._id).lean();return NextResponse.json({record:{...fresh,...calculateTimes(fresh)}});
 }catch(e){return NextResponse.json({error:"Attendance action failed.",detail:e.message},{status:500});}
}