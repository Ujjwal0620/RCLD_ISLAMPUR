"use client";

import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const initial = {
  name: "",
  age: "",
  dateOfBirth: "",
  gender: "",
  mobile: "",
  password: "",
  offDays: [],
  email: "",
  address: "",
  joiningDate: "",
  designation: "",
  department: "",
  employmentType: "Full Time",
  salary: "",
  salaryFrequency: "Monthly",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  leaveBalance: { casual: 0, sick: 0, earned: 0, other: 0 },
  skills: [],
  status: "Active",
  notes: ""
};

const groups = [
  { title: "Computer Fundamentals", skills: ["Fundamentals", "DOS", "Windows", "Internet and Email"] },
  { title: "Microsoft Office", skills: ["MS Word", "MS Paint", "MS Excel", "MS PowerPoint", "MS Access", "MS Outlook"] },
  { title: "Programming & Development", skills: ["Blue Java", "C Programming", "JavaScript", "Python", "SQL", "Visual Basic", "VB .NET", "HTML", "CSS", "Android App Development"] },
  { title: "Design & Accounts", skills: ["CorelDRAW", "Photoshop", "Tally ERP 9"] },
  { title: "Technology & Security", skills: ["Gen AI Tools", "Hardware", "Networking", "CCTV Installation", "Cyber Security Online Works", "Scratch"] }
];

function Field({ label, name, value, onChange, type = "text", required = false, maxLength }) {
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

function LeaveField({ label, name, value, onChange }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
      />
    </label>
  );
}

