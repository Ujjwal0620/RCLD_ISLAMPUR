"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save, Camera, ImagePlus } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
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

export default function RegisterStudentPage() {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);

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

  async function uploadSignature(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Please select a signature image."); return; }
    if (file.size > 3 * 1024 * 1024) { setMessage("Signature image must be smaller than 3 MB."); return; }
    setSignatureUploading(true); setMessage("");
    try {
      const data = new FormData(); data.append("file", file); data.append("purpose", "signature");
      const response = await fetch("/api/uploads/student-photo", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to upload signature.");
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
        <div><div className="crumb">Students / Registration</div><h1>RCLD Registration Form</h1></div>
        <a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={17}/> Back to Students</a>
      </header>

      <form className="registration-form rcld-registration-sheet" onSubmit={submit}>
        <div className="rcld-registration-brand">
          <div className="rcld-brand-seal">RCLD<span>ISLAMPUR</span></div>
          <div className="rcld-brand-title"><h2>RASHTRIYA COMPUTER<br/>LITERACY DRIVE</h2><span>RCLD ISLAMPUR · STUDENT REGISTRATION FORM</span></div>
          <div className="rcld-brand-book">RCLD<small>Islampur</small></div>
        </div>

        <div className="rcld-registration-meta">
          <label className="form-field"><span>Registration No.</span><input value={form.regnNo} onChange={e=>update("regnNo",e.target.value)} placeholder="Registration number"/></label>
          <label className="form-field"><span>Date</span><input type="date" value={form.admissionDate} onChange={e=>update("admissionDate",e.target.value)}/></label>
        </div>

        <section className="form-section rcld-form-section">
          <h3>Office / Registration Details</h3>
          <div className="rcld-office-layout">
            <div className="rcld-office-fields">
              <label className="form-field"><span>AEC Code</span><input value="RCLD/ISL-001" readOnly/></label>
              <label className="form-field"><span>Form No. (Auto Generated)</span><input value={form.formNo || "Generated automatically after registration"} readOnly/></label>
              <label className="form-field"><span>Enrollment No. (Auto Generated)</span><input value={form.enrollmentNo || "Generated automatically after registration"} readOnly/></label>
              <label className="form-field"><span>Course *</span><select value={form.courseCode} onChange={e=>selectCourse(e.target.value)} required><option value="">Select course</option>{courses.map(c=><option key={c._id} value={c.code}>{c.code} — {c.name}</option>)}</select></label>
              <Field label="Course Code" name="courseCode" value={form.courseCode} onChange={update}/>
              <Field label="Course Name" name="courseName" value={form.courseName} onChange={update}/>
              <label className="form-field"><span>Referral / Marketing Source</span><select value={form.referralId} onChange={e=>update("referralId",e.target.value)}><option value="">Direct / No referral</option>{referrals.map(r=><option key={r._id} value={r._id}>{r.name} — {r.marketingEmployeeName}</option>)}</select></label>
            </div>
            <label className="registration-photo-card rcld-photo-card">
              <span className="registration-photo-preview">{form.photoUrl?<img src={form.photoUrl} alt="Student"/>:<Camera size={27}/>}</span>
              <strong>{photoUploading?"Uploading photo…":"PHOTO Selection Option"}</strong>
              <span className="ghost-btn"><ImagePlus size={14}/> Choose Photo<input type="file" accept="image/*" disabled={photoUploading} onChange={e=>uploadPhoto(e.target.files?.[0])}/></span>
              <small>JPG / PNG · Max 5 MB</small>
            </label>
          </div>
          {selectedCourse&&<div className="course-fee-summary"><div><span>Course Fee</span><strong>₹{Number(selectedCourse.fee||0).toLocaleString("en-IN")}</strong></div><div><span>Admission Fee</span><strong>₹{Number(selectedCourse.admissionFee||0).toLocaleString("en-IN")}</strong></div><div><span>Initial Payable</span><strong>₹{(Number(selectedCourse.fee||0)+Number(selectedCourse.admissionFee||0)).toLocaleString("en-IN")}</strong></div></div>}
        </section>

        <section className="form-section rcld-form-section">
          <h3>Applicant Details</h3>
          <div className="rcld-applicant-grid">
            <Field label="① Name" name="applicantName" value={form.applicantName} onChange={update} required/>
            <Field label="② Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update}/>
            <label className="form-field"><span>③ Sex</span><select value={form.sex} onChange={e=>update("sex",e.target.value)}><option value="">Select</option><option value="M">M - Male</option><option value="F">F - Female</option></select></label>
            <Field label="④ Nationality" name="nationality" value={form.nationality} onChange={update}/>
            <div className="rcld-applicant-wide"><Field label="⑤ Father / Mother / Husband" name="fatherOrHusbandName" value={form.fatherOrHusbandName} onChange={update}/></div>
          </div>
        </section>

        <section className="form-section rcld-form-section">
          <h3>Address</h3>
          <div className="registration-address-grid rcld-address-grid">
            <div className="registration-address-card">
              <h4>◉ Present Address</h4>
              <label className="form-field"><span>Ward No. / Village / Town</span><textarea value={form.presentAddress||form.address} onChange={e=>{update("presentAddress",e.target.value);update("address",e.target.value);}} rows="2"/></label>
              <div className="form-grid two">
                <Field label="P.O." name="postOffice" value={form.postOffice} onChange={update}/>
                <Field label="P.S." name="policeStation" value={form.policeStation} onChange={update}/>
                <label className="form-field"><span>State</span><select value={form.state} onChange={e=>{update("state",e.target.value);update("district","");}}><option value="">Select state</option>{indiaLocations.map(st=><option key={st.code} value={st.name}>{st.name}</option>)}</select></label>
                <label className="form-field"><span>District</span><select value={form.district} disabled={!form.state} onChange={e=>update("district",e.target.value)}><option value="">Select district</option>{(indiaLocations.find(st=>st.name===form.state)?.districts||[]).map(d=><option key={d.code} value={d.name}>{d.name}</option>)}</select></label>
                <Field label="PIN" name="pin" value={form.pin} onChange={update} maxLength={10}/>
                <Field label="Nearest Landmark" name="nearestLandmark" value={form.nearestLandmark} onChange={update}/>
              </div>
            </div>
            <div className="registration-address-card">
              <h4>Permanent Address</h4>
              <label className="registration-same-address"><input type="checkbox" checked={!!form.sameAsPresentAddress} onChange={e=>update("sameAsPresentAddress",e.target.checked)}/> Same As Present Address</label>
              {!form.sameAsPresentAddress&&<>
                <label className="form-field"><span>Ward No. / Village / Town</span><textarea value={form.permanentAddress} onChange={e=>update("permanentAddress",e.target.value)} rows="2"/></label>
                <div className="form-grid two">
                  <Field label="P.O." name="permanentPostOffice" value={form.permanentPostOffice} onChange={update}/>
                  <label className="form-field"><span>State</span><select value={form.permanentState} onChange={e=>{update("permanentState",e.target.value);update("permanentDistrict","");}}><option value="">Select state</option>{indiaLocations.map(st=><option key={st.code} value={st.name}>{st.name}</option>)}</select></label>
                  <label className="form-field"><span>District</span><select value={form.permanentDistrict} disabled={!form.permanentState} onChange={e=>update("permanentDistrict",e.target.value)}><option value="">Select district</option>{(indiaLocations.find(st=>st.name===form.permanentState)?.districts||[]).map(d=><option key={d.code} value={d.name}>{d.name}</option>)}</select></label>
                  <Field label="PIN" name="permanentPin" value={form.permanentPin} onChange={update}/>
                  <Field label="Nearest Landmark" name="permanentNearestLandmark" value={form.permanentNearestLandmark} onChange={update}/>
                </div>
              </>}
            </div>
          </div>
        </section>

        <section className="form-section rcld-form-section">
          <h3>Contact Details</h3>
          <div className="rcld-contact-grid">
            <label className="form-field"><span>* Mobile No. (10 digits)</span><div className="rcld-digit-boxes">{Array.from({length:10},(_,i)=><input key={i} aria-label={"Mobile digit "+(i+1)} inputMode="numeric" maxLength={1} value={form.mobileNumber[i]||""} onChange={e=>{const digit=e.target.value.replace(/\D/g,"").slice(-1);const next=(form.mobileNumber||"").padEnd(10," ").split("");next[i]=digit;update("mobileNumber",next.join("").replace(/ /g,"").slice(0,10));if(digit&&i<9)e.target.nextElementSibling?.focus();}} onKeyDown={e=>{if(e.key==="Backspace"&&!form.mobileNumber[i]&&i>0)e.target.previousElementSibling?.focus();}} onPaste={e=>{if(i===0){e.preventDefault();update("mobileNumber",e.clipboardData.getData("text").replace(/\D/g,"").slice(0,10));}}}/>)}</div></label>
            <Field label="* Mob. of Guardian" name="guardianContactNumber" value={form.guardianContactNumber} onChange={update} maxLength={15}/>
            <Field label="* WhatsApp No." name="whatsappNumber" value={form.whatsappNumber} onChange={update} maxLength={15}/>
            <Field label="* Email Id" name="email" value={form.email} onChange={update} required type="email"/>
            <Field label="* Aadhaar No. (12 digits)" name="aadhaarNumber" value={form.aadhaarNumber} onChange={update} required maxLength={12} inputMode="numeric" pattern="[0-9]{12}"/>
          </div>
        </section>

        <section className="form-section rcld-form-section">
          <h3>Qualifications</h3>
          <div className="rcld-qualification-grid">
            <Field label="① Class / Sem / Course" name="examCourse" value={form.qualifications[0].examCourse} onChange={(_,v)=>updateQ("examCourse",v)}/>
            <Field label="② Institute" name="collegeInstitute" value={form.qualifications[0].collegeInstitute} onChange={(_,v)=>updateQ("collegeInstitute",v)}/>
            <Field label="③ Board / Council / University" name="boardUniversity" value={form.qualifications[0].boardUniversity} onChange={(_,v)=>updateQ("boardUniversity",v)}/>
            <Field label="④ Year" name="year" value={form.qualifications[0].year} onChange={(_,v)=>updateQ("year",v)}/>
            <Field label="⑤ Percentage of Marks" name="percentage" value={form.qualifications[0].percentage} onChange={(_,v)=>updateQ("percentage",v)}/>
          </div>
        </section>

        <section className="form-section rcld-form-section">
          <h3>Enclosure</h3>
          <div className="checks rcld-enclosures">
            {[[ "stampPhoto","2 Passport size photo"],["qualifyingCertificates","Aadhaar / Qualifying certificates"],["matricAdmitCard","Admit / Caste worksheet"]].map(([key,label])=><label key={key}><input type="checkbox" checked={!!form.enclosures[key]} onChange={e=>setForm(current=>({...current,enclosures:{...current.enclosures,[key]:e.target.checked}}))}/>{label}</label>)}
          </div>
        </section>

        <section className="form-section rcld-form-section">
          <h3>Declaration</h3>
          <p className="declaration">I do hereby declare that all the information stated in this application form is true to the best of my knowledge. I have read and understood the rules and regulations and agree to abide by them.</p>
          <div className="rcld-declaration-grid">
            <Field label="Date" name="declarationDate" type="date" value={form.declarationDate} onChange={update}/>
            <Field label="Place" name="declarationPlace" value={form.declarationPlace} onChange={update}/>
            <label className="form-field"><span>Student Signature Image *</span><input type="file" accept="image/*" disabled={signatureUploading} onChange={e=>uploadSignature(e.target.files?.[0])} required={!form.signatureUrl}/><small>{signatureUploading?"Uploading signature to Cloudinary…":"PNG/JPG image · Maximum 3 MB"}</small>{form.signatureUrl&&<img src={form.signatureUrl} alt="Uploaded student signature" style={{maxWidth:220,maxHeight:80,objectFit:"contain",background:"#fff",padding:8,border:"1px solid #d5dce7",borderRadius:8}}/>}</label>
          </div>
        </section>

        {message&&<div className={message.includes("successfully")?"success-msg":"error-msg"}>{message}</div>}
        <div className="form-actions"><a className="ghost-btn" href="/dashboard/students">Cancel</a><button className="primary-btn" disabled={saving||photoUploading||signatureUploading}><Save size={17}/>{saving?"Saving…":"Register Student"}</button></div>
      </form>
    </ERPLayout>
  );
}
