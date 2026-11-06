import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession, roleOfEmployee } from "@/lib/auth";

const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: String, required: true },
  method: { type: String, default: "Cash" },
  reference: String,
  note: String,
  paymentType: { type: String, default: "General" },
  installmentMonth: String,
}, { _id: true });

const FeeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true, ref: "Student" },
  totalFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  admissionFee: { type: Number, default: 0 },
  payments: { type: [PaymentSchema], default: [] },
  updatedBy: String,
}, { timestamps: true });

const EmployeeSchema = new mongoose.Schema({
  employeeId: String,
  name: String,
  designation: String,
  department: String,
  status: String,
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);

async function getFeeActor() {
  const session = await getSession();
  if (!session?.sub) return null;

  // The configured Super Admin account can exist without an Employee document.
  if (session.role === "superadmin" || String(session.sub) === "superadmin") {
    return { role: "superadmin", name: session.name || "Super Admin" };
  }

  if (!mongoose.Types.ObjectId.isValid(String(session.sub))) return null;
  const employee = await Employee.findById(session.sub).select("employeeId name designation department status").lean();
  if (!employee || employee.status === "Inactive") return null;

  return {
    role: roleOfEmployee(employee),
    name: employee.name || employee.employeeId || "Employee",
  };
}

function feeSummary(record) {
  const payable = Math.max(0, Number(record.totalFee || 0) + Number(record.admissionFee || 0) - Number(record.discount || 0));
  const paid = (record.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return { ...record, payable, paid, due: Math.max(0, payable - paid) };
}

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    const fee = await StudentFee.findOne({ studentId: id }).lean();
    return NextResponse.json({ fee: feeSummary(fee || { totalFee: 0, discount: 0, admissionFee: 0, payments: [] }) });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load fee details.", detail: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    await connectMongoDB();

    const actor = await getFeeActor();
    if (!actor) return NextResponse.json({ error: "Please sign in to update student fees." }, { status: 401 });
    if (!["superadmin", "office-admin"].includes(actor.role)) {
      return NextResponse.json({ error: "Only Super Admin or Office Admin can update student fees." }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });

    const body = await request.json();
    const totalFee = Number(body.totalFee ?? 0);
    const discount = Number(body.discount ?? 0);
    const admissionFee = Number(body.admissionFee ?? 0);
    if (![totalFee, discount, admissionFee].every(value => Number.isFinite(value) && value >= 0)) {
      return NextResponse.json({ error: "Fee, discount and admission fee must be valid non-negative amounts." }, { status: 400 });
    }

    let paymentUpdate = {};
    if (body.payment) {
      const amount = Number(body.payment.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Enter a payment amount greater than zero." }, { status: 400 });
      }
      paymentUpdate = {
        $push: {
          payments: {
            amount,
            date: body.payment.date || new Date().toISOString().slice(0, 10),
            method: body.payment.method || "Cash",
            reference: body.payment.reference || "",
            note: body.payment.note || "",
            paymentType: body.payment.paymentType || "General",
            installmentMonth: body.payment.installmentMonth || "",
          },
        },
      };
    }

    const fee = await StudentFee.findOneAndUpdate(
      { studentId: id },
      {
        $set: { totalFee, discount, admissionFee, updatedBy: actor.name },
        ...paymentUpdate,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ fee: feeSummary(fee) }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to save fee details.", detail: error.message }, { status: 500 });
  }
}
