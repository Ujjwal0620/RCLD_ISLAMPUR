import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ALL_EMPLOYEE_SKILLS } from "@/lib/access-control";

const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  age: Number,
  dateOfBirth: String,
  gender: String,
  mobile: { type: String, index: true },
  loginId: String,
  password: String,
  offDays: { type: [String], default: [] },
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
  // IDs are reusable. Always allocate the lowest free number so a hard-deleted
  // employee ID becomes available to the next employee.
  const rows = await Employee.find({ employeeId: /^RCLD\/ISL\/\d+$/ }).select("employeeId").lean();
  const used = new Set(
    rows
      .map((row) => Number(String(row.employeeId || "").split("/").pop()))
      .filter((value) => Number.isInteger(value) && value > 0)
  );
  let seq = 1;
  while (used.has(seq)) seq += 1;
  return `RCLD/ISL/${String(seq).padStart(3, "0")}`;
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
    if (status && status !== "all") filter.status = status;
    else if (!status) filter.status = { $ne: "Inactive" };
    if (skill) filter.skills = skill;
    const employees = await Employee.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ employees, skills: ALL_EMPLOYEE_SKILLS });
  } catch (error) {
    const unavailable = /MONGODB_URI|ECONNREFUSED|Server selection|connect/i.test(error.message || "");
    return NextResponse.json(
      {
        error: unavailable ? "Employee database is unavailable." : "Unable to load employees.",
        detail: error.message,
        code: unavailable ? "DATABASE_UNAVAILABLE" : "EMPLOYEE_LOAD_FAILED",
      },
      { status: unavailable ? 503 : 500 }
    );
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
    const mobile=String(body.mobile||"").replace(/\D/g,"").slice(-10);
    if((String(body.designation||"").toLowerCase().includes("faculty")||String(body.department||"").toLowerCase().includes("faculty")) && !mobile) return NextResponse.json({error:"Faculty mobile number is required because it is the faculty login ID."},{status:400});
    if(mobile && await Employee.exists({mobile})) return NextResponse.json({error:"This mobile number is already used by another employee."},{status:409});

    const employee = await Employee.create({
      employeeId,
      name: String(body.name).trim(),
      age: body.age ? Number(body.age) : undefined,
      dateOfBirth: body.dateOfBirth || "",
      gender: body.gender || "",
      mobile,
      loginId: mobile,
      password: await bcrypt.hash(String(body.password || "emp@123"), 12),
      offDays: Array.isArray(body.offDays) ? body.offDays : [],
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
    const unavailable = /MONGODB_URI|ECONNREFUSED|Server selection|connect/i.test(error.message || "");
    const duplicate = error?.code === 11000;
    return NextResponse.json(
      {
        error: duplicate
          ? "An employee with this generated ID already exists. Please try again."
          : unavailable
            ? "Employee database is unavailable. Make sure MongoDB is running, then try again."
            : "Unable to create employee.",
        detail: error.message,
        code: duplicate ? "DUPLICATE_EMPLOYEE" : unavailable ? "DATABASE_UNAVAILABLE" : "EMPLOYEE_CREATE_FAILED",
      },
      { status: duplicate ? 409 : unavailable ? 503 : 500 }
    );
  }
}
