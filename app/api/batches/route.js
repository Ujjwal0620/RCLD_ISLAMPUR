import { NextResponse } from "next/server";
import Batch from "@/models/Batch";
import Course from "@/models/Course";
import { getSeriesSlots } from "@/data/batchSchedule";
import mongoose from "mongoose";
import BatchSlotLock from "@/models/BatchSlotLock";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";

const EmployeeSchema = new mongoose.Schema(
  { employeeId:String,name:String,designation:String,department:String,skills:[String],offDays:[String],status:String },
  { timestamps:true }
);
const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

async function nextBatchCode() {
  const last = await Batch.findOne().sort({ createdAt:-1 }).select("batchCode").lean();
  const n = Number(String(last?.batchCode || "RCLD-BATCH-000").split("-").pop()) || 0;
  return `RCLD-BATCH-${String(n + 1).padStart(3,"0")}`;
}

function normalizeSeries(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter(Boolean).map(x => String(x).trim().toUpperCase()))]
    : [];
}

function normalizeSlots(series) {
  return series.flatMap(value =>
    getSeriesSlots(value).map(slot => ({
      day: slot.day,
      time: slot.time,
      series: value,
      slot: slot.slot,
    }))
  );
}

function uniqueHours(schedules) {
  return [...new Map(
    schedules.map(x => [`${x.day}|${x.time}|${x.series}`, {
      day:x.day, time:x.time, series:x.series, slot:x.slot
    }])
  ).values()];
}

function uniqueConflicts(items) {
  return [...new Map(
    items.map(x => [`${x.batchCode}|${x.day}|${x.time}`, x])
  ).values()];
}

async function validateSchedule({ series, facultyIds = [], course, excludeBatchId }) {
  const schedules = normalizeSlots(series);
  if (!schedules.length) throw new Error("The selected series have no valid timetable slots.");
  const selectedHours = uniqueHours(schedules);

  const existingBatches = await Batch.find({
    status:{ $in:["Draft","Active"] },
    ...(excludeBatchId && mongoose.Types.ObjectId.isValid(excludeBatchId)
      ? { _id:{ $ne:excludeBatchId } } : {})
  }).select("batchCode name schedules facultyId facultyName facultyIds facultyNames staffAssignments").lean();

  const conflicts = [];
  for (const existingBatch of existingBatches) {
    for (const existingSlot of existingBatch.schedules || []) {
      const hit = selectedHours.find(x => x.day === existingSlot.day && x.time === existingSlot.time && x.series === existingSlot.series);
      if (hit) {
        conflicts.push({
          batchCode:existingBatch.batchCode,
          batchName:existingBatch.name,
          day:existingSlot.day,
          time:existingSlot.time,
          bookedSlot:existingSlot.slot,
          series:existingSlot.series
        });
      }
    }
  }
  if (conflicts.length) {
    return {
      ok:false,
      response:NextResponse.json({
        error:"One or more selected timetable hours are already booked.",
        conflicts:uniqueConflicts(conflicts)
      },{status:409})
    };
  }

  let employee = null;
  const ids = [...new Set((facultyIds || []).filter(Boolean).map(String))].slice(0,2);
  if (ids.length > 2) return {ok:false,response:NextResponse.json({error:"A batch can have maximum two faculty members."},{status:400})};
  const employees = ids.length ? await Employee.find({employeeId:{$in:ids},status:"Active"}).lean() : [];
  if (ids.length && employees.length !== ids.length) return {ok:false,response:NextResponse.json({error:"One or more selected faculty are not active."},{status:400})};
  const facultyById = new Map(employees.map(e=>[e.employeeId,e]));
  const facultyForDay = day => ids.find(id => !(facultyById.get(id)?.offDays || []).includes(day)) || null;
  if (ids.length) {
    employee = employees[0] || null;
    if (!employee) {
      return { ok:false, response:NextResponse.json({error:"Selected faculty is not an active employee."},{status:400}) };
    }

    const required = course.requiredSkills || [];
    const missingSkills = required.filter(skill => !(employee.skills || []).includes(skill));
    if (missingSkills.length) {
      return {
        ok:false,
        response:NextResponse.json({
          error:"Selected faculty does not meet the course skill requirements.",
          missingSkills
        },{status:409})
      };
    }

    const facultyBatches = await Batch.find({
      $or:[{facultyId:{$in:ids}},{facultyIds:{$in:ids}}],
      status:{ $in:["Draft","Active"] },
      ...(excludeBatchId && mongoose.Types.ObjectId.isValid(excludeBatchId)
        ? { _id:{ $ne:excludeBatchId } } : {})
    }).select("batchCode name schedules").lean();

    const facultyConflicts = [];
    for (const batch of facultyBatches) {
      for (const existingSlot of batch.schedules || []) {
        if (selectedHours.some(x => x.day === existingSlot.day && x.time === existingSlot.time && ids.includes(existingSlot.facultyId))) {
          facultyConflicts.push({
            batchCode:batch.batchCode,
            batchName:batch.name,
            day:existingSlot.day,
            time:existingSlot.time,
            series:existingSlot.series
          });
        }
      }
    }
    for (const hour of selectedHours) { if (!facultyForDay(hour.day)) return {ok:false,response:NextResponse.json({error:`Both selected faculty are off on ${hour.day}. Select another faculty.`},{status:409})}; }
    if (facultyConflicts.length) {
      return {
        ok:false,
        response:NextResponse.json({
          error:"The selected faculty already has a conflicting class.",
          conflicts:uniqueConflicts(facultyConflicts)
        },{status:409})
      };
    }
  }

  const assignedSchedules=schedules.map(slot=>{const id=facultyForDay(slot.day);const emp=id?facultyById.get(id):null;return {...slot,facultyId:id||"",facultyName:emp?.name||""};});
  return {ok:true,schedules:assignedSchedules,selectedHours,employee,employees};
}

