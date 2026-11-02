import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";

const ReferralSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  marketingEmployeeId: { type: String, required: true, index: true },
  marketingEmployeeName: { type: String, required: true, trim: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  notes: { type: String, default: "" },
}, { timestamps: true });
const Referral = mongoose.models.Referral || mongoose.model("Referral", ReferralSchema);

const EmployeeSchema = new mongoose.Schema({}, { strict: false });
const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
const StudentSchema = new mongoose.Schema({}, { strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

export async function GET() {
  try {
    await connectMongoDB();
    const [referrals, employees] = await Promise.all([
      Referral.find({}).sort({ status: 1, name: 1 }).lean(),
      Employee.find({ status: { $ne: "Inactive" } }).select("employeeId name designation department status").sort({ name: 1 }).lean(),
    ]);
    const marketingEmployees = employees.filter((employee) =>
      /market/i.test(String(employee.department || "") + " " + String(employee.designation || ""))
    );
    const counts = await Student.aggregate([
      { $match: { referralId: { $exists: true, $nin: ["", null] } } },
      { $group: { _id: "$referralId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
    return NextResponse.json({
      referrals: referrals.map((item) => ({ ...item, studentCount: countMap.get(String(item._id)) || 0 })),
      marketingEmployees,
    });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load referrals.", detail: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectMongoDB();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const marketingEmployeeId = String(body.marketingEmployeeId || "").trim();
    if (!name || !marketingEmployeeId) {
      return NextResponse.json({ error: "Referral name and marketing employee are required." }, { status: 400 });
    }
    const employee = await Employee.findOne({ employeeId: marketingEmployeeId, status: { $ne: "Inactive" } }).lean();
    if (!employee || !/market/i.test(String(employee.department || "") + " " + String(employee.designation || ""))) {
      return NextResponse.json({ error: "Select an active employee from the Marketing department/designation." }, { status: 400 });
    }
    const existingReferrals = await Referral.find({ marketingEmployeeId: employee.employeeId }).select("name").lean();
    if (existingReferrals.some((item) => String(item.name || "").trim().toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: "This referral name is already assigned to this marketing employee." }, { status: 409 });
    }
    const referral = await Referral.create({");
    const duplicate = await Referral.findOne({
      marketingEmployeeId: employee.employeeId,
      name: { $regex: "^" + escapedName + "$", $options: "i" },
    }).lean();
    if (duplicate) {
      return NextResponse.json({ error: "This referral name is already assigned to this marketing employee." }, { status: 409 });
    }
    const referral = await Referral.create({
      name,
      marketingEmployeeId: employee.employeeId,
      marketingEmployeeName: employee.name,
      notes: String(body.notes || "").trim(),
      status: "Active",
    });
    return NextResponse.json({ referral }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.code === 11000 ? "Referral already exists." : "Unable to create referral.", detail: error.message }, { status: error?.code === 11000 ? 409 : 500 });
  }
}
