import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
import { getSeriesSlots } from "@/data/batchSchedule";

const EmployeeSchema = new mongoose.Schema(
  {
    employeeId: String,
    name: String,
    designation: String,
    department: String,
    skills: [String],
    status: String,
  },
  { timestamps: true }
);

const Employee =
  mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

export async function GET(req) {
  try {
    await connectMongoDB();

    const sp = new URL(req.url).searchParams;
    const courseId = sp.get("courseId");
    const requestedSeries = (sp.get("series") || "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);

    const course = courseId ? await Course.findById(courseId).lean() : null;
    const required = course?.requiredSkills || [];

    const selectedSlots = requestedSeries.flatMap((series) =>
      getSeriesSlots(series).map((slot) => ({
        day: slot.day,
        time: slot.time,
        series,
      }))
    );

    const batches = await Batch.find({
      status: { $in: ["Draft", "Active"] },
    })
      .select("batchCode name facultyId facultyName schedules status")
      .lean();

    const employees = await Employee.find({ status: "Active" })
      .select("employeeId name designation department skills status")
      .lean();

    const options = employees
      .map((employee) => {
        const skills = employee.skills || [];
        const matchedSkills = required.filter((skill) =>
          skills.includes(skill)
        );
        const missingSkills = required.filter(
          (skill) => !skills.includes(skill)
        );

        const conflicts = [];
        for (const batch of batches) {
          if (batch.facultyId !== employee.employeeId) continue;

          for (const existing of batch.schedules || []) {
            const conflict = selectedSlots.find(
              (selected) =>
                selected.day === existing.day && selected.time === existing.time
            );

            if (conflict) {
              conflicts.push({
                batchCode: batch.batchCode,
                batchName: batch.name,
                day: existing.day,
                time: existing.time,
                series: existing.series,
              });
            }
          }
        }

        const skillEligible =
          required.length === 0 ? true : missingSkills.length === 0;
        const scheduleAvailable = conflicts.length === 0;

        return {
          ...employee,
          skillMatch: matchedSkills.length,
          matchedSkills,
          missingSkills,
          assignedBatches: batches.filter(
            (batch) => batch.facultyId === employee.employeeId
          ).length,
          conflicts,
          skillEligible,
          scheduleAvailable,
          available: skillEligible && scheduleAvailable,
        };
      })
      .filter((employee) => employee.skillEligible && employee.scheduleAvailable)
      .sort(
        (a, b) =>
          b.skillMatch - a.skillMatch ||
          a.assignedBatches - b.assignedBatches ||
          a.name.localeCompare(b.name)
      );

    return NextResponse.json({
      faculty: options,
      requiredSkills: required,
      selectedSlots,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Unable to load available faculty.", detail: e.message },
      { status: 500 }
    );
  }
}
