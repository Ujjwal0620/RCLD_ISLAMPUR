import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Course from "@/models/Course";
import { getSession, roleOfEmployee } from "@/lib/auth";

const Student = mongoose.models.Student || mongoose.model("Student", new mongoose.Schema({}, { strict: false }));
const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", new mongoose.Schema({}, { strict: false }));
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({ employeeId:String,name:String,designation:String,department:String,status:String }));

async function actorForSemesterAction() {
  const session = await getSession();
  if (!session?.sub) return null;
  if (session.role === "superadmin" || String(session.sub) === "superadmin") return { role:"superadmin", name:session.name || "Super Admin" };
  if (!mongoose.Types.ObjectId.isValid(String(session.sub))) return null;
  const employee = await Employee.findById(session.sub).select("employeeId name designation department status").lean();
  if (!employee || employee.status === "Inactive") return null;
  return { role:roleOfEmployee(employee), name:employee.name || employee.employeeId || "Admin" };
}

export async function POST(request, { params }) {
  try {
    await connectMongoDB();
    const actor = await actorForSemesterAction();
    if (!actor) return NextResponse.json({ error:"Please sign in to manage Coding for Kids semesters." }, { status:401 });
    if (!["superadmin","office-admin"].includes(actor.role)) return NextResponse.json({ error:"Only Super Admin or Office Admin can complete or readmit a semester." }, { status:403 });
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error:"Invalid student ID." }, { status:400 });
    const body = await request.json();
    const action = String(body.action || "");
    const student = await Student.findById(id).lean();
    if (!student) return NextResponse.json({ error:"Student not found." }, { status:404 });
    if (String(student.courseCode || "").toUpperCase() !== "KIDS" && !/coding\s*for\s*kids/i.test(String(student.courseName || ""))) return NextResponse.json({ error:"This workflow is only for Coding for Kids students." }, { status:400 });
    const currentSemester = Number(student.currentSemester || 1);
    const now = new Date().toISOString().slice(0,10);
    const history = Array.isArray(student.semesterHistory) ? [...student.semesterHistory] : [];

    if (action === "complete") {
      if (student.semesterStatus === "Completed") return NextResponse.json({ error:"This semester is already marked completed." }, { status:409 });
      if (history.length) history[history.length - 1] = { ...history[history.length - 1], status:"Completed", completedAt:now, completedBy:actor.name };
      else history.push({ semester:currentSemester, status:"Completed", completedAt:now, completedBy:actor.name });
      await Student.collection.updateOne({ _id:new mongoose.Types.ObjectId(id) }, { $set:{ semesterStatus:"Completed", semesterHistory:history } });
      return NextResponse.json({ message:"Semester " + currentSemester + " marked completed.", currentSemester, semesterStatus:"Completed" });
    }

    if (action === "readmit") {
      if (student.semesterStatus !== "Completed") return NextResponse.json({ error:"Mark the current semester completed before readmission." }, { status:409 });
      if (currentSemester >= 6) return NextResponse.json({ error:"Semester 6 is the final semester. No further readmission is available." }, { status:409 });
      const nextSemester = currentSemester + 1;
      const course = await Course.findOne({ code:"KIDS" }).lean();
      const plan = (course?.semesterPlans || []).find(item => Number(item.semester) === nextSemester);
      if (!plan) return NextResponse.json({ error:"The fee plan for the next semester is not configured." }, { status:409 });
      history.push({ semester:nextSemester, status:"Active", admittedAt:now, admittedBy:actor.name, admissionFee:Number(plan.admissionFee), monthlyFee:Number(plan.monthlyFee), tuitionFee:Number(plan.tuitionFee), totalFee:Number(plan.totalFee), durationMonths:Number(plan.durationMonths || 6) });
      await Student.collection.updateOne({ _id:new mongoose.Types.ObjectId(id) }, { $set:{ currentSemester:nextSemester, semesterStatus:"Active", semesterHistory:history } });
      await StudentFee.collection.updateOne({ studentId:new mongoose.Types.ObjectId(id) }, { $set:{ currentSemester:nextSemester, totalFee:Number(plan.tuitionFee), discount:0, admissionFee:Number(plan.admissionFee), registrationFee:0, admissionDate:now, updatedBy:actor.name }, $push:{ semesterHistory:{ semester:nextSemester, admissionFee:Number(plan.admissionFee), monthlyFee:Number(plan.monthlyFee), tuitionFee:Number(plan.tuitionFee), totalFee:Number(plan.totalFee), admittedAt:now, admittedBy:actor.name } } });
      return NextResponse.json({ message:"Student readmitted to Semester " + nextSemester + ".", currentSemester:nextSemester, semesterStatus:"Active", feePlan:plan });
    }
    return NextResponse.json({ error:"Action must be complete or readmit." }, { status:400 });
  } catch (error) {
    return NextResponse.json({ error:"Unable to update Coding for Kids semester.", detail:error.message }, { status:500 });
  }
}
