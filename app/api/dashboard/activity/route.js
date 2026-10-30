import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";

const AttendanceSchema=new mongoose.Schema({studentId:mongoose.Schema.Types.ObjectId,date:String,status:String,subject:String,batch:String,markedBy:String},{strict:false});
const Attendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);
const FeeSchema=new mongoose.Schema({studentId:mongoose.Schema.Types.ObjectId,payments:Array},{strict:false});
const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
const StudentSchema=new mongoose.Schema({batchId:mongoose.Schema.Types.ObjectId,batchCode:String,courseCode:String,courseName:String,applicantName:String},{strict:false});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const BatchSchema=new mongoose.Schema({batchCode:String,name:String,courseCode:String,courseName:String,capacity:Number,facultyIds:Array,facultyNames:Array,schedules:Array,status:String},{strict:false});
const Batch=mongoose.models.Batch||mongoose.model("Batch",BatchSchema);

function isoDate(d){return d.toISOString().slice(0,10)}
function monthRange(month){
 const [y,m]=String(month).split("-").map(Number);
 const start=new Date(Date.UTC(y,m-1,1)), end=new Date(Date.UTC(y,m,0));
 return {start:isoDate(start),end:isoDate(end)};
}
function dayName(date){return new Date(date+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"})}

export async function GET(req){
 try{
  await connectMongoDB();
  const {searchParams}=new URL(req.url);
  const date=searchParams.get("date")||isoDate(new Date());
  const month=searchParams.get("month")||date.slice(0,7);
  const mode=searchParams.get("mode")==="month"?"month":"day";
  const range=mode==="month"?monthRange(month):{start:date,end:date};
  const [attendance,fees,batches]=await Promise.all([
    Attendance.find({date:{$gte:range.start,$lte:range.end}}).lean(),
    StudentFee.find({"payments.date":{$gte:range.start,$lte:range.end}}).lean(),
    Batch.find({status:{$in:["Draft","Active","Completed"]}}).lean()
  ]);

  const attendanceByDay={}; const statusTotals={Present:0,Absent:0,Leave:0};
  const facultyMap={}; const batchMap={};
  for(const a of attendance){
    const day=a.date||"Unknown";
    attendanceByDay[day]??={Present:0,Absent:0,Leave:0,total:0};
    if(statusTotals[a.status]!==undefined)statusTotals[a.status]+=1;
    if(attendanceByDay[day][a.status]!==undefined)attendanceByDay[day][a.status]+=1;
    attendanceByDay[day].total+=1;
    const faculty=String(a.markedBy||"Unknown");
    facultyMap[faculty]??={name:faculty,sessions:new Set(),records:0,present:0,absent:0,leave:0,batches:new Set()};
    facultyMap[faculty].sessions.add(day+"|"+String(a.batch||""));
    facultyMap[faculty].records++;
    if(a.status==="Present")facultyMap[faculty].present++;
    if(a.status==="Absent")facultyMap[faculty].absent++;
    if(a.status==="Leave")facultyMap[faculty].leave++;
    if(a.batch)facultyMap[faculty].batches.add(a.batch);
    const batch=String(a.batch||"Unknown");
    batchMap[batch]??={batch,records:0,present:0,absent:0,leave:0,subjects:new Set()};
    batchMap[batch].records++;
    if(a.status==="Present")batchMap[batch].present++;
    if(a.status==="Absent")batchMap[batch].absent++;
    if(a.status==="Leave")batchMap[batch].leave++;
    if(a.subject)batchMap[batch].subjects.add(a.subject);
  }

  const feeByDay={}; let collected=0;
  for(const f of fees) for(const p of (f.payments||[])){
    if(!p.date||p.date<range.start||p.date>range.end)continue;
    const day=p.date; const amount=Number(p.amount||0); collected+=amount;
    feeByDay[day]??={amount:0,count:0}; feeByDay[day].amount+=amount; feeByDay[day].count++;
  }

  const dayAttendance=attendanceByDay[date]||{Present:0,Absent:0,Leave:0,total:0};
  const faculty=Object.values(facultyMap).map(x=>({...x,sessions:x.sessions.size,batches:[...x.batches]})).sort((a,b)=>b.records-a.records);
  const batchAttendance=Object.values(batchMap).map(x=>({...x,subjects:[...x.subjects],percentage:x.records?Math.round(x.present/x.records*100):0})).sort((a,b)=>b.records-a.records);
  const plannedClasses=batches.flatMap(b=>(b.schedules||[]).filter(s=>mode==="month"||s.day===dayName(date)).map(s=>({batch:b.batchCode,name:b.name,course:b.courseCode||b.courseName,day:s.day,time:s.time,series:s.series,slot:s.slot,room:s.room,faculty:s.facultyName||((b.facultyNames||[]).join(", "))||b.facultyName||"Unassigned"})));
  const monthlyAttendance=Object.entries(attendanceByDay).sort(([a],[b])=>a.localeCompare(b)).map(([day,v])=>({day,...v,percentage:v.total?Math.round(v.Present/v.total*100):0}));
  const dailyFees=Object.entries(feeByDay).sort(([a],[b])=>a.localeCompare(b)).map(([day,v])=>({day,...v}));

  return NextResponse.json({
    mode,date,month,dayName:dayName(date),
    attendance:{day:dayAttendance,statusTotals,monthly:monthlyAttendance},
    faculty,batchAttendance,plannedClasses,fees:{collected,daily:dailyFees}
  });
 }catch(error){return NextResponse.json({error:"Unable to load dashboard activity.",detail:error.message},{status:500});}
}
