"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CreditCard, WalletCards } from "lucide-react";
import StudentFeePlanSection from "@/components/students/profile/fee-workspace/StudentFeePlanSection";
import StudentPaymentEntrySection from "@/components/students/profile/fee-workspace/StudentPaymentEntrySection";
import StudentPaymentHistorySection from "@/components/students/profile/fee-workspace/StudentPaymentHistorySection";

export default function StudentFeeWorkspace({
  student,
  fee,
  value,
  feeWorkspaceOpen,
  setFeeWorkspaceOpen,
  feeForm,
  setFeeForm,
  paymentItems,
  setPaymentItems,
  saveFees,
  proofUploading,
  uploadPaymentProof,
  printBill,
}) {
  const [historyScope, setHistoryScope] = useState("all");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const paymentHistory = Array.isArray(student.paymentHistory) ? student.paymentHistory : [];
  const enrollmentOptions = Array.isArray(student.enrollments) ? student.enrollments : [];
  const semesterRoman = ["I", "II", "III", "IV", "V", "VI"][Number(student.currentSemester || 0) - 1] || "";
  const semesterEnrollment = semesterRoman
    ? enrollmentOptions.find(item => String(item.semesterLabel || "").toUpperCase() === "SM-" + semesterRoman)
    : null;
  const currentEnrollment = student.activeEnrollment || semesterEnrollment || enrollmentOptions.find(item => item.status === "ACTIVE");
  const currentStCode = String(currentEnrollment?.stCode || student.regnNo || student.enrollmentNo || "");
  const effectiveEnrollmentId = selectedEnrollmentId || String(currentEnrollment?._id || "");
  const selectedEnrollment = enrollmentOptions.find(item => String(item._id) === effectiveEnrollmentId) || currentEnrollment;
  const effectiveStCode = String(selectedEnrollment?.stCode || currentStCode);
  const selectedInstallments = Array.isArray(selectedEnrollment?.installments) ? selectedEnrollment.installments : [];
  const selectedSummary = selectedEnrollment?.summary || {};
  const selectedDue = Number(selectedSummary.totalDue || selectedEnrollment?.feeConfig?.netPayableFee || 0);
  const selectedPaid = Number(selectedSummary.totalPaid || 0);
  const selectedBalance = Number(selectedSummary.totalDue || 0) > 0
    ? Number(selectedSummary.balanceDue || 0) : Math.max(0, selectedDue - selectedPaid);
  const historyRows = useMemo(() => paymentHistory.filter(payment =>
    historyScope === "all" || (payment.enrollmentId ? String(payment.enrollmentId) === effectiveEnrollmentId : String(payment.stCode || "") === effectiveStCode)
  ), [paymentHistory, historyScope, effectiveStCode]);
  const totalAcrossSemesters = paymentHistory.reduce((sum, payment) => sum + Number(payment.amountPaid ?? payment.amount ?? 0), 0);
  const currentSemesterPaid = paymentHistory.filter(payment => payment.enrollmentId
    ? String(payment.enrollmentId) === String(currentEnrollment?._id || "")
    : String(payment.stCode || "") === currentStCode)
    .reduce((sum, payment) => sum + Number(payment.amountPaid ?? payment.amount ?? 0), 0);
  const activeEnrollment = currentEnrollment;
  const currentCourseName = activeEnrollment?.courseName
    || (String(activeEnrollment?.courseCode || "").toUpperCase() === String(student.courseCode || "").toUpperCase()
      ? student.courseName : activeEnrollment?.courseCode)
    || student.courseName;
  const activeSummary = activeEnrollment?.summary || {};
  const currentPayable = Number(activeEnrollment?.feeConfig?.netPayableFee || activeSummary.totalDue || fee?.payable || 0);
  const currentPaid = Number(activeSummary.totalPaid || currentSemesterPaid || fee?.paid || 0);
  const currentBalanceDue = Number(activeSummary.totalDue || 0) > 0
    ? Number(activeSummary.balanceDue || 0)
    : currentPayable > 0 ? Math.max(0, currentPayable - currentPaid) : Number(fee?.due || 0);
  const formatDate = value => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-IN");
  };
  return (
    <section className="detail-section student-fees-section">
                <div className="detail-section-title">
                  <CreditCard size={17} />
                  <div>
                    <h3>Fees & Payments</h3>
                    <span>Live fee position · lifetime payment ledger · receipt workspace</span>
                  </div>
                </div>
                <div className="student-fee-overview">
                  <div className="fee-overview-card fee-total">
                    <span>Total Payable</span>
                    <strong>₹{currentPayable.toLocaleString("en-IN")}</strong>
                    <small>Admission fee and installments are included</small>
                  </div>
                  <div className="fee-overview-card fee-paid">
                    <span>Course Fee Paid (incl. discount)</span>
                    <strong>₹{currentPaid.toLocaleString("en-IN")}</strong>
                    <small>{(fee?.payments || []).length} payment entries recorded</small>
                  </div>
                  <div className="fee-overview-card fee-due">
                    <span>Outstanding Due</span>
                    <strong>₹{currentBalanceDue.toLocaleString("en-IN")}</strong>
                    <small>Discount is counted as course-fee credit</small>
                  </div>
                </div>
                <div className="fee-overview-meta">
                  <span>
                    <b>Course</b>
                    {value(currentCourseName)}
                  </span>
                  <span>
                    <b>Enrollment</b>
                    {value(currentStCode)}
                  </span>
                  <span>
                    <b>Fee status</b>
                    <em className={currentBalanceDue <= 0 ? "fee-status-paid" : "fee-status-due"}>
                      {currentBalanceDue <= 0 ? "Paid" : "Payment Due"}
                    </em>
                  </span>
                </div>
                <section className="student-payment-history-ledger" style={{ marginTop: 20, padding: 16, border: "1px solid var(--border,#e3e7ef)", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Payment History / Money Receipt Ledger</h3>
                      <small>Imported receipts and ERP payments across every registration code</small>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <select aria-label="Select course enrollment" value={effectiveEnrollmentId}
                        onChange={event => { setSelectedEnrollmentId(event.target.value); setHistoryScope("selected"); }}
                        style={{ minHeight: 36, borderRadius: 8, padding: "6px 10px", border: "1px solid var(--border,#d9deea)", background: "var(--surface,#fff)", color: "inherit" }}>
                        {enrollmentOptions.length ? enrollmentOptions.map(enrollment =>
                          <option key={String(enrollment._id)} value={String(enrollment._id)}>
                            {enrollment.courseCode || enrollment.semesterLabel || "Course"} ({enrollment.stCode})
                          </option>
                        ) : <option value={currentStCode}>{currentStCode || "Current registration"}</option>}
                      </select>
                      <button type="button" className={historyScope === "all" ? "primary-btn" : "ghost-btn"} onClick={() => setHistoryScope("all")}>All Semesters / Full History</button>
                      <button type="button" className={historyScope === "current" ? "primary-btn" : "ghost-btn"} onClick={() => { setSelectedEnrollmentId(String(currentEnrollment?._id || "")); setHistoryScope("current"); }}>Current ({currentStCode || "Code"})</button>
                    </div>
                  </div>
                  <div className="student-fee-overview" style={{ marginTop: 12 }}>
                    <div className="fee-overview-card fee-paid"><span>Total Paid Across All Semesters</span><strong>₹{totalAcrossSemesters.toLocaleString("en-IN")}</strong></div>
                    <div className="fee-overview-card fee-paid"><span>Current Semester Paid</span><strong>₹{currentSemesterPaid.toLocaleString("en-IN")}</strong></div>
                    <div className="fee-overview-card fee-due"><span>Current Balance Due</span><strong>₹{currentBalanceDue.toLocaleString("en-IN")}</strong></div>
                  </div>
                  <div style={{ overflowX: "auto", marginTop: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                      <thead><tr>
                        {["Date (D.O.P.)", "MR No", "St_Code", "Course / Semester", "Amount Paid", "Installment / Fee Applied"].map(label =>
                          <th key={label} style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border,#e3e7ef)", fontSize: 12 }}>{label}</th>
                        )}
                      </tr></thead>
                      <tbody>
                        {historyRows.length ? historyRows.map((payment, index) => (
                          <tr key={String(payment._id || payment.mrNo) + "-" + index}>
                            <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{formatDate(payment.paymentDate || payment.rawPaymentDate || payment.date)}</td>
                            <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{payment.mrNo || payment.receiptNo || "—"}</td>
                            <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{payment.stCode || currentStCode || "—"}</td>
                            <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{payment.courseName || payment.courseCode || "—"}{payment.semesterLabel ? " / " + payment.semesterLabel : ""}</td>
                            <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)", fontWeight: 700 }}>₹{Number(payment.amountPaid ?? payment.amount ?? 0).toLocaleString("en-IN")}</td>
                            <td style={{ padding: "9px 8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{payment.installmentApplied || payment.paymentType || "Legacy receipt / not allocated"}</td>
                          </tr>
                        )) : <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "var(--muted,#7b8494)" }}>No payment receipts are linked to this student profile yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h4 style={{ margin: 0 }}>Installment Breakdown — {selectedEnrollment?.semesterLabel || selectedEnrollment?.courseCode || "Selected Semester"} ({effectiveStCode || "—"})</h4>
                      <small>Due ₹{selectedDue.toLocaleString("en-IN")} · Paid ₹{selectedPaid.toLocaleString("en-IN")} · Balance ₹{selectedBalance.toLocaleString("en-IN")}</small>
                    </div>
                    <div style={{ overflowX: "auto", marginTop: 8 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                        <thead><tr>
                          {["Installment", "Due Date", "Amount Due", "Amount Paid", "Balance", "Status"].map(label =>
                            <th key={label} style={{ textAlign: "left", padding: "9px 8px", borderBottom: "1px solid var(--border,#e3e7ef)", fontSize: 12 }}>{label}</th>
                          )}
                        </tr></thead>
                        <tbody>
                          {selectedInstallments.length ? selectedInstallments.map((installment, index) => (
                            <tr key={String(installment.index ?? index) + "-" + installment.label}>
                              <td style={{ padding: "8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{installment.label}</td>
                              <td style={{ padding: "8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{formatDate(installment.dueDate)}</td>
                              <td style={{ padding: "8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>₹{Number(installment.amountDue || 0).toLocaleString("en-IN")}</td>
                              <td style={{ padding: "8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>₹{Number(installment.amountPaid || 0).toLocaleString("en-IN")}</td>
                              <td style={{ padding: "8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>₹{Math.max(0, Number(installment.amountDue || 0) - Number(installment.amountPaid || 0)).toLocaleString("en-IN")}</td>
                              <td style={{ padding: "8px", borderBottom: "1px solid var(--border,#eef0f4)" }}>{installment.status || "PENDING"}</td>
                            </tr>
                          )) : <tr><td colSpan={6} style={{ padding: 14, textAlign: "center", color: "var(--muted,#7b8494)" }}>No installment plan is available for this registration. Legacy receipts remain listed above.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
                <button
                  type="button"
                  className="fee-workspace-launch"
                  onClick={() => setFeeWorkspaceOpen(true)}
                >
                  <span className="fee-workspace-icon">
                    <WalletCards size={22} />
                  </span>
                  <span>
                    <strong>Open Fee & Receipt Workspace</strong>
                    <small>
                      Manage fee plan, record payments and review the complete payment history
                    </small>
                  </span>
                  <span className="fee-workspace-action">
                    Open workspace <ArrowLeft size={15} />
                  </span>
                </button>
                {feeWorkspaceOpen && (
                  <div
                    className="fee-modal-backdrop"
                    role="presentation"
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) setFeeWorkspaceOpen(false);
                    }}
                  >
                    <section
                      className="fee-workspace-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="fee-workspace-title"
                    >
                      <header className="fee-modal-header">
                        <div>
                          <div className="eyebrow">STUDENT FINANCE</div>
                          <h2 id="fee-workspace-title">Fee & Receipt Workspace</h2>
                          <p>
                            {student.applicantName} · {currentStCode || student.formNo}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="fee-modal-close"
                          onClick={() => setFeeWorkspaceOpen(false)}
                          aria-label="Close fee workspace"
                        >
                          ×
                        </button>
                      </header>
                      <div className="fee-modal-body">
                        <div className="fee-modal-stats">
                          <div>
                            <small>Total payable</small>
                            <strong>₹{currentPayable.toLocaleString("en-IN")}</strong>
                          </div>
                          <div>
                            <small>Paid till date</small>
                            <strong className="fee-green">
                              ₹{currentPaid.toLocaleString("en-IN")}
                            </strong>
                          </div>
                          <div>
                            <small>Balance due</small>
                            <strong className="fee-red">
                              ₹{currentBalanceDue.toLocaleString("en-IN")}
                            </strong>
                          </div>
                        </div>
                        <StudentFeePlanSection fee={fee} feeForm={feeForm} setFeeForm={setFeeForm} saveFees={saveFees} />
                        <StudentPaymentEntrySection
                          feeForm={feeForm}
                          setFeeForm={setFeeForm}
                          paymentItems={paymentItems}
                          setPaymentItems={setPaymentItems}
                          saveFees={saveFees}
                          proofUploading={proofUploading}
                          uploadPaymentProof={uploadPaymentProof}
                        />
                        <StudentPaymentHistorySection fee={fee} printBill={printBill} />
                      </div>
                      <footer className="fee-modal-footer">
                        <span>Print format remains a compact half-page receipt.</span>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setFeeWorkspaceOpen(false)}
                        >
                          Close workspace
                        </button>
                      </footer>
                    </section>
                  </div>
                )}
              </section>
  );
}
