"use client";

import { Save } from "lucide-react";

export default function StudentPaymentEntrySection({ feeForm, setFeeForm, paymentItems, setPaymentItems, saveFees, proofUploading, uploadPaymentProof }) {
  return (
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
  );
}
