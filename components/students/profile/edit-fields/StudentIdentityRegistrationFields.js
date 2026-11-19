"use client";

export default function StudentIdentityRegistrationFields({ editForm, setEditForm }) {
  return (
    <div className="edit-card">
                            <h4>Identity & Registration</h4>
                            <div className="form-grid two">
                              {[
                                ["formNo", "Form No."],
                                ["enrollmentNo", "Enrollment No."],
                                ["applicantName", "Applicant Name"],
                                ["aecCode", "AEC Code"],
                                ["regnNo", "Registration No."],
                                ["admissionDate", "Admission Date"],
                                ["sourceQualification", "Qualification (Source Excel)"],
                              ].map(([k, l]) => (
                                <label className="form-field" key={k}>
                                  <span>{l}</span>
                                  <input
                                    type={k === "admissionDate" ? "date" : "text"}
                                    value={editForm[k] || ""}
                                    readOnly={["formNo", "enrollmentNo", "aecCode"].includes(k)}
                                    onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
  );
}
