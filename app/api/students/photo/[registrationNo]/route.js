import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import { configureCloudinary } from "@/lib/cloudinary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_DIRECTORIES = [
  path.join(process.cwd(), "public", "assets", "id card coding images", "id card coding"),
  path.join(process.cwd(), "public", "assets", "id card coding images"),
  path.join(process.cwd(), "public", "assets", "uploaded-images"),
];
const PHOTO_LOOKUP_TTL_MS = 30 * 60 * 1000;
const photoLookupCache = new Map();
const EXTENSIONS = [
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".png", "image/png"], [".webp", "image/webp"],
];

const StudentSchema = new mongoose.Schema({
  regnNo: String, enrollmentNo: String, photoUrl: String,
}, { timestamps: true, strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

function normalizeRegistrationNo(value) {
  return String(value ?? "").trim().replace(/\.0$/, "");
}
function safeCloudinaryUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !/(^|\.)((res\.)?cloudinary\.com)$/i.test(url.hostname)) return "";
    return url.toString();
  } catch { return ""; }
}
async function findCloudinaryPhoto(client, code) {
  if (!client) return "";
  const cached = photoLookupCache.get(code);
  if (cached && cached.expiresAt > Date.now()) return cached.url || "";
  if (cached) photoLookupCache.delete(code);
  // De-duplicate concurrent lookups and cache misses so a missing photo cannot
  // trigger repeated slow Cloudinary Admin API requests on every page render.
  const pending = photoLookupCache.get("pending:" + code);
  if (pending?.promise) return pending.promise;
  const lookupPromise = (async () => {
  // Bulk uploads use this exact Cloudinary public ID convention.
  for (const publicId of [
    "rcld-islampur/students/" + code,
    code,
  ]) {
    try {
      const resource = await client.api.resource(publicId, { resource_type: "image" });
      const url = safeCloudinaryUrl(resource?.secure_url);
      if (url) return url;
    } catch (error) {
      // Never log Cloudinary error/request objects: they can contain API credentials.
      if (![404, "not found"].includes(error?.http_code) && !/not found|unknown api/i.test(String(error?.message || ""))) {
        console.warn("[student-photo] Cloudinary lookup failed (details suppressed).");
      }
    }
  }
  return "";
  })();
  photoLookupCache.set("pending:" + code, { promise: lookupPromise, expiresAt: Date.now() + PHOTO_LOOKUP_TTL_MS });
  try {
    const url = await lookupPromise;
    photoLookupCache.delete("pending:" + code);
    photoLookupCache.set(code, { url, expiresAt: Date.now() + (url ? 60 * 60 * 1000 : PHOTO_LOOKUP_TTL_MS) });
    return url;
  } catch (error) {
    photoLookupCache.delete("pending:" + code);
    photoLookupCache.set(code, { url: "", expiresAt: Date.now() + PHOTO_LOOKUP_TTL_MS });
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

    let cloudinaryUrl = "";
    let databaseAvailable = false;
    let student = null;
    let master = null;
    let enrollment = null;
    try {
      await connectMongoDB();
      databaseAvailable = true;
      const numericCode = /^\d+$/.test(code) ? Number(code) : null;
      const [matchedStudent, masterByCode, matchedEnrollment] = await Promise.all([
        Student.findOne({
          $or: [
            { regnNo: code }, { enrollmentNo: code },
            ...(numericCode === null ? [] : [{ regnNo: numericCode }, { enrollmentNo: numericCode }]),
          ],
        }).select("_id photoUrl hasPhoto regnNo enrollmentNo").lean(),
        StudentMaster.findOne({ stCodes: code }).select("_id photoUrl hasPhoto stCodes legacyStudentIds").lean(),
        StudentEnrollment.findOne({ stCode: code }).select("studentId legacyStudentId stCode").lean(),
      ]);

      student = matchedStudent;
      enrollment = matchedEnrollment;
      master = masterByCode;
      if (!master && enrollment?.studentId) {
        master = await StudentMaster.findById(enrollment.studentId)
          .select("_id photoUrl stCodes legacyStudentIds").lean();
      }
      cloudinaryUrl = safeCloudinaryUrl(student?.photoUrl) || safeCloudinaryUrl(master?.photoUrl);
      const explicitlyHasNoPhoto = student?.hasPhoto === false && master?.hasPhoto === false;
      if (!cloudinaryUrl && explicitlyHasNoPhoto) {
        return NextResponse.json({ error: "Student photograph is not available.", registrationNo: code }, {
          status: 404,
          headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400" },
        });
      }
    } catch (databaseError) {
      console.warn("[student-photo] Database lookup unavailable (details suppressed).");
    }

    // Cloudinary lookup is independent of MongoDB availability. This is important
    // when the Atlas connection is temporarily unavailable.
    if (!cloudinaryUrl) {
      const cloudinary = configureCloudinary();
      if (cloudinary.configured) {
        cloudinaryUrl = await findCloudinaryPhoto(cloudinary.client, code);
        if (cloudinaryUrl && databaseAvailable) {
          if (master?._id) {
            await StudentMaster.updateOne({ _id: master._id }, { $set: { photoUrl: cloudinaryUrl } }).catch(() => {});
          }
          const linkedIds = [
            ...(master?.legacyStudentIds || []),
            ...(enrollment?.legacyStudentId ? [enrollment.legacyStudentId] : []),
            ...(student?._id ? [student._id] : []),
          ];
          if (linkedIds.length) {
            await Student.updateMany({ _id: { $in: linkedIds } }, { $set: { photoUrl: cloudinaryUrl } }).catch(() => {});
          }
        }
      }
    }

    if (cloudinaryUrl) {
      return NextResponse.redirect(cloudinaryUrl, {
        status: 302,
        headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
      });
    }

    // Local fallback supports the current project folder and the previous upload folder.
    for (const directory of PHOTO_DIRECTORIES) {
      for (const [extension, contentType] of EXTENSIONS) {
        for (const filename of [code + extension, code + extension.toUpperCase()]) {
          try {
            const image = await readFile(path.join(directory, filename));
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
    }

    return NextResponse.json({
      error: "Student photograph is not available.",
      registrationNo: code,
    }, { status: 404, headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400" } });
  } catch (error) {
    console.error("[student-photo] Request failed (details suppressed).");
    return NextResponse.json({ error: "Unable to load student photograph." }, { status: 500 });
  }
}
