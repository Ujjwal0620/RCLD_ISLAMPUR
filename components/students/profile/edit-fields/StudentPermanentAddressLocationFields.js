"use client";

export default function StudentPermanentAddressLocationFields({ editForm, setEditForm, indiaLocations }) {
  return (
    <div className="form-grid two">
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
  );
}
