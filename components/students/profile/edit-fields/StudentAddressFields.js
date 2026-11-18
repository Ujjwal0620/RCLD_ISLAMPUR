"use client";

import StudentPresentAddressLocationFields from "@/components/students/profile/edit-fields/StudentPresentAddressLocationFields";
import StudentPermanentAddressLocationFields from "@/components/students/profile/edit-fields/StudentPermanentAddressLocationFields";

export default function StudentAddressFields({ editForm, setEditForm, indiaLocations }) {
  return (
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
                                  <StudentPresentAddressLocationFields editForm={editForm} setEditForm={setEditForm} indiaLocations={indiaLocations} />
                                    <StudentPermanentAddressLocationFields editForm={editForm} setEditForm={setEditForm} indiaLocations={indiaLocations} />
                                </div>
  );
}
