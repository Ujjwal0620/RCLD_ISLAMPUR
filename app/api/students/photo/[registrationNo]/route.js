import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import StudentMaster from "@/models/StudentMaster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "assets",
  "id card coding images",
  "id card coding"
);
const EXTENSIONS = [
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
];

const StudentSchema = new mongoose.Schema({
  regnNo: String,
  enrollmentNo: String,
  photoUrl: String,
}, { timestamps: true, strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

function normalizeRegistrationNo(value) {
  return String(value ?? "").trim().replace(/\.0$/, "");
}

function safeCloudinaryUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    if (!/(^|\.)((res\.)?cloudinary\.com)$/i.test(url.hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function GET(_request, { params }) {
  try {
    const { registrationNo } = await params;
    const code = normalizeRegistrationNo(registrationNo);
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(code)) {
      return NextResponse.json({ error: "Invalid registration number." }, { status: 400 });
    }

    // Cloudinary is the durable source of truth; local files are only a fallback.
    let cloudinaryUrl = "";
    try {
      await connectMongoDB();
      const numericCode = /^\d+$/.test(code) ? Number(code) : null;
      const student = await Student.findOne({
        $or: [
          { regnNo: code },
          { enrollmentNo: code },
          ...(numericCode === null ? [] : [{ regnNo: numericCode }, { enrollmentNo: numericCode }]),
        ],
      }).select("photoUrl regnNo enrollmentNo").lean();

      cloudinaryUrl = safeCloudinaryUrl(student?.photoUrl);
      if (!cloudinaryUrl) {
        const master = await StudentMaster.findOne({ stCodes: code }).select("photoUrl").lean();
        cloudinaryUrl = safeCloudinaryUrl(master?.photoUrl);
      }
    } catch (databaseError) {
      // Keep local asset fallback available if Atlas is temporarily unreachable.
      console.warn("[student-photo] Database lookup unavailable:", databaseError?.message || databaseError);
    }
    if (cloudinaryUrl) {
      return NextResponse.redirect(cloudinaryUrl, {
        status: 302,
        headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
      });
    }

    for (const [extension, contentType] of EXTENSIONS) {
      for (const filename of [code + extension, code + extension.toUpperCase()]) {
      try {
        const image = await readFile(path.join(PHOTO_DIRECTORY, filename));
        return new NextResponse(new Uint8Array(image), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      }
    }

    return NextResponse.json({ error: "No photograph found for this registration number." }, { status: 404 });
  } catch (error) {
    console.error("[student-photo]", error);
    return NextResponse.json({ error: "Unable to load student photograph." }, { status: 500 });
  }
}
