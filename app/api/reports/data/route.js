import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Batch from "@/models/Batch";
import EmployeeAttendance from "@/models/EmployeeAttendance";
import BackOfficeTask from "@/models/BackOfficeTask";

const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
const FeeSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, totalFee: Number, discount: Number, admissionFee: Number, registrationFee: Number, payments: Array }, { strict: false, timestamps: true });
const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);
const EmployeeSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
const StudentAttendanceSchema = new mongoose.Schema({ studentId: mongoose.Schema.Types.ObjectId, date: String, status: String, subject: String, batch: String, note: String, markedBy: String }, { strict: false, timestamps: true });
const StudentAttendance = mongoose.models.StudentAttendance || mongoose.model("StudentAttendance", StudentAttendanceSchema);

const money = value => Math.round(Number(value || 0) * 100) / 100;
const inRange = (value, from, to) => {
  if (!value) return true;
  const date = String(value).slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
};
const dateFilter = (from, to) => {
  const filter = {};
  if (from || to) filter.createdAt = { ...(from ? { $gte: new Date(from + "T00:00:00.000Z") } : {}), ...(to ? { $lte: new Date(to + "T23:59:59.999Z") } : {}) };
  return filter;
};

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["superadmin", "office-admin", "admin"].includes(session.role)) return NextResponse.json({ error: "Management reports are restricted." }, { status: 403 });
  try {
    await connectMongoDB();
    const q = new URL(request.url).searchParams;
    const type = q.get("type") || "overview";
    const from = q.get("from") || "";
    const to = q.get("to") || "";
    const course = q.get("course") || "";
    const batchId = q.get("batchId") || "";
    const [studentsAll, batches, employees, fees] = await Promise.all([
      Student.find(dateFilter(from, to)).sort({ createdAt: -1 }).lean(),
      Batch.find(batchId && mongoose.Types.ObjectId.isValid(batchId) ? { _id: batchId } : {}).sort({ createdAt: -1 }).lean(),
      Employee.find({ status: { $ne: "Inactive" } }).select("-password -bankName -accountNumber -ifsc").sort({ name: 1 }).lean(),
      StudentFee.find().lean()
    ]);
    const students = studentsAll.filter(s => (!course || (s.courseCode || s.courseName) === course));
    const feeMap = new Map(fees.map(f => [String(f.studentId), f]));
    const feeRows = students.map(s => {
      const f = feeMap.get(String(s._id)) || {};
      const payable = Math.max(0, money(f.totalFee) - money(f.discount) + money(f.admissionFee) + money(f.registrationFee));
      const payments = (f.payments || []).map(p => ({ ...p, amount: money(p.amount) }));
      const paid = money(payments.reduce((sum, p) => sum + p.amount, 0));
      return { studentId: String(s._id), formNo: s.formNo || "", name: s.applicantName || "", course: s.courseCode || s.courseName || "", batch: s.batchCode || "", payable, paid, due: Math.max(0, money(payable - paid)), payments };
    });
    const finance = feeRows.reduce((a, r) => ({ payable: a.payable + r.payable, collected: a.collected + r.paid, due: a.due + r.due }), { payable: 0, collected: 0, due: 0 });
    const courseMap = {}, statusMap = {};
    for (const s of students) { const c = s.courseCode || s.courseName || "Unspecified"; courseMap[c] = (courseMap[c] || 0) + 1; const st = s.status || "Unknown"; statusMap[st] = (statusMap[st] || 0) + 1; }
    let rows = [], summary = {}, notes = [];
    if (type === "overview" || type === "students") {
      rows = students.map(s => ({ formNo: s.formNo || "", enrollmentNo: s.enrollmentNo || "", name: s.applicantName || "", mobile: s.mobileNumber || "", course: s.courseCode || s.courseName || "", batch: s.batchCode || "", status: s.status || "", admissionDate: s.admissionDate || "", registeredOn: s.createdAt || "" }));
      summary = { records: rows.length, active: students.filter(s => s.status === "Active").length, pending: students.filter(s => ["Registered", "Admission Pending"].includes(s.status)).length, dropped: students.filter(s => s.status === "Dropped Out").length };
    } else if (type === "fees") {
      rows = feeRows.map(({ payments, ...row }) => row);
      summary = { students: rows.length, payable: money(finance.payable), collected: money(finance.collected), due: money(finance.due), collectionRate: finance.payable ? money(finance.collected / finance.payable * 100) : 0 };
      notes.push("Fee due is calculated from tuition minus discount plus admission and registration fees, less recorded payments. Late fines are not included in this report.");
    } else if (type === "collections") {
      rows = feeRows.flatMap(r => r.payments.map(p => ({ formNo: r.formNo, student: r.name, course: r.course, amount: p.amount, date: p.date || "", method: p.method || "", receiptNo: p.receiptNo || "", paymentType: p.paymentType || "", recordedBy: p.recordedBy || "" }))).filter(r => inRange(r.date, from, to)).sort((a,b) => String(b.date).localeCompare(String(a.date)));
      summary = { transactions: rows.length, collected: money(rows.reduce((n,r)=>n+r.amount,0)) };
    } else if (type === "batches") {
      rows = batches.map(b => { const roster = studentsAll.filter(s => String(s.batchId || "") === String(b._id) || (!s.batchId && s.batchCode === b.batchCode)); return { batchCode: b.batchCode || "", name: b.name || "", course: b.courseCode || b.courseName || "", status: b.status || "", faculty: b.facultyName || (b.facultyNames || []).join(", "), capacity: Number(b.capacity || 0), students: roster.length, utilization: b.capacity ? money(roster.length / b.capacity * 100) : 0 }; });
      summary = { batches: rows.length, assignedStudents: rows.reduce((n,r)=>n+r.students,0), capacity: rows.reduce((n,r)=>n+r.capacity,0) };
    } else if (type === "employees") {
      rows = employees.map(e => ({ employeeId: e.employeeId || "", name: e.name || "", designation: e.designation || "", department: e.department || "", mobile: e.mobile || "", status: e.status || "", joiningDate: e.joiningDate || "", skills: (e.skills || []).join(", ") }));
      summary = { employees: rows.length, faculty: employees.filter(e => /faculty|teacher|trainer/i.test((e.designation || "") + " " + (e.department || ""))).length };
    } else if (type === "student-attendance") {
      const attendance = await StudentAttendance.find({ date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } }).sort({ date: -1 }).lean();
      const studentMap = new Map(studentsAll.map(s => [String(s._id), s]));
      rows = attendance.filter(a => studentMap.has(String(a.studentId))).map(a => { const s = studentMap.get(String(a.studentId)); return { date: a.date || "", student: s.applicantName || "", formNo: s.formNo || "", course: s.courseCode || s.courseName || "", batch: a.batch || s.batchCode || "", subject: a.subject || "", status: a.status || "", markedBy: a.markedBy || "" }; });
      summary = { records: rows.length, present: rows.filter(r => r.status === "Present").length, absent: rows.filter(r => r.status === "Absent").length, leave: rows.filter(r => r.status === "Leave").length };
    } else if (type === "employee-attendance") {
      const attendance = await EmployeeAttendance.find({ ...(from || to ? { date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}) }).sort({ date: -1 }).lean();
      const employeeMap = new Map(employees.map(e => [String(e._id), e]));
      rows = attendance.filter(a => employeeMap.has(String(a.employeeId))).map(a => { const e = employeeMap.get(String(a.employeeId)); return { date: a.date || "", employeeId: e.employeeId || "", employee: e.name || "", status: a.status || "", punchIn: a.punchIn || "", punchOut: a.punchOut || "", workMinutes: Number(a.workMinutes || 0), totalMinutes: Number(a.totalMinutes || 0), breakMinutes: (a.breaks || []).reduce((n,x)=>n+Number(x.minutes||0),0), outMinutes: (a.outTimes || []).reduce((n,x)=>n+Number(x.minutes||0),0) }; });
      summary = { records: rows.length, present: rows.filter(r => r.status === "Present").length, absent: rows.filter(r => r.status === "Absent").length, totalWorkMinutes: rows.reduce((n,r)=>n+r.workMinutes,0) };
    } else if (type === "tasks") {
      const tasks = await BackOfficeTask.find(dateFilter(from,to)).sort({ taskDate: -1 }).lean();
      rows = tasks.map(t => ({ date: t.taskDate || "", title: t.title || "", type: t.taskType || "", workArea: t.workArea || "", assignedTo: t.assignments?.map(a=>a.employeeName).join(", ") || t.assignedToName || "", startTime: t.startTime || "", endTime: t.endTime || "", status: t.status || "" }));
      summary = { tasks: rows.length, completed: rows.filter(r=>r.status==="Completed").length, pending: rows.filter(r=>r.status!=="Completed").length };
    } else {
      return NextResponse.json({ error: "This report is not connected to a verified live data source yet.", code: "REPORT_NOT_IMPLEMENTED", supportedTypes: ["overview","students","fees","collections","batches","employees","student-attendance","employee-attendance","tasks"] }, { status: 501 });
    }
    return NextResponse.json({ type, generatedAt: new Date().toISOString(), filters: { from, to, course, batchId }, summary: Object.fromEntries(Object.entries(summary).map(([k,v]) => [k, typeof v === "number" ? money(v) : v])), rows, charts: { courses: Object.entries(courseMap).map(([name,value])=>({name,value})), statuses: Object.entries(statusMap).map(([name,value])=>({name,value})) }, notes, totals: { students: students.length, batches: batches.length, employees: employees.length } });
  } catch (error) {
    console.error("Report generation failed:", error);
    return NextResponse.json({ error: "Unable to generate report from live ERP data.", detail: error.message }, { status: 500 });
  }
}
