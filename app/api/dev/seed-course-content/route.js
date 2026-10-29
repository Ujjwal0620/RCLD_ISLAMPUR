import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Course from "@/models/Course";
import CourseContent from "@/models/CourseContent";
import { COURSE_CONTENT_SEED } from "@/data/courseContentSeed";

export async function POST() {
  try {
    await connectMongoDB();
    const results = [];
    for (const entry of Object.entries(COURSE_CONTENT_SEED)) {
      const courseCode = entry[0];
      const modules = entry[1];
      const course = await Course.findOne({ code: courseCode }).lean();
      if (!course) {
        results.push({ courseCode, status: "course-not-found" });
        continue;
      }
      const saved = await CourseContent.findOneAndUpdate(
        { courseId: course._id },
        { courseCode: course.code, courseName: course.name, modules, active: true },
        { upsert: true, new: true }
      ).lean();
      results.push({ courseCode, status: "saved", modules: saved.modules.length });
    }
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: "Unable to seed course content.", detail: error.message }, { status: 500 });
  }
}
