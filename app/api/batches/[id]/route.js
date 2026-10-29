import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";
import Course from "@/models/Course";
import BatchSlotLock from "@/models/BatchSlotLock";
import mongoose from "mongoose";
import { getSeriesSlots } from "@/data/batchSchedule";

const StudentSchema = new mongoose.Schema({batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch"},batchCode:String},{strict:false});
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

const EmployeeSchema = new mongoose.Schema(
  { employeeId:String,name:String,designation:String,skills:[String],status:String },
  { timestamps:true }
);
const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

async function getBatchId(params){ return (await params)?.id; }
function normalizeSeries(value){
  return Array.isArray(value) ? [...new Set(value.filter(Boolean).map(x=>String(x).trim().toUpperCase()))] : [];
}
function normalizeSlots(series){
  return series.flatMap(value=>getSeriesSlots(value).map(slot=>({
    day:slot.day,time:slot.time,series:value,slot:slot.slot
  })));
}
function uniqueHours(schedules){
  return [...new Map(schedules.map(x=>[`${x.day}|${x.time}|${x.series}`,{day:x.day,time:x.time,series:x.series,slot:x.slot}])).values()];
}
function uniqueConflicts(items){
  return [...new Map(items.map(x=>[`${x.batchCode}|${x.day}|${x.time}`,x])).values()];
}

async function validateReschedule({id,course,series,facultyId}){
  const schedules=normalizeSlots(series);
  if(!schedules.length) return {response:NextResponse.json({error:"The selected series have no valid timetable slots."},{status:400})};
  const selectedHours=uniqueHours(schedules);

  const others=await Batch.find({
    _id:{$ne:id},
    status:{$in:["Draft","Active"]}
  }).select("batchCode name schedules").lean();

  const conflicts=[];
  for(const other of others){
    for(const existing of other.schedules||[]){
      if(selectedHours.some(x=>x.day===existing.day&&x.time===existing.time&&x.series===existing.series)){
        conflicts.push({
          batchCode:other.batchCode,batchName:other.name,
          day:existing.day,time:existing.time,
          bookedSlot:existing.slot,series:existing.series
        });
      }
    }
  }
  if(conflicts.length) return {response:NextResponse.json({
    error:"One or more selected timetable hours are already booked.",
    conflicts:uniqueConflicts(conflicts)
  },{status:409})};

  let employee=null;
  if(facultyId){
    employee=await Employee.findOne({employeeId:facultyId,status:"Active"}).lean();
    if(!employee) return {response:NextResponse.json({error:"Selected faculty is not an active employee."},{status:400})};
    const missing=(course.requiredSkills||[]).filter(skill=>!(employee.skills||[]).includes(skill));
    if(missing.length) return {response:NextResponse.json({
      error:"Selected faculty does not meet the course skill requirements.",missingSkills:missing
    },{status:409})};

    const facultyBatches=await Batch.find({
      _id:{$ne:id},facultyId:employee.employeeId,status:{$in:["Draft","Active"]}
    }).select("batchCode name schedules").lean();
    const facultyConflicts=[];
    for(const other of facultyBatches){
      for(const existing of other.schedules||[]){
        if(selectedHours.some(x=>x.time===existing.time)){
          facultyConflicts.push({
            batchCode:other.batchCode,batchName:other.name,
            day:existing.day,time:existing.time,series:existing.series
          });
        }
      }
    }
    if(facultyConflicts.length) return {response:NextResponse.json({
      error:"The selected faculty already has a conflicting class.",
      conflicts:uniqueConflicts(facultyConflicts)
    },{status:409})};
  }
  return {schedules,selectedHours,employee};
}

export async function GET(_req,{params}){
  try{
    const id=await getBatchId(params);
    if(!id)return NextResponse.json({error:"Batch id is required."},{status:400});
    await connectMongoDB();
    const batch=await Batch.findById(id).lean();
    if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
    return NextResponse.json({batch});
  }catch(e){return NextResponse.json({error:"Unable to load batch.",detail:e.message},{status:500});}
}

export async function PATCH(req,{params}){
  try{
    const id=await getBatchId(params);
    if(!id)return NextResponse.json({error:"Batch id is required."},{status:400});
    await connectMongoDB();
    const body=await req.json();
    const batch=await Batch.findById(id).lean();
    if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});

    const nextStatus=body.status!==undefined?body.status:batch.status;
    const scheduleChange=body.series!==undefined || body.facultyId!==undefined || body.classFrequency!==undefined;
    let schedules=batch.schedules||[];
    let selectedHours=uniqueHours(schedules);
    let facultyName=batch.facultyName||"";
    let facultyId=body.facultyId!==undefined?String(body.facultyId||""):batch.facultyId||"";

    if(scheduleChange){
      const course=await Course.findById(batch.courseId).lean();
      if(!course)return NextResponse.json({error:"Course for this batch no longer exists."},{status:409});
      const series=body.series!==undefined?normalizeSeries(body.series):normalizeSeries(batch.series);
      const classFrequency=Number(body.classFrequency||batch.classFrequency||course.classesPerWeek);
      if(series.length!==classFrequency)return NextResponse.json({
        error:`Select exactly ${classFrequency} series for this batch.`
      },{status:400});
      const checked=await validateReschedule({id,course,series,facultyId});
      if(checked.response)return checked.response;
      schedules=checked.schedules;
      selectedHours=checked.selectedHours;
      facultyName=body.facultyName!==undefined?String(body.facultyName||""):checked.employee?.name||"";
    }

    const update={};
    for(const key of ["name","status","capacity","startDate","endDate","notes"]) if(body[key]!==undefined) update[key]=body[key];
    if(update.capacity!==undefined)update.capacity=Number(update.capacity);
    if(scheduleChange){
      update.series=body.series!==undefined?normalizeSeries(body.series):batch.series;
      update.classFrequency=Number(body.classFrequency||batch.classFrequency);
      update.facultyId=facultyId;
      update.facultyName=facultyName;
      update.schedules=schedules.map(slot=>({
        ...slot,facultyId,facultyName,room:slot.room||""
      }));
    }

    const updated=await Batch.findByIdAndUpdate(id,update,{new:true,runValidators:true}).lean();

    await BatchSlotLock.deleteMany({batchId:updated._id});
    if(["Draft","Active"].includes(nextStatus)){
      try{
        await BatchSlotLock.insertMany(selectedHours.map(hour=>({
          key:`${hour.day}|${hour.time}|${hour.series}`,day:hour.day,time:hour.time,
          slot:hour.slot,series:hour.series,batchId:updated._id,
          batchCode:updated.batchCode,status:nextStatus
        })),{ordered:true});
      }catch(lockError){
        if(lockError?.code===11000){
          return NextResponse.json({error:"A timetable hour was booked by another batch. Refresh and choose another time."},{status:409});
        }
        throw lockError;
      }
    }

    return NextResponse.json({batch:updated,message:"Batch updated."});
  }catch(e){
    if(e instanceof Response)return e;
    return NextResponse.json({error:"Unable to update batch.",detail:e.message},{status:400});
  }
}

export async function DELETE(_req,{params}){
  try{
    const id=await getBatchId(params);
    if(!id)return NextResponse.json({error:"Batch id is required."},{status:400});
    await connectMongoDB();
    const batch=await Batch.findByIdAndDelete(id).lean();
    if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
    await Student.updateMany({batchId:batch._id},{$set:{batchId:null,batchCode:""}});
    await BatchSlotLock.deleteMany({batchId:batch._id});
    return NextResponse.json({batch,message:"Batch permanently deleted and its timetable series are immediately available again."});
  }catch(e){return NextResponse.json({error:"Unable to delete batch.",detail:e.message},{status:400});}
}