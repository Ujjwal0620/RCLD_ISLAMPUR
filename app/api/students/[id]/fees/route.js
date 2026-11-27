import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession, roleOfEmployee } from "@/lib/auth";
import Student from "@/models/Student";
import { normalizeStCode } from "@/lib/student-import/normalization";
import { recalculateImportedStudentCodes } from "@/lib/student-import/import-payment-sheet";
import StudentFeePayment from "@/models/StudentFeePayment";
import { normalizeReceiptNumber } from "@/lib/student-import/normalization.mjs";

const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  items: { type: [{ purpose: String, type: String, amount: { type: Number, required: true, min: 0 }, installmentMonth: String }], default: [] },
  date: { type: String, required: true },
  method: { type: String, default: "Cash" },
  reference: String,
  utrNumber: String,
  screenshotUrl: String,
  receiptNo: String,
  authorisedBy: String,
  recordedBy: String,
  note: String,
  paymentType: { type: String, default: "General" },
  installmentMonth: String,
  semester: Number,
}, { _id: true });

const FeeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true, ref: "Student" },
  totalFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  admissionFee: { type: Number, default: 0 },
  registrationFee: { type: Number, default: 0 },
  admissionDate: String,
  currentSemester: Number,
  semesterHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
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
const ReceiptCounterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
const FeeReceiptCounter = mongoose.models.FeeReceiptCounter || mongoose.model("FeeReceiptCounter", ReceiptCounterSchema);

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
  const courseFeeTotal = Math.max(0, Number(record.totalFee || 0));
  const discount = Math.min(courseFeeTotal, Math.max(0, Number(record.discount || 0)));
  const courseFeePayable = Math.max(0, courseFeeTotal - discount);
  const allPayments = record.payments || [];
  const semesterPayments = record.currentSemester
    ? allPayments.filter(payment => Number(payment.semester || 0) === Number(record.currentSemester))
    : allPayments;
  const classifyItem = (item) => {
    const purpose = String(item.purpose || item.type || "").trim().toLowerCase();
    return ["course fee", "admission fee", "installment", "tuition fee"].includes(purpose);
  };
  const paymentItemsForAccounting = (payment) => {
    const stored = Array.isArray(payment.items) ? payment.items : [];
    const hasPurpose = stored.some(item => {
      const purpose = String(item.purpose || item.type || "").trim().toLowerCase();
      return purpose && purpose !== "other";
    });
    if (hasPurpose) return stored;
    const match = String(payment.note || "").match(/Fee sections:\s*([\s\S]*)$/i);
    if (!match) return stored;
    return match[1].split(/;\s*/).map(part => {
      const item = part.match(/^(.*?):\s*₹([\d,.]+)(?:\s*\((.*?)\))?$/);
      return item ? { purpose: item[1].trim(), amount: Number(item[2].replace(/,/g, "")), installmentMonth: item[3] || "" } : null;
    }).filter(Boolean);
  };
  const coursePaidForPayment = (payment) => {
    const items = paymentItemsForAccounting(payment);
    if (items.length) return items.filter(classifyItem).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const type = String(payment.paymentType || "").toLowerCase();
    return ["late fine", "lab charge", "registration fee"].some(label => type.includes(label))
      ? 0
      : Number(payment.amount || 0);
  };
  const coursePaymentsReceived = semesterPayments.reduce((sum, payment) => sum + coursePaidForPayment(payment), 0);
  const paid = Math.min(courseFeeTotal, discount + coursePaymentsReceived);
  const historicalPaid = Math.min(courseFeeTotal, discount + allPayments.reduce((sum, payment) => sum + coursePaidForPayment(payment), 0));
  const totalCollected = semesterPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const separateChargesPaid = Math.max(0, totalCollected - coursePaymentsReceived);
  const due = Math.max(0, courseFeeTotal - paid);
  const lateFine = semesterPayments.reduce((sum, payment) => sum + paymentItemsForAccounting(payment)
    .filter(item => String(item.purpose || item.type || "").toLowerCase() === "late fine")
    .reduce((itemSum, item) => itemSum + Number(item.amount || 0), 0), 0);
  const labCharges = semesterPayments.reduce((sum, payment) => sum + paymentItemsForAccounting(payment)
    .filter(item => String(item.purpose || item.type || "").toLowerCase() === "lab charge")
    .reduce((itemSum, item) => itemSum + Number(item.amount || 0), 0), 0);
  const registrationCharges = semesterPayments.reduce((sum, payment) => sum + paymentItemsForAccounting(payment)
    .filter(item => String(item.purpose || item.type || "").toLowerCase() === "registration fee")
    .reduce((itemSum, item) => itemSum + Number(item.amount || 0), 0), 0);
  return {
    ...record,
    courseFeeTotal,
    tuitionAfterDiscount: courseFeePayable,
    oneTimeFees: Number(record.admissionFee || 0) + Number(record.registrationFee || 0),
    payable: courseFeePayable,
    paid,
    historicalPaid,
    totalCollected,
    separateChargesPaid,
    lateFine,
    labCharges,
    registrationCharges,
    due,
  };
}

