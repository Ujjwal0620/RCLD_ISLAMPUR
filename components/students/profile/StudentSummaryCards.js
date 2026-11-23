"use client";

import { BookOpen, CalendarDays, ClipboardCheck, WalletCards } from "lucide-react";
import { formatDisplayValue as value } from "@/lib/formatters";

export default function StudentSummaryCards({ fee, attendance, student }) {
  const aggregate = student?.masterProfile?.feeSummary || {};
  return (
    <section className="student-summary-grid">
            <div className="summary-card">
              <WalletCards size={18} />
              <span>Fees Due</span>
              <strong>₹{Number(aggregate.balanceDue ?? fee?.due ?? 0).toLocaleString("en-IN")}</strong>
            </div>
            <div className="summary-card">
              <WalletCards size={18} />
              <span>Total Fees Paid (All Courses)</span>
              <strong>₹{Number(aggregate.totalPaid || 0).toLocaleString("en-IN")}</strong>
            </div>
            <div className="summary-card">
              <WalletCards size={18} />
              <span>Total Course Fees</span>
              <strong>₹{Number(aggregate.totalFee || 0).toLocaleString("en-IN")}</strong>
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
