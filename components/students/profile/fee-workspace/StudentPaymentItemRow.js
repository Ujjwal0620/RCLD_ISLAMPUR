"use client";

export default function StudentPaymentItemRow({ item, index, paymentItems, setPaymentItems }) {
  return (
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
  );
}
