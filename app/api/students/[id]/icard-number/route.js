import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Student from "@/models/Student";
import IdCardCounter from "@/models/IdCardCounter";
import IdCardIssue from "@/models/IdCardIssue";

export const runtime = "nodejs";

function formatIdCardNumber(number) {
  return `RCLD/ID-NO/${String(number).padStart(4, "0")}`;
}

function issueSnapshot(student, idCardNumber, issuedAt) {
  return {
    idCardNumber,
    studentId: student._id,
    formNo: String(student.formNo || ""),
    applicantName: String(student.applicantName || student.name || ""),
    photoUrl: String(student.photoUrl || ""),
    course: String(student.courseCode || student.courseName || student.course || ""),
    batch: String(student.batchCode || ""),
    mobile: String(student.mobileNumber || student.phone || ""),
    issuedAt,
    status: "Downloaded",
  };
}

export async function POST(request, { params }) {
  let session;
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "download") {
      return NextResponse.json({ error: "An explicit download confirmation is required." }, { status: 400 });
    }

    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      const student = await Student.findById(id).session(session).lean();
      if (!student) {
        const error = new Error("Student not found.");
        error.status = 404;
        throw error;
      }

      const now = new Date();
      let idCardNumber = String(student.idCardNumber || "").trim();
      let issuedAt = student.idIssuedAt || now;
      const firstIssue = !idCardNumber;

      if (firstIssue) {
        await IdCardCounter.updateOne(
          { _id: "student_id_card" },
          { $setOnInsert: { lastIssuedNumber: 0 } },
          { upsert: true, session },
        );
        const counter = await IdCardCounter.findOneAndUpdate(
          { _id: "student_id_card" },
          { $inc: { lastIssuedNumber: 1 } },
          { new: true, session },
        ).lean();
        const nextNumber = Number(counter?.lastIssuedNumber);
        if (!Number.isSafeInteger(nextNumber) || nextNumber < 1) {
          throw new Error("Unable to allocate the next ID-card number.");
        }
        idCardNumber = formatIdCardNumber(nextNumber);
      }

      const update = {
        idCardNumber,
        idCardNo: idCardNumber,
        isIdDownloaded: true,
        isDownloaded: true,
        lastDownloadedAt: now,
      };
      if (firstIssue) update.idIssuedAt = issuedAt;

      const updated = await Student.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, session, runValidators: true },
      ).lean();
      if (!updated) throw new Error("Unable to save the student's ID-card details.");

      const snapshot = issueSnapshot(updated, idCardNumber, issuedAt);
      // Keep status and lastDownloadedAt out of $setOnInsert because they
      // are updated explicitly below. MongoDB rejects updating the same path
      // through both $setOnInsert and $set in one operation.
      const { status: _snapshotStatus, ...insertSnapshot } = snapshot;
      await IdCardIssue.updateOne(
        { studentId: updated._id },
        {
          $setOnInsert: insertSnapshot,
          $set: { lastDownloadedAt: now, status: "Downloaded" },
        },
        { upsert: true, session, setDefaultsOnInsert: true },
      );

      result = {
        idCardNumber,
        idCardNo: idCardNumber,
        isIdDownloaded: true,
        isDownloaded: true,
        idIssuedAt: issuedAt,
        lastDownloadedAt: now,
        student: updated,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[student-icard-download-confirm]", error);
    return NextResponse.json(
      { error: error.message === "Student not found." ? error.message : "Unable to confirm and save the ID-card download." },
      { status: error.status || (error.code === 11000 ? 409 : 500) },
    );
  } finally {
    if (session) await session.endSession();
  }
}