export default function CreateEmployeePage() {
  const [form, setForm] = useState(initial);
  const [skills, setSkills] = useState(() => groups.flatMap((group) => group.skills));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateLeave = (key, value) => {
    setForm((current) => ({
      ...current,
      leaveBalance: { ...current.leaveBalance, [key]: value }
    }));
  };

  const allSkills = groups.flatMap((group) => group.skills);
  const allSelected = allSkills.every((skill) => form.skills.includes(skill));

  const toggleAllSkills = () => {
    setForm((current) => ({ ...current, skills: allSelected ? [] : allSkills }));
  };

  const toggleGroup = (groupSkills) => {
    const groupSelected = groupSkills.every((skill) => form.skills.includes(skill));
    setForm((current) => ({
      ...current,
      skills: groupSelected
        ? current.skills.filter((skill) => !groupSkills.includes(skill))
        : [...new Set([...current.skills, ...groupSkills])]
    }));
  };

  const toggleSkill = (skill) => {
    setForm((current) => ({
      ...current,
      skills: current.skills.includes(skill)
        ? current.skills.filter((item) => item !== skill)
        : [...current.skills, skill]
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
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        designation: form.designation.trim(),
        department: form.department.trim(),
        salary: form.salary === "" ? "" : Number(form.salary),
        age: form.age === "" ? "" : Number(form.age),
        leaveBalance: Object.fromEntries(
          Object.entries(form.leaveBalance).map(([key, value]) => [key, Number(value || 0)])
        )
      };

      const r = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const d = await r.json();
      if (!r.ok) {
        const detail = d.detail ? ` (${d.detail})` : "";
        throw new Error(`${d.error || "Unable to create employee."}${detail}`);
      }

      setMessage(`Employee ${d.employee.employeeId} created successfully.`);
      setForm(initial);
    } catch (error) {
      setMessage(error.message || "Unable to create employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ERPLayout active="/dashboard/employees">
      <header className="topbar">
        <div>
          <div className="crumb">People / Employees / Create</div>
          <h1>Create Employee</h1>
        </div>
        <a className="ghost-btn" href="/dashboard/employees"><ArrowLeft size={17} /> Back to Employees</a>
      </header>

      <form className="registration-form employee-form" onSubmit={submit}>
        <div className="form-intro">
          <div className="rcld-title">RCLD / ISLAMPUR</div>
          <strong>Employee Creation & HR Profile</strong>
          <span>Employee ID is generated automatically in the format RCLD/ISL/001, RCLD/ISL/002 and so on.</span>
        </div>

        <section className="form-section">
          <h3>Personal Details</h3>
          <div className="form-grid four">
            <Field label="Employee Name" name="name" value={form.name} onChange={update} required />
            <Field label="Age" name="age" type="number" value={form.age} onChange={update} />
            <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={update} />
            <label className="form-field"><span>Gender</span><select value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label>
            <Field label="Mobile Number / Faculty Login ID" name="mobile" value={form.mobile} onChange={update} maxLength={15} />
            <Field label="Faculty Login Password" name="password" type="password" value={form.password} onChange={update} />
            <Field label="Email" name="email" type="email" value={form.email} onChange={update} />
            <Field label="Joining Date" name="joiningDate" type="date" value={form.joiningDate} onChange={update} />
            <Field label="Designation" name="designation" value={form.designation} onChange={update} />
            <Field label="Department" name="department" value={form.department} onChange={update} />
            <label className="form-field"><span>Employment Type</span><select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}><option>Full Time</option><option>Part Time</option><option>Contract</option><option>Intern</option></select></label>
            <label className="form-field"><span>Status</span><select value={form.status} onChange={(e) => update("status", e.target.value)}><option>Active</option><option>Inactive</option><option>On Leave</option></select></label>
          </div>
          <label className="form-field full"><span>Address</span><textarea rows="3" value={form.address} onChange={(e) => update("address", e.target.value)} /></label>
        </section>

        <section className="form-section">
          <h3>Attendance & Leave Balance</h3>
          <div className="form-grid four">
            {["casual", "sick", "earned", "other"].map((key) => (
              <LeaveField key={key} label={`${key[0].toUpperCase()}${key.slice(1)} Leave`} name={key} value={form.leaveBalance[key]} onChange={updateLeave} />
            ))}
          </div>
          <div className="form-field full"><span>Weekly Off Days</span><div className="skill-check-grid">{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day=><label key={day} className={form.offDays.includes(day)?"checked":""}><input type="checkbox" checked={form.offDays.includes(day)} onChange={e=>setForm(x=>({...x,offDays:e.target.checked?[...x.offDays,day]:x.offDays.filter(d=>d!==day)}))}/><span>{day}</span></label>)}</div></div>
          <p className="form-help">These are the employee's opening leave balances. Actual attendance, leave applications and approvals will be managed in the Employee Attendance & Leave module.</p>
        </section>

        <section className="form-section">
          <h3>Salary & Banking</h3>
          <div className="form-grid four">
            <Field label="Salary" name="salary" type="number" value={form.salary} onChange={update} />
            <label className="form-field"><span>Salary Frequency</span><select value={form.salaryFrequency} onChange={(e) => update("salaryFrequency", e.target.value)}><option>Monthly</option><option>Daily</option><option>Hourly</option></select></label>
            <Field label="Bank Name" name="bankName" value={form.bankName} onChange={update} />
            <Field label="Account Number" name="accountNumber" value={form.accountNumber} onChange={update} />
            <Field label="IFSC" name="ifsc" value={form.ifsc} onChange={update} />
          </div>
        </section>

        <section className="form-section">
          <h3>Emergency Contact</h3>
          <div className="form-grid three">
            <Field label="Contact Name" name="emergencyContactName" value={form.emergencyContactName} onChange={update} />
            <Field label="Contact Number" name="emergencyContactNumber" value={form.emergencyContactNumber} onChange={update} maxLength={15} />
          </div>
        </section>

        <section className="form-section">
          <h3>Skills</h3>
          <p className="form-help">Select all skills the employee is qualified to teach or support. Multiple skills can be selected.</p>
          <div className="form-actions" style={{ justifyContent: "flex-start", marginBottom: 16 }}>
            <button type="button" className="ghost-btn" onClick={toggleAllSkills}>
              {allSelected ? "Clear All Skills" : "Select All Skills"}
            </button>
            <span className="form-help">{form.skills.length} of {allSkills.length} selected</span>
          </div>
          <div className="skill-groups">
            {groups.map((group) => (
              <div className="skill-group" key={group.title}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <h4>{group.title}</h4>
                  <label className="skill-group-select-all">
                    <input
                      type="checkbox"
                      checked={group.skills.every((skill) => form.skills.includes(skill))}
                      onChange={() => toggleGroup(group.skills)}
                    />
                    <span>Select group</span>
                  </label>
                </div>
                <div className="skill-check-grid">
                  {group.skills.map((skill) => (
                    <label key={skill} className={form.skills.includes(skill) ? "checked" : ""}>
                      <input type="checkbox" checked={form.skills.includes(skill)} onChange={() => toggleSkill(skill)} />
                      <span>{skill}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="form-section">
          <h3>Notes</h3>
          <textarea className="employee-notes" rows="4" value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Internal HR notes…" />
        </section>

        {message && <div className={message.includes("successfully") ? "success-msg" : "error-msg"}>{message}</div>}
        <div className="form-actions">
          <a className="ghost-btn" href="/dashboard/employees">Cancel</a>
          <button className="primary-btn" disabled={saving}><Save size={17} />{saving ? "Saving…" : "Create Employee"}</button>
        </div>
      </form>
    </ERPLayout>
  );
}
