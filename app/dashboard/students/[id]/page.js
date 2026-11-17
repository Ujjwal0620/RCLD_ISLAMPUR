"use client";

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
import useStudentProfile from "@/features/students/hooks/useStudentProfile";
import RCLDLogo from "@/components/RCLDLogo";
import indiaLocations from "@/lib/indiaStatesDistricts.json";
import { isIcardEligible } from "@/features/students/utils/studentProfile";
import { formatDisplayValue as value } from "@/lib/formatters";
export default function StudentDetailsPage({ params }) {
  const {
    student, setStudent, error, loading, fee, courses, batches, referrals, attendance,
    feeForm, setFeeForm, paymentItems, setPaymentItems, proofUploading,
    feeWorkspaceOpen, setFeeWorkspaceOpen, attForm, setAttForm, message, setMessage,
    editing, setEditing, editForm, setEditForm, history, setHistory, contactLogs,
    transition, setTransition, transitioning, setTransitioning, icardDialogOpen,
    setIcardDialogOpen, semesterBusy, updateCfkSemester, saveStudent, deleteStudent,
    saveFees, uploadPaymentProof, printStudentICard, printStudentForm, printBill,
    saveAttendance,
  } = useStudentProfile(params);

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
