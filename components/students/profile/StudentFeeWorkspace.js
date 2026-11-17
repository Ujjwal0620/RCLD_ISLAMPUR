"use client";

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
                    <strong>₹{Number(fee?.payable || 0).toLocaleString("en-IN")}</strong>
                    <small>Course + admission + registration − discount</small>
                  </div>
                  <div className="fee-overview-card fee-paid">
                    <span>Total Collected</span>
                    <strong>₹{Number(fee?.paid || 0).toLocaleString("en-IN")}</strong>
                    <small>{(fee?.payments || []).length} payment entries recorded</small>
                  </div>
                  <div className="fee-overview-card fee-due">
                    <span>Outstanding Due</span>
                    <strong>₹{Number(fee?.due || 0).toLocaleString("en-IN")}</strong>
                    <small>Including applicable late fine</small>
                  </div>
                </div>
                <div className="fee-overview-meta">
                  <span>
                    <b>Course</b>
                    {value(student.courseName)}
                  </span>
                  <span>
                    <b>Enrollment</b>
                    {value(student.enrollmentNo)}
                  </span>
                  <span>
                    <b>Fee status</b>
                    <em className={Number(fee?.due || 0) <= 0 ? "fee-status-paid" : "fee-status-due"}>
                      {Number(fee?.due || 0) <= 0 ? "Paid" : "Payment Due"}
                    </em>
                  </span>
                </div>
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
                            {student.applicantName} · {student.enrollmentNo || student.formNo}
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
                            <strong>₹{Number(fee?.payable || 0).toLocaleString("en-IN")}</strong>
                          </div>
                          <div>
                            <small>Paid till date</small>
                            <strong className="fee-green">
                              ₹{Number(fee?.paid || 0).toLocaleString("en-IN")}
                            </strong>
                          </div>
                          <div>
                            <small>Balance due</small>
                            <strong className="fee-red">
                              ₹{Number(fee?.due || 0).toLocaleString("en-IN")}
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
                        <StudentPaymentHistorySection fee={fee} printBill={printBill} />                      <footer className="fee-modal-footer">
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
