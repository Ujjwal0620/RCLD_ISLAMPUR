"use client";

import { useMemo } from "react";

const dateLabel = value => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
};

export default function StudentIdentityHistory({ student }) {
  const profile = student?.masterProfile || {};
  const codes = useMemo(() => {
    const all = [...new Set([...(profile.studentCodes || []), ...(profile.stCodes || []), ...(student.studentCodes || [])].map(String).filter(Boolean))];
    const current = String(profile.primaryStCode || profile.currentStCode || student.primaryStCode || student.regnNo || "");
    return all.sort((a, b) => a === current ? -1 : b === current ? 1 : b.localeCompare(a, undefined, { numeric: true }));
  }, [profile.studentCodes, profile.stCodes, profile.primaryStCode, profile.currentStCode, student.studentCodes, student.primaryStCode, student.regnNo]);
  const history = useMemo(() => {
    const source = Array.isArray(student.enrollments) && student.enrollments.length
      ? student.enrollments
      : (profile.registrations || profile.enrollments || []);
    const byKey = new Map();
    for (const item of source) {
      const code = String(item.stCode || "");
      const course = String(item.courseName || item.courseCode || item.course || "Previous Course (Legacy)");
      const admissionDate = item.admissionDate || item.dateOfAdmission || null;
      const key = [code, course, admissionDate ? new Date(admissionDate).toISOString().slice(0, 10) : ""].join("|");
      const old = byKey.get(key) || {};
      byKey.set(key, { ...old, ...item, stCode: code, course, admissionDate });
    }
    return [...byKey.values()].sort((a, b) => new Date(b.admissionDate || b.earliestPaymentDate || 0) - new Date(a.admissionDate || a.earliestPaymentDate || 0));
  }, [student.enrollments, profile.registrations, profile.enrollments]);
  const currentCode = String(profile.primaryStCode || profile.currentStCode || student.primaryStCode || student.regnNo || "");
  return (
    <section className="panel" style={{ margin: "16px 0", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><h3 style={{ margin: 0 }}>Linked Student Codes</h3><p style={{ margin: "5px 0 0", color: "var(--text-muted,#748094)", fontSize: 13 }}>One student identity across every admission and course</p></div>
        <strong>{codes.length} linked code{codes.length === 1 ? "" : "s"}</strong>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {codes.map(code => <span key={code} style={{ borderRadius: 999, padding: "7px 12px", border: "1px solid var(--border,#dfe5ee)", background: code === currentCode ? "var(--primary-soft,#edf2ff)" : "var(--surface-muted,#f7f8fb)", fontWeight: 700, fontSize: 12 }}>
          {code}{code === currentCode ? " · Latest" : ""}
        </span>)}
        {!codes.length && <span style={{ color: "var(--text-muted,#748094)" }}>No linked codes recorded yet.</span>}
      </div>
      <div style={{ marginTop: 20 }}>
        <h3 style={{ margin: "0 0 10px" }}>Enrollment / Semester History</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
            <thead><tr>{["St_Code", "Course", "Form No.", "D_O_A", "Qualification"].map(label => <th key={label} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--border,#e3e7ef)", fontSize: 12 }}>{label}</th>)}</tr></thead>
            <tbody>
              {history.map((item, index) => <tr key={[item.stCode, item.course, item.admissionDate, index].join("-")}>
                <td style={{ padding: 10, borderBottom: "1px solid var(--border,#edf0f4)", fontWeight: 700 }}>{item.stCode || "—"}{item.stCode === currentCode ? <small style={{ display: "block", color: "var(--primary,#315efb)" }}>Latest</small> : null}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--border,#edf0f4)" }}>{item.courseName || item.courseCode || item.course || "Previous Course (Legacy)"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--border,#edf0f4)" }}>{item.formNo || "—"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--border,#edf0f4)" }}>{dateLabel(item.admissionDate || item.dateOfAdmission)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--border,#edf0f4)" }}>{item.qualification || "—"}</td>
              </tr>)}
              {!history.length && <tr><td colSpan={5} style={{ padding: 14, textAlign: "center", color: "var(--text-muted,#748094)" }}>No enrollment history is available.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
