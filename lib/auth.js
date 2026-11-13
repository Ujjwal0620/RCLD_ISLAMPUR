import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAuthSecret } from "@/lib/auth-secret";

export async function createSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getAuthSecret());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("rcld_session")?.value;
  return token ? verifySession(token) : null;
}

export function sessionCookie(token) {
  return {
    name: "rcld_session",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 43200,
  };
}

export function roleOfEmployee(employee) {
  const designation = String(employee?.designation || "").toLowerCase();
  const department = String(employee?.department || "").toLowerCase();

  if (designation.includes("super admin")) return "superadmin";
  if (designation.includes("admin") || department.includes("office")) return "office-admin";
  if (designation.includes("account") || department.includes("account")) return "accountant";
  if (
    department.includes("faculty") ||
    designation.includes("faculty") ||
    designation.includes("trainer") ||
    designation.includes("teacher")
  ) {
    return "faculty";
  }
  return "employee";
}

export function canManageAttendance(role) {
  return ["superadmin", "admin", "office-admin"].includes(role);
}
