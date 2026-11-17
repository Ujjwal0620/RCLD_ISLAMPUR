"use client";

import { BookOpen } from "lucide-react";

export default function CodingForKidsSemesterPanel({
  student,
  courses,
  semesterBusy,
  onUpdateSemester,
}) {
  if (!/coding\\s*for\\s*kids|\\bKIDS\\b/i.test(String(student?.courseName || student?.courseCode || ""))) {
    return null;
  }

  const currentSemester = Math.min(6, Math.max(1, Number(student.currentSemester || 1)));
  const semesterPlan = (courses.find((course) => course.code === "KIDS")?.semesterPlans || [])
    .find((plan) => Number(plan.semester) === Number(student.currentSemester || 1));
  const semesterFee = Number(semesterPlan?.totalFee || 0);

  return (
    <section className="detail-section cfk-semester-management">
      <div className="detail-section-title">
        <BookOpen size={17} />
        <div>
          <h3>Coding for Kids — Semester Progression</h3>
          <span>
            Six semesters · six months each · readmission advances one semester and
            preserves payment history
          </span>
        </div>
      </div>
      <div className="student-summary-grid compact">
        <div className="summary-card">
          <span>Current Semester</span>
          <strong>SEM {currentSemester}</strong>
        </div>
        <div className="summary-card">
          <span>Semester Status</span>
          <strong>{student.semesterStatus || "Active"}</strong>
        </div>
        <div className="summary-card">
          <span>Semester Fee</span>
          <strong>₹{semesterFee.toLocaleString("en-IN")}</strong>
        </div>
      </div>
      <div className="top-actions">
        <button
          type="button"
          className="secondary-btn"
          disabled={semesterBusy || student.semesterStatus === "Completed"}
          onClick={() => onUpdateSemester("complete")}
        >
          Mark SEM {student.currentSemester || 1} Completed
        </button>
        <button
          type="button"
          className="primary-btn"
          disabled={
            semesterBusy ||
            student.semesterStatus !== "Completed" ||
            Number(student.currentSemester || 1) >= 6
          }
          onClick={() => onUpdateSemester("readmit")}
        >
          {semesterBusy
            ? "Updating…"
            : Number(student.currentSemester || 1) >= 6
              ? "Final Semester Completed"
              : "Readmit to SEM " + (Number(student.currentSemester || 1) + 1)}
        </button>
      </div>
      {(student.semesterHistory || []).length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Semester</th>
                <th>Status</th>
                <th>Admission Date</th>
                <th>Semester Fee</th>
              </tr>
            </thead>
            <tbody>
              {student.semesterHistory.map((item, index) => (
                <tr key={item.semester + "-" + index}>
                  <td>SEM {item.semester}</td>
                  <td>{item.status || "Active"}</td>
                  <td>{item.admittedAt || item.completedAt || "—"}</td>
                  <td>₹{Number(item.totalFee || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
