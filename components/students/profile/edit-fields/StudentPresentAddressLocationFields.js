"use client";

export default function StudentPresentAddressLocationFields({ editForm, setEditForm, indiaLocations }) {
  return (
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
    </div>
  );
}
