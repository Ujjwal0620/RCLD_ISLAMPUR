"use client";

export default function StudentStatusEnclosureFields({ student, editForm, setEditForm }) {
  return (
    <div className="edit-card">
                            <h4>Status & Enclosures</h4>
                            <div className="form-grid two">
                              <label className="form-field">
                                <span>Status</span>
                                <select
                                  value={editForm.status || "Registered"}
                                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                                >
                                  {[
                                    "Registered",
                                    "Admission Pending",
                                    "Active",
                                    "Course Completed",
                                    "Dropped Out",
                                    "Cancelled",
                                    "Suspended",
                                    "Alumni",
                                  ].map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="form-field">
                                <span>Student Signature Image</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (file.size > 3 * 1024 * 1024) {
                                      setMessage("Signature image must be smaller than 3 MB.");
                                      return;
                                    }
                                    const fd = new FormData();
                                    fd.append("file", file);
                                    fd.append("purpose", "signature");
                                    const r = await fetch("/api/uploads/student-photo", {
                                      method: "POST",
                                      body: fd,
                                    });
                                    const d = await r.json();
                                    if (!r.ok) {
                                      setMessage(d.error || "Unable to upload signature.");
                                      return;
                                    }
                                    setEditForm((f) => ({ ...f, signatureUrl: d.url }));
                                  }}
                                />
                                {editForm.signatureUrl && (
                                  <img
                                    src={editForm.signatureUrl}
                                    alt="Student signature"
                                    style={{
                                      display: "block",
                                      maxWidth: 220,
                                      maxHeight: 80,
                                      objectFit: "contain",
                                      marginTop: 8,
                                    }}
                                  />
                                )}
                              </label>
                            </div>
                            <div className="checks edit-checks">
                              {[
                                ["stampPhoto", "Photo"],
                                ["qualifyingCertificates", "Qualification Certificates"],
                                ["matricAdmitCard", "Matric Admit Card"],
                              ].map(([k, l]) => (
                                <label key={k}>
                                  <input
                                    type="checkbox"
                                    checked={!!editForm.enclosures?.[k]}
                                    onChange={(e) =>
                                      setEditForm((f) => ({
                                        ...f,
                                        enclosures: { ...(f.enclosures || {}), [k]: e.target.checked },
                                      }))
                                    }
                                  />
                                  {l}
                                </label>
                              ))}
                            </div>
                          </div>
  );
}
