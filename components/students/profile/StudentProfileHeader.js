"use client";

import { ArrowLeft, IdCard, Pencil, Printer, Trash2 } from "lucide-react";

export default function StudentProfileHeader({
  student,
  printStudentForm,
  onPrintIcard,
  printStudentICard,
  printBill,
  onEdit,
  deleteStudent,
  isIcardEligible,
}) {
  return (
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
                  <button className="ghost-btn" onClick={onEdit}>
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
  );
}
