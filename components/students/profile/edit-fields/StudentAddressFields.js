"use client";

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
  );
}
