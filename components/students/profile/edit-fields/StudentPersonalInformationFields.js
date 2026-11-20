"use client";

import DigitBoxes from "@/components/students/DigitBoxes";
import StudentAddressFields from "@/components/students/profile/edit-fields/StudentAddressFields";

export default function StudentPersonalInformationFields({ editForm, setEditForm, referrals, indiaLocations }) {
  return (
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
                                <span>Email Address</span>
                                <input
                                  type="email"
                                  value={editForm.email || ""}
                                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                />
                              </label>
                              <label className="form-field">
                                <span>Aadhaar Card Number</span>
                                <input
                                  inputMode="numeric"
                                  pattern="[0-9]{12}"
                                  maxLength="12"

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
                            <StudentAddressFields editForm={editForm} setEditForm={setEditForm} indiaLocations={indiaLocations} />
                          </div>
  );
}
