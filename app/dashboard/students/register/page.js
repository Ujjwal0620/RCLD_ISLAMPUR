"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save, Camera, ImagePlus } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const initial = {
  formNo: "", aecCode: "", regnNo: "", courseName: "", courseCode: "", applicantName: "", email: "", aadhaarNumber: "", referralId: "",
  nationality: "", dateOfBirth: "", sex: "", fatherOrHusbandName: "", address: "", presentAddress: "", permanentAddress: "", sameAsPresentAddress: true, district: "", state: "", permanentPin: "", permanentDistrict: "", permanentState: "", guardianContactNumber: "", photoUrl: "",
  pin: "", whatsappNumber: "", mobileNumber: "",
  qualifications: [{ examCourse: "", boardUniversity: "", collegeInstitute: "", year: "", percentage: "" }],
  enclosures: { stampPhoto: false, qualifyingCertificates: false, matricAdmitCard: false },
  declarationDate: "", declarationPlace: "", signatureApplicant: ""
};

function Field({ label, name, value, onChange, required, type = "text", maxLength, inputMode, pattern }) {
  return (
    <label className="form-field">
      <span>{label}{required ? " *" : ""}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        pattern={pattern}
        autoComplete="off"
      />
    </label>
  );
}

export default function RegisterStudentPage() {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => { fetch("/api/courses",{cache:"no-store"}).then(r=>r.json()).then(d=>setCourses(d.courses||[])).catch(()=>{}); fetch("/api/referrals",{cache:"no-store"}).then(r=>r.json()).then(d=>setReferrals((d.referrals||[]).filter(x=>x.status==="Active"))).catch(()=>{}); }, []);

  const selectCourse = (code) => { const c = courses.find(x=>x.code===code); setSelectedCourse(c||null); setForm(current=>({...current,courseCode:c?.code||"",courseName:c?.name||""})); };

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateQ = (key, value) => {
    setForm((current) => ({
      ...current,
      qualifications: [{ ...current.qualifications[0], [key]: value }]
    }));
  };

  async function uploadPhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("Student photo must be smaller than 5 MB."); return; }
    setPhotoUploading(true); setMessage("");
    try {
      const data = new FormData(); data.append("file", file);
      const response = await fetch("/api/uploads/student-photo", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to upload photo.");
      update("photoUrl", result.url);
    } catch (error) { setMessage(error.message); }
    finally { setPhotoUploading(false); }
  }

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
        email: form.email.trim().toLowerCase(),
        aadhaarNumber: form.aadhaarNumber.replace(/\D/g, ""),
        address: (form.presentAddress || form.address).trim(),
        presentAddress: (form.presentAddress || form.address).trim(),
        permanentAddress: form.sameAsPresentAddress ? (form.presentAddress || form.address).trim() : form.permanentAddress.trim()
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
          <strong>RCLD ISLAMPUR · STUDENT REGISTRATION FORM</strong>
          <span>Complete all applicant, address, contact and academic details. Fields marked * are mandatory.</span>
        </div>

        <div className="registration-photo-row"><div className="registration-office-intro"><span className="registration-mini-label">REGISTRATION DESK</span><h2>Office / Registration Details</h2><p>Enter the student registration number and choose the applicable computer course.</p></div><label className="registration-photo-card"><span className="registration-photo-preview">{form.photoUrl ? <img src={form.photoUrl} alt="Student" /> : <Camera size={27}/>}</span><strong>{photoUploading ? "Uploading photo…" : "Photo Selection Option"}</strong><span className="ghost-btn"><ImagePlus size={14}/> Choose Photo<input type="file" accept="image/*" disabled={photoUploading} onChange={e=>uploadPhoto(e.target.files?.[0])}/></span><small>JPG / PNG · Max 5 MB</small></label></div>
        <section className="form-section">
          <h3>Office / Registration Details</h3>
          <div className="form-grid four">
            <Field label="Form No." name="formNo" value={form.formNo} onChange={update} required />
            <Field label="AEC Code" name="aecCode" value={form.aecCode} onChange={update} />
            <Field label="Regn. No." name="regnNo" value={form.regnNo} onChange={update} />
            <label className="form-field"><span>Course *</span><select value={form.courseCode} onChange={e=>selectCourse(e.target.value)} required><option value="">Select course</option>{courses.map(c=><option key={c._id} value={c.code}>{c.code} — {c.name}</option>)}</select></label>
            <Field label="Course Name" name="courseName" value={form.courseName} onChange={update} />
            <Field label="Course Code" name="courseCode" value={form.courseCode} onChange={update} />
          </div>
          {selectedCourse && <div className="course-fee-summary"><div><span>Course Fee</span><strong>₹{Number(selectedCourse.fee||0).toLocaleString("en-IN")}</strong></div><div><span>Admission Fee</span><strong>₹{Number(selectedCourse.admissionFee||0).toLocaleString("en-IN")}</strong></div><div><span>Initial Payable</span><strong>₹{(Number(selectedCourse.fee||0)+Number(selectedCourse.admissionFee||0)).toLocaleString("en-IN")}</strong></div></div>}
        </section>

        <section className="form-section">
          <h3>Applicant Details</h3>
          <div className="form-grid three">
            <Field label="Complete Name of the Applicant" name="applicantName" value={form.applicantName} onChange={update} required />
            <Field label="Nationality" name="nationality" value={form.nationality} onChange={update} />
            <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update} />
            <label className="form-field"><span>Sex</span><select value={form.sex} onChange={(e) => update("sex", e.target.value)}><option value="">Select</option><option value="M">M - Male</option><option value="F">F - Female</option></select></label>
            <Field label="Father / Husband Name" name="fatherOrHusbandName" value={form.fatherOrHusbandName} onChange={update} />
            <Field label="WhatsApp Number" name="whatsappNumber" value={form.whatsappNumber} onChange={update} maxLength={15} />
            <Field label="Guardian Mobile Number" name="guardianContactNumber" value={form.guardianContactNumber} onChange={update} maxLength={15} />
            <Field label="Mobile Number" name="mobileNumber" value={form.mobileNumber} onChange={update} required maxLength={15} />
            <Field label="Email Address" name="email" value={form.email} onChange={update} required type="email" />
            <Field label="Aadhaar Card Number (12 digits)" name="aadhaarNumber" value={form.aadhaarNumber} onChange={update} required maxLength={12} inputMode="numeric" pattern="[0-9]{12}" />
          </div>
          <label className="form-field"><span>Referral (optional)</span><select value={form.referralId} onChange={(e)=>update("referralId",e.target.value)}><option value="">Direct / No referral</option>{referrals.map((r)=><option key={r._id} value={r._id}>{r.name} — {r.marketingEmployeeName}</option>)}</select></label>
          <div className="registration-address-grid"><div className="registration-address-card"><h4>◉ Present Address</h4><label className="form-field"><span>Ward No. / Village / Town</span><textarea value={form.presentAddress || form.address} onChange={e=>{update("presentAddress",e.target.value);update("address",e.target.value);}} rows="2"/></label><div className="form-grid two"><Field label="P.O. / Post Office" name="postOffice" value={form.postOffice} onChange={update}/><Field label="P.S. / Police Station" name="policeStation" value={form.policeStation} onChange={update}/><Field label="District" name="district" value={form.district} onChange={update}/><Field label="PIN" name="pin" value={form.pin} onChange={update} maxLength={10}/><Field label="State" name="state" value={form.state} onChange={update}/></div></div><div className="registration-address-card"><h4>Permanent Address</h4><label className="registration-same-address"><input type="checkbox" checked={!!form.sameAsPresentAddress} onChange={e=>update("sameAsPresentAddress",e.target.checked)}/> Same as Present Address</label>{!form.sameAsPresentAddress&&<><label className="form-field"><span>Ward No. / Village / Town</span><textarea value={form.permanentAddress} onChange={e=>update("permanentAddress",e.target.value)} rows="2"/></label><div className="form-grid two"><Field label="District" name="permanentDistrict" value={form.permanentDistrict} onChange={update}/><Field label="P.O. / PIN" name="permanentPin" value={form.permanentPin} onChange={update}/><Field label="State" name="permanentState" value={form.permanentState} onChange={update}/></div></>}</div></div>
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
          <h3>Enclosures</h3>
          <div className="checks">
            {[["stampPhoto", "One Stamp Size Photo"], ["qualifyingCertificates", "Xerox copy of qualifying certificates"], ["matricAdmitCard", "Matric Admit Card"]].map(([key, label]) => (
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
