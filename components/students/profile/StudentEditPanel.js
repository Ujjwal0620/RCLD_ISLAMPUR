"use client";

import { Pencil, Save } from "lucide-react";

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
                      <StudentIdentityRegistrationFields student={student} editForm={editForm} setEditForm={setEditForm} courses={courses} batches={batches} referrals={referrals} indiaLocations={indiaLocations} />
                    <StudentCourseFeeFields student={student} editForm={editForm} setEditForm={setEditForm} courses={courses} batches={batches} referrals={referrals} indiaLocations={indiaLocations} />
                    <StudentPersonalInformationFields student={student} editForm={editForm} setEditForm={setEditForm} courses={courses} batches={batches} referrals={referrals} indiaLocations={indiaLocations} />
                    <StudentAcademicDocumentFields student={student} editForm={editForm} setEditForm={setEditForm} courses={courses} batches={batches} referrals={referrals} indiaLocations={indiaLocations} />
                    <StudentStatusEnclosureFields student={student} editForm={editForm} setEditForm={setEditForm} courses={courses} batches={batches} referrals={referrals} indiaLocations={indiaLocations} />
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
