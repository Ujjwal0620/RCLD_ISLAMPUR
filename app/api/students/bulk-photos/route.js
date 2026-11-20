import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { configureCloudinary } from "@/lib/cloudinary";
import StudentMaster from "@/models/StudentMaster";

export const runtime = "nodejs";

const StudentSchema = new mongoose.Schema({
  regnNo: String,
  enrollmentNo: String,
  photoUrl: String,
}, { timestamps: true, strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

function registrationFromFilename(filename) {
  const base = String(filename || "").split(/[\\/]/).pop() || "";
  const exact = base.match(/(?:^|[_\\-\\s])(\\d{4,})(?=\\.[^.]+$)/);
  if (exact?.[1]) return exact[1];
  const withoutExtension = base.replace(/\\.[^.]+$/, "");
  const candidates = withoutExtension.match(/\\d{4,}/g) || [];
  return candidates.length ? candidates[candidates.length - 1] : "";
}

function uploadToCloudinary(client, buffer, registrationNo, extension) {
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      folder: "rcld-islampur/students",
      public_id: registrationNo,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
      format: extension === "jpg" ? "jpg" : extension,
      transformation: [{ width: 900, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }],
    }, (error, result) => {
      if (error) reject(error);
      else if (!result?.secure_url) reject(new Error("Cloudinary did not return a secure image URL."));
      else resolve(result);
    });
    stream.on("error", reject);
    stream.end(buffer);
  });
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in before uploading student photos." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to upload student photos in bulk." }, { status: 403 });
    }

    const form = await request.formData();
    const files = form.getAll("files").filter(file => file && typeof file.arrayBuffer === "function");
    if (!files.length) return NextResponse.json({ error: "Choose one or more student photo files or a folder." }, { status: 400 });
    if (files.length > 300) return NextResponse.json({ error: "Upload up to 300 photos in one batch." }, { status: 413 });

    const cloudinary = configureCloudinary();
    if (!cloudinary.configured) return NextResponse.json({ error: cloudinary.error }, { status: 503 });
    await connectMongoDB();

    const summary = { matchedAndUpdated: 0, unmatchedFilenames: [], failedFiles: [], updated: [] };
    for (const file of files) {
      const filename = String(file.name || "unnamed");
      const extension = filename.split(".").pop().toLowerCase();
      if (!["jpg", "jpeg", "png", "webp"].includes(extension) || !String(file.type || "").startsWith("image/")) {
        summary.failedFiles.push({ filename, reason: "Unsupported image format." });
        continue;
      }
      if (Number(file.size || 0) > 8 * 1024 * 1024) {
        summary.failedFiles.push({ filename, reason: "Image exceeds 8 MB." });
        continue;
      }
      const registrationNo = registrationFromFilename(filename);
      if (!registrationNo) {
        summary.unmatchedFilenames.push(filename);
        continue;
      }

      const student = await Student.findOne({
        regnNo: { $in: [registrationNo, Number(registrationNo)] },
      }).select("_id regnNo applicantName").lean();
      if (!student) {
        summary.unmatchedFilenames.push(filename);
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploaded = await uploadToCloudinary(cloudinary.client, buffer, registrationNo, extension);
        await Student.findByIdAndUpdate(student._id, { $set: { photoUrl: uploaded.secure_url } }, { new: true, runValidators: false });
        await StudentMaster.updateOne(
          { legacyStudentIds: student._id },
          { $set: { photoUrl: uploaded.secure_url } }
        );
        summary.matchedAndUpdated += 1;
        summary.updated.push({
          filename,
          regnNo: registrationNo,
          studentName: student.applicantName || "",
          photoUrl: uploaded.secure_url,
        });
      } catch (error) {
        summary.failedFiles.push({ filename, regnNo: registrationNo, reason: error.message || "Upload failed." });
      }
    }

    return NextResponse.json({
      message: "Student photo upload completed.",
      matchedAndUpdated: summary.matchedAndUpdated,
      unmatchedFilenames: summary.unmatchedFilenames,
      failedFiles: summary.failedFiles,
      updated: summary.updated,
    });
  } catch (error) {
    console.error("[bulk-student-photos]", error);
    return NextResponse.json({ error: "Unable to process student photo uploads.", detail: error.message }, { status: 500 });
  }
}