export async function GET(request, { params }) {
  try {
    await connectMongoDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid student ID." }, { status: 400 });
    const fee = await StudentFee.findOne({ studentId: id }).lean();
    const student = await Student.findById(id).select("normalizedStCode regnNo enrollmentNo").lean();
    const code = normalizeStCode(student?.normalizedStCode || student?.regnNo || student?.enrollmentNo);
    const variants = [code];
    if (/^\d+$/.test(code)) {
      for (let zeroes = 1; zeroes <= 8; zeroes += 1) variants.push("0".repeat(zeroes) + code);
      variants.push(new RegExp("^\\s*0*" + code + "(?:\\.0+)?\\s*$", "i"));
    }
    const importedPayments = code ? await StudentFeePayment.find({
      $or: [{ normalizedStCode: code }, { stCode: { $in: variants } }]
    }).select("stCode normalizedStCode mrNo normalizedMrNo paymentDate amountPaid updatedAt createdAt").lean() : [];
    const base = feeSummary(fee || { totalFee: 0, discount: 0, admissionFee: 0, registrationFee: 0, payments: [] });
    const legacyReceiptKeys = new Set((fee?.payments || []).map(payment => [
      code, normalizeReceiptNumber(payment.receiptNo || payment.reference),
      String(payment.date || "").slice(0, 10)
    ].join("|")));
    const importedByReceipt = new Map();
    for (const payment of importedPayments) {
      const receipt = normalizeReceiptNumber(payment.normalizedMrNo || payment.mrNo);
      const date = payment.paymentDate ? new Date(payment.paymentDate).toISOString().slice(0, 10) : "";
      const key = [normalizeStCode(payment.normalizedStCode || payment.stCode), receipt || String(payment._id), date].join("|");
      if (receipt && legacyReceiptKeys.has(key)) continue;
      const prior = importedByReceipt.get(key);
      if (!prior || new Date(payment.updatedAt || payment.createdAt || 0) > new Date(prior.updatedAt || prior.createdAt || 0)) importedByReceipt.set(key, payment);
    }
    const importedPaid = [...importedByReceipt.values()].reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
    const legacyCoursePaid = Math.max(0, Number(base.paid || 0) - Number(base.discount || 0));
    const paid = Math.min(Number(base.courseFeeTotal || 0), Number(base.discount || 0) + legacyCoursePaid + importedPaid);
    const due = Math.max(0, Number(base.courseFeeTotal || 0) - paid);
    return NextResponse.json({ fee: {
      ...base, paid, historicalPaid: paid, due,
      totalCollected: Number(base.totalCollected || 0) + importedPaid,
      importedPaymentRows: importedByReceipt.size
    } });
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

    // Give legacy payment records a permanent receipt number on first print.
    if (body.receiptPaymentId) {
      if (!mongoose.Types.ObjectId.isValid(String(body.receiptPaymentId))) {
        return NextResponse.json({ error: "Invalid payment record." }, { status: 400 });
      }
      const existing = await StudentFee.findOne({
        studentId: id,
        "payments._id": body.receiptPaymentId,
      }).lean();
      if (!existing) return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
      const existingPayment = (existing.payments || []).find(
        payment => String(payment._id) === String(body.receiptPaymentId)
      );
      if (existingPayment?.receiptNo) return NextResponse.json({ fee: feeSummary(existing) });
      const counter = await FeeReceiptCounter.findOneAndUpdate(
        { _id: "RCLD-FEE-RECEIPT" },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const receiptNo = "RCLD/ISL/RCPT/" + String(counter.seq).padStart(6, "0");
      const updated = await StudentFee.findOneAndUpdate(
        {
          studentId: id,
          "payments._id": body.receiptPaymentId,
          $or: [
            { "payments.receiptNo": { $exists: false } },
            { "payments.receiptNo": "" },
            { "payments.receiptNo": null }
          ]
        },
        { $set: { "payments.$.receiptNo": receiptNo } },
        { new: true }
      ).lean();
      const latest = updated || await StudentFee.findOne({ studentId: id }).lean();
      return NextResponse.json({ fee: feeSummary(latest) });
    }

    const totalFee = Number(body.totalFee ?? 0);
    const discount = Number(body.discount ?? 0);
    const admissionFee = Number(body.admissionFee ?? 0);
    const registrationFee = Number(body.registrationFee ?? 0);
    if (![totalFee, discount, admissionFee, registrationFee].every(value => Number.isFinite(value) && value >= 0)) {
      return NextResponse.json({ error: "Fee, discount and admission fee must be valid non-negative amounts." }, { status: 400 });
    }

    let paymentUpdate = {};
    if (body.payment) {
      const items = Array.isArray(body.payment.items) ? body.payment.items.map((item) => ({
        purpose: String(item.purpose || item.type || "Other").trim(),
        type: String(item.purpose || item.type || "Other").trim(),
        amount: Number(item.amount),
        installmentMonth: String(item.installmentMonth || "").trim(),
      })) : [];
      const amount = items.length
        ? items.reduce((sum, item) => sum + item.amount, 0)
        : Number(body.payment.amount);
      if (!Number.isFinite(amount) || amount <= 0 || (items.length && items.some((item) => !item.type || !Number.isFinite(item.amount) || item.amount <= 0))) {
        return NextResponse.json({ error: "Add at least one valid fee item with an amount greater than zero." }, { status: 400 });
      }
      if (items.length && Math.abs(amount - Number(body.payment.amount)) > 0.01) {
        return NextResponse.json({ error: "Receipt total does not match the payment item total." }, { status: 400 });
      }
      const counter = await FeeReceiptCounter.findOneAndUpdate({ _id: "RCLD-FEE-RECEIPT" }, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
      const receiptNo = "RCLD/ISL/RCPT/" + String(counter.seq).padStart(6, "0");
      const screenshotUrl = String(body.payment.screenshotUrl || "");
      if (screenshotUrl && !screenshotUrl.startsWith("https://res.cloudinary.com/")) return NextResponse.json({ error: "Payment screenshot must be uploaded to Cloudinary." }, { status: 400 });
      paymentUpdate = {
        $push: {
          payments: {
            receiptNo,
            utrNumber: String(body.payment.utrNumber || "").trim(),
            screenshotUrl,
            recordedBy: actor.name,
            authorisedBy: String(body.payment.authorisedBy || "").trim(),
            amount,
            items,
            date: body.payment.date || new Date().toISOString().slice(0, 10),
            method: body.payment.method || "Cash",
            reference: body.payment.reference || "",
            note: body.payment.note || "",
            paymentType: body.payment.paymentType || "General",
            installmentMonth: body.payment.installmentMonth || "",
            semester: Number((await StudentFee.findOne({ studentId: id }).select("currentSemester").lean())?.currentSemester || 0) || undefined,
          },
        },
      };
    }

    const fee = await StudentFee.findOneAndUpdate(
      { studentId: id },
      {
        $set: { totalFee, discount, admissionFee, registrationFee, admissionDate: body.admissionDate || undefined, updatedBy: actor.name },
        ...paymentUpdate,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    let feeStatusRecalculation = { success: true };
    try {
      const student = await Student.findById(id).select("normalizedStCode regnNo enrollmentNo").lean();
      const code = normalizeStCode(student?.normalizedStCode || student?.regnNo || student?.enrollmentNo);
      if (code) {
        const recalculated = await recalculateImportedStudentCodes([code]);
        feeStatusRecalculation = {
          success: !(recalculated.ambiguousCodes || []).includes(code),
          ambiguousCodes: recalculated.ambiguousCodes || [],
          duplicatePaymentDocumentsFound: recalculated.duplicatePaymentDocumentsFound || 0
        };
      }
    } catch (recalculationError) {
      feeStatusRecalculation = { success: false, error: recalculationError.message };
      console.error("[student-fees] status recalculation failed", recalculationError);
    }
    return NextResponse.json({ fee: feeSummary(fee), feeStatusRecalculation }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to save fee details.", detail: error.message }, { status: 500 });
  }
}
