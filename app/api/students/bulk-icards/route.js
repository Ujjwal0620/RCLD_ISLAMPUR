import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import StudentMaster from "@/models/StudentMaster";

export const runtime = "nodejs";

const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^{}()|[\]\\$]/g, "\\$&");
}

function buildFilter(filters = {}) {
  const filter = {};
  const search = String(filters.search || "").trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { applicantName: rx }, { formNo: rx }, { enrollmentNo: rx }, { regnNo: rx },
      { mobileNumber: rx }, { courseCode: rx }, { courseName: rx },
      { fatherOrHusbandName: rx }, { email: rx },
    ];
  }
  if (filters.sex) filter.sex = String(filters.sex);
  if (filters.course) filter.courseName = String(filters.course);
  if (filters.status && filters.status !== "all") filter.status = String(filters.status);
  else if (!filters.status) filter.status = { $ne: "Cancelled" };
  if (filters.registration === "assigned") filter.regnNo = { $exists: true, $nin: ["", null] };
  if (filters.registration === "unassigned") filter.$and = [{ $or: [
    { regnNo: { $exists: false } }, { regnNo: "" }, { regnNo: null }
  ] }];
  if (filters.fromDate || filters.toDate) {
    filter.createdAt = {};
    if (filters.fromDate) filter.createdAt.$gte = new Date(String(filters.fromDate) + "T00:00:00.000Z");
    if (filters.toDate) filter.createdAt.$lte = new Date(String(filters.toDate) + "T23:59:59.999Z");
  }
  return filter;
}

export async function POST(request) {
  try {
    await connectMongoDB();
    const body = await request.json();
    const ids = Array.isArray(body.studentIds)
      ? [...new Set(body.studentIds.map(String).filter(id => mongoose.Types.ObjectId.isValid(id)))]
      : [];
    const filter = body.selectAllMatching === true ? buildFilter(body.filters || {}) : { _id: { $in: ids } };
    if (!body.selectAllMatching && !ids.length) {
      return NextResponse.json({ error: "Select at least one student." }, { status: 400 });
    }
    const students = await Student.find(filter).sort({ applicantName: 1 }).limit(500).lean();
    if (!students.length) return NextResponse.json({ error: "No students matched the ID-card selection." }, { status: 404 });

    const pageIds = students.map(student => student._id);
    const profiles = await StudentMaster.find({ legacyStudentIds: { $in: pageIds } })
      .select("legacyStudentIds photoUrl stCodes").lean();
    const profileByStudent = new Map();
    for (const profile of profiles) {
      for (const legacyId of profile.legacyStudentIds || []) profileByStudent.set(String(legacyId), profile);
    }
    const enriched = students.map(student => {
      const profile = profileByStudent.get(String(student._id));
      const registration = String(student.regnNo || profile?.stCodes?.[0] || "").trim();
      return {
        ...student,
        photoUrl: student.photoUrl || profile?.photoUrl || (
          registration ? `/api/students/photo/${encodeURIComponent(registration)}` : ""
        ),
      };
    });
    return NextResponse.json({ students: enriched, count: enriched.length, truncated: students.length === 500 });
  } catch (error) {
    console.error("[bulk-student-icards]", error);
    return NextResponse.json({ error: "Unable to prepare selected student ID cards.", detail: error.message }, { status: 500 });
  }
}
