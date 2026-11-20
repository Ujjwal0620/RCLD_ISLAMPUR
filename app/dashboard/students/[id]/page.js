"use client";

import ERPLayout from "@/components/ERPLayout";
import StudentProfileStyles from "@/components/students/profile/StudentProfileStyles";
import StudentProfileHeader from "@/components/students/profile/StudentProfileHeader";
import StudentProfileHero from "@/components/students/profile/StudentProfileHero";
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
import { formatDisplayValue as value } from "@/lib/formatters";
import { useState } from "react";

export default function StudentDetailsPage({ params }) {
  const {
    student, setStudent, error, loading, fee, courses, batches, referrals, attendance,
    feeForm, setFeeForm, paymentItems, setPaymentItems, proofUploading,
    feeWorkspaceOpen, setFeeWorkspaceOpen, attForm, setAttForm, message, setMessage,
    editing, setEditing, editForm, setEditForm, history, setHistory, contactLogs,
    transition, setTransition, transitioning, setTransitioning, icardDialogOpen,
    setIcardDialogOpen, semesterBusy, updateCfkSemester, saveStudent, deleteStudent,
    saveFees, uploadPaymentProof, uploadStudentPhoto, photoUploading, printStudentICard, downloadStudentICardJpg, printStudentForm, printBill,
    saveAttendance,
  } = useStudentProfile(params);
  const [icardOutputMode, setIcardOutputMode] = useState("print");

  return (
    <ERPLayout active="/dashboard/students">
      <StudentProfileStyles />
      <StudentProfileHeader
        student={student}
        printStudentForm={printStudentForm}
        onDownloadIcardJpg={() => {
          setIcardOutputMode("jpg");
          setIcardDialogOpen(true);
        }}
        onPrintIcard={() => {
          setIcardOutputMode("print");
          setIcardDialogOpen(true);
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
          <CodingForKidsSemesterPanel student={student} courses={courses} semesterBusy={semesterBusy} onUpdateSemester={updateCfkSemester} />
          <CodingForKidsIcardDialog
            open={icardDialogOpen}
            student={student}
            onClose={() => setIcardDialogOpen(false)}
            onSelect={(templateName) => {
              setIcardDialogOpen(false);
              printStudentICard("", icardOutputMode, templateName);
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
          <StudentTransitionPanel
            student={student} batches={batches} history={history} setHistory={setHistory}
            editForm={editForm} setEditForm={setEditForm} setStudent={setStudent}
            transition={transition} setTransition={setTransition}
            transitioning={transitioning} setTransitioning={setTransitioning} setMessage={setMessage}
          />
          <StudentContactHistory contactLogs={contactLogs} />
          <StudentSummaryCards fee={fee} attendance={attendance} student={student} />
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
          <StudentAttendanceSection attendance={attendance} attForm={attForm} setAttForm={setAttForm} saveAttendance={saveAttendance} />
          <StudentQualificationSection student={student} />
          {message && <div className="success-msg student-profile-feedback" role="status" style={{ position: "fixed", top: 18, right: 18, zIndex: 1200, maxWidth: "min(420px, calc(100vw - 32px))" }}>{message}</div>}
        </main>
      )}
    </ERPLayout>
  );
}
