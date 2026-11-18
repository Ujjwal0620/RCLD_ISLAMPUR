"use client";

export default function StudentAcademicDocumentFields({ editForm, setEditForm }) {
  return (
    <div className="edit-card">
                            <h4>Academic & Documents</h4>
                            <div className="form-grid two">
                              <label className="form-field">
                                <span>Qualification</span>
                                <input
                                  value={editForm.qualifications?.[0]?.examCourse || ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      qualifications: [
                                        { ...(f.qualifications?.[0] || {}), examCourse: e.target.value },
                                      ],
                                    }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Board / University</span>
                                <input
                                  value={editForm.qualifications?.[0]?.boardUniversity || ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      qualifications: [
                                        {
                                          ...(f.qualifications?.[0] || {}),
                                          boardUniversity: e.target.value,
                                        },
                                      ],
                                    }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Qualification Year</span>
                                <input
                                  value={editForm.qualifications?.[0]?.year || ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      qualifications: [
                                        { ...(f.qualifications?.[0] || {}), year: e.target.value },
                                      ],
                                    }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Percentage</span>
                                <input
                                  value={editForm.qualifications?.[0]?.percentage || ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      qualifications: [
                                        { ...(f.qualifications?.[0] || {}), percentage: e.target.value },
                                      ],
                                    }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Declaration Date</span>
                                <input
                                  type="date"
                                  value={editForm.declarationDate || ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, declarationDate: e.target.value }))
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>Declaration Place</span>
                                <input
                                  value={editForm.declarationPlace || ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, declarationPlace: e.target.value }))
                                  }
                                />
                              </label>
                            </div>
                          </div>
  );
}
