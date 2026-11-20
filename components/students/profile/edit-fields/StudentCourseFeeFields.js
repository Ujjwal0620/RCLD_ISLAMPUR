"use client";

export default function StudentCourseFeeFields({ editForm, setEditForm, feeForm, setFeeForm, courses, batches }) {
  return (
    <div className="edit-card">
                            <h4>Course & Fee</h4>
                            <div className="form-grid two">
                              <label className="form-field">
                                <span>Course</span>
                                <select
                                  value={editForm.courseCode || ""}
                                  onChange={(e) => {
                                    const selected = courses.find((x) => x.code === e.target.value);
                                    setEditForm((f) => ({
                                      ...f,
                                      courseCode: selected?.code || "",
                                      courseName: selected?.name || "",
                                      sourceCourseLabel: selected?.code || "",
                                    }));
                                    if (selected)
                                      setFeeForm((f) => ({
                                        ...f,
                                        totalFee: selected.fee || 0,
                                        admissionFee: selected.admissionFee || 0,
                                        registrationFee: selected.registrationFee || f.registrationFee || 0,
                                      }));
                                  }}
                                >
                                  <option value="">Select course</option>
                                  {courses.map((x) => (
                                    <option key={x._id} value={x.code}>
                                      {x.code} — {x.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="form-field">
                                <span>Course Code</span>
                                <input value={editForm.courseCode ?? ""} readOnly />
                              </label>
                              <label className="form-field">
                                <span>Course Fee (₹)</span>
                                <input value={feeForm?.totalFee ?? 0} readOnly />
                              </label>
                              <label className="form-field">
                                <span>Admission Fee (₹)</span>
                                <input value={feeForm?.admissionFee ?? 0} readOnly />
                              </label>
                              <label className="form-field">
                                <span>Due Amount</span>
                                <input
                                  value={editForm.dueAmount ?? ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, dueAmount: e.target.value }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Payment Status</span>
                                <input
                                  value={editForm.paymentStatus ?? ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, paymentStatus: e.target.value }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Batch Assignment</span>
                                <select
                                  value={editForm.batchId || ""}
                                  onChange={(e) => {
                                    const b = batches.find((x) => String(x._id) === e.target.value);
                                    setEditForm((f) => ({
                                      ...f,
                                      batchId: e.target.value || null,
                                      batchCode: b?.batchCode || "",
                                    }));
                                  }}
                                >
                                  <option value="">Not assigned</option>
                                  {batches
                                    .filter(
                                      (b) =>
                                        String(b.courseCode || "").toUpperCase() ===
                                          String(editForm.courseCode || "").toUpperCase() &&
                                        !["Cancelled", "Completed"].includes(b.status),
                                    )
                                    .map((b) => (
                                      <option key={b._id} value={b._id}>
                                        {b.batchCode} — {b.name} ({b.courseCode})
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label className="form-field">
                                <span>Original Course / Series</span>
                                <input
                                  value={editForm.sourceCourseLabel ?? ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, sourceCourseLabel: e.target.value }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Payment Purpose / Note</span>
                                <input
                                  value={editForm.paymentNote ?? ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, paymentNote: e.target.value }))
                                  }
                                />
                              </label>
                            </div>
                          </div>
  );
}
