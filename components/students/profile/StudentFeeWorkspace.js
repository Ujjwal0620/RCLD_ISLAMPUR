"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CreditCard, WalletCards, Printer } from "lucide-react";
import StudentFeePlanSection from "@/components/students/profile/fee-workspace/StudentFeePlanSection";
import StudentPaymentEntrySection from "@/components/students/profile/fee-workspace/StudentPaymentEntrySection";
import StudentPaymentHistorySection from "@/components/students/profile/fee-workspace/StudentPaymentHistorySection";

const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");
const dateLabel = value => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
};
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function printReceipt(payment, student) {
  const popup = window.open("", "_blank", "width=820,height=720");
  if (!popup) return;
  const amountPaid = Number(payment.amountPaid ?? payment.amount ?? 0);
  const html = `<!doctype html><html><head><title>Money Receipt ${escapeHtml(payment.mrNo || "")}</title>
    <style>body{font:14px Arial,sans-serif;color:#172033;padding:32px}.receipt{max-width:680px;margin:auto;border:1px solid #ccd3df;padding:28px;border-radius:10px}.head{text-align:center;border-bottom:2px solid #24324a;padding-bottom:16px;margin-bottom:18px}.head h1{margin:0 0 6px;font-size:23px}.muted{color:#65718a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.field{border-bottom:1px solid #e2e6ee;padding:8px 0}.field b{display:block;font-size:11px;color:#65718a;text-transform:uppercase;margin-bottom:5px}.amount{font-size:26px;font-weight:700;background:#f3f6fb;padding:18px;border-radius:8px;text-align:right}@media print{body{padding:0}.receipt{border:0}}</style></head><body><main class="receipt">
    <header class="head"><h1>RCLD — Islampur</h1><div class="muted">Official Money Receipt</div></header>
    <div class="grid"><div class="field"><b>Receipt No.</b>${escapeHtml(payment.mrNo || "—")}</div><div class="field"><b>Payment Date</b>${escapeHtml(dateLabel(payment.paymentDate || payment.rawPaymentDate))}</div>
    <div class="field"><b>Student Name</b>${escapeHtml(student.applicantName || student.name || student.masterProfile?.fullName || "Student")}</div><div class="field"><b>Registration Code</b>${escapeHtml(payment.stCode || "—")}</div>
    <div class="field"><b>Course</b>${escapeHtml(payment.courseName || payment.courseCode || "—")}</div><div class="field"><b>Payment Mode</b>${escapeHtml(payment.paymentMode || "—")}</div></div>
    <div class="amount">Amount Received: ₹${amountPaid.toLocaleString("en-IN")}</div><p class="muted" style="margin-top:32px">This receipt is generated from the RCLD student fee ledger.</p></main></body></html>`;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function StudentFeeWorkspace({
  student, fee, feeWorkspaceOpen, setFeeWorkspaceOpen, feeForm, setFeeForm,
  paymentItems, setPaymentItems, saveFees, proofUploading, uploadPaymentProof, printBill,
}) {
  const paymentHistory = Array.isArray(student.paymentHistory) ? student.paymentHistory : [];
  const enrollmentOptions = Array.isArray(student.enrollments) ? student.enrollments : [];
  const historyMetadata = Array.isArray(student.masterProfile?.registrations) && student.masterProfile.registrations.length
    ? student.masterProfile.registrations
    : Array.isArray(student.masterProfile?.enrollments) ? student.masterProfile.enrollments : [];
  const currentEnrollment = student.activeEnrollment
    || enrollmentOptions.find(item => String(item.registrationId || "") === String(student.masterProfile?.currentRegistrationId || ""))
    || enrollmentOptions.find(item => String(item.stCode) === String(student.masterProfile?.currentStCode || ""))
    || enrollmentOptions.find(item => item.status === "ACTIVE")
    || enrollmentOptions[0];
  const currentStCode = String(student.masterProfile?.currentStCode || currentEnrollment?.stCode || student.regnNo || student.enrollmentNo || "");
  const currentRegistrationId = String(student.masterProfile?.currentRegistrationId || currentEnrollment?.registrationId || (currentStCode && (student.masterProfile?.fullName || student.applicantName) ? String(student.masterProfile?.fullName || student.applicantName).trim().toUpperCase().replace(/\s+/g, " ") + "_" + currentStCode : ""));
  const [selectedCodeState, setSelectedCodeState] = useState("ALL");
  const selectedCode = selectedCodeState || "ALL";
  useEffect(() => { setSelectedCodeState("ALL"); }, [student._id]);
  const codeCards = useMemo(() => {
    const map = new Map();
    for (const item of historyMetadata) {
      const fallbackName = String(item.cleanName || student.masterProfile?.fullName || student.applicantName || "").trim().toUpperCase().replace(/\s+/g, " ");
      const id = String(item.registrationId || (fallbackName && item.stCode ? fallbackName + "_" + item.stCode : "") || "");
      if (id) map.set(id, { ...item, registrationId: id });
    }
    for (const item of enrollmentOptions) {
      const id = String(item.registrationId || "");
      if (!id) continue;
      const old = map.get(id) || {};
      map.set(id, { ...old, ...item, registrationId: id, course: item.courseName || item.courseCode || old.course, dateOfAdmission: item.admissionDate || old.dateOfAdmission });
    }
    const codeCounts = new Map();
    for (const item of map.values()) codeCounts.set(String(item.stCode), (codeCounts.get(String(item.stCode)) || 0) + 1);
    return [...map.values()].filter(item => item.stCode).map(item => {
      const code = String(item.stCode);
      const id = String(item.registrationId);
      const matchingRows = paymentHistory.filter(payment => {
        const paymentId = String(payment.registrationId || payment.stNameKey || "").toUpperCase();
        return paymentId === id.toUpperCase() || (!paymentId && codeCounts.get(code) === 1 && String(payment.stCode || "") === code);
      });
      return { ...item, paidTotal: matchingRows.reduce((sum, payment) => sum + Number(payment.amountPaid ?? payment.amount ?? 0), 0) };
    }).sort((a, b) => new Date(b.dateOfAdmission || b.admissionDate || b.earliestPaymentDate || 0).getTime() - new Date(a.dateOfAdmission || a.admissionDate || a.earliestPaymentDate || 0).getTime());
  }, [historyMetadata, enrollmentOptions, paymentHistory]);
  const selectedEnrollment = enrollmentOptions.find(item => String(item.registrationId || "") === selectedCode)
    || (selectedCode !== "ALL" ? enrollmentOptions.find(item => String(item.stCode) === String(codeCards.find(item => item.registrationId === selectedCode)?.stCode || "")) : null);
  const selectedHistory = historyMetadata.find(item => String(item.registrationId || "") === selectedCode) || {};
  const selectedRegistration = codeCards.find(item => item.registrationId === selectedCode) || selectedHistory;
  const codeCount = new Map();
  for (const item of codeCards) codeCount.set(String(item.stCode), (codeCount.get(String(item.stCode)) || 0) + 1);
  const visibleRows = useMemo(() => [...paymentHistory]
    .filter(payment => {
      if (selectedCode === "ALL") return true;
      const id = String(payment.registrationId || payment.stNameKey || "").toUpperCase();
      if (id) return id === selectedCode.toUpperCase();
      const card = codeCards.find(item => item.registrationId === selectedCode);
      return Boolean(card && codeCount.get(String(card.stCode)) === 1 && String(payment.stCode || "") === String(card.stCode));
    })
    .sort((a, b) => new Date(a.paymentDate || a.rawPaymentDate || 0).getTime() - new Date(b.paymentDate || b.rawPaymentDate || 0).getTime()),
  [paymentHistory, selectedCode, codeCards]);
  const paymentRows = useMemo(() => visibleRows.map(payment => {
    const paymentId = String(payment.registrationId || payment.stNameKey || "").toUpperCase();
    const matchedCard = codeCards.find(item => String(item.registrationId || "").toUpperCase() === paymentId)
      || (payment.stCode && codeCount.get(String(payment.stCode)) === 1
        ? codeCards.find(item => String(item.stCode) === String(payment.stCode))
        : null);
    return {
      ...payment,
      registrationId: payment.registrationId || payment.stNameKey || matchedCard?.registrationId || "",
      stCode: payment.stCode || matchedCard?.stCode || "",
      courseName: payment.courseName || payment.courseCode || matchedCard?.course || matchedCard?.courseName || "Previous Course (Legacy)"
    };
  }), [visibleRows, codeCards]);
  const selectedPaid = paymentRows.reduce((sum, item) => sum + Number(item.amountPaid ?? item.amount ?? 0), 0);
  const selectedCourse = selectedCode === "ALL"
    ? [...new Set(codeCards.map(item => item.course || item.courseName || item.courseCode).filter(Boolean))].join(", ") || "All Registrations"
    : selectedEnrollment?.courseName || selectedEnrollment?.courseCode || selectedRegistration?.course || selectedRegistration?.courseCode || "Previous Course (Legacy)";
  const configuredFee = enrollment => enrollment && enrollment.feeConfig?.configured !== false
    && enrollment.feeConfig?.feeRuleSource !== "NO_FEE_RULE"
    && String(enrollment.courseCode || "").toUpperCase() !== "PREVIOUS-LEGACY"
    && String(enrollment.courseName || enrollment.semesterLabel || "").toLowerCase() !== "previous course (legacy)";
  const enrollmentForRegistration = item => enrollmentOptions.find(entry => String(entry.registrationId || "") === String(item.registrationId))
    || (codeCount.get(String(item.stCode)) === 1 ? enrollmentOptions.find(entry => String(entry.stCode || "") === String(item.stCode)) : null);
  const configuredRegistrationCount = codeCards.filter(item => configuredFee(enrollmentForRegistration(item))).length;
  const selectedTotalFee = selectedCode === "ALL"
    ? (configuredRegistrationCount ? codeCards.reduce((sum, item) => {
        const enrollment = enrollmentForRegistration(item);
        return sum + (configuredFee(enrollment) ? Number(enrollment?.feeConfig?.grossFee ?? enrollment?.summary?.totalFee ?? 0) : 0);
      }, 0) : null)
    : configuredFee(selectedEnrollment) ? Number(selectedEnrollment?.feeConfig?.grossFee ?? selectedEnrollment?.summary?.totalFee ?? 0) : null;
  const selectedPayable = selectedCode === "ALL"
    ? (configuredRegistrationCount ? codeCards.reduce((sum, item) => {
        const enrollment = enrollmentForRegistration(item);
        return sum + (configuredFee(enrollment) ? Number(enrollment?.feeConfig?.netPayableFee ?? enrollment?.summary?.totalDue ?? 0) : 0);
      }, 0) : null)
    : configuredFee(selectedEnrollment) ? Number(selectedEnrollment?.feeConfig?.netPayableFee ?? selectedEnrollment?.summary?.totalDue ?? 0) : null;
  const selectedBalance = selectedCode === "ALL"
    ? (configuredRegistrationCount ? codeCards.reduce((sum, item) => {
        const enrollment = enrollmentForRegistration(item);
        if (!configuredFee(enrollment)) return sum;
        const payable = Number(enrollment?.feeConfig?.netPayableFee ?? enrollment?.summary?.totalDue ?? 0);
        return sum + Math.max(0, payable - Number(item.paidTotal || 0));
      }, 0) : null)
    : selectedPayable === null ? null : Math.max(0, selectedPayable - selectedPaid);
  const selectedDiscount = selectedCode === "ALL"
    ? enrollmentOptions.reduce((sum, item) => sum + (configuredFee(item) ? Number(item.feeConfig?.discountAmount || 0) : 0), 0)
    : Number(selectedEnrollment?.feeConfig?.discountAmount || 0);
  const currentPayable = Number(currentEnrollment?.feeConfig?.netPayableFee || currentEnrollment?.summary?.totalDue || fee?.payable || 0);
  const currentPaid = Number(currentEnrollment?.summary?.totalPaid || fee?.paid || 0);
  const currentBalanceDue = Number(currentEnrollment?.summary?.balanceDue ?? Math.max(0, currentPayable - currentPaid));
  return (
    <section className="detail-section student-fees-section">
      <div className="detail-section-title">
        <CreditCard size={17} />
        <div><h3>Fees & Payments</h3><span>Registration-wise fee summaries and date-wise receipt ledger</span></div>
      </div>

      <div className="student-code-switcher" style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0" }}>
        <button type="button" className={selectedCode === "ALL" ? "primary-btn" : "ghost-btn"} onClick={() => setSelectedCodeState("ALL")} aria-pressed={selectedCode === "ALL"}>All Registrations</button>
        {codeCards.map(item => {
          const id = String(item.registrationId);
          const current = id === currentRegistrationId || Boolean(item.isCurrent) || String(item.stCode) === currentStCode;
          const active = selectedCode === id;
          return <button key={id} type="button" onClick={() => setSelectedCodeState(id)}
            className={active ? "primary-btn" : "ghost-btn"} aria-pressed={active}
            style={{ minWidth: 190, textAlign: "left", display: "grid", gap: 4, padding: "9px 12px" }}>
            <span style={{ fontWeight: 800 }}>#{item.stCode} <small style={{ marginLeft: 5, padding: "3px 7px", borderRadius: 999, background: current ? "#dcfce7" : "#eef2f7", color: current ? "#166534" : "#596579", fontSize: 10 }}>{current ? "Current" : "Previous"}</small></span>
            <span style={{ fontSize: 11, overflowWrap: "anywhere" }}>{id}</span>
            <span style={{ fontSize: 12 }}>{item.course || item.courseCode || "Previous Course (Legacy)"}</span>
            <span style={{ fontSize: 11, opacity: .8 }}>{item.dateOfAdmission || item.admissionDate ? "Admission: " + dateLabel(item.dateOfAdmission || item.admissionDate) : "First payment: " + dateLabel(item.earliestPaymentDate)} · {money(item.paidTotal)} paid</span>
          </button>;
        })}
      </div>

      <div className="student-fee-overview">
        <div className="fee-overview-card"><span>Course(s)</span><strong style={{ fontSize: 17 }}>{selectedCourse || "—"}</strong></div>
        <div className="fee-overview-card"><span>Registration Code</span><strong>{selectedCode === "ALL" ? "All Registrations" : selectedCode}</strong></div>
        <div className="fee-overview-card fee-total"><span>Total Course Fee</span><strong>{selectedTotalFee === null ? "—" : money(selectedTotalFee)}</strong><small>{selectedDiscount ? "Discount: " + money(selectedDiscount) : "Course fee rule"}</small></div>
        <div className="fee-overview-card fee-paid"><span>Total Paid</span><strong>{money(selectedPaid)}</strong><small>{paymentRows.length} receipt(s)</small></div>
        <div className="fee-overview-card fee-due"><span>Balance Due</span><strong>{selectedBalance === null ? "—" : money(selectedBalance)}</strong></div>
      </div>

      <section className="student-payment-history-ledger" style={{ marginTop: 20, padding: 16, border: "1px solid var(--border,#e3e7ef)", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><h3 style={{ margin: 0 }}>Date-wise Payment Ledger</h3><small>Sorted chronologically by D_O_P · {selectedCode === "ALL" ? "all registration codes" : selectedCode}</small></div>
        </div>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead><tr>{["Date (D_O_P)", "MR No", "St_Code / Registration ID", "Course", "Amount Paid (₹)", "Receipt"].map(label =>
              <th key={label} style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border,#e3e7ef)", fontSize: 12 }}>{label}</th>
            )}</tr></thead>
            <tbody>
              {paymentRows.map((payment, index) => (
                <tr key={String(payment._id || payment.mrNo) + "-" + index}>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{dateLabel(payment.paymentDate || payment.rawPaymentDate || payment.date)}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{payment.mrNo || payment.receiptNo || "—"}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>#{payment.stCode || "—"}<small style={{ display: "block", fontSize: 10, opacity: .75 }}>{payment.registrationId || payment.stNameKey || "—"}</small></td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{payment.courseName || payment.courseCode || "Previous Course (Legacy)"}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)", fontWeight: 700 }}>{money(payment.amountPaid ?? payment.amount)}</td>
                  <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>
                    <button type="button" className="ghost-btn" onClick={() => printReceipt(payment, student)}><Printer size={14} /> View / Print</button>
                  </td>
                </tr>
              ))}
              {!visibleRows.length && <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "var(--muted,#7b8494)" }}>No receipts are linked to this registration code yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <button type="button" className="fee-workspace-launch" onClick={() => setFeeWorkspaceOpen(true)}>
        <span className="fee-workspace-icon"><WalletCards size={22} /></span>
        <span><strong>Open Fee & Receipt Workspace</strong><small>Manage fee plan, record a payment and review receipt history</small></span>
        <span className="fee-workspace-action">Open workspace <ArrowLeft size={15} /></span>
      </button>

      {feeWorkspaceOpen && (
        <div className="fee-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFeeWorkspaceOpen(false); }}>
          <section className="fee-workspace-modal" role="dialog" aria-modal="true" aria-labelledby="fee-workspace-title">
            <header className="fee-modal-header">
              <div><div className="eyebrow">STUDENT FINANCE</div><h2 id="fee-workspace-title">Fee & Receipt Workspace</h2><p>{student.applicantName} · {currentStCode || student.formNo}</p></div>
              <button type="button" className="fee-modal-close" onClick={() => setFeeWorkspaceOpen(false)} aria-label="Close fee workspace">×</button>
            </header>
            <div className="fee-modal-body">
              <div className="fee-modal-stats">
                <div><small>Total payable</small><strong>{money(currentPayable)}</strong></div>
                <div><small>Paid till date</small><strong className="fee-green">{money(currentPaid)}</strong></div>
                <div><small>Balance due</small><strong className="fee-red">{money(currentBalanceDue)}</strong></div>
              </div>
              <StudentFeePlanSection fee={fee} feeForm={feeForm} setFeeForm={setFeeForm} saveFees={saveFees} />
              <StudentPaymentEntrySection feeForm={feeForm} setFeeForm={setFeeForm} paymentItems={paymentItems} setPaymentItems={setPaymentItems} saveFees={saveFees} proofUploading={proofUploading} uploadPaymentProof={uploadPaymentProof} />
              <StudentPaymentHistorySection fee={fee} printBill={printBill} />
            </div>
            <footer className="fee-modal-footer"><span>Print format remains a compact half-page receipt.</span><button type="button" className="ghost-btn" onClick={() => setFeeWorkspaceOpen(false)}>Close workspace</button></footer>
          </section>
        </div>
      )}
    </section>
  );
}
