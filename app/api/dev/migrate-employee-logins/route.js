import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectMongoDB } from "@/lib/mongodb";

const S = new mongoose.Schema({
  mobile:String, loginId:String, password:String, status:String
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", S);

export async function POST(req) {
  try {
    await connectMongoDB();
    const body = await req.json();
    const defaultPassword = String(body.defaultPassword || "").trim();
    if (!defaultPassword || defaultPassword.length < 6) {
      return NextResponse.json({error:"Provide the employee default password (minimum 6 characters)."}, {status:400});
    }
    const hash = await bcrypt.hash(defaultPassword, 12);
    const employees = await Employee.find({mobile:{$exists:true,$ne:""}, status:{$ne:"Inactive"}});
    let updated = 0;
    for (const employee of employees) {
      const mobile = String(employee.mobile || "").replace(/\D/g,"").slice(-10);
      if (!mobile) continue;
      employee.loginId = mobile;
      employee.password = hash;
      await employee.save();
      updated++;
    }
    return NextResponse.json({ok:true,updated});
  } catch (error) {
    return NextResponse.json({error:"Unable to migrate employee logins.",detail:error.message},{status:500});
  }
}