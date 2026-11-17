"use client";

import { BookOpen, CalendarDays, ClipboardCheck, WalletCards } from "lucide-react";

export default function StudentSummaryCards({ fee, attendance, student, value }) {
  return (
    <section className="student-summary-grid">
            <div className="summary-card">
              <WalletCards size={18} />
              <span>Fees Due</span>
              <strong>₹{Number(fee?.due || 0).toLocaleString("en-IN")}</strong>
            </div>
            <div className="summary-card">
              <ClipboardCheck size={18} />
              <span>Attendance</span>
              <strong>{attendance.summary?.percentage || 0}%</strong>
            </div>
            <div className="summary-card">
              <BookOpen size={18} />
              <span>Course</span>
              <strong>{value(student.courseName)}</strong>
            </div>
            <div className="summary-card">
              <CalendarDays size={18} />
              <span>Attendance Records</span>
              <strong>{attendance.summary?.total || 0}</strong>
            </div>
          </section>
  );
}
