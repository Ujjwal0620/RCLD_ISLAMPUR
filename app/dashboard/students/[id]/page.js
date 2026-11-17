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
      <StudentProfileStyles />

      <StudentProfileHeader
        student={student}
        printStudentForm={printStudentForm}
        onPrintIcard={() => {
          const courseText = String(student.courseName || student.courseCode || "");
          if (/coding\s*for\s*kids|\bCFK\b|\bKIDS\b/i.test(courseText)) setIcardDialogOpen(true);
          else printStudentICard();
        }}
        printBill={printBill}
        onEdit={() => setEditing(true)}
        deleteStudent={deleteStudent}
        isIcardEligible={isIcardEligible}
      />
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
          <StudentProfileHero student={student} />
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
