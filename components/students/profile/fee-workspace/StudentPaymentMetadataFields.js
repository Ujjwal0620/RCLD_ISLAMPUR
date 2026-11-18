"use client";

export default function StudentPaymentMetadataFields({ feeForm, setFeeForm, setPaymentItems }) {
  return (
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
  );
}
