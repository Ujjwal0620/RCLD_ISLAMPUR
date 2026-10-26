import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  date: { type: String, required: true },
  method: { type: String, default: "Cash" },
  reference: String,
  note: String,
}, { _id: true });

const FeeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true, ref: "Student" },
  totalFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  admissionFee: { type: Number, default: 0 },
  payments: { type: [PaymentSchema], default: [] },
  updatedBy: String,
}, { timestamps: true });

const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    const fee = await StudentFee.findOne({ studentId: id }).lean();
    const record = fee || { totalFee: 0, discount: 0, admissionFee: 0, payments: [] };
    const payable = Math.max(0, Number(record.totalFee || 0) - Number(record.discount || 0));
    const paid = (record.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return NextResponse.json({ fee: { ...record, payable, paid, due: Math.max(0, payable - paid) } });
  } catch (error) {
    return NextResponse.json({ error: "Unable to load fee details.", detail: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    const body = await request.json();
    const fee = await StudentFee.findOneAndUpdate(
      { studentId: id },
      {
        $set: {
          totalFee: Math.max(0, Number(body.totalFee || 0)),
          discount: Math.max(0, Number(body.discount || 0)),
          admissionFee: Math.max(0, Number(body.admissionFee || 0)),
          updatedBy: body.updatedBy || "superadmin",
        },
        ...(body.payment ? { $push: { payments: {
          amount: Math.max(0, Number(body.payment.amount || 0)),
          date: body.payment.date || new Date().toISOString().slice(0,10),
          method: body.payment.method || "Cash",
          reference: body.payment.reference || "",
          note: body.payment.note || "",
        } } } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const payable = Math.max(0, Number(fee.totalFee || 0) - Number(fee.discount || 0));
    const paid = (fee.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return NextResponse.json({ fee: { ...fee, payable, paid, due: Math.max(0, payable - paid) } }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to save fee details.", detail: error.message }, { status: 500 });
  }
}
