"use client";

import { Save } from "lucide-react";
import StudentPaymentMetadataFields from "@/components/students/profile/fee-workspace/StudentPaymentMetadataFields";
import StudentPaymentItemsEditor from "@/components/students/profile/fee-workspace/StudentPaymentItemsEditor";

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
                                <StudentPaymentMetadataFields feeForm={feeForm} setFeeForm={setFeeForm} setPaymentItems={setPaymentItems} />
                                <StudentPaymentItemsEditor feeForm={feeForm} paymentItems={paymentItems} setPaymentItems={setPaymentItems} />
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
