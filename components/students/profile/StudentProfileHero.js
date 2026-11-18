"use client";

import { UserRound } from "lucide-react";
import RCLDLogo from "@/components/RCLDLogo";
import { formatDisplayValue as value } from "@/lib/formatters";

export default function StudentProfileHero({ student }) {
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
                <div className="student-avatar">
                  {student.photoUrl ? <img src={student.photoUrl} alt="" /> : <UserRound size={30} />}
                </div>
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
