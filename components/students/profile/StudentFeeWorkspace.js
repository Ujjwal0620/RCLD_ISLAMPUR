"use client";

import { ArrowLeft, CreditCard, WalletCards } from "lucide-react";

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
                        <section className="fee-modal-section">
                          <div className="fee-modal-section-heading">
                            <div>
                              <h3>Fee Plan & Breakdown</h3>
                              <p>Update the approved student fee structure</p>
                            </div>
                            <span className="fee-section-tag">FEE SETUP</span>
                          </div>
                          <form className="inline-operation-form fee-modal-form" onSubmit={saveFees}>
                            <div className="form-grid four">
                              <label className="form-field">
                                <span>Course Fee (₹)</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={feeForm.totalFee}
                                  onChange={(e) =>
                                    setFeeForm((f) => ({ ...f, totalFee: e.target.value }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Discount (₹)</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={feeForm.discount}
                                  onChange={(e) =>
                                    setFeeForm((f) => ({ ...f, discount: e.target.value }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Admission Fee (₹)</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={feeForm.admissionFee}
                                  onChange={(e) =>
                                    setFeeForm((f) => ({ ...f, admissionFee: e.target.value }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Registration Fee (₹)</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={feeForm.registrationFee}
                                  onChange={(e) =>
                                    setFeeForm((f) => ({ ...f, registrationFee: e.target.value }))
                                  }
                                />
                              </label>
                            </div>
                            <div className="fee-plan-total">
                              <span>Current payable amount</span>
                              <strong>₹{Number(fee?.payable || 0).toLocaleString("en-IN")}</strong>
                              <span>
                                Late fine: ₹{Number(fee?.lateFine || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="fee-modal-actions">
                              <button className="primary-btn operation-btn">
                                <Save size={16} /> Save Fee Plan
                              </button>
                            </div>
                          </form>
                        </section>
                        <section className="fee-modal-section">
                          <div className="fee-modal-section-heading">
                            <div>
                              <h3>Record New Payment</h3>
                              <p>Capture every transaction detail for the student ledger</p>
                            </div>
                            <span className="fee-section-tag fee-tag-blue">NEW ENTRY</span>
                          </div>
                          <form className="inline-operation-form fee-modal-form" onSubmit={saveFees}>
                            <div className="form-grid four">
                              <label className="form-field">
                                <span>Payment Date *</span>
                                <input
                                  type="date"
                                  required
                                  value={feeForm.date}
                                  onChange={(e) => {
                                    const date = e.target.value;
                                    setFeeForm((f) => ({ ...f, date }));
                                    const isLate = Number(date.slice(8, 10)) > 10;
                                    setPaymentItems((items) => {
                                      const withoutLate = items.filter(
                                        (item) => item.purpose !== "Late Fine",
                                      );
                                      return isLate
                                        ? [
                                            ...withoutLate,
                                            {
                                              id: `late-fine-${date}`,
                                              purpose: "Late Fine",
                                              amount: "50",
                                              installmentMonth: "",
                                            },
                                          ]
                                        : withoutLate;
                                    });
                                  }}
                                />
                              </label>
                              <label className="form-field">
                                <span>Payment Method *</span>
                                <select
                                  value={feeForm.method}
                                  onChange={(e) => setFeeForm((f) => ({ ...f, method: e.target.value }))}
                                >
                                  <option>Cash</option>
                                  <option>UPI</option>
                                  <option>Bank Transfer</option>
                                  <option>Card</option>
                                  <option>PhonePe</option>
                                </select>
                              </label>
                              <label className="form-field">
                                <span>UTR / Transaction No.</span>
                                <input
                                  value={feeForm.utrNumber}
                                  onChange={(e) =>
                                    setFeeForm((f) => ({ ...f, utrNumber: e.target.value }))
                                  }
                                  placeholder="Enter UTR number"
                                />
                              </label>
                              <label className="form-field">
                                <span>Other Reference</span>
                                <input
                                  value={feeForm.reference}
                                  onChange={(e) =>
                                    setFeeForm((f) => ({ ...f, reference: e.target.value }))
                                  }
                                  placeholder="Receipt / bank reference"
                                />
                              </label>
                            </div>
                            <div className="fee-payment-items">
                              <div className="fee-modal-section-heading">
                                <div>
                                  <h4>Payment Sections & Amounts</h4>
                                  <p>
                                    Add multiple fee heads to this one receipt. Each line is recorded
                                    separately in the receipt breakdown.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  onClick={() =>
                                    setPaymentItems((items) => [
                                      ...items,
                                      {
                                        id: `payment-line-${Date.now()}-${items.length}`,
                                        purpose: "Lab Charge",
                                        amount: "",
                                        installmentMonth: "",
                                      },
                                    ])
                                  }
                                >
                                  + Add Fee Section
                                </button>
                              </div>
                              {paymentItems.map((item, index) => (
                                <div className="form-grid four fee-payment-item-row" key={item.id}>
                                  <label className="form-field">
                                    <span>Fee Section / Purpose</span>
                                    <select
                                      value={item.purpose}
                                      onChange={(e) =>
                                        setPaymentItems((items) =>
                                          items.map((row, i) =>
                                            i === index
                                              ? {
                                                  ...row,
                                                  purpose: e.target.value,
                                                  amount:
                                                    e.target.value === "Late Fine" ? "50" : row.amount,
                                                }
                                              : row,
                                          ),
                                        )
                                      }
                                    >
                                      <option>Course Fee</option>
                                      <option>Admission Fee</option>
                                      <option>Registration Fee</option>
                                      <option>Installment</option>
                                      <option>Lab Charge</option>
                                      <option>Late Fine</option>
                                      <option>Other</option>
                                    </select>
                                  </label>
                                  <label className="form-field">
                                    <span>Amount (₹) *</span>
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      value={item.amount}
                                      disabled={
                                        item.purpose === "Late Fine" && Number(item.amount) === 50
                                      }
                                      onChange={(e) =>
                                        setPaymentItems((items) =>
                                          items.map((row, i) =>
                                            i === index ? { ...row, amount: e.target.value } : row,
                                          ),
                                        )
                                      }
                                      placeholder="Enter amount"
                                    />
                                  </label>
                                  <label className="form-field">
                                    <span>Installment Month (if applicable)</span>
                                    <input
                                      type="month"
                                      value={item.installmentMonth}
                                      onChange={(e) =>
                                        setPaymentItems((items) =>
                                          items.map((row, i) =>
                                            i === index
                                              ? { ...row, installmentMonth: e.target.value }
                                              : row,
                                          ),
                                        )
                                      }
                                    />
                                  </label>
                                  <div className="form-field fee-item-remove">
                                    <span>&nbsp;</span>
                                    <button
                                      type="button"
                                      className="secondary-btn"
                                      disabled={
                                        paymentItems.length === 1 || item.purpose === "Late Fine"
                                      }
                                      onClick={() =>
                                        setPaymentItems((items) => items.filter((_, i) => i !== index))
                                      }
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <div className="fee-plan-total">
                                <span>Total amount on this receipt</span>
                                <strong>
                                  ₹
                                  {paymentItems
                                    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
                                    .toLocaleString("en-IN")}
                                </strong>
                                <span>
                                  {Number(feeForm.date.slice(8, 10)) > 10
                                    ? "₹50 late fine automatically included (payment date is after the 10th)."
                                    : "No late fine based on the selected payment date."}
                                </span>
                              </div>
                            </div>
                            <div className="form-grid four">
                              <label className="form-field">
                                <span>Payment Purpose / Note</span>
                                <input
                                  value={feeForm.note}
                                  onChange={(e) => setFeeForm((f) => ({ ...f, note: e.target.value }))}
                                  placeholder="Additional purpose or note"
                                />
                              </label>
                              <label className="form-field">
                                <span>Payment Screenshot</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={proofUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                      if (file.size > 5 * 1024 * 1024) {
                                      setMessage("Payment screenshot must be smaller than 5 MB.");
                                      return;
                                    }
                                    setProofUploading(true);
                                    try {
                                      const fd = new FormData();
                                      fd.append("file", file);
                                      fd.append("purpose", "payment-proof");
                                      const up = await fetch("/api/uploads/student-photo", {
                                        method: "POST",
                                        body: fd,
                                      });
                                      const ud = await up.json();
                                      if (!up.ok)
                                        throw new Error(ud.error || "Unable to upload screenshot.");
                                      setFeeForm((f) => ({ ...f, screenshotUrl: ud.url }));
                                      setMessage("Payment screenshot uploaded.");
                                    } catch (err) {
                                      setMessage(err.message);
                                    } finally {
                                      setProofUploading(false);
                                    }
                                  }}
                                />
                                {feeForm.screenshotUrl && (
                                  <a href={feeForm.screenshotUrl} target="_blank" rel="noreferrer">
                                    View uploaded screenshot
                                  </a>
                                )}
                              </label>
                            </div>
                            <div className="fee-modal-actions">
                              <button className="primary-btn operation-btn" disabled={proofUploading}>
                                <Save size={16} />
                                {proofUploading ? "Uploading…" : "Save Payment Entry"}
                              </button>
                            </div>
                          </form>
                        </section>
                        <section className="fee-modal-section fee-history-section">
                          <div className="fee-modal-section-heading">
                            <div>
                              <h3>Complete Payment History</h3>
                              <p>All payment records available for this student, newest first</p>
                            </div>
                            <span className="fee-section-tag">
                              {(fee?.payments || []).length} RECORDS
                            </span>
                          </div>
                          {(fee?.payments || []).length === 0 ? (
                            <div className="empty">No payment history recorded yet.</div>
                          ) : (
                            <div className="table-wrap fee-history-table-wrap">
                              <table className="fee-history-table">
                                <thead>
                                  <tr>
                                    <th>Receipt No.</th>
                                    <th>Date</th>
                                    <th>Type / Installment</th>
                                    <th>Method</th>
                                    <th>UTR / Reference</th>
                                    <th>Amount</th>
                                    <th>Recorded By</th>
                                    <th>Receipt</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fee.payments
                                    .slice()
                                    .sort((a, b) =>
                                      String(b.date || "").localeCompare(String(a.date || "")),
                                    )
                                    .map((p, i) => (
                                      <tr key={p._id || p.receiptNo || i}>
                                        <td>
                                          <strong>{p.receiptNo || "Pending"}</strong>
                                        </td>
                                        <td>{p.date || "—"}</td>
                                        <td>
                                          {p.paymentType || "General"}
                                          <small>{p.installmentMonth || p.dueDate || "—"}</small>
                                        </td>
                                        <td>{p.method || "—"}</td>
                                        <td>{p.utrNumber || p.reference || "—"}</td>
                                        <td className="fee-history-amount">
                                          ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                                        </td>
                                        <td>{p.recordedBy || "—"}</td>
                                        <td>
                                          <button
                                            type="button"
                                            className="fee-print-row"
                                            onClick={() => printBill(p)}
                                          >
                                            <Printer size={14} /> Print
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <div className="fee-history-total fee-history-summary">
                            <span>
                              Total Course Fee:{" "}
                              <strong>
                                ₹
                                {Number(
                                  fee?.payable ??
                                    Number(fee?.totalFee || 0) -
                                      Number(fee?.discount || 0) +
                                      Number(fee?.admissionFee || 0) +
                                      Number(fee?.registrationFee || 0) +
                                      Number(fee?.lateFine || 0),
                                ).toLocaleString("en-IN")}
                              </strong>
                            </span>
                            <span>
                              Amount Paid:{" "}
                              <strong>
                                ₹
                                {Number(
                                  fee?.paid ??
                                    (fee?.payments || []).reduce(
                                      (sum, p) => sum + Number(p.amount || 0),
                                      0,
                                    ),
                                ).toLocaleString("en-IN")}
                              </strong>
                            </span>
                            <span>
                              Amount Due:{" "}
                              <strong>
                                ₹
                                {Number(
                                  fee?.due ??
                                    Math.max(
                                      0,
                                      Number(
                                        fee?.payable ??
                                          Number(fee?.totalFee || 0) -
                                            Number(fee?.discount || 0) +
                                            Number(fee?.admissionFee || 0) +
                                            Number(fee?.registrationFee || 0) +
                                            Number(fee?.lateFine || 0),
                                      ) -
                                        Number(
                                          fee?.paid ??
                                            (fee?.payments || []).reduce(
                                              (sum, p) => sum + Number(p.amount || 0),
                                              0,
                                            ),
                                        ),
                                    ),
                                ).toLocaleString("en-IN")}
                              </strong>
                            </span>
                          </div>
                        </section>
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
