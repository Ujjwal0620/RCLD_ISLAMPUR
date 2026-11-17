"use client";

import { Save } from "lucide-react";

export default function StudentFeePlanSection({ fee, feeForm, setFeeForm, saveFees }) {
  return (
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
  );
}
