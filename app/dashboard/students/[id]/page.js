"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, UserRound, Phone, MapPin, BookOpen, FileText, CreditCard, CalendarDays } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const value = (v) => v === undefined || v === null || v === "" ? "—" : v;

function Detail({ label, children }) {
  return <div className="student-detail-field"><span>{label}</span><strong>{value(children)}</strong></div>;
}

export default function StudentDetailsPage({ params }) {
  const [student, setStudent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { id } = await params;
        const response = await fetch("/api/students/" + id, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load student.");
        setStudent(data.student);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params]);

  return (
    <ERPLayout active="/dashboard/students">
      <header className="topbar">
        <div><div className="crumb">Students / Student Details</div><h1>{student?.applicantName || "Student Details"}</h1></div>
        <a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={17}/> Back to Students</a>
      </header>

      {loading && <section className="panel"><div className="empty">Loading student details…</div></section>}
      {error && <section className="panel"><div className="empty error-text">{error}</div></section>}

      {student && <main className="student-details">
        <section className="student-profile-card">
          <div className="student-avatar">{student.photoUrl ? <img src={student.photoUrl} alt="" /> : <UserRound size={30}/>}</div>
          <div><div className="eyebrow">Student Profile</div><h2>{student.applicantName}</h2><p>Form No. {value(student.formNo)} · {value(student.courseName)}</p></div>
          <span className="badge profile-status">{value(student.status)}</span>
        </section>

        <section className="detail-section">
          <div className="detail-section-title"><UserRound size={17}/><h3>Personal Details</h3></div>
          <div className="student-detail-grid">
            <Detail label="Form No.">{student.formNo}</Detail><Detail label="Registration No.">{student.regnNo}</Detail>
            <Detail label="Applicant Name">{student.applicantName}</Detail><Detail label="Father / Husband Name">{student.fatherOrHusbandName}</Detail>
            <Detail label="Nationality">{student.nationality}</Detail><Detail label="Sex">{student.sex === "M" ? "Male" : student.sex === "F" ? "Female" : student.sex}</Detail>
            <Detail label="Date of Birth">{student.dateOfBirth}</Detail><Detail label="Mobile Number">{student.mobileNumber}</Detail>
            <Detail label="Telephone">{student.telephoneNumber}</Detail><Detail label="PIN">{student.pin}</Detail>
            <Detail label="STD Code">{student.stdCode}</Detail><Detail label="Status">{student.status}</Detail>
          </div>
          <div className="student-address"><MapPin size={16}/><div><span>Complete Address</span><strong>{value(student.address)}</strong></div></div>
        </section>

        <section className="detail-section">
          <div className="detail-section-title"><BookOpen size={17}/><h3>Course & Registration</h3></div>
          <div className="student-detail-grid">
            <Detail label="Course Name">{student.courseName}</Detail><Detail label="Course Code">{student.courseCode}</Detail>
            <Detail label="KIT Issue No.">{student.kitIssueNo}</Detail><Detail label="AEC Code">{student.aecCode}</Detail>
            <Detail label="GDCA Semester II">{student.gdcaSem2}</Detail><Detail label="GDCA Semester III">{student.gdcaSem3}</Detail>
            <Detail label="Registered On">{student.createdAt ? new Date(student.createdAt).toLocaleString() : ""}</Detail>
            <Detail label="Last Updated">{student.updatedAt ? new Date(student.updatedAt).toLocaleString() : ""}</Detail>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-title"><CreditCard size={17}/><h3>Payment / Office Details</h3></div>
          <div className="student-detail-grid">
            <Detail label="Demand Draft No.">{student.demandDraftNo}</Detail><Detail label="Amount">{student.amount}</Detail>
            <Detail label="Demand Draft Date">{student.demandDraftDate}</Detail><Detail label="Bank">{student.bank}</Detail>
          </div>
        </section>

        <section className="detail-section">
          <div className="detail-section-title"><FileText size={17}/><h3>Qualification</h3></div>
          {(student.qualifications || []).length ? <div className="table-wrap"><table><thead><tr><th>Exam / Course</th><th>Board / University</th><th>College / Institute</th><th>Year</th><th>Percentage</th></tr></thead><tbody>{student.qualifications.map((q, i) => <tr key={i}><td>{value(q.examCourse)}</td><td>{value(q.boardUniversity)}</td><td>{value(q.collegeInstitute)}</td><td>{value(q.year)}</td><td>{value(q.percentage)}</td></tr>)}</tbody></table></div> : <div className="empty">No qualification information available.</div>}
        </section>

        <section className="detail-section">
          <div className="detail-section-title"><CalendarDays size={17}/><h3>Declaration & Enclosures</h3></div>
          <div className="student-detail-grid">
            <Detail label="Declaration Date">{student.declarationDate}</Detail><Detail label="Declaration Place">{student.declarationPlace}</Detail>
            <Detail label="Applicant Signature">{student.signatureApplicant}</Detail>
            <Detail label="Photo Uploaded">{student.enclosures?.stampPhoto ? "Yes" : "No"}</Detail>
            <Detail label="Certificates Attached">{student.enclosures?.qualifyingCertificates ? "Yes" : "No"}</Detail>
            <Detail label="Demand Draft Attached">{student.enclosures?.demandDraft ? "Yes" : "No"}</Detail>
          </div>
        </section>
      </main>}
    </ERPLayout>
  );
}
