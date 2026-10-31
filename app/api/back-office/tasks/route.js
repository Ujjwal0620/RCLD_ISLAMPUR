import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import BackOfficeTask from "@/models/BackOfficeTask";
import Batch from "@/models/Batch";
import { getSession } from "@/lib/auth";
import mongoose from "mongoose";

const EmployeeSchema=new mongoose.Schema({employeeId:String,name:String,designation:String,department:String,status:String},{timestamps:true});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);
const AREAS=["T1","T2","L1","L2","L3","L4","Back Office","Front Office"];

async function guard(write=false){
  const session=await getSession();
  if(!session?.employeeId)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
  if(write&&!["superadmin","office-admin"].includes(session.role))return {error:NextResponse.json({error:"Only Super Admin or Office Admin can assign tasks."},{status:403})};
  return {session};
}
function today(){return new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});}
function overlaps(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&bStart<aEnd;}
function batchBusyIds(batches,date,startTime,endTime){
  const day=new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",timeZone:"Asia/Kolkata"});
  const busy=new Set();
  for(const batch of batches)for(const s of batch.schedules||[]){
    if(s.day!==day||!s.facultyId)continue;
    const m=String(s.time||"").match(/(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})/i);
    if(!m||overlaps(startTime,endTime,m[1].padStart(5,"0"),m[2].padStart(5,"0")))busy.add(s.facultyId);
  }
  return busy;
}

export async function GET(req){
  const g=await guard();if(g.error)return g.error;
  try{
    await connectMongoDB();
    const q=new URL(req.url).searchParams,date=q.get("date")||today(),startTime=q.get("startTime")||"",endTime=q.get("endTime")||"";
    const [tasks,employees,batches]=await Promise.all([
      BackOfficeTask.find({taskDate:date}).sort({startTime:1,createdAt:-1}).lean(),
      Employee.find({status:{$ne:"Inactive"}}).select("employeeId name designation department").sort({name:1}).lean(),
      Batch.find({status:{$in:["Draft","Active"]}}).select("schedules").lean()
    ]);
    const assignedToday=new Set(tasks.flatMap(t=>(t.assignments||[]).map(a=>a.employeeId).concat(t.assignedTo?[t.assignedTo]:[])));
    const classBusy=startTime&&endTime?batchBusyIds(batches,date,startTime,endTime):new Set();
    const availableEmployees=employees.filter(e=>!assignedToday.has(e.employeeId)&&!classBusy.has(e.employeeId));
    return NextResponse.json({tasks,employees,availableEmployees,date});
  }catch(e){return NextResponse.json({error:"Unable to load Task Assignment.",detail:e.message},{status:500});}
}

export async function POST(req){
  const g=await guard(true);if(g.error)return g.error;
  try{
    await connectMongoDB();const b=await req.json();
    const title=String(b.title||"").trim(),taskDate=String(b.taskDate||today()),startTime=String(b.startTime||""),endTime=String(b.endTime||"");
    const ids=[...new Set(Array.isArray(b.employeeIds)?b.employeeIds.filter(Boolean).map(String):[])];
    if(!title)return NextResponse.json({error:"Task name is required."},{status:400});
    if(!ids.length)return NextResponse.json({error:"Select at least one employee."},{status:400});
    if(!AREAS.includes(b.workArea))return NextResponse.json({error:"Select a valid work area."},{status:400});
    if(!startTime||!endTime||startTime>=endTime)return NextResponse.json({error:"Select a valid start and end time."},{status:400});
    const [employees,batches,dayTasks]=await Promise.all([
      Employee.find({employeeId:{$in:ids},status:{$ne:"Inactive"}}).select("employeeId name").lean(),
      Batch.find({status:{$in:["Draft","Active"]}}).select("schedules").lean(),
      BackOfficeTask.find({taskDate}).lean()
    ]);
    if(employees.length!==ids.length)return NextResponse.json({error:"One or more selected employees are unavailable."},{status:409});
    const alreadyAssigned=new Set(dayTasks.flatMap(t=>(t.assignments||[]).map(a=>a.employeeId).concat(t.assignedTo?[t.assignedTo]:[])));
    const busyClass=batchBusyIds(batches,taskDate,startTime,endTime);
    const blocked=employees.filter(e=>alreadyAssigned.has(e.employeeId)||busyClass.has(e.employeeId));
    if(blocked.length)return NextResponse.json({error:"One or more employees already have a task today or a class in this time.",employees:blocked.map(e=>e.name)},{status:409});
    const assignments=employees.map(e=>({employeeId:e.employeeId,employeeName:e.name}));
    const task=await BackOfficeTask.create({title,assignments,assignedTo:assignments[0]?.employeeId||"",assignedToName:assignments[0]?.employeeName||"",workArea:b.workArea,taskDate,startTime,endTime,status:"Open",createdBy:g.session.employeeId,createdByName:g.session.name||""});
    return NextResponse.json({task},{status:201});
  }catch(e){return NextResponse.json({error:"Unable to create task.",detail:e.message},{status:400});}
}

export async function PATCH(req){
  const g=await guard(true);if(g.error)return g.error;
  try{await connectMongoDB();const b=await req.json();const task=await BackOfficeTask.findByIdAndUpdate(b.id,{$set:{status:b.status}},{new:true});if(!task)return NextResponse.json({error:"Task not found."},{status:404});return NextResponse.json({task});}
  catch(e){return NextResponse.json({error:"Unable to update task.",detail:e.message},{status:400});}
}
export async function DELETE(req){
  const g=await guard(true);if(g.error)return g.error;
  try{await connectMongoDB();const id=new URL(req.url).searchParams.get("id");if(!id)return NextResponse.json({error:"Task id is required."},{status:400});await BackOfficeTask.findByIdAndDelete(id);return NextResponse.json({ok:true});}
  catch(e){return NextResponse.json({error:"Unable to delete task.",detail:e.message},{status:400});}
}
