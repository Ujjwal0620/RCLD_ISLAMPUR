import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import BackOfficeTask from "@/models/BackOfficeTask";
import Batch from "@/models/Batch";
import { getSession } from "@/lib/auth";
import mongoose from "mongoose";

const EmployeeSchema=new mongoose.Schema({employeeId:String,name:String,designation:String,department:String,status:String},{timestamps:true});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);
const AREAS=["T1","T2","L1","L2","L3","L4","Back Office","Front Office"];
const SLOTS=[
 ["09:00","10:00"],["10:00","11:00"],["11:00","12:00"],["12:00","13:00"],["13:00","14:00"],
 ["14:00","15:00"],["15:00","16:00"],["16:00","17:00"],["17:00","18:00"],["18:00","19:00"]
];
async function guard(write=false){
 const session=await getSession();
 if(!session?.employeeId)return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
 if(write&&!["superadmin","office-admin"].includes(session.role))return {error:NextResponse.json({error:"Only Super Admin or Office Admin can assign tasks."},{status:403})};
 return {session};
}
function today(){return new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"});}
function overlaps(aStart,aEnd,bStart,bEnd){return aStart<bEnd&&bStart<aEnd;}
function validSlot(start,end){return SLOTS.some(([s,e])=>s===start&&e===end);}
function to24(raw){
 const s=String(raw||"").trim();let m=s.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
 if(m){let h=Number(m[1]);if(m[3].toLowerCase()==="pm"&&h!==12)h+=12;if(m[3].toLowerCase()==="am"&&h===12)h=0;return String(h).padStart(2,"0")+":"+m[2];}
 m=s.match(/(\d{1,2}):(\d{2})/);return m?String(Number(m[1])).padStart(2,"0")+":"+m[2]:"";
}
function batchAssociatedIds(batches){
 const ids=new Set();
 for(const batch of batches){
  if(batch.facultyId)ids.add(String(batch.facultyId));
  for(const id of batch.facultyIds||[])if(id)ids.add(String(id));
  for(const a of batch.staffAssignments||[])if(a.employeeId)ids.add(String(a.employeeId));
  for(const s of batch.schedules||[])if(s.facultyId)ids.add(String(s.facultyId));
 }
 return ids;
}
function batchBusyIds(batches,date,startTime,endTime){
 const day=new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",timeZone:"Asia/Kolkata"});
 const busy=new Set();
 for(const batch of batches)for(const s of batch.schedules||[]){
  if(s.day!==day||!s.facultyId)continue;
  const parts=String(s.time||"").split(/\s*(?:-|–|to)\s*/i);if(parts.length<2)continue;
  const bs=to24(parts[0]),be=to24(parts[1]);if(bs&&be&&overlaps(startTime,endTime,bs,be))busy.add(String(s.facultyId));
 }
 return busy;
}
function employeeAssignments(employees,batches,allTasks,date,startTime,endTime){
 const batchRows=[];
 for(const b of batches){
  const ids=[b.facultyId,...(b.facultyIds||[]),...(b.staffAssignments||[]).map(a=>a.employeeId)].filter(Boolean).map(String);
  for(const id of ids)batchRows.push({employeeId:id,batchCode:b.batchCode||"",batchName:b.name||"",facultyName:b.facultyName||b.facultyNames?.filter(Boolean).join(", ")||""});
 }
 const batchMap=new Map();
 for(const x of batchRows){if(!batchMap.has(x.employeeId))batchMap.set(x.employeeId,[]);batchMap.get(x.employeeId).push(x);}
 const taskMap=new Map();
 for(const t of allTasks){
  for(const a of t.assignments||[]){if(!taskMap.has(String(a.employeeId)))taskMap.set(String(a.employeeId),[]);taskMap.get(String(a.employeeId)).push(t);}
  if(t.assignedTo){if(!taskMap.has(String(t.assignedTo)))taskMap.set(String(t.assignedTo),[]);taskMap.get(String(t.assignedTo)).push(t);}
 }
 const busy=batchBusyIds(batches,date,startTime,endTime);
 return employees.map(e=>{
  const id=String(e.employeeId),b=batchMap.get(id)||[],t=taskMap.get(id)||[],reasons=[];
  if(b.length)reasons.push("Batch: "+[...new Set(b.map(x=>x.batchCode).filter(Boolean))].join(", "));
  if(t.length)reasons.push("Task: "+[...new Set(t.map(x=>x.title).filter(Boolean))].join(", "));
  if(busy.has(id))reasons.push("Class in selected time");
  return {...e,available:!reasons.length,reasons,batches:b,tasks:t};
 });
}
export async function GET(req){
 const g=await guard();if(g.error)return g.error;
 try{
  await connectMongoDB();
  const q=new URL(req.url).searchParams,date=q.get("date")||today(),startTime=q.get("startTime")||"",endTime=q.get("endTime")||"";
  const isManager=["superadmin","office-admin"].includes(g.session.role);
  const [allTasks,employees,batches]=await Promise.all([
   BackOfficeTask.find({taskDate:date}).sort({startTime:1,createdAt:-1}).lean(),
   isManager?Employee.find({status:{$ne:"Inactive"}}).select("employeeId name designation department").sort({name:1}).lean():Promise.resolve([]),
   isManager?Batch.find({status:{$in:["Draft","Active"]}}).select("batchCode name facultyId facultyIds facultyName facultyNames staffAssignments schedules").lean():Promise.resolve([])
  ]);
  const tasks=isManager?allTasks:allTasks.filter(t=>(t.assignments||[]).some(a=>a.employeeId===g.session.employeeId)||t.assignedTo===g.session.employeeId);
  if(!isManager)return NextResponse.json({tasks,availableEmployees:[],employeeAvailability:[],date,canAssign:false});
  const employeeAvailability=employeeAssignments(employees,batches,allTasks,date,startTime,endTime);
  const availableEmployees=employeeAvailability.filter(e=>e.available);
  return NextResponse.json({tasks,availableEmployees,employeeAvailability,date,canAssign:true});
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
  if(!validSlot(startTime,endTime))return NextResponse.json({error:"Select one of the fixed hourly task slots."},{status:400});
  const [employees,batches,dayTasks]=await Promise.all([
   Employee.find({employeeId:{$in:ids},status:{$ne:"Inactive"}}).select("employeeId name").lean(),
   Batch.find({status:{$in:["Draft","Active"]}}).select("facultyId facultyIds staffAssignments schedules").lean(),
   BackOfficeTask.find({taskDate}).lean()
  ]);
  if(employees.length!==ids.length)return NextResponse.json({error:"One or more selected employees are unavailable."},{status:409});
  const batchAssociated=batchAssociatedIds(batches);
  const alreadyAssignedToday=new Set(dayTasks.flatMap(t=>(t.assignments||[]).map(a=>String(a.employeeId)).concat(t.assignedTo?[String(t.assignedTo)]:[])));
  const busyClass=batchBusyIds(batches,taskDate,startTime,endTime);
  const blocked=employees.filter(e=>{const id=String(e.employeeId);return batchAssociated.has(id)||alreadyAssignedToday.has(id)||busyClass.has(id);});
  if(blocked.length)return NextResponse.json({error:"One or more selected employees are already associated with a batch, already have a task today, or have a class in this time.",employees:blocked.map(e=>e.name)},{status:409});
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