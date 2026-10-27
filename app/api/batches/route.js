import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";
import Course from "@/models/Course";
import { getSeriesSlots } from "@/data/batchSchedule";
import mongoose from "mongoose";
import BatchSlotLock from "@/models/BatchSlotLock";

const EmployeeSchema = new mongoose.Schema(
  {
    employeeId: String,
    name: String,
    designation: String,
    skills: [String],
    status: String,
  },
  { timestamps: true }
);
const Employee =
  mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

async function nextBatchCode() {
  const last = await Batch.findOne()
    .sort({ createdAt: -1 })
    .select("batchCode")
    .lean();
  const n =
    Number(String(last?.batchCode || "RCLD-BATCH-000").split("-").pop()) || 0;
  return `RCLD-BATCH-${String(n + 1).padStart(3, "0")}`;
}

function normalizeSlots(series) {
  return series.flatMap((value) =>
    getSeriesSlots(value).map((slot) => ({
      day: slot.day,
      time: slot.time,
      series: value,
      slot: slot.slot,
    }))
  );
}

export async function GET() {
  try {
    await connectMongoDB();
    const batches = await Batch.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ batches });
  } catch (e) {
    return NextResponse.json(
      { error: "Unable to load batches.", detail: e.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectMongoDB();

    const b = await req.json();
    const course = await Course.findById(b.courseId).lean();
    if (!course)
      return NextResponse.json(
        { error: "Course not found." },
        { status: 400 }
      );

    const series = Array.isArray(b.series)
      ? [...new Set(b.series.filter(Boolean).map((x) => String(x).toUpperCase()))]
      : [];

    if (!series.length)
      return NextResponse.json(
        { error: "Select at least one series." },
        { status: 400 }
      );

    const classFrequency =
      Number(b.classFrequency) || course.classesPerWeek;

    if (series.length !== classFrequency) {
      return NextResponse.json(
        {
          error: `Select exactly ${classFrequency} series for this course frequency. Each selected series represents one weekly class day.`,
        },
        { status: 400 }
      );
    }

    const schedules = normalizeSlots(series);
    const existingBatches = await Batch.find({ status: { $in: ["Draft", "Active"] } })
      .select("batchCode name schedules")
      .lean();

    const slotConflicts = [];
    for (const existingBatch of existingBatches) {
      for (const existingSlot of existingBatch.schedules || []) {
        const conflict = schedules.find(
          (slot) =>
            slot.day === existingSlot.day &&
            slot.time === existingSlot.time &&
            slot.slot === existingSlot.slot
        );
        if (conflict) {
          slotConflicts.push({
            batchCode: existingBatch.batchCode,
            batchName: existingBatch.name,
            day: existingSlot.day,
            time: existingSlot.time,
            slot: existingSlot.slot,
            series: existingSlot.series,
          });
        }
      }
    }
    if (slotConflicts.length) {
      return NextResponse.json(
        {
          error: "One or more selected timetable slots are already booked.",
          conflicts: slotConflicts,
        },
        { status: 409 }
      );
    }

    if (!schedules.length) {
      return NextResponse.json(
        { error: "The selected series have no valid timetable slots." },
        { status: 400 }
      );
    }

    if (b.facultyId) {
      const employee = await Employee.findOne({
        employeeId: b.facultyId,
        status: "Active",
      }).lean();

      if (!employee) {
        return NextResponse.json(
          { error: "Selected faculty is not an active employee." },
          { status: 400 }
        );
      }

      const required = course.requiredSkills || [];
      const missingSkills = required.filter(
        (skill) => !(employee.skills || []).includes(skill)
      );

      if (missingSkills.length) {
        return NextResponse.json(
          {
            error: "Selected faculty does not meet the course skill requirements.",
            missingSkills,
          },
          { status: 409 }
        );
      }

      const existing = await Batch.find({
        facultyId: employee.employeeId,
        status: { $in: ["Draft", "Active"] },
      })
        .select("batchCode name schedules")
        .lean();

      const conflicts = [];
      for (const batch of existing) {
        for (const existingSlot of batch.schedules || []) {
          if (
            schedules.some(
              (slot) =>
                slot.day === existingSlot.day &&
                slot.time === existingSlot.time
            )
          ) {
            conflicts.push({
              batchCode: batch.batchCode,
              batchName: batch.name,
              day: existingSlot.day,
              time: existingSlot.time,
              series: existingSlot.series,
            });
          }
        }
      }

      if (conflicts.length) {
        return NextResponse.json(
          {
            error: "The selected faculty already has a conflicting class.",
            conflicts,
          },
          { status: 409 }
        );
      }
    }

    const batch = await Batch.create({
      batchCode: await nextBatchCode(),
      name: String(b.name || `${course.code} Batch`).trim(),
      courseId: course._id,
      courseCode: course.code,
      courseName: course.name,
      series,
      classFrequency,
      capacity: Number(b.capacity) || 50,
      startDate: b.startDate || undefined,
      endDate: b.endDate || undefined,
      facultyId: b.facultyId || "",
      facultyName: b.facultyName || "",
      schedules: schedules.map((slot) => ({
        ...slot,
        facultyId: b.facultyId || "",
        facultyName: b.facultyName || "",
        room: b.room || "",
      })),
      status: b.status || "Draft",
      notes: b.notes || "",
      createdBy: "superadmin",
    });

    try {
      await BatchSlotLock.insertMany(
        schedules.map((slot) => ({
          key: `${slot.day}|${slot.time}|${slot.slot}`,
          day: slot.day,
          time: slot.time,
          slot: slot.slot,
          series: slot.series,
          batchId: batch._id,
          batchCode: batch.batchCode,
          status: batch.status === "Active" ? "Active" : "Draft",
        })),
        { ordered: true }
      );
    } catch (lockError) {
      await Batch.findByIdAndDelete(batch._id);
      if (lockError?.code === 11000) {
        return NextResponse.json(
          { error: "A timetable slot was booked by another batch while this batch was being created. Refresh the timetable and choose another slot." },
          { status: 409 }
        );
      }
      throw lockError;
    }

    return NextResponse.json({ batch }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Unable to create batch.", detail: e.message },
      { status: 400 }
    );
  }
}
