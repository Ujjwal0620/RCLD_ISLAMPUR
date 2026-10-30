import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";

const S = new mongoose.Schema({ password: String, status: String });
const Employee = mongoose.models.Employee || mongoose.model("Employee", S);

export async function POST(req) {
  try {
    const session = await getSession();
    if (!session || session.role === "superadmin" || !mongoose.Types.ObjectId.isValid(String(session.sub || ""))) {
      return NextResponse.json({ error: "Employee session required." }, { status: 401 });
    }
    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!currentPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Current password and a new password of at least 6 characters are required." }, { status: 400 });
    }
    await connectMongoDB();
    const employee = await Employee.findById(session.sub);
    if (!employee || employee.status === "Inactive") return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    const ok = employee.password?.startsWith("$2") ? await bcrypt.compare(currentPassword, employee.password) : currentPassword === employee.password;
    if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    employee.password = await bcrypt.hash(newPassword, 12);
    await employee.save();
    return NextResponse.json({ ok: true, message: "Password changed successfully." });
  } catch (error) {
    return NextResponse.json({ error: "Unable to change password.", detail: error.message }, { status: 500 });
  }
}
