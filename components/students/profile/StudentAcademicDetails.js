"use client";

import { BookOpen } from "lucide-react";
import { DetailField as Detail } from "@/components/students/DetailField";

export default function StudentAcademicDetails({ student }) {
  return (
    <section className="detail-section">
            <div className="detail-section-title">
              <BookOpen size={17} />
              <h3>Course, Batch & Academic Tracking</h3>
            </div>
            <div className="student-detail-grid">
              <Detail label="Course Name">{student.courseName}</Detail>
              <Detail label="Course Code">{student.courseCode}</Detail>
              <Detail label="Original Course / Series">{student.sourceCourseLabel}</Detail>
              <Detail label="Batch">{student.batchCode || "Not assigned"}</Detail>
              <Detail label="Admission Date">{student.admissionDate}</Detail>
              <Detail label="Imported Due Amount">{student.dueAmount}</Detail>
              <Detail label="Imported Payment Status">{student.paymentStatus}</Detail>
              <Detail label="AEC Code">RCLD/ISL-001</Detail>
              <Detail label="Registered On">
                {student.createdAt ? new Date(student.createdAt).toLocaleString() : ""}
              </Detail>
              <Detail label="Last Updated">
                {student.updatedAt ? new Date(student.updatedAt).toLocaleString() : ""}
              </Detail>
            </div>
            <div className="operational-placeholder">
              <strong>Course Content Progress</strong>
              <span>
                Course content and batch-wise topic completion will be shown here after this student
                is assigned to a batch.
              </span>
            </div>
          </section>
  );
}
