import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongoDB } from "@/lib/mongodb";
import { createSession, sessionCookie, roleOfEmployee } from "@/lib/auth";

const S = new mongoose.Schema({
  name: String, employeeId: String, mobile: String, loginId: String, email: String,
  password: String, status: String, designation: String, department: String
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", S);

export async function POST(req) {
  try {
    await connectMongoDB();
    const body = await req.json();
    const rawLogin = String(body.loginId || "").trim();
    const password = String(body.password || "");
    if (!rawLogin || !password) return NextResponse.json({ error: "Login ID and password are required." }, { status: 400 });

    const isEmail = rawLogin.includes("@");
    const normalizedLogin = isEmail ? rawLogin.toLowerCase() : rawLogin.replace(/\D/g, "").slice(-10);

    let employee;
    let role;
    let sessionLoginId = normalizedLogin;

    const superAdminEmail = String(process.env.SUPERADMIN_EMAIL || "admin@rcld.in").trim().toLowerCase();
    const superAdminPassword = String(process.env.SUPERADMIN_PASSWORD || "Admin@321");

    if (isEmail && normalizedLogin === superAdminEmail && password === superAdminPassword) {
      employee = await Employee.findOne({
        $or: [
          { email: { $regex: new RegExp("^" + superAdminEmail.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "$", "i") } },
          { designation: { $regex: /super\s*admin/i } }
        ]
      }).lean();

      role = "superadmin";
      employee = employee || {
        _id: "superadmin",
        employeeId: "SUPERADMIN",
        name: "Super Admin",
        email: superAdminEmail,
        status: "Active",
        designation: "Super Admin",
        department: "Administration"
      };
    } else {
      if (isEmail) {
        employee = await Employee.findOne({ email: { $regex: new RegExp("^" + normalizedLogin.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "$", "i") } }).lean();
      } else {
        employee = await Employee.findOne({ $or: [{ loginId: normalizedLogin }, { mobile: normalizedLogin }, { mobile: rawLogin }] }).lean();
      }

      if (!employee || employee.status === "Inactive") return NextResponse.json({ error: "Invalid employee login." }, { status: 401 });
      let ok = employee.password?.startsWith("$2") ? await bcrypt.compare(password, employee.password) : password === employee.password;
      // Existing/imported employees may predate employee-login credentials.
      // Their stored mobile is the login ID and emp@123 initializes the default password on first successful login.
      if (!ok && !employee.password && !isEmail && normalizedLogin && password === "emp@123") {
        const hash = await bcrypt.hash("emp@123", 12);
        await Employee.updateOne({ _id: employee._id }, { $set: { loginId: normalizedLogin, password: hash } });
        ok = true;
      }
      if (!ok) return NextResponse.json({ error: "Invalid employee login." }, { status: 401 });
      role = roleOfEmployee(employee);
    }

    const token = await createSession({
      sub: String(employee._id),
      employeeId: employee.employeeId,
      name: employee.name,
      role,
      loginId: sessionLoginId
    });
    const res = NextResponse.json({ employee: { id: employee._id, employeeId: employee.employeeId, name: employee.name, role } });
    res.cookies.set({ ...sessionCookie(token) });
    return res;
  } catch (error) {
    return NextResponse.json({ error: "Unable to login.", detail: error.message }, { status: 500 });
  }
}
