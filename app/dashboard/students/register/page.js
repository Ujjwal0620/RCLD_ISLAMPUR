"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save, Camera, ImagePlus, Printer } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import RCLDLogo from "@/components/RCLDLogo";
import indiaLocations from "@/lib/indiaStatesDistricts.json";

const initial = {
  formNo: "", aecCode: "RCLD/ISL-001", regnNo: "", enrollmentNo: "", admissionDate: new Date().toISOString().slice(0,10), courseName: "", courseCode: "", applicantName: "", email: "", aadhaarNumber: "", referralId: "",
  nationality: "", dateOfBirth: "", sex: "", fatherOrHusbandName: "", address: "", presentAddress: "", permanentAddress: "", sameAsPresentAddress: true, district: "", state: "", postOffice: "", policeStation: "", nearestLandmark: "", permanentPin: "", permanentDistrict: "", permanentState: "", permanentPostOffice: "", permanentNearestLandmark: "", guardianContactNumber: "", photoUrl: "", signatureUrl: "",
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


function DigitBoxes({ label, value = "", onChange, length = 10, required = false }) {
  const digits = String(value || "").padEnd(length, " ").slice(0, length).split("");
  function setDigits(start, text) {
    const incoming = String(text || "").replace(/\D/g, "").slice(0, length - start);
    const next = digits.slice();
    if (!String(text || "")) next[start] = " ";
    incoming.split("").forEach((digit, offset) => { next[start + offset] = digit; });
    onChange(next.join("").replace(/\s+$/, ""));
  }
  return <label className="form-field digit-box-field"><span>{label}{required ? " *" : ""}</span><div className="rcld-digit-boxes" role="group" aria-label={label}>{Array.from({ length }, (_, i) => <input key={i} aria-label={label + " digit " + (i + 1)} inputMode="numeric" pattern="[0-9]" maxLength={1} value={digits[i] === " " ? "" : digits[i]} required={required && i === 0} onChange={e => { setDigits(i, e.target.value.slice(-1)); if (e.target.value && i < length - 1) e.target.parentElement.children[i + 1]?.focus(); }} onKeyDown={e => { if (e.key === "Backspace" && !digits[i] && i > 0) e.currentTarget.parentElement.children[i - 1]?.focus(); if (e.key === "ArrowLeft" && i > 0) e.currentTarget.parentElement.children[i - 1]?.focus(); if (e.key === "ArrowRight" && i < length - 1) e.currentTarget.parentElement.children[i + 1]?.focus(); }} onPaste={e => { e.preventDefault(); setDigits(i, e.clipboardData.getData("text")); const target = Math.min(length - 1, i + e.clipboardData.getData("text").replace(/\D/g, "").length); e.currentTarget.parentElement.children[target]?.focus(); }} />)}</div></label>;
}

export default function RegisterStudentPage() {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [signatureInputKey, setSignatureInputKey] = useState(0);

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
      if (!response.ok) throw new Error([result.error, result.detail].filter(Boolean).join(" — ") || "Unable to upload photo.");
      update("photoUrl", result.url);
    } catch (error) { setMessage(error.message); }
    finally { setPhotoUploading(false); }
  }

  async function uploadSignature(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Please select a signature image."); return; }
    if (file.size > 3 * 1024 * 1024) { setMessage("Signature image must be smaller than 3 MB."); return; }
    setSignatureUploading(true); setMessage("");
    try {
      const data = new FormData(); data.append("file", file); data.append("purpose", "signature");
      const response = await fetch("/api/uploads/student-photo", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, result.detail].filter(Boolean).join(" — ") || "Unable to upload signature.");
      update("signatureUrl", result.url);
    } catch (error) { setMessage(error.message); }
    finally { setSignatureUploading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        applicantName: form.applicantName.trim(),
        mobileNumber: form.mobileNumber.replace(/\D/g, "").slice(0, 10),
        email: form.email.trim().toLowerCase(),
        aadhaarNumber: form.aadhaarNumber.replace(/\D/g, "").slice(0, 12),
        aecCode: "RCLD/ISL-001",
        address: (form.presentAddress || form.address).trim(),
        presentAddress: (form.presentAddress || form.address).trim(),
        permanentAddress: form.sameAsPresentAddress ? (form.presentAddress || form.address).trim() : form.permanentAddress.trim()
      };

      if ([payload.mobileNumber,payload.guardianContactNumber,payload.whatsappNumber].some(v => v && v.length !== 10)) throw new Error("Any entered mobile number must contain exactly 10 digits.");

      const r = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Unable to register.");

      setMessage("Student registered successfully. Enrollment No: " + j.student.enrollmentNo);
      setForm({ ...initial, formNo: "", regnNo: "", enrollmentNo: j.student.enrollmentNo, aecCode: "RCLD/ISL-001" });
      setSignatureInputKey(key => key + 1);
      setSelectedCourse(null);
    } catch (error) {
      setMessage(error.message || "Unable to connect to the local ERP server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ERPLayout active="/dashboard/students/register">
      <header className="topbar">
        <div><div className="crumb">Students / Registration</div><h1>RCLD Registration Form</h1></div>
        <div className="top-actions"><button type="button" className="ghost-btn" onClick={() => window.print()}><Printer size={16}/> Print Preview</button><a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={17}/> Back to Students</a></div>
      </header>

      <form className="registration-form rcld-registration-sheet" onSubmit={submit}>
        <div className="rcld-registration-brand">
          <RCLDLogo className="rcld-screen-logo" />
          <div className="rcld-brand-title">
            <h2>RASHTRIYA COMPUTER LITERACY DRIVE</h2>
            <span>STUDENT REGISTRATION FORM. RCLD ISLAMPUR</span>
          </div>
        </div>
        <div className="rcld-screen-divider" />

        <section className="form-section rcld-form-section rcld-office-section">
          <h3>Office / Registration Details</h3>
          <div className="rcld-office-template-grid">
            <label className="rcld-inline-field"><span>AEC CODE:</span><input value="RCLD/ISL-001" readOnly /></label>
            <label className="rcld-inline-field"><span>Registration No:</span><input value={form.regnNo} onChange={e=>update("regnNo",e.target.value)} /></label>
            <label className="rcld-inline-field"><span>Form No:</span><input value={form.formNo} onChange={e=>update("formNo",e.target.value)} /></label>
            <label className="rcld-inline-field"><span>Enrollment No:</span><input value={form.enrollmentNo} readOnly placeholder="Auto generated after registration" /></label>
            <label className="rcld-inline-field"><span>Date:</span><input type="date" value={form.admissionDate} onChange={e=>update("admissionDate",e.target.value)} /></label>
            <label className="rcld-inline-field rcld-course-field"><span>Course / Course Code:</span><select value={form.courseCode} onChange={e=>selectCourse(e.target.value)} required><option value="">Select course</option>{courses.map(c=><option key={c._id} value={c.code}>{c.name} — {c.code}</option>)}</select></label>
          </div>
          <div className="rcld-office-extra">
            <Field label="Course Name" name="courseName" value={form.courseName} onChange={update}/>
            <Field label="Course Code" name="courseCode" value={form.courseCode} onChange={update}/>
            <label className="form-field"><span>Referral / Marketing Source</span><select value={form.referralId} onChange={e=>update("referralId",e.target.value)}><option value="">Direct / No referral</option>{referrals.map(r=><option key={r._id} value={r._id}>{r.name} — {r.marketingEmployeeName}</option>)}</select></label>
          </div>
          {selectedCourse&&<div className="course-fee-summary"><div><span>Course Fee</span><strong>₹{Number(selectedCourse.fee||0).toLocaleString("en-IN")}</strong></div><div><span>Admission Fee</span><strong>₹{Number(selectedCourse.admissionFee||0).toLocaleString("en-IN")}</strong></div><div><span>Initial Payable</span><strong>₹{(Number(selectedCourse.fee||0)+Number(selectedCourse.admissionFee||0)).toLocaleString("en-IN")}</strong></div></div>}
        </section>

        <section className="form-section rcld-form-section rcld-applicant-section">
          <h3>Applicant Details</h3>
          <div className="rcld-applicant-template-grid">
            <div className="rcld-applicant-template-fields">
              <Field label="Name" name="applicantName" value={form.applicantName} onChange={update}/>
              <Field label="Father/Mother/Husband Name" name="fatherOrHusbandName" value={form.fatherOrHusbandName} onChange={update}/>
              <Field label="DOB" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update}/>
              <label className="form-field"><span>Sex</span><select value={form.sex} onChange={e=>update("sex",e.target.value)}><option value="">Select</option><option value="M">M - Male</option><option value="F">F - Female</option></select></label>
              <Field label="Nationality" name="nationality" value={form.nationality} onChange={update}/>
            </div>
            <label className="registration-photo-card rcld-photo-card rcld-photo-template">
              <span className="registration-photo-preview">{form.photoUrl?<img src={form.photoUrl} alt="Student"/>:<Camera size={34}/>}</span>
              <strong>{photoUploading?"Uploading photo…":"Student Photograph"}</strong>
              <span className="ghost-btn"><ImagePlus size={14}/> Choose Photo<input type="file" accept="image/*" disabled={photoUploading} onChange={e=>uploadPhoto(e.target.files?.[0])}/></span>
              <small>JPG / PNG · Max 5 MB</small>
            </label>
          </div>
        </section>

        <section className="form-section rcld-form-section rcld-address-section">
          <h3>Address Details</h3>
          <div className="registration-address-grid rcld-address-grid">
            <div className="registration-address-card rcld-address-template-card">
              <h4>Present Address</h4>
              <label className="form-field"><span>Ward/Colony/ Village</span><textarea value={form.presentAddress||form.address} onChange={e=>{update("presentAddress",e.target.value);update("address",e.target.value);}} rows="2"/></label>
              <div className="form-grid two">
                <Field label="PO" name="postOffice" value={form.postOffice} onChange={update}/>
                <Field label="PS" name="policeStation" value={form.policeStation} onChange={update}/>
                <label className="form-field"><span>State</span><select value={form.state} onChange={e=>{update("state",e.target.value);update("district","");}}><option value="">Select state</option>{indiaLocations.map(st=><option key={st.code} value={st.name}>{st.name}</option>)}</select></label>
                <label className="form-field"><span>District</span><select value={form.district} disabled={!form.state} onChange={e=>update("district",e.target.value)}><option value="">Select district</option>{(indiaLocations.find(st=>st.name===form.state)?.districts||[]).map(d=><option key={d.code} value={d.name}>{d.name}</option>)}</select></label>
                <Field label="PIN" name="pin" value={form.pin} onChange={update} maxLength={10}/>
                <Field label="Nearest Land Mark" name="nearestLandmark" value={form.nearestLandmark} onChange={update}/>
              </div>
            </div>
            <div className="registration-address-card rcld-address-template-card">
              <h4>Permanent Address</h4>
              <label className="registration-same-address"><input type="checkbox" checked={!!form.sameAsPresentAddress} onChange={e=>update("sameAsPresentAddress",e.target.checked)}/> Same As Present Address</label>
              {!form.sameAsPresentAddress&&<>
                <label className="form-field"><span>Ward/Colony/ Village</span><textarea value={form.permanentAddress} onChange={e=>update("permanentAddress",e.target.value)} rows="2"/></label>
                <div className="form-grid two">
                  <Field label="PO" name="permanentPostOffice" value={form.permanentPostOffice} onChange={update}/>
                  <label className="form-field"><span>State</span><select value={form.permanentState} onChange={e=>{update("permanentState",e.target.value);update("permanentDistrict","");}}><option value="">Select state</option>{indiaLocations.map(st=><option key={st.code} value={st.name}>{st.name}</option>)}</select></label>
                  <label className="form-field"><span>District</span><select value={form.permanentDistrict} disabled={!form.permanentState} onChange={e=>update("permanentDistrict",e.target.value)}><option value="">Select district</option>{(indiaLocations.find(st=>st.name===form.permanentState)?.districts||[]).map(d=><option key={d.code} value={d.name}>{d.name}</option>)}</select></label>
                  <Field label="PIN" name="permanentPin" value={form.permanentPin} onChange={update}/>
                  <Field label="Nearest Land Mark" name="permanentNearestLandmark" value={form.permanentNearestLandmark} onChange={update}/>
                </div>
              </>}
            </div>
          </div>
        </section>

        <section className="form-section rcld-form-section rcld-contact-section">
          <h3>Contact Details</h3>
          <div className="rcld-contact-template-grid">
            <div>
              <DigitBoxes label="Mobile No" value={form.mobileNumber} onChange={v=>update("mobileNumber",v)} length={10}/>
              <DigitBoxes label="WhatsApp No" value={form.whatsappNumber} onChange={v=>update("whatsappNumber",v)} length={10}/>
              <Field label="Aadhaar No" name="aadhaarNumber" value={form.aadhaarNumber} onChange={update} maxLength={12} inputMode="numeric" pattern="[0-9]{12}"/>
            </div>
            <div>
              <DigitBoxes label="Mobile No Guardian" value={form.guardianContactNumber} onChange={v=>update("guardianContactNumber",v)} length={10}/>
              <Field label="Email" name="email" value={form.email} onChange={update} type="email"/>
            </div>
          </div>
        </section>

        <section className="form-section rcld-form-section rcld-qualification-section">
          <h3>Qualification Details</h3>
          <div className="rcld-qualification-table-wrap">
            <table className="rcld-input-qualification-table">
              <thead><tr><th>Class/Sem/Course</th><th>Institute/School/College</th><th>Board/Council/University</th><th>Year</th><th>Percentage Of Marks</th></tr></thead>
              <tbody><tr>
                <td><input aria-label="Class/Sem/Course" value={form.qualifications[0].examCourse} onChange={e=>updateQ("examCourse",e.target.value)}/></td>
                <td><input aria-label="Institute/School/College" value={form.qualifications[0].collegeInstitute} onChange={e=>updateQ("collegeInstitute",e.target.value)}/></td>
                <td><input aria-label="Board/Council/University" value={form.qualifications[0].boardUniversity} onChange={e=>updateQ("boardUniversity",e.target.value)}/></td>
                <td><input aria-label="Year" value={form.qualifications[0].year} onChange={e=>updateQ("year",e.target.value)}/></td>
                <td><input aria-label="Percentage Of Marks" value={form.qualifications[0].percentage} onChange={e=>updateQ("percentage",e.target.value)}/></td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section className="form-section rcld-form-section rcld-enclosure-section">
          <h3>Enclosure</h3>
          <div className="checks rcld-enclosures">
            {[[ "stampPhoto","2 Passport Size photo"],["qualifyingCertificates","Aadhaar / Qualifying Certificates"],["matricAdmitCard","Admit / Registration Details"]].map(([key,label])=><label key={key}><input type="checkbox" checked={!!form.enclosures[key]} onChange={e=>setForm(current=>({...current,enclosures:{...current.enclosures,[key]:e.target.checked}}))}/>{label}</label>)}
          </div>
        </section>

        <footer className="rcld-screen-footer">
          <label className="form-field"><span>Date</span><input type="date" value={form.declarationDate} onChange={e=>update("declarationDate",e.target.value)}/></label>
          <label className="form-field"><span>Place</span><input value={form.declarationPlace} onChange={e=>update("declarationPlace",e.target.value)}/></label>
          <label className="form-field rcld-signature-field"><span>Student Signature</span><input key={signatureInputKey} type="file" accept="image/*" disabled={signatureUploading} onChange={e=>uploadSignature(e.target.files?.[0])} /><small>{signatureUploading?"Uploading signature…":"PNG/JPG · Maximum 3 MB"}</small>{form.signatureUrl&&<img src={form.signatureUrl} alt="Uploaded student signature"/>}</label>
        </footer>
        {message&&<div className={message.includes("successfully")?"success-msg":"error-msg"}>{message}</div>}
        <div className="form-actions"><a className="ghost-btn" href="/dashboard/students">Cancel</a><button className="primary-btn" disabled={saving||photoUploading||signatureUploading}><Save size={17}/>{saving?"Saving…":"Register Student"}</button></div>
      </form>

      <section className="rcld-print-document" aria-label="RCLD student registration print form">
        <header className="rcld-print-header">
          <RCLDLogo className="rcld-print-logo-image" />
          <div className="rcld-print-heading">
            <h1>RASHTRIYA COMPUTER LITERACY DRIVE</h1>
            <p>STUDENT REGISTRATION FORM. RCLD ISLAMPUR</p>
          </div>
        </header>
        <div className="rcld-print-rule"/>
        <section className="rcld-print-section rcld-print-office">
          <h2>Office / Registration Details</h2>
          <div className="rcld-print-office-grid">
            <p><span>AEC CODE:</span><b>RCLD/ISL-001</b></p>
            <p><span>Registration No:</span><b>{form.regnNo || ""}</b></p>
            <p><span>Form No:</span><b>{form.formNo || ""}</b></p>
            <p><span>Enrollment No:</span><b>{form.enrollmentNo || ""}</b></p>
            <p><span>Date:</span><b>{form.admissionDate ? new Date(form.admissionDate + "T00:00:00").toLocaleDateString("en-GB") : ""}</b></p>
            <p><span>Course / Course Code:</span><b>{[form.courseName, form.courseCode].filter(Boolean).join("  /  ")}</b></p>
          </div>
        </section>
        <section className="rcld-print-section rcld-print-applicant-section">
          <h2>Applicant Details</h2>
          <div className="rcld-print-applicant">
            <div className="rcld-print-applicant-fields">
              <p className="applicant-name"><span>Name:</span><b>{form.applicantName || ""}</b></p>
              <p className="applicant-guardian"><span>Father/Mother/Husband Name:</span><b>{form.fatherOrHusbandName || ""}</b></p>
              <p><span>DOB:</span><b>{form.dateOfBirth ? new Date(form.dateOfBirth + "T00:00:00").toLocaleDateString("en-GB") : ""}</b></p>
              <p><span>Sex:</span><b>{form.sex || ""}</b></p>
              <p><span>Nationality:</span><b>{form.nationality || ""}</b></p>
            </div>
            <div className="rcld-print-photo">{form.photoUrl ? <img src={form.photoUrl} alt="Applicant"/> : <span/>}</div>
          </div>
        </section>
        <section className="rcld-print-section rcld-print-address-section">
          <h2>Address Details</h2>
          <div className="rcld-print-address-grid">
            <div className="rcld-print-address rcld-registration-address-print">
              <h3>Present Address</h3>
              <p><span>Ward/Colony/ Village:</span> {form.presentAddress || form.address || ""}</p>
              <p><span>PO:</span> {form.postOffice || ""}</p>
              <p><span>PS:</span> {form.policeStation || ""}</p>
              <p className="state-district"><span>State:</span> {form.state || ""}<span>District:</span> {form.district || ""}</p>
              <p><span>Pin:</span> {form.pin || ""}</p>
              <p><span>Nearest Land Mark:</span> {form.nearestLandmark || ""}</p>
            </div>
            <div className="rcld-print-address rcld-registration-address-print">
              <h3>Permanent Address</h3>
              <p><span>Ward/Colony/ Village:</span> {form.sameAsPresentAddress ? (form.presentAddress || form.address || "") : (form.permanentAddress || "")}</p>
              <p><span>PO:</span> {form.sameAsPresentAddress ? (form.postOffice || "") : (form.permanentPostOffice || "")}</p>
              <p><span>PS:</span> {form.sameAsPresentAddress ? (form.policeStation || "") : ""}</p>
              <p className="state-district"><span>State:</span> {form.sameAsPresentAddress ? (form.state || "") : (form.permanentState || "")}<span>District:</span> {form.sameAsPresentAddress ? (form.district || "") : (form.permanentDistrict || "")}</p>
              <p><span>Pin:</span> {form.sameAsPresentAddress ? (form.pin || "") : (form.permanentPin || "")}</p>
              <p><span>Nearest Land Mark:</span> {form.sameAsPresentAddress ? (form.nearestLandmark || "") : (form.permanentNearestLandmark || "")}</p>
            </div>
          </div>
        </section>
        <section className="rcld-print-section rcld-print-contact-section">
          <h2>Contact Details</h2>
          <div className="rcld-print-contact-grid">
            <div><p><strong>Mobile No:</strong> {form.mobileNumber || ""}</p><p><strong>WhatsApp No:</strong> {form.whatsappNumber || ""}</p><p><strong>Aadhaar No:</strong> {form.aadhaarNumber || ""}</p></div>
            <div><p><strong>Mobile No Guardian:</strong> {form.guardianContactNumber || ""}</p><p><strong>Email:</strong> {form.email || ""}</p></div>
          </div>
        </section>
        <section className="rcld-print-section rcld-print-qualification-section">
          <h2>Qualification Details</h2>
          <table className="rcld-print-qualification">
            <thead><tr><th>Class/Sem/Course</th><th>Institute/School/College</th><th>Board/Council/University</th><th>Year</th><th>Percentage Of Marks</th></tr></thead>
            <tbody><tr><td>{form.qualifications?.[0]?.examCourse || ""}</td><td>{form.qualifications?.[0]?.collegeInstitute || ""}</td><td>{form.qualifications?.[0]?.boardUniversity || ""}</td><td>{form.qualifications?.[0]?.year || ""}</td><td>{form.qualifications?.[0]?.percentage || ""}</td></tr></tbody>
          </table>
        </section>
        <section className="rcld-print-section rcld-print-enclosure-section">
          <h2>Enclosure</h2>
          <div className="rcld-print-enclosures">
            <span><i/>{form.enclosures.stampPhoto ? "✓ " : ""}2 Passport Size photo</span>
            <span><i/>{form.enclosures.qualifyingCertificates ? "✓ " : ""}Aadhaar / Qualifying Certificates</span>
            <span><i/>{form.enclosures.matricAdmitCard ? "✓ " : ""}Admit / Registration Details</span>
          </div>
        </section>
        <footer className="rcld-print-footer">
          <div><p>{form.declarationDate ? new Date(form.declarationDate + "T00:00:00").toLocaleDateString("en-GB") : ""}</p><div/><span>DATE</span></div>
          <div><p>{form.declarationPlace || ""}</p><div/><span>PLACE</span></div>
          <div className="rcld-print-signature">{form.signatureUrl ? <img src={form.signatureUrl} alt="Applicant signature"/> : <p/>}<div/><span>SIGNATURE</span></div>
        </footer>
      </section>
    </ERPLayout>
  );
}
