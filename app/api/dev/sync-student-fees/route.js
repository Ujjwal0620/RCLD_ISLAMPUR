import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";

const StudentSchema = new mongoose.Schema({
  formNo: String,
  applicantName: String,
  courseName: String,
  courseCode: String,
  enrollmentNo: String,
  paymentStatus: mongoose.Schema.Types.Mixed,
  dueAmount: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: String, required: true },
  method: { type: String, default: "" },
  reference: { type: String, default: "" },
  note: { type: String, default: "" },
}, { _id: true });

const FeeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true,
    ref: "Student",
  },
  totalFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  admissionFee: { type: Number, default: 0 },
  payments: { type: [PaymentSchema], default: [] },
  updatedBy: String,
}, { timestamps: true });

const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);

function normalizeCourseCode(student) {
  const raw = String(student.courseCode || student.courseName || "").trim().toUpperCase();

  if (raw.startsWith("DOM")) return "DOM";
  if (raw.startsWith("DCST")) return "DCST";
  if (raw.startsWith("DCA")) return "DCA";
  if (/^SM[-_\s]?/i.test(raw)) return "KIDS";

  return raw;
}

function calculate(fee) {
  const payable = Math.max(
    0,
    Number(fee.totalFee || 0) +
      Number(fee.admissionFee || 0) -
      Number(fee.discount || 0)
  );

  const paid = (fee.payments || []).reduce(
    (sum, payment) => sum + Math.max(0, Number(payment.amount || 0)),
    0
  );

  return {
    payable,
    paid,
    due: Math.max(0, payable - paid),
  };
}

export async function POST(request) {
  try {
    await connectMongoDB();

    const body = await request.json().catch(() => ({}));
    const addDummyPayments = body.addDummyPayments !== false;

    const [students, courses] = await Promise.all([
      Student.find({}).sort({ createdAt: 1, _id: 1 }).lean(),
      Course.find({}).lean(),
    ]);

    const byCode = new Map(
      courses.map((course) => [
        String(course.code || "").toUpperCase(),
        course,
      ])
    );

    const byName = new Map(
      courses.map((course) => [
        String(course.name || "").trim().toLowerCase(),
        course,
      ])
    );

    let synced = 0;
    let paymentsSeeded = 0;
    let unmatched = 0;
    let totalPayable = 0;
    let totalPaid = 0;
    let totalDue = 0;

    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      const code = normalizeCourseCode(student);

      const course =
        byCode.get(code) ||
        byName.get(String(student.courseName || "").trim().toLowerCase());

      if (!course) {
        unmatched += 1;
        continue;
      }

      const existing = await StudentFee.findOne({
        studentId: student._id,
      }).lean();

      const currentPayments = Array.isArray(existing?.payments)
        ? existing.payments
        : [];

      const discount = Math.max(0, Number(existing?.discount || 0));

      let fee = await StudentFee.findOneAndUpdate(
        { studentId: student._id },
        {
          $set: {
            totalFee: Math.max(0, Number(course.fee || 0)),
            admissionFee: Math.max(0, Number(course.admissionFee || 0)),
            discount,
            updatedBy: "course-master-sync",
          },
          $setOnInsert: {
            payments: [],
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      let calc = calculate(fee);

      if (
        addDummyPayments &&
        currentPayments.length === 0 &&
        calc.payable > 0 &&
        index % 5 === 0
      ) {
        const ratios = [0.25, 0.5, 0.75];
        const ratio = ratios[Math.floor(index / 5) % ratios.length];

        const amount = Math.min(
          calc.payable,
          Math.max(500, Math.round((calc.payable * ratio) / 100) * 100)
        );

        fee = await StudentFee.findByIdAndUpdate(
          fee._id,
          {
            $push: {
              payments: {
                amount,
                date: new Date().toISOString().slice(0, 10),
                method: ["Cash", "UPI", "Bank Transfer"][index % 3],
                reference:
                  "DUMMY-PAY-" +
                  String(index + 1).padStart(4, "0"),
                note: "Dummy/demo payment for ERP fee testing",
              },
            },
            $set: {
              updatedBy: "dummy-fee-seed",
            },
          },
          { new: true }
        );

        paymentsSeeded += 1;
        calc = calculate(fee);
      }

      const paymentStatus =
        calc.due <= 0
          ? "Paid"
          : calc.paid > 0
            ? "Partial"
            : "Pending";

      await Student.updateOne(
        { _id: student._id },
        {
          $set: {
            dueAmount: calc.due,
            paymentStatus,
          },
        }
      );

      synced += 1;
      totalPayable += calc.payable;
      totalPaid += calc.paid;
      totalDue += calc.due;
    }

    return NextResponse.json({
      success: true,
      message:
        "Existing student fees synchronized with the current course master. Existing payments were preserved.",
      students: students.length,
      synced,
      paymentsSeeded,
      unmatched,
      totals: {
        payable: totalPayable,
        paid: totalPaid,
        due: totalDue,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to synchronize student fees.",
        detail: error.message,
      },
      { status: 500 }
    );
  }
}
