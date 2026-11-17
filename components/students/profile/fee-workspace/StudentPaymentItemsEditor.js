"use client";

import StudentPaymentItemRow from "@/components/students/profile/fee-workspace/StudentPaymentItemRow";

export default function StudentPaymentItemsEditor({ feeForm, paymentItems, setPaymentItems }) {
  return (
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
                                        <StudentPaymentItemRow item={item} index={index} paymentItems={paymentItems} setPaymentItems={setPaymentItems} />
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
  );
}
