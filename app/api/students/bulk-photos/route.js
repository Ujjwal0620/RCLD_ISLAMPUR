import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { configureCloudinary } from "@/lib/cloudinary";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";

export const runtime = "nodejs";

const StudentSchema = new mongoose.Schema({
  regnNo: String,
  enrollmentNo: String,
  photoUrl: String,
}, { timestamps: true, strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

const clean = value => String(value ?? "").trim().replace(/\.0$/, "");
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function registrationFromFilename(filename) {
  const base = String(filename || "").split(/[\\/]/).pop() || "";
  const withoutExtension = base.replace(/\.[^.]+$/, "");
  const candidates = withoutExtension.match(/[0-9]{4,}/g) || [];
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
      format: extension === "jpeg" ? "jpg" : extension,
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

async function findStudentPhotoTargets(registrationNo) {
  const suffix = new RegExp("(?:^|[/\\s_-])" + escapeRegex(registrationNo) + "$", "i");
  const numericCode = /^\d+$/.test(registrationNo) ? Number(registrationNo) : null;
  const studentQuery = {
    $or: [
      { regnNo: registrationNo },
      { enrollmentNo: registrationNo },
      { regnNo: suffix },
      { enrollmentNo: suffix },
      ...(numericCode === null ? [] : [{ regnNo: numericCode }, { enrollmentNo: numericCode }]),
    ],
  };
  const students = await Student.find(studentQuery)
    .select("_id regnNo enrollmentNo applicantName").lean();
  const studentIds = students.map(item => item._id);
  const enrollmentQuery = {
    $or: [
      { stCode: registrationNo },
      { stCode: suffix },
      ...(studentIds.length ? [{ legacyStudentId: { $in: studentIds } }] : []),
    ],
  };
  const enrollments = await StudentEnrollment.find(enrollmentQuery)
    .select("_id studentId legacyStudentId stCode").lean();
  const masterIdsFromEnrollments = enrollments.map(item => item.studentId).filter(Boolean);
  const masterQuery = {
    $or: [
      { stCodes: registrationNo },
      { stCodes: suffix },
      ...(studentIds.length ? [{ legacyStudentIds: { $in: studentIds } }] : []),
      ...(masterIdsFromEnrollments.length ? [{ _id: { $in: masterIdsFromEnrollments } }] : []),
    ],
  };
  const masters = await StudentMaster.find(masterQuery)
    .select("_id stCodes legacyStudentIds fullName").lean();

  const uniqueMasterIds = [...new Set(masters.map(item => String(item._id)))];
  if (uniqueMasterIds.length > 1) {
    throw new Error("This registration number matches more than one master student profile. Resolve the duplicate registration mapping before uploading.");
  }
  const master = masters[0] || null;
  const linkedIds = new Map();
  for (const student of students) linkedIds.set(String(student._id), student._id);
  for (const id of master?.legacyStudentIds || []) linkedIds.set(String(id), id);
  for (const enrollment of enrollments) {
    if (enrollment.legacyStudentId) linkedIds.set(String(enrollment.legacyStudentId), enrollment.legacyStudentId);
  }
  const linkedStudents = linkedIds.size
    ? await Student.find({ _id: { $in: [...linkedIds.values()] } }).select("_id regnNo enrollmentNo applicantName").lean()
    : [];
  const hasTarget = Boolean(master || linkedStudents.length || enrollments.length);
  return { master, students: linkedStudents, enrollments, hasTarget };
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

    const summary = { mapped: 0, unmatchedFilenames: [], failedFiles: [], updated: [] };
    for (const file of files) {
      const filename = String(file.name || "unnamed");
      const extension = filename.split(".").pop().toLowerCase();
      if (!["jpg", "jpeg", "png", "webp"].includes(extension) || (file.type && !String(file.type).startsWith("image/"))) {
        summary.failedFiles.push({ filename, reason: "Unsupported image format." });
        continue;
      }
      if (Number(file.size || 0) > 4 * 1024 * 1024) {
        summary.failedFiles.push({ filename, reason: "Image exceeds 4 MB." });
        continue;
      }
      const registrationNo = clean(registrationFromFilename(filename));
      if (!registrationNo) {
        summary.unmatchedFilenames.push(filename);
        continue;
      }

      let targets;
      try {
        targets = await findStudentPhotoTargets(registrationNo);
      } catch (error) {
        summary.failedFiles.push({ filename, regnNo: registrationNo, reason: error.message || "Unable to resolve student." });
        continue;
      }
      if (!targets.hasTarget) {
        summary.unmatchedFilenames.push(filename);
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploaded = await uploadToCloudinary(cloudinary.client, buffer, registrationNo, extension);
        const studentIds = targets.students.map(item => item._id);
        const studentUpdate = studentIds.length
          ? await Student.updateMany({ _id: { $in: studentIds } }, { $set: { photoUrl: uploaded.secure_url } })
          : { matchedCount: 0, modifiedCount: 0 };
        let masterUpdate = { matchedCount: 0, modifiedCount: 0 };
        if (targets.master?._id) {
          masterUpdate = await StudentMaster.updateOne(
            { _id: targets.master._id },
            { $set: { photoUrl: uploaded.secure_url }, $addToSet: { stCodes: registrationNo } }
          );
        }

        const mappedRecords = Number(studentUpdate.matchedCount || 0) + Number(masterUpdate.matchedCount || 0);
        if (!mappedRecords) {
          summary.failedFiles.push({
            filename,
            regnNo: registrationNo,
            reason: "The image reached Cloudinary, but no student record was updated. Check the registration number mapping.",
          });
          continue;
        }
        summary.mapped += 1;
        summary.updated.push({
          filename,
          regnNo: registrationNo,
          studentName: targets.students[0]?.applicantName || targets.master?.fullName || "",
          linkedStudentRecords: Number(studentUpdate.matchedCount || 0),
          masterProfileUpdated: Number(masterUpdate.matchedCount || 0) > 0,
          photoUrl: uploaded.secure_url,
        });
      } catch (error) {
        summary.failedFiles.push({ filename, regnNo: registrationNo, reason: error.message || "Upload or mapping failed." });
      }
    }

    return NextResponse.json({
      message: "Student photo upload and mapping completed.",
      mapped: summary.mapped,
      matchedAndUpdated: summary.mapped,
      unmatchedFilenames: summary.unmatchedFilenames,
      failedFiles: summary.failedFiles,
      updated: summary.updated,
    });
  } catch (error) {
    console.error("[bulk-student-photos]", error?.message || error);
    return NextResponse.json({ error: "Unable to process student photo uploads.", detail: error.message }, { status: 500 });
  }
}
