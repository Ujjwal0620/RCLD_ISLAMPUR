"use client";

import { Pencil, Save } from "lucide-react";
import { DetailField as Detail } from "@/components/students/DetailField";
import DigitBoxes from "@/components/students/DigitBoxes";
import { formatDisplayValue as value } from "@/lib/formatters";

export default function StudentEditPanel({
  editing,
  setEditing,
  student,
  editForm,
  setEditForm,
  courses,
  batches,
  referrals,
  saveStudent,
  indiaLocations,
}) {
  if (!editing) return null;

  return (
    <section className="detail-section student-edit-panel">
                  <div className="detail-section-title">
                    <Pencil size={17} />
                    <div>
                      <h3>Edit Student Profile</h3>
                      <span>
                        Complete student master data. Imported Excel values are preserved; synthetic
                        values are marked as demo data in the source import.
                      </span>
                    </div>
                  </div>
                  <form onSubmit={saveStudent}>
                    <div className="student-edit-grid">
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
                              required
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
                            <input value={feeForm.totalFee ?? 0} readOnly />
                          </label>
                          <label className="form-field">
                            <span>Admission Fee (₹)</span>
                            <input value={feeForm.admissionFee ?? 0} readOnly />
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
                      <div className="edit-card">
                        <h4>Personal Information</h4>
                        <div className="form-grid two">
                          {[
                            ["nationality", "Nationality"],
                            ["dateOfBirth", "Date of Birth"],
                            ["fatherOrHusbandName", "Father / Husband Name"],
                            ["pin", "PIN"],
                          ].map(([k, l]) => (
                            <label className="form-field" key={k}>
                              <span>{l}</span>
                              <input
                                type={k === "dateOfBirth" ? "date" : "text"}
                                value={editForm[k] || ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))}
                              />
                            </label>
                          ))}
                          <DigitBoxes
                            label="Mobile No. (10 digits)"
                            value={editForm.mobileNumber || ""}
                            onChange={(v) => setEditForm((f) => ({ ...f, mobileNumber: v }))}
                          />
                          <DigitBoxes
                            label="Mob. of Guardian (10 digits)"
                            value={editForm.guardianContactNumber || ""}
                            onChange={(v) => setEditForm((f) => ({ ...f, guardianContactNumber: v }))}
                          />
                          <DigitBoxes
                            label="WhatsApp No. (10 digits)"
                            value={editForm.whatsappNumber || ""}
                            onChange={(v) => setEditForm((f) => ({ ...f, whatsappNumber: v }))}
                          />
                          <label className="form-field">
                            <span>Email Address *</span>
                            <input
                              type="email"
                              required
                              value={editForm.email || ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                            />
                          </label>
                          <label className="form-field">
                            <span>Aadhaar Card Number *</span>
                            <input
                              inputMode="numeric"
                              pattern="[0-9]{12}"
                              maxLength="12"
                              required
                              value={editForm.aadhaarNumber || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  aadhaarNumber: e.target.value.replace(/\D/g, "").slice(0, 12),
                                }))
                              }
                            />
                          </label>
                          <label className="form-field">
                            <span>Referral</span>
                            <select
                              value={editForm.referralId || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, referralId: e.target.value }))
                              }
                            >
                              <option value="">Direct / No referral</option>
                              {referrals.map((r) => (
                                <option key={r._id} value={r._id}>
                                  {r.name} — {r.marketingEmployeeName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field">
                            <span>Sex</span>
                            <select
                              value={editForm.sex || ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, sex: e.target.value }))}
                            >
                              <option value="">Select</option>
                              <option value="M">Male</option>
                              <option value="F">Female</option>
                            </select>
                          </label>
                        </div>
                        <div className="student-address-edit-grid">
                          <label className="form-field">
                            <span>Present Address / Ward / Village / Town</span>
                            <textarea
                              rows="3"
                              value={editForm.presentAddress || editForm.address || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  presentAddress: e.target.value,
                                  address: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="form-field">
                            <span>Permanent Address / Ward / Village / Town</span>
                            <textarea
                              rows="3"
                              value={editForm.permanentAddress || ""}
                              disabled={!!editForm.sameAsPresentAddress}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  permanentAddress: e.target.value,
                                  sameAsPresentAddress: false,
                                }))
                              }
                            />
                          </label>
                          <label className="registration-same-address">
                            <input
                              type="checkbox"
                              checked={!!editForm.sameAsPresentAddress}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  sameAsPresentAddress: e.target.checked,
                                  permanentAddress: e.target.checked
                                    ? f.presentAddress || f.address || ""
                                    : f.permanentAddress,
                                }))
                              }
                            />{" "}
                            Same as present address
                          </label>
                          <div className="form-grid two">
                            <label className="form-field">
                              <span>Present P.O.</span>
                              <input
                                value={editForm.postOffice || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, postOffice: e.target.value }))
                                }
                              />
                            </label>
                            <label className="form-field">
                              <span>Present P.S.</span>
                              <input
                                value={editForm.policeStation || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, policeStation: e.target.value }))
                                }
                              />
                            </label>
                            <label className="form-field">
                              <span>Present State</span>
                              <select
                                value={editForm.state || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, state: e.target.value, district: "" }))
                                }
                              >
                                <option value="">Select state</option>
                                {indiaLocations.map((st) => (
                                  <option key={st.code} value={st.name}>
                                    {st.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Present District</span>
                              <select
                                value={editForm.district || ""}
                                disabled={!editForm.state}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, district: e.target.value }))
                                }
                              >
                                <option value="">Select district</option>
                                {(
                                  indiaLocations.find((st) => st.name === editForm.state)?.districts ||
                                  []
                                ).map((d) => (
                                  <option key={d.code} value={d.name}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Present PIN</span>
                              <input
                                value={editForm.pin || ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, pin: e.target.value }))}
                              />
                            </label>
                            <label className="form-field">
                              <span>Present Nearest Landmark</span>
                              <input
                                value={editForm.nearestLandmark || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, nearestLandmark: e.target.value }))
                                }
                              />
                            </label>
                            <label className="form-field">
                              <span>Permanent P.O.</span>
                              <input
                                value={editForm.permanentPostOffice || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, permanentPostOffice: e.target.value }))
                                }
                              />
                            </label>
                            <label className="form-field">
                              <span>Permanent State</span>
                              <select
                                value={editForm.permanentState || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    permanentState: e.target.value,
                                    permanentDistrict: "",
                                  }))
                                }
                              >
                                <option value="">Select state</option>
                                {indiaLocations.map((st) => (
                                  <option key={st.code} value={st.name}>
                                    {st.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Permanent District</span>
                              <select
                                value={editForm.permanentDistrict || ""}
                                disabled={!editForm.permanentState}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, permanentDistrict: e.target.value }))
                                }
                              >
                                <option value="">Select district</option>
                                {(
                                  indiaLocations.find((st) => st.name === editForm.permanentState)
                                    ?.districts || []
                                ).map((d) => (
                                  <option key={d.code} value={d.name}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Permanent PIN</span>
                              <input
                                value={editForm.permanentPin || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, permanentPin: e.target.value }))
                                }
                              />
                            </label>
                            <label className="form-field">
                              <span>Permanent Nearest Landmark</span>
                              <input
                                value={editForm.permanentNearestLandmark || ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    permanentNearestLandmark: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                      </div>
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
                    </div>
                    <div className="form-actions sticky-edit-actions">
                      <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                      <button className="primary-btn">
                        <Save size={16} /> Save Changes
                      </button>
                    </div>
                  </form>
                </section>
  );
}
