import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema({
  employeeId: String, name: String, age: Number, dateOfBirth: String, gender: String,
  mobile: String, email: String, address: String, joiningDate: String,
  designation: String, department: String, employmentType: String, salary: Number,
  salaryFrequency: String, bankName: String, accountNumber: String, ifsc: String,
  emergencyContactName: String, emergencyContactNumber: String,
  leaveBalance: { casual: Number, sick: Number, earned: Number, other: Number },
  skills: [String], status: String, notes: String
}, { timestamps: true });

const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid employee ID." }, { status: 400 });
    const employee = await Employee.findById(id).lean();
    if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    return NextResponse.json({ employee });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load employee.", detail: error.message }, { status: 500 });
  }
}
