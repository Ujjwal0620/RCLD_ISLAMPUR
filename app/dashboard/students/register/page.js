"use client";

import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const initial = {
  formNo: "", kitIssueNo: "", aecCode: "", regnNo: "", courseName: "", courseCode: "",
  demandDraftNo: "", amount: "", demandDraftDate: "", bank: "", applicantName: "",
  nationality: "", dateOfBirth: "", sex: "", fatherOrHusbandName: "", address: "",
  pin: "", stdCode: "", telephoneNumber: "", mobileNumber: "",
  qualifications: [{ examCourse: "", boardUniversity: "", collegeInstitute: "", year: "", percentage: "" }],
  gdcaSem2: "", gdcaSem3: "",
  enclosures: { stampPhoto: false, qualifyingCertificates: false, demandDraft: false },
  declarationDate: "", declarationPlace: "", signatureApplicant: ""
};

function Field({ label, name, value, onChange, required, type = "text", maxLength }) {
  return (
    <label className="form-field">
      <span>{label}{required ? " *" : ""}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
      />
    </label>
  );
}

export default function RegisterStudentPage() {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateQ = (key, value) => {
    setForm((current) => ({
      ...current,
      qualifications: [{ ...current.qualifications[0], [key]: value }]
    }));
  };

  async function submit(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        formNo: form.formNo.trim(),
        applicantName: form.applicantName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        address: form.address.trim()
      };

      const r = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to register.");

      setMessage("Student registered successfully.");
      setForm(initial);
    } catch (error) {
      setMessage(error.message || "Unable to connect to the local ERP server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ERPLayout active="/dashboard/students/register">
      <header className="topbar">
        <div>
          <div className="crumb">Students / Registration</div>
          <h1>RCLD Registration Form</h1>
        </div>
        <a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={17} /> Back to Students</a>
      </header>

      <form className="registration-form" onSubmit={submit}>
        <div className="form-intro">
          <div className="rcld-title">RASHTRIYA COMPUTER LITERACY DRIVE</div>
          <strong>Registration Form</strong>
          <span>All information to be filled in CAPITAL LETTERS only using Blue/Black Roller pen.</span>
        </div>

        <section className="form-section">
          <h3>Office / Registration Details</h3>
          <div className="form-grid four">
            <Field label="Form No." name="formNo" value={form.formNo} onChange={update} required />
            <Field label="KIT Issue No." name="kitIssueNo" value={form.kitIssueNo} onChange={update} />
            <Field label="AEC Code" name="aecCode" value={form.aecCode} onChange={update} />
            <Field label="Regn. No." name="regnNo" value={form.regnNo} onChange={update} />
            <Field label="Course Name" name="courseName" value={form.courseName} onChange={update} />
            <Field label="Course Code" name="courseCode" value={form.courseCode} onChange={update} />
            <Field label="Demand Draft No." name="demandDraftNo" value={form.demandDraftNo} onChange={update} />
            <Field label="Amount" name="amount" type="number" value={form.amount} onChange={update} />
            <Field label="Demand Draft Date" name="demandDraftDate" type="date" value={form.demandDraftDate} onChange={update} />
            <Field label="Bank" name="bank" value={form.bank} onChange={update} />
          </div>
        </section>

        <section className="form-section">
          <h3>Applicant Details</h3>
          <div className="form-grid three">
            <Field label="Complete Name of the Applicant" name="applicantName" value={form.applicantName} onChange={update} required />
            <Field label="Nationality" name="nationality" value={form.nationality} onChange={update} />
            <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update} />
            <label className="form-field"><span>Sex</span><select value={form.sex} onChange={(e) => update("sex", e.target.value)}><option value="">Select</option><option value="M">M - Male</option><option value="F">F - Female</option></select></label>
            <Field label="Father / Husband Name" name="fatherOrHusbandName" value={form.fatherOrHusbandName} onChange={update} />
            <Field label="PIN" name="pin" value={form.pin} onChange={update} maxLength={10} />
            <Field label="STD Code" name="stdCode" value={form.stdCode} onChange={update} />
            <Field label="Telephone Number" name="telephoneNumber" value={form.telephoneNumber} onChange={update} maxLength={15} />
            <Field label="Mobile Number" name="mobileNumber" value={form.mobileNumber} onChange={update} required maxLength={15} />
          </div>
          <label className="form-field full"><span>Complete Address</span><textarea value={form.address} onChange={(e) => update("address", e.target.value)} rows="3" /></label>
        </section>

        <section className="form-section">
          <h3>Details of Maximum Qualification</h3>
          <div className="qualification-grid">
            <input placeholder="Exam / Course" value={form.qualifications[0].examCourse} onChange={(e) => updateQ("examCourse", e.target.value)} />
            <input placeholder="Board / University" value={form.qualifications[0].boardUniversity} onChange={(e) => updateQ("boardUniversity", e.target.value)} />
            <input placeholder="College / Institute" value={form.qualifications[0].collegeInstitute} onChange={(e) => updateQ("collegeInstitute", e.target.value)} />
            <input placeholder="Year" value={form.qualifications[0].year} onChange={(e) => updateQ("year", e.target.value)} />
            <input placeholder="% of Marks" value={form.qualifications[0].percentage} onChange={(e) => updateQ("percentage", e.target.value)} />
          </div>
        </section>

        <section className="form-section">
          <h3>Course Selection for G.D.C.A. Candidate only</h3>
          <div className="form-grid two">
            <Field label="SEM - II" name="gdcaSem2" value={form.gdcaSem2} onChange={update} />
            <Field label="SEM - III" name="gdcaSem3" value={form.gdcaSem3} onChange={update} />
          </div>
        </section>

        <section className="form-section">
          <h3>Enclosures</h3>
          <div className="checks">
            {[["stampPhoto", "One Stamp Size Photo"], ["qualifyingCertificates", "Xerox copy of qualifying certificates"], ["demandDraft", "Demand Draft"]].map(([key, label]) => (
              <label key={key}><input type="checkbox" checked={form.enclosures[key]} onChange={(e) => setForm((current) => ({ ...current, enclosures: { ...current.enclosures, [key]: e.target.checked } }))} />{label}</label>
            ))}
          </div>
        </section>

        <section className="form-section">
          <h3>Declaration</h3>
          <p className="declaration">I do hereby declare that all the informations stated in this application form are true to the best of my knowledge. I have followed the prospectus carefully and understood all the rules and regulations agree to abide by them.</p>
          <div className="form-grid three">
            <Field label="Date" name="declarationDate" type="date" value={form.declarationDate} onChange={update} />
            <Field label="Place" name="declarationPlace" value={form.declarationPlace} onChange={update} />
            <Field label="Signature of Applicant" name="signatureApplicant" value={form.signatureApplicant} onChange={update} />
          </div>
        </section>

        {message && <div className={message.includes("successfully") ? "success-msg" : "error-msg"}>{message}</div>}
        <div className="form-actions">
          <a className="ghost-btn" href="/dashboard/students">Cancel</a>
          <button className="primary-btn" disabled={saving}><Save size={17} />{saving ? "Saving…" : "Register Student"}</button>
        </div>
      </form>
    </ERPLayout>
  );
}
