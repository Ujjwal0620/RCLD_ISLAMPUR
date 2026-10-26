import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    application: "RCLD Islampur ERP",
    stack: { frontend: "Next.js + JavaScript", database: "MongoDB", storage: "Cloudinary" },
    environment: process.env.NODE_ENV,
  });
}
