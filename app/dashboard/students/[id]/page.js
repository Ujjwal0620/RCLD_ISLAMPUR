"use client";

import ERPLayout from "@/components/ERPLayout";
import StudentProfileStyles from "@/components/students/profile/StudentProfileStyles";
import StudentProfileHeader from "@/components/students/profile/StudentProfileHeader";
import StudentProfileHero from "@/components/students/profile/StudentProfileHero";
import StudentIdentityHistory from "@/components/students/profile/StudentIdentityHistory";
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
import indiaLocations from "@/lib/indiaStatesDistricts.json";
import { isIcardEligible } from "@/features/students/utils/studentProfile";
import { isCodingForKidsCourse } from "@/lib/student-icard/courseRouting.mjs";
import { formatDisplayValue as value } from "@/lib/formatters";
import { useEffect, useState } from "react";
import { useErpCache, useErpToast } from "@/components/providers/ERPUIProvider";

export default function StudentDetailsPage({ params }) {
  const {
    student, setStudent, error, loading, fee, courses, batches, referrals, attendance,
    feeForm, setFeeForm, paymentItems, setPaymentItems, proofUploading,
    feeWorkspaceOpen, setFeeWorkspaceOpen, attForm, setAttForm, message, setMessage,
    editing, setEditing, editForm, setEditForm, history, setHistory, contactLogs,
    transition, setTransition, transitioning, setTransitioning, icardDialogOpen,
    setIcardDialogOpen, semesterBusy, updateCfkSemester, saveStudent, deleteStudent,
    saveFees, uploadPaymentProof, uploadStudentPhoto, photoUploading, printStudentICard, printStudentForm, printBill,
    saveAttendance,
  } = useStudentProfile(params);
  const [icardOutputMode, setIcardOutputMode] = useState("print");
  const [activeTab, setActiveTab] = useState("overview");
  const notify = useErpToast();
  const { invalidate } = useErpCache();

  useEffect(() => {
    if (!message) return;
    const failed = /unable|failed|error|cannot|could not/i.test(message);
    notify(message, failed ? "error" : "success");
    if (!failed) invalidate(["students:", "student-detail:", "student-fees:", "dashboard-stats", "batches:"]);
  }, [message, notify, invalidate]);

  return (
    <ERPLayout active="/dashboard/students">
      <StudentProfileStyles />
      <StudentProfileHeader
        student={student}
        printStudentForm={printStudentForm}
        onDownloadIcardJpg={() => {
          if (isCodingForKidsCourse(student)) {
            setIcardOutputMode("jpg");
            setIcardDialogOpen(true);
          } else {
            printStudentICard("", "jpg");
          }
        }}
        onPrintIcard={() => {
          if (isCodingForKidsCourse(student)) {
            setIcardOutputMode("print");
            setIcardDialogOpen(true);
          } else {
            printStudentICard("", "print");
          }
        }}
        printBill={printBill}
        onEdit={() => setEditing(true)}
        deleteStudent={deleteStudent}
        isIcardEligible={isIcardEligible}
      />
      {loading && (
        <section className="panel student-profile-loading" aria-live="polite">
          <div className="empty">Loading student details…</div>
        </section>
      )}
      {error && (
        <section className="panel student-profile-error" role="alert">
          <div className="empty error-text">{error}</div>
        </section>
      )}
      {student && (
        <main className="student-details student-profile-page">
          <CodingForKidsIcardDialog
            open={icardDialogOpen && isCodingForKidsCourse(student)}
            student={student}
            mode={icardOutputMode}
            onClose={() => setIcardDialogOpen(false)}
            onSelect={(templateName, _records, mode) => {
              setIcardDialogOpen(false);
              printStudentICard("", mode || icardOutputMode, templateName);
            }}
          />
          <StudentEditPanel
            editing={editing}
            setEditing={setEditing}
            editForm={editForm}
            setEditForm={setEditForm}
            feeForm={feeForm}
            setFeeForm={setFeeForm}
            courses={courses}
            batches={batches}
            referrals={referrals}
            saveStudent={saveStudent}
            indiaLocations={indiaLocations}
            setMessage={setMessage}
            uploadStudentPhoto={uploadStudentPhoto}
            photoUploading={photoUploading}
          />
          <StudentProfileHero student={student} uploadStudentPhoto={uploadStudentPhoto} photoUploading={photoUploading} />
          <StudentIdentityHistory student={student} />
          <nav className="student-profile-tabs" aria-label="Student profile sections">
            {[
              ["overview", "Overview"],
              ["courses-fees", "Courses & Fees"],
              ["attendance", "Attendance"],
              ["batch-history", "Batch History"],
              ["contact-log", "Contact Log"],
            ].map(([key, label]) => (
              <button key={key} type="button" className={activeTab === key ? "active" : ""} aria-current={activeTab === key ? "page" : undefined} onClick={() => setActiveTab(key)}>{label}</button>
            ))}
          </nav>
          <div className="student-profile-tab-panel" hidden={activeTab !== "overview"}>
            <StudentSummaryCards fee={fee} attendance={attendance} student={student} />
            <StudentPersonalDetails student={student} />
            <StudentQualificationSection student={student} />
          </div>
          <div className="student-profile-tab-panel" hidden={activeTab !== "courses-fees"}>
            <CodingForKidsSemesterPanel student={student} courses={courses} semesterBusy={semesterBusy} onUpdateSemester={updateCfkSemester} />
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
          </div>
          <div className="student-profile-tab-panel" hidden={activeTab !== "attendance"}>
            <StudentAttendanceSection attendance={attendance} attForm={attForm} setAttForm={setAttForm} saveAttendance={saveAttendance} />
          </div>
          <div className="student-profile-tab-panel" hidden={activeTab !== "batch-history"}>
            <StudentTransitionPanel
              student={student} batches={batches} history={history} setHistory={setHistory}
              editForm={editForm} setEditForm={setEditForm} setStudent={setStudent}
              transition={transition} setTransition={setTransition}
              transitioning={transitioning} setTransitioning={setTransitioning} setMessage={setMessage}
            />
          </div>
          <div className="student-profile-tab-panel" hidden={activeTab !== "contact-log"}>
            <StudentContactHistory contactLogs={contactLogs} />
          </div>
          {message && <div className="success-msg student-profile-feedback" role="status" style={{ position: "fixed", top: 18, right: 18, zIndex: 1200, maxWidth: "min(420px, calc(100vw - 32px))" }}>{message}</div>}
        </main>
      )}
    </ERPLayout>
  );
}
