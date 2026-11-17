"use client";

import { IdCard, Printer } from "lucide-react";

export default function CodingForKidsIcardDialog({ open, student, onClose, onPrint }) {
  if (!open) return null;

  return (
    <div
      className="cfk-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="cfk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cfk-dialog-title"
      >
        <div className="cfk-dialog-heading">
          <div className="cfk-dialog-icon">
            <IdCard size={22} />
          </div>
          <div>
            <h2 id="cfk-dialog-title">Coding For Kids I-Card</h2>
            <p>Select the student&apos;s current semester or learning module.</p>
          </div>
          <button
            type="button"
            className="cfk-dialog-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="cfk-dialog-student">
          <strong>{student.applicantName}</strong>
          <span>
            {student.enrollmentNo ||
              student.studentId ||
              student.admissionNo ||
              "Student ID not available"}
          </span>
        </div>
        <div className="cfk-dialog-current-semester">
          <span>Saved current semester</span>
          <strong>SEM {Math.min(6, Math.max(1, Number(student.currentSemester || 1)))}</strong>
          <small>
            The I-Card uses the student&apos;s recorded semester. It cannot be changed from the
            print dialog.
          </small>
        </div>
        <div className="cfk-dialog-note">
          The semester label and colour are taken from the student&apos;s current academic
          record. In the print dialog set Margins to None and Scale to 100%.
        </div>
        <footer className="cfk-dialog-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={onPrint}>
            <Printer size={16} /> Continue to Print
          </button>
        </footer>
      </section>
    </div>
  );
}
