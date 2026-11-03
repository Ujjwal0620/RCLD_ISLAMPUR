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
 const outMinutes=out.reduce((n,x)=>n+(x.end?Number(x.minutes||0):mins(x.start,at)),0);
 const breakMinutes=(record?.breaks||[]).reduce((n,x)=>n+(x.end?Number(x.minutes||0):mins(x.start,at)),0);
 return {totalMinutes:total,outMinutes,breakMinutes,workMinutes:Math.max(0,total-outMinutes-breakMinutes)};
}
function hasOpenOut(record){return (record?.outTimes||[]).some(x=>!x.end);}
function hasOpenBreak(record){return (record?.breaks||[]).some(x=>!x.end);}

export async function GET(req){
 const s=await getSession();if(!s)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{await connectMongoDB();const q=new URL(req.url).searchParams,date=q.get("date")||nowDate();
  if(canManageAttendance(s.role)&&!q.get("employeeId")){
   const employees=await E.find({status:{$ne:"Inactive"}}).select("name employeeId offDays status designation department").sort({name:1}).lean();
   const records=await Attendance.find({date,employeeId:{$in:employees.map(e=>e._id)}}).lean();
   const byEmployee=new Map(records.map(r=>[String(r.employeeId),r]));
   const teamAttendance=employees.map(employee=>{const record=byEmployee.get(String(employee._id))||null;return {employee,record:record?{...record,...calculateTimes(record)}:null,marked:!!record,status:record?.status||"Not Marked"};});
   return NextResponse.json({date,teamAttendance,summary:{total:employees.length,marked:records.length,notMarked:employees.length-records.length,present:records.filter(r=>r.status==="Present"||r.status==="Half Day").length,absent:records.filter(r=>r.status==="Absent").length,leave:records.filter(r=>r.status==="Leave").length},session:s});
  }
  const target=canManageAttendance(s.role)&&q.get("employeeId")?q.get("employeeId"):s.sub;
  if(q.get("history")==="1"){
   const month=String(q.get("month")||nowDate().slice(0,7));
   if(!/^\\d{4}-\\d{2}$/.test(month))return NextResponse.json({error:"Month must use YYYY-MM format."},{status:400});
   const history=await Attendance.find({employeeId:s.sub,date:new RegExp("^"+month)}).sort({date:-1}).lean();
   return NextResponse.json({month,history:history.map(record=>({...record,...calculateTimes(record)}))});
  }
  const employee=await E.findById(target).select("name employeeId offDays").lean(),record=await Attendance.findOne({employeeId:target,date}).lean();
  return NextResponse.json({date,employee,record:record?{...record,...calculateTimes(record)}:null,session:s});
 }catch(e){return NextResponse.json({error:"Unable to load attendance.",detail:e.message},{status:500});}
}
export async function POST(req){
 const s=await getSession();if(!s)return NextResponse.json({error:"Unauthorized"},{status:401});
 try{await connectMongoDB();const b=await req.json(),action=b.action,target=canManageAttendance(s.role)&&b.employeeId?b.employeeId:s.sub,date=canManageAttendance(s.role)?(b.date||nowDate()):nowDate();let record=await Attendance.findOne({employeeId:target,date});
  if(action==="punchIn"){
   if(record?.punchIn)return NextResponse.json({error:"Punch in already recorded."},{status:409});
   record=await Attendance.findOneAndUpdate({employeeId:target,date},{$set:{punchIn:new Date(),status:"Present",updatedBy:s.employeeId},$setOnInsert:{employeeId:target,date,createdBy:s.employeeId,outTimes:[],breaks:[]}},{upsert:true,new:true});
  }else if(action==="punchOut"){
   if(!record?.punchIn)return NextResponse.json({error:"Punch in is required first."},{status:400});
   if(record.punchOut)return NextResponse.json({error:"Punch out already recorded."},{status:409});
   if(hasOpenOut(record)||hasOpenBreak(record))return NextResponse.json({error:"Close the active break or out-time before punching out."},{status:409});
   const punchOut=new Date(),times=calculateTimes(record,punchOut);
   record=await Attendance.findByIdAndUpdate(record._id,{$set:{punchOut,totalMinutes:times.totalMinutes,workMinutes:times.workMinutes,updatedBy:s.employeeId}},{new:true});
  }else if(action==="startOut"){
   if(!record?.punchIn||record.punchOut)return NextResponse.json({error:"You must be punched in and not punched out."},{status:400});
   if(hasOpenOut(record)||hasOpenBreak(record))return NextResponse.json({error:"Close the active break or out-time before starting another out-time."},{status:409});
   const reason=String(b.reason||"").trim();if(!reason)return NextResponse.json({error:"Reason is mandatory."},{status:400});
   record=await Attendance.findByIdAndUpdate(record._id,{$push:{outTimes:{start:new Date(),reason,type:b.type==="Official"?"Official":"Personal",minutes:0}},$set:{updatedBy:s.employeeId}},{new:true});
  }else if(action==="endOut"){
   if(!record?.punchIn)return NextResponse.json({error:"Punch in is required."},{status:400});
   const activeIndex=(record.outTimes||[]).findIndex(x=>!x.end);if(activeIndex<0)return NextResponse.json({error:"No active out-time."},{status:400});
   const returnTime=new Date();record.outTimes[activeIndex].end=returnTime;record.outTimes[activeIndex].minutes=mins(record.outTimes[activeIndex].start,returnTime);
   const times=calculateTimes(record,returnTime);record.totalMinutes=times.totalMinutes;record.workMinutes=times.workMinutes;record.updatedBy=s.employeeId;record=await record.save();
  }else if(action==="startBreak"){
   if(!record?.punchIn||record.punchOut)return NextResponse.json({error:"You must be punched in and not punched out."},{status:400});
   if(hasOpenBreak(record)||hasOpenOut(record))return NextResponse.json({error:"Close the active break or out-time before starting a break."},{status:409});
   record=await Attendance.findByIdAndUpdate(record._id,{$push:{breaks:{start:new Date(),reason:"Break",minutes:0}},$set:{updatedBy:s.employeeId}},{new:true});
  }else if(action==="endBreak"){
   if(!record?.punchIn)return NextResponse.json({error:"Punch in is required."},{status:400});
   const activeIndex=(record.breaks||[]).findIndex(x=>!x.end);
   if(activeIndex<0)return NextResponse.json({error:"No active break."},{status:400});
   const returnTime=new Date();record.breaks[activeIndex].end=returnTime;record.breaks[activeIndex].minutes=mins(record.breaks[activeIndex].start,returnTime);
   const times=calculateTimes(record,returnTime);record.totalMinutes=times.totalMinutes;record.workMinutes=times.workMinutes;record.updatedBy=s.employeeId;record=await record.save();
  }else if(action==="setStatus"){
   if(!canManageAttendance(s.role))return NextResponse.json({error:"Access denied."},{status:403});
   if(!["Present","Absent","Leave","Half Day","Holiday"].includes(b.status))return NextResponse.json({error:"Select a valid attendance status."},{status:400});
   record=await Attendance.findOneAndUpdate({employeeId:target,date},{$set:{status:b.status,remarks:String(b.remarks||"").trim(),employeeId:target,date,updatedBy:s.employeeId},$setOnInsert:{createdBy:s.employeeId,outTimes:[],breaks:[]}},{upsert:true,new:true});
  }else return NextResponse.json({error:"Unsupported action."},{status:400});
  const fresh=await Attendance.findById(record._id).lean();return NextResponse.json({record:{...fresh,...calculateTimes(fresh)}});
 }catch(e){return NextResponse.json({error:"Attendance action failed.",detail:e.message},{status:500});}
}