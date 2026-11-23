"use client";

import { useMemo, useState } from "react";

const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");
const dateLabel = value => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString("en-IN") : "—";

export default function StudentUnifiedFeeLedger({ student }) {
  const [selectedCode, setSelectedCode] = useState("ALL");
  const enrollments = student?.enrollments || [];
  const receipts = student?.paymentHistory || [];
  const rows = useMemo(() => [...receipts].sort((a, b) =>
    new Date(a.paymentDate || 0).getTime() - new Date(b.paymentDate || 0).getTime()
  ), [receipts]);
  const visibleRows = selectedCode === "ALL" ? rows : rows.filter(row => String(row.stCode || "") === selectedCode);
  const lifetimePaid = rows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0);
  const active = enrollments.find(item => String(item._id) === String(student?.activeEnrollmentId || student?.activeEnrollment?._id))
    || enrollments.find(item => item.status === "ACTIVE")
    || student?.activeEnrollment;
  const breakdown = enrollments.map(enrollment => {
    const items = rows.filter(row => String(row.stCode || "") === String(enrollment.stCode || ""));
    return { ...enrollment, subtotal: items.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0), receiptCount: items.length };
  });
  const seenCodes = new Set(breakdown.map(item => String(item.stCode || "")));
  for (const receipt of rows) {
    const code = String(receipt.stCode || "");
    if (code && !seenCodes.has(code)) {
      seenCodes.add(code);
      breakdown.push({ stCode: code, courseCode: receipt.courseCode, semesterLabel: receipt.semesterLabel, status: "LEGACY", subtotal: Number(receipt.amountPaid || 0), receiptCount: 1 });
    }
  }
  return (
    <section className="panel" style={{ marginTop: 20, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>Unified Student Fee Ledger</h2><p style={{ margin: "5px 0 0", color: "var(--muted,#778)" }}>All linked semesters, registrations and money receipts</p></div>
        <select aria-label="Filter fee ledger by semester" value={selectedCode} onChange={event => setSelectedCode(event.target.value)} style={{ minHeight: 38, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border,#ddd)", background: "var(--surface,#fff)", color: "inherit" }}>
          <option value="ALL">All Semesters</option>
          {breakdown.map(item => <option key={String(item.stCode)} value={String(item.stCode)}>{item.semesterLabel || item.courseCode || "Semester"} · {item.stCode}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, margin: "16px 0" }}>
        <div className="fee-overview-card fee-paid"><span>Lifetime Paid</span><strong>{money(lifetimePaid)}</strong></div>
        <div className="fee-overview-card"><span>Active Course / St_Code</span><strong style={{ fontSize: 16 }}>{active?.courseCode || active?.semesterLabel || "—"} / {active?.stCode || "—"}</strong></div>
        <div className="fee-overview-card"><span>Total Receipts</span><strong>{rows.length}</strong></div>
      </div>
      <h3 style={{ margin: "18px 0 8px" }}>Semester-wise Summary</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead><tr>{["St_Code","Course / Semester","D.O.A.","Status","Subtotal","Receipts"].map(label => <th key={label} style={{ textAlign: "left", padding: 9, borderBottom: "1px solid var(--border,#ddd)" }}>{label}</th>)}</tr></thead>
          <tbody>{breakdown.map(item => <tr key={String(item._id || item.stCode)} onClick={() => setSelectedCode(String(item.stCode || "ALL"))} style={{ cursor: "pointer" }}>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{item.stCode || "—"}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{item.courseCode || item.semesterLabel || "LEGACY"}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{dateLabel(item.admissionDate)}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{item.status || "LEGACY"}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)", fontWeight: 700 }}>{money(item.subtotal)}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{item.receiptCount}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <h3 style={{ margin: "20px 0 8px" }}>Money Receipt History</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead><tr>{["Date (D.O.P.)","MR No","St_Code","Course","Amount Paid"].map(label => <th key={label} style={{ textAlign: "left", padding: 9, borderBottom: "1px solid var(--border,#ddd)" }}>{label}</th>)}</tr></thead>
          <tbody>{visibleRows.map((row,index) => <tr key={String(row._id || row.mrNo) + index}>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{dateLabel(row.paymentDate || row.rawPaymentDate)}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{row.mrNo || "—"}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{row.stCode || "—"}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)" }}>{row.courseName || row.courseCode || row.semesterLabel || "LEGACY"}</td>
            <td style={{ padding: 9, borderBottom: "1px solid var(--border,#eee)", fontWeight: 700 }}>{money(row.amountPaid)}</td>
          </tr>)}
          {!visibleRows.length && <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--muted,#778)" }}>No receipts found for this selection.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  );
}
