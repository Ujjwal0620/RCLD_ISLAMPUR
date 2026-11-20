"use client";

import { Camera, UserRound } from "lucide-react";
import RCLDLogo from "@/components/RCLDLogo";
import { formatDisplayValue as value } from "@/lib/formatters";

export default function StudentProfileHero({ student, uploadStudentPhoto, photoUploading }) {
  return (
    <section className="student-profile-card student-profile-hero">
                <div className="student-profile-brand">
                  <RCLDLogo className="student-profile-logo" />
              <div>
                    <span>RASHTRIYA COMPUTER LITERACY DRIVE</span>
                    <strong>STUDENT PROFILE</strong>
                    <small>RCLD ISLAMPUR EDUCATION ERP</small>
                  </div>
                </div>
                <div className="student-avatar" style={{ position: "relative" }}>
                  {student.photoUrl ? <img src={student.photoUrl} alt={student.applicantName + " photograph"} /> : <UserRound size={30} />}
                  <label
                    title={student.photoUrl ? "Change student photograph" : "Upload student photograph"}
                    style={{
                      position: "absolute", right: -7, bottom: -7, width: 34, height: 34,
                      display: "grid", placeItems: "center", borderRadius: "50%",
                      background: "var(--primary,#315efb)", color: "#fff", border: "2px solid var(--surface,#fff)",
                      cursor: photoUploading ? "wait" : "pointer", opacity: photoUploading ? .65 : 1,
                    }}
                  >
                    <Camera size={16} />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={photoUploading}
                      aria-label="Upload or change student photograph"
                      style={{ display: "none" }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadStudentPhoto(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <small style={{ gridColumn: "1 / -1", marginTop: -6, opacity: .7 }}>
                  {photoUploading ? "Saving photograph…" : "Click camera to upload or change photo"}
                </small>
                <div className="student-profile-identity">
                  <div className="eyebrow">STUDENT RECORD / REGISTRATION</div>
                  <h2>{student.applicantName}</h2>
                  <p>
                    Form No. {value(student.formNo)} · {value(student.courseName)} ·{" "}
                    {value(student.mobileNumber)}
                  </p>
                </div>
                <span className="badge profile-status">{value(student.status)}</span>
              </section>
  );
}
