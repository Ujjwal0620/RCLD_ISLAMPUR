"use client";

import { Pencil, Save } from "lucide-react";
import StudentIdentityRegistrationFields from "@/components/students/profile/edit-fields/StudentIdentityRegistrationFields";
import StudentCourseFeeFields from "@/components/students/profile/edit-fields/StudentCourseFeeFields";
import StudentPersonalInformationFields from "@/components/students/profile/edit-fields/StudentPersonalInformationFields";
import StudentAcademicDocumentFields from "@/components/students/profile/edit-fields/StudentAcademicDocumentFields";
import StudentStatusEnclosureFields from "@/components/students/profile/edit-fields/StudentStatusEnclosureFields";

export default function StudentEditPanel({
  editing,
  setEditing,
  editForm,
  setEditForm,
  feeForm,
  setFeeForm,
  courses,
  batches,
  referrals,
  saveStudent,
  indiaLocations,
  setMessage,
  uploadStudentPhoto,
  photoUploading,
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
                    <div className="edit-card student-photo-edit-card" style={{ marginBottom: 16 }}>
                      <h4>Student Photograph</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                        <div style={{ width: 112, height: 132, borderRadius: 12, border: "1px solid var(--border-color,#dbe2ec)", background: "var(--surface-muted,#f4f6fa)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                          {editForm.photoUrl ? <img src={editForm.photoUrl} alt="Student photograph preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 12, opacity: .65 }}>No photo</span>}
                        </div>
                        <div>
                          <label className="form-field">
                            <span>{editForm.photoUrl ? "Change student photo" : "Upload student photo"}</span>
                            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoUploading} onChange={event => {
                              const file = event.target.files?.[0];
                              if (file) uploadStudentPhoto(file);
                              event.target.value = "";
                            }} />
                          </label>
                          <p className="form-help" style={{ marginTop: 7 }}>JPG, PNG or WebP · maximum 5 MB · stored securely in Cloudinary.</p>
                          {photoUploading && <p className="form-help">Uploading photograph…</p>}
                          {editForm.photoUrl && <span className="form-help">The photograph is saved to this student profile immediately after upload.</span>}
                        </div>
                      </div>
                    </div>
                    <div className="student-edit-grid">
                      <StudentIdentityRegistrationFields editForm={editForm} setEditForm={setEditForm} />
                    <StudentCourseFeeFields editForm={editForm} setEditForm={setEditForm} feeForm={feeForm} setFeeForm={setFeeForm} courses={courses} batches={batches} />
                    <StudentPersonalInformationFields editForm={editForm} setEditForm={setEditForm} referrals={referrals} indiaLocations={indiaLocations} />
                    <StudentAcademicDocumentFields editForm={editForm} setEditForm={setEditForm} />
                    <StudentStatusEnclosureFields editForm={editForm} setEditForm={setEditForm} setMessage={setMessage} />
                    <div className="form-actions sticky-edit-actions">
                      <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                      <button className="primary-btn" disabled={photoUploading}>
                        <Save size={16} /> Save Changes
                      </button>
                    </div>
                    </div>
                  </form>
                </section>
  );
}
