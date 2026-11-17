"use client";

import { Printer } from "lucide-react";

export default function StudentPaymentHistorySection({ fee, printBill }) {
  return (
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
  );
}
