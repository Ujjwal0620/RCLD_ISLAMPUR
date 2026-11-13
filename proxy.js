import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/auth-secret";

const adminRoles = ["superadmin", "admin", "office-admin", "accountant"];
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function proxy(request) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("rcld_session")?.value;

  if (pathname === "/dashboard/login") return NextResponse.next();

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }

    try {
      await jwtVerify(token, getAuthSecret());
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
  }

  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/dev/")
  ) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const { payload } = await jwtVerify(token, getAuthSecret());
      if (
        !adminRoles.includes(payload.role) &&
        writeMethods.has(request.method) &&
        !pathname.startsWith("/api/employee-attendance") &&
        !pathname.startsWith("/api/auth/change-password")
      ) {
        return NextResponse.json(
          { error: "Read-only access. Super Admin must grant create, update or delete permission." },
          { status: 403 },
        );
      }
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