export async function GET() {
  try {
    await connectMongoDB();
    const batches = await Batch.find().sort({createdAt:-1}).lean();
    return NextResponse.json({batches});
  } catch (e) {
    return NextResponse.json({error:"Unable to load batches.",detail:e.message},{status:500});
  }
}

export async function POST(req) {
  try {
    const session=await getSession();
    if(!session?.employeeId || !["superadmin","office-admin"].includes(session.role)) return NextResponse.json({error:"Only Super Admin or Office Admin can create batches and assign class staff."},{status:403});
    await connectMongoDB();
    const b = await req.json();
    const course = await Course.findById(b.courseId).lean();
    if (!course) return NextResponse.json({error:"Course not found."},{status:400});

    const series = normalizeSeries(b.series);
    if (!series.length) return NextResponse.json({error:"Select at least one series."},{status:400});

    const classFrequency = Number(b.classFrequency) || course.classesPerWeek;
    if (series.length !== classFrequency) {
      return NextResponse.json({
        error:`Select exactly ${classFrequency} series for this course frequency. Each selected series represents one weekly class day.`
      },{status:400});
    }

    const facultyIds=[...new Set((b.facultyIds || (b.facultyId ? [b.facultyId] : [])).filter(Boolean).map(String))].slice(0,2);
    const checked = await validateSchedule({series,facultyIds,course});
    if (!checked.ok) return checked.response;

    const batch = await Batch.create({
      batchCode:await nextBatchCode(),
      name:String(b.name || `${course.code} Batch`).trim(),
      courseId:course._id,
      courseCode:course.code,
      courseName:course.name,
      series,
      classFrequency,
      capacity:Number(b.capacity)||50,
      startDate:b.startDate||undefined,
      endDate:b.endDate||undefined,
      facultyIds,
      facultyNames:checked.employees?.map(e=>e.name)||[],
      staffAssignments:(checked.employees||[]).map(e=>({employeeId:e.employeeId,name:e.name,role:/lab/i.test(`${e.designation||""} ${e.department||""}`)?"Lab Assistant":"Faculty"})),
      facultyId:facultyIds[0]||"",
      facultyName:checked.employees?.[0]?.name||checked.employee?.name||"",
      schedules:checked.schedules.map(slot => ({
        ...slot,
        facultyId:slot.facultyId||facultyIds[0]||"",
        facultyName:slot.facultyName||checked.employees?.[0]?.name||"",
        room:b.room||""
      })),
      status:b.status||"Draft",
      notes:b.notes||"",
      createdBy:"superadmin"
    });

    try {
      if (["Draft","Active"].includes(batch.status)) {
        await BatchSlotLock.insertMany(
          checked.selectedHours.map(hour => ({
            key:`${hour.day}|${hour.time}|${hour.series}`,
            day:hour.day,
            time:hour.time,
            slot:hour.slot,
            series:hour.series,
            batchId:batch._id,
            batchCode:batch.batchCode,
            status:batch.status
          })),
          {ordered:true}
        );
      }
    } catch (lockError) {
      await Batch.findByIdAndDelete(batch._id);
      if (lockError?.code === 11000) {
        return NextResponse.json({
          error:"A timetable hour was booked by another batch while this batch was being created. Refresh the timetable and choose another time."
        },{status:409});
      }
      throw lockError;
    }

    return NextResponse.json({batch},{status:201});
  } catch (e) {
    return NextResponse.json({error:"Unable to create batch.",detail:e.message},{status:400});
  }
}