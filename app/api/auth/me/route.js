import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSession, roleOfEmployee } from "@/lib/auth";
import { connectMongoDB } from "@/lib/mongodb";

const S = new mongoose.Schema({
  employeeId: String, name: String, designation: String, department: String, status: String, permissions: [String]
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", S);

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });

    // The bootstrap Super Admin session is self-contained and must remain usable
    // even before the new MongoDB database has been populated.
    if (session.role === "superadmin" || session.sub === "superadmin") {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: "superadmin",
          employeeId: "SUPERADMIN",
          name: session.name || "Super Admin",
          role: "superadmin",
          designation: "Super Admin",
          department: "Administration",
          permissions: [],
          isSuperAdmin: true
        }
      });
    }

    await connectMongoDB();
    const employee = await Employee.findById(session.sub).lean();
    const role = roleOfEmployee(employee || {});
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.sub,
        employeeId: session.employeeId,
        name: session.name,
        role,
        designation: employee?.designation || "",
        department: employee?.department || "",
        permissions: employee?.permissions || [],
        isSuperAdmin: role === "superadmin"
      }
    });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    return NextResponse.json({ error: "Unable to load session.", detail: error.message }, { status: 500 });
  }
}
