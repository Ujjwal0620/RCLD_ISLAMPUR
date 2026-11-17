"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  UserRound,
  Pencil,
  Trash2,
  Printer,
  IdCard,
} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import CodingForKidsSemesterPanel from "@/components/students/profile/CodingForKidsSemesterPanel";
import CodingForKidsIcardDialog from "@/components/students/profile/CodingForKidsIcardDialog";
import StudentEditPanel from "@/components/students/profile/StudentEditPanel";
import StudentFeeWorkspace from "@/components/students/profile/StudentFeeWorkspace";
import StudentAttendanceSection from "@/components/students/profile/StudentAttendanceSection";
import StudentQualificationSection from "@/components/students/profile/StudentQualificationSection";
import StudentTransitionPanel from "@/components/students/profile/StudentTransitionPanel";
import StudentContactHistory from "@/components/students/profile/StudentContactHistory";
import StudentSummaryCards from "@/components/students/profile/StudentSummaryCards";
import StudentPersonalDetails from "@/components/students/profile/StudentPersonalDetails";
import StudentAcademicDetails from "@/components/students/profile/StudentAcademicDetails";
import useStudentPrint from "@/features/students/hooks/useStudentPrint";
import RCLDLogo from "@/components/RCLDLogo";
import indiaLocations from "@/lib/indiaStatesDistricts.json";
import { isIcardEligible } from "@/features/students/utils/studentProfile";
import { formatDisplayValue as value } from "@/lib/formatters";
export default function StudentDetailsPage({ params }) {
  const [student, setStudent] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [fee, setFee] = useState(null),
    [courses, setCourses] = useState([]),
    [batches, setBatches] = useState([]),
    [referrals, setReferrals] = useState([]),
    [attendance, setAttendance] = useState({
      records: [],
      summary: { total: 0, present: 0, absent: 0, leave: 0, percentage: 0 },
    });
  const [feeForm, setFeeForm] = useState({
    totalFee: "",
    discount: "",
    admissionFee: "",
    registrationFee: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "Cash",
    reference: "",
    utrNumber: "",
    screenshotUrl: "",
    note: "",
    paymentType: "Installment",
    installmentMonth: "",
  });
  const [paymentItems, setPaymentItems] = useState(() => [
    { id: "payment-line-1", purpose: "Course Fee", amount: "", installmentMonth: "" },
    ...(new Date().getDate() > 10
      ? [{ id: "late-fine-initial", purpose: "Late Fine", amount: "50", installmentMonth: "" }]
      : []),
  ]);
  const [proofUploading, setProofUploading] = useState(false);
  const [feeWorkspaceOpen, setFeeWorkspaceOpen] = useState(false);
  const [attForm, setAttForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    status: "Present",
    subject: "",
    batch: "",
    note: "",
  });
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [history, setHistory] = useState([]),
    [contactLogs, setContactLogs] = useState([]);
  const [transition, setTransition] = useState({ action: "", batchId: "", remark: "" });
  const [transitioning, setTransitioning] = useState(false);
  const [icardDialogOpen, setIcardDialogOpen] = useState(false);
  const [semesterBusy, setSemesterBusy] = useState(false);

  async function loadOperational(id) {
    const [fr, ar] = await Promise.all([
      fetch("/api/students/" + id + "/fees", { cache: "no-store" }),
      fetch("/api/students/" + id + "/attendance", { cache: "no-store" }),
    ]);
    const [fj, aj] = await Promise.all([fr.json(), ar.json()]);
    if (fr.ok) {
      setFee(fj.fee);
      setFeeForm((f) => ({
        ...f,
        totalFee: f.totalFee || fj.fee.totalFee || "",
        discount: f.discount || fj.fee.discount || "",
        admissionFee: f.admissionFee || fj.fee.admissionFee || "",
        registrationFee: f.registrationFee || fj.fee.registrationFee || "",
      }));
    }
    if (ar.ok) setAttendance(aj);
  }

  async function updateCfkSemester(action) {
    if (!student || semesterBusy) return;
    setSemesterBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/students/" + student._id + "/semester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update the semester.");
      const studentResponse = await fetch("/api/students/" + student._id, { cache: "no-store" });
      const studentData = await studentResponse.json();
      await loadOperational(student._id);
      if (studentResponse.ok) {
        setStudent(studentData.student);
        setEditForm(studentData.student);
      }
      setMessage(data.message || "Coding for Kids semester updated.");
    } catch (error) {
      setMessage(error.message || "Unable to update the semester.");
    } finally {
      setSemesterBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [courseResponse, batchResponse, referralResponse] = await Promise.all([
          fetch("/api/courses", { cache: "no-store" }),
          fetch("/api/batches", { cache: "no-store" }),
          fetch("/api/referrals", { cache: "no-store" }),
        ]);
        const [courseData, batchData, referralData] = await Promise.all([
          courseResponse.json(),
          batchResponse.json(),
          referralResponse.json(),
        ]);
        setCourses(courseData.courses || []);
        setBatches(batchData.batches || []);
        setReferrals((referralData.referrals || []).filter((x) => x.status === "Active"));
        const { id } = await params;
        const r = await fetch("/api/students/" + id, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Unable to load student.");
        setStudent(d.student);
        setEditForm(d.student);
        const hr = await fetch("/api/students/" + id + "/batch-history", { cache: "no-store" });
        const hd = await hr.json();
        if (hr.ok) setHistory(hd.history || []);
        const cr = await fetch("/api/students/" + id + "/contact-log", { cache: "no-store" });
        const cd = await cr.json();
        if (cr.ok) setContactLogs(cd.logs || []);
        if (new URLSearchParams(window.location.search).get("edit") === "1") setEditing(true);
        await loadOperational(id);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  async function saveStudent(e) {
    e.preventDefault();
    setMessage("");
    const r = await fetch("/api/students/" + student._id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        permanentAddress: editForm.sameAsPresentAddress
          ? editForm.presentAddress || editForm.address || ""
          : editForm.permanentAddress,
      }),
    });
    const d = await r.json();
    if (!r.ok) return setMessage(d.error || "Unable to update student.");
    const fr = await fetch("/api/students/" + student._id + "/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalFee: feeForm.totalFee,
        discount: feeForm.discount || 0,
        admissionFee: feeForm.admissionFee,
        registrationFee: feeForm.registrationFee,
        lateFine:
          Number(fee?.lateFine || 0) +
          paymentItems
            .filter((item) => item.purpose === "Late Fine")
            .reduce((sum, item) => sum + Number(item.amount || 0), 0),
        admissionDate: student.admissionDate,
      }),
    });
    const fd = await fr.json();
    if (!fr.ok) return setMessage(fd.error || "Student saved, but fee mapping failed.");
    setFee(fd.fee);
    setStudent(d.student);
    setEditForm(d.student);
    setEditing(false);
    setMessage("Student profile and course fee mapping updated successfully.");
  }

  async function deleteStudent() {
    if (!confirm("Permanently delete this student from the database? This cannot be undone."))
      return;
    const r = await fetch("/api/students/" + student._id, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return setMessage(d.error || "Unable to archive student.");
    window.location.href = "/dashboard/students";
  }

  async function saveFees(e) {
    e.preventDefault();
    setMessage("");
    if (!student) return;
    const r = await fetch("/api/students/" + student._id + "/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalFee: feeForm.totalFee,
        discount: feeForm.discount,
        admissionFee: feeForm.admissionFee,
        registrationFee: feeForm.registrationFee,
        admissionDate: student.admissionDate,
        payment: paymentItems.some((item) => Number(item.amount) > 0)
          ? {
              amount: paymentItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
              date: feeForm.date,
              method: feeForm.method,
              reference: feeForm.reference,
              utrNumber: feeForm.utrNumber,
              screenshotUrl: feeForm.screenshotUrl,
              note: [
                feeForm.note,
                "Fee sections: " +
                  paymentItems
                    .filter((item) => Number(item.amount) > 0)
                    .map(
                      (item) =>
                        `${item.purpose}: ₹${Number(item.amount).toLocaleString("en-IN")}${
                          item.installmentMonth ? ` (${item.installmentMonth})` : ""
                        }`,
                    )
                    .join("; "),
              ]
                .filter(Boolean)
                .join(" | "),
              paymentType:
                paymentItems.length > 1
                  ? "Multiple Sections"
                  : paymentItems[0]?.purpose || feeForm.paymentType,
              installmentMonth:
                paymentItems.find((item) => item.installmentMonth)?.installmentMonth ||
                feeForm.installmentMonth,
              items: paymentItems
                .filter((item) => Number(item.amount) > 0)
                .map(({ purpose, amount, installmentMonth }) => ({
                  purpose,
                  amount: Number(amount),
                  installmentMonth,
                })),
            }
          : undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error || "Unable to save fees.");
      return;
    }
    setFee(d.fee);
    setFeeForm((f) => ({
      ...f,
      amount: "",
      reference: "",
      utrNumber: "",
      screenshotUrl: "",
      note: "",
    }));
    setPaymentItems([
      { id: `payment-line-${Date.now()}`, purpose: "Course Fee", amount: "", installmentMonth: "" },
    ]);
    setMessage("Fee information saved.");
  }

  async function uploadPaymentProof(file) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "payment-proof");
      const r = await fetch("/api/uploads/student-photo", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to upload screenshot.");
      setFeeForm((f) => ({ ...f, screenshotUrl: d.url }));
    } catch (e) {
      setMessage(e.message);
    } finally {
      setProofUploading(false);
    }
  }

  const { printStudentICard, printStudentForm, printBill } = useStudentPrint({
    student,
    fee,
    courses,
    setMessage,
  });

  async function saveAttendance(e) {
    e.preventDefault();
    setMessage("");
    if (!student) return;
    const r = await fetch("/api/students/" + student._id + "/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attForm),
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error || "Unable to save attendance.");
      return;
    }
    const ar = await fetch("/api/students/" + student._id + "/attendance", { cache: "no-store" });
    setAttendance(await ar.json());
    setMessage("Attendance saved.");
  }

  return (
    <ERPLayout active="/dashboard/students">
      <style jsx global>{`
        .cfk-dialog-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,20,35,.62);backdrop-filter:blur(5px)}
        .cfk-dialog{width:min(100%,460px);background:var(--panel-bg,#fff);color:var(--text-primary,#172033);border:1px solid var(--border-color,#e3e8ef);border-radius:18px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.28)}
        .cfk-dialog-heading{display:flex;align-items:center;gap:13px;position:relative;padding-right:25px}
        .cfk-dialog-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:rgba(37,99,235,.1);color:#2563eb;flex:none}
        .cfk-dialog-heading h2{margin:0;font-size:19px;font-weight:750}.cfk-dialog-heading p{margin:5px 0 0;font-size:13px;opacity:.72}
        .cfk-dialog-close{position:absolute;right:-8px;top:-8px;border:0;background:transparent;font-size:27px;line-height:1;cursor:pointer;color:inherit}
        .cfk-dialog-student{display:flex;justify-content:space-between;gap:12px;margin:22px 0 18px;padding:12px 14px;border:1px solid var(--border-color,#e3e8ef);border-radius:11px;background:rgba(127,127,127,.045);font-size:13px}
        .cfk-dialog-student span{opacity:.7;text-align:right}.cfk-dialog-current-semester{display:flex;flex-direction:column;gap:5px;padding:14px 16px;border:1px solid var(--border-color,#d7deea);border-radius:12px;background:var(--panel-bg,#f8f9fc)}.cfk-dialog-current-semester>span{font-size:12px;opacity:.7}.cfk-dialog-current-semester strong{font-size:22px}.cfk-dialog-current-semester small{font-size:12px;opacity:.75}
        .cfk-dialog-note{margin-top:12px;font-size:12px;line-height:1.5;opacity:.7}
        .cfk-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}
        @media(max-width:520px){.cfk-dialog{padding:19px}.cfk-dialog-student{flex-direction:column;gap:4px}.cfk-dialog-student span{text-align:left}}
      `}</style>
      <header className="topbar">
        <div>
          <div className="crumb">Students / Student Details</div>
          <h1>{student?.applicantName || "Student Details"}</h1>
        </div>
        <div className="top-actions">
          {student && (
            <>
              <button className="ghost-btn" onClick={printStudentForm}>
                <Printer size={16} /> Print Registration Form
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  const courseText = String(student.courseName || student.courseCode || "");
                  if (/coding\s*for\s*kids|\bCFK\b|\bKIDS\b/i.test(courseText)) {
                    setIcardDialogOpen(true);
                  } else {
                    printStudentICard();
                  }
                }}
                disabled={!isIcardEligible(student)}
                title={
                  !isIcardEligible(student)
                    ? "Complete all required details and clear Admission Pending status first"
                    : "Print student I-Card"
                }
              >
                <IdCard size={16} /> Print I-Card
              </button>
              <button className="ghost-btn" onClick={() => printBill()}>
                <Printer size={16} /> Print Fee Receipt
              </button>
              <button className="ghost-btn" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Edit
              </button>
              <button className="ghost-btn" onClick={deleteStudent}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
          <a className="ghost-btn" href="/dashboard/students">
            <ArrowLeft size={17} /> Back
          </a>
        </div>
      </header>
      {loading && (
        <section className="panel">
          <div className="empty">Loading student details…</div>
        </section>
      )}
      {error && (
        <section className="panel">
          <div className="empty error-text">{error}</div>
        </section>
      )}
      {student && (
        <main className="student-details student-profile-page">
          <CodingForKidsSemesterPanel
            student={student}
            courses={courses}
            semesterBusy={semesterBusy}
            onUpdateSemester={updateCfkSemester}
          />
          <CodingForKidsIcardDialog
            open={icardDialogOpen}
            student={student}
            onClose={() => setIcardDialogOpen(false)}
            onPrint={() => {
              setIcardDialogOpen(false);
              printStudentICard();
            }}
          />
          <StudentEditPanel
            editing={editing}
            setEditing={setEditing}
            student={student}
            editForm={editForm}
            setEditForm={setEditForm}
            courses={courses}
            batches={batches}
            referrals={referrals}
            saveStudent={saveStudent}
            indiaLocations={indiaLocations}
          />
          <section className="student-profile-card student-profile-hero">
            <div className="student-profile-brand">
              <RCLDLogo className="student-profile-logo" />
          <div>
                <span>RASHTRIYA COMPUTER LITERACY DRIVE</span>
                <strong>STUDENT PROFILE</strong>
                <small>RCLD ISLAMPUR EDUCATION ERP</small>
              </div>
            </div>
            <div className="student-avatar">
              {student.photoUrl ? <img src={student.photoUrl} alt="" /> : <UserRound size={30} />}
            </div>
            <div className="student-profile-identity">
              <div className="eyebrow">STUDENT RECORD / REGISTRATION</div>
              <h2>{student.applicantName}</h2>
              <p>
                Form No. {value(student.formNo)} · {value(student.courseName)} ·{" "}
                {value(student.mobileNumber)}
              </p>
            </div>
            <span className="badge profile-status">{value(student.status)}</span>
          </section>
          <StudentTransitionPanel
            student={student} batches={batches} history={history} setHistory={setHistory}
            editForm={editForm} setEditForm={setEditForm} setStudent={setStudent}
            transition={transition} setTransition={setTransition}
            transitioning={transitioning} setTransitioning={setTransitioning} setMessage={setMessage}
          />
          <StudentContactHistory contactLogs={contactLogs} />
          <StudentSummaryCards fee={fee} attendance={attendance} student={student} value={value} />
          <StudentPersonalDetails student={student} />
          <StudentAcademicDetails student={student} />
          <StudentFeeWorkspace
            student={student}
            fee={fee}
            value={value}
            feeWorkspaceOpen={feeWorkspaceOpen}
            setFeeWorkspaceOpen={setFeeWorkspaceOpen}
            feeForm={feeForm}
            setFeeForm={setFeeForm}
            paymentItems={paymentItems}
            setPaymentItems={setPaymentItems}
            saveFees={saveFees}
            proofUploading={proofUploading}
            uploadPaymentProof={uploadPaymentProof}
            printBill={printBill}
          />
          <StudentAttendanceSection
            attendance={attendance}
            attForm={attForm}
            setAttForm={setAttForm}
            saveAttendance={saveAttendance}
          />
          <StudentQualificationSection student={student} />
          {message && <div className="success-msg">{message}</div>}
        </main>
      )}
    </ERPLayout>
  );
}
