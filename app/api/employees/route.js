import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import { ALL_EMPLOYEE_SKILLS } from "@/lib/access-control";

const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  age: Number,
  dateOfBirth: String,
  gender: String,
  mobile: String,
  email: String,
  address: String,
  joiningDate: String,
  designation: String,
  department: String,
  employmentType: { type: String, default: "Full Time" },
  salary: { type: Number, default: 0 },
  salaryFrequency: { type: String, default: "Monthly" },
  bankName: String,
  accountNumber: String,
  ifsc: String,
  emergencyContactName: String,
  emergencyContactNumber: String,
  leaveBalance: {
    casual: { type: Number, default: 0 },
    sick: { type: Number, default: 0 },
    earned: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  skills: { type: [String], default: [] },
  status: { type: String, default: "Active" },
  notes: String,
}, { timestamps: true });

const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

async function nextEmployeeId() {
  const CounterSchema = new mongoose.Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } });
  const Counter = mongoose.models.EmployeeCounter || mongoose.model("EmployeeCounter", CounterSchema);
  const counter = await Counter.findOneAndUpdate(
    { key: "employee" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();
  return `RCLD/ISL/${String(counter.seq).padStart(3, "0")}`;
}

export async function GET(request) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "").trim();
    const skill = (searchParams.get("skill") || "").trim();
    const filter = {};
    if (search) {
      const escaped = search.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [{ employeeId: rx }, { name: rx }, { mobile: rx }, { email: rx }, { designation: rx }, { department: rx }];
    }
    if (status) filter.status = status;
    if (skill) filter.skills = skill;
    const employees = await Employee.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ employees, skills: ALL_EMPLOYEE_SKILLS });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load employees.", detail: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectMongoDB();
    const body = await request.json();
    if (!String(body.name || "").trim()) return NextResponse.json({ error: "Employee name is required." }, { status: 400 });

    const allowedSkills = new Set(ALL_EMPLOYEE_SKILLS);
    const skills = Array.isArray(body.skills) ? body.skills.filter((skill) => allowedSkills.has(skill)) : [];
    const employeeId = await nextEmployeeId();

    const employee = await Employee.create({
      employeeId,
      name: String(body.name).trim(),
      age: body.age ? Number(body.age) : undefined,
      dateOfBirth: body.dateOfBirth || "",
      gender: body.gender || "",
      mobile: body.mobile || "",
      email: body.email || "",
      address: body.address || "",
      joiningDate: body.joiningDate || "",
      designation: body.designation || "",
      department: body.department || "",
      employmentType: body.employmentType || "Full Time",
      salary: body.salary ? Number(body.salary) : 0,
      salaryFrequency: body.salaryFrequency || "Monthly",
      bankName: body.bankName || "",
      accountNumber: body.accountNumber || "",
      ifsc: body.ifsc || "",
      emergencyContactName: body.emergencyContactName || "",
      emergencyContactNumber: body.emergencyContactNumber || "",
      leaveBalance: {
        casual: Number(body.leaveBalance?.casual || 0),
        sick: Number(body.leaveBalance?.sick || 0),
        earned: Number(body.leaveBalance?.earned || 0),
        other: Number(body.leaveBalance?.other || 0),
      },
      skills,
      status: body.status || "Active",
      notes: body.notes || "",
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to create employee.", detail: error.message }, { status: 500 });
  }
}
