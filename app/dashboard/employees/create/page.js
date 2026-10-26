"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const initial = {
  name:"", age:"", dateOfBirth:"", gender:"", mobile:"", email:"", address:"",
  joiningDate:"", designation:"", department:"", employmentType:"Full Time",
  salary:"", salaryFrequency:"Monthly", bankName:"", accountNumber:"", ifsc:"",
  emergencyContactName:"", emergencyContactNumber:"",
  leaveBalance:{casual:0,sick:0,earned:0,other:0}, skills:[], status:"Active", notes:""
};

const groups = [
  { title:"Computer Fundamentals", skills:["Fundamentals","DOS","Windows","Internet and Email"] },
  { title:"Microsoft Office", skills:["MS Word","MS Paint","MS Excel","MS PowerPoint","MS Access","MS Outlook"] },
  { title:"Programming & Development", skills:["Blue Java","C Programming","JavaScript","Python","SQL","Visual Basic","VB .NET","HTML","CSS","Android App Development"] },
  { title:"Design & Accounts", skills:["CorelDRAW","Photoshop","Tally ERP 9"] },
  { title:"Technology & Security", skills:["Gen AI Tools","Hardware","Networking","CCTV Installation","Cyber Security Online Works","Scratch"] }
];

export default function CreateEmployeePage() {
  const [form,setForm]=useState(initial);
  const [skills,setSkills]=useState([]);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{ fetch("/api/employees",{cache:"no-store"}).then(r=>r.json()).then(d=>setSkills(d.skills||[])); },[]);

  const update=(key,value)=>setForm(f=>({...f,[key]:value}));
  const updateLeave=(key,value)=>setForm(f=>({...f,leaveBalance:{...f.leaveBalance,[key]:value}}));
  const toggleSkill=(skill)=>setForm(f=>({...f,skills:f.skills.includes(skill)?f.skills.filter(s=>s!==skill):[...f.skills,skill]}));

  async function submit(e){
    e.preventDefault(); setSaving(true); setMessage("");
    try{
      const r=await fetch("/api/employees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Unable to create employee.");
      setMessage(`Employee ${d.employee.employeeId} created successfully.`);
      setForm(initial);
    }catch(e){setMessage(e.message);}finally{setSaving(false);}
  }

  const Field=({label,name,type="text",required=false})=><label className="form-field"><span>{label}{required?" *":""}</span><input type={type} value={form[name]} onChange={e=>update(name,e.target.value)} required={required}/></label>;
  const LeaveField=({label,name})=><label className="form-field"><span>{label}</span><input type="number" min="0" value={form.leaveBalance[name]} onChange={e=>updateLeave(name,e.target.value)}/></label>;

  return <ERPLayout active="/dashboard/employees">
    <header className="topbar"><div><div className="crumb">People / Employees / Create</div><h1>Create Employee</h1></div><a className="ghost-btn" href="/dashboard/employees"><ArrowLeft size={17}/> Back to Employees</a></header>
    <form className="registration-form employee-form" onSubmit={submit}>
      <div className="form-intro"><div className="rcld-title">RCLD / ISLAMPUR</div><strong>Employee Creation & HR Profile</strong><span>Employee ID is generated automatically in the format RCLD/ISL/001, RCLD/ISL/002 and so on.</span></div>
      <section className="form-section"><h3>Personal Details</h3><div className="form-grid four">
        <Field label="Employee Name" name="name" required/><Field label="Age" name="age" type="number"/><Field label="Date of Birth" name="dateOfBirth" type="date"/><label className="form-field"><span>Gender</span><select value={form.gender} onChange={e=>update("gender",e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label>
        <Field label="Mobile Number" name="mobile"/><Field label="Email" name="email" type="email"/><Field label="Joining Date" name="joiningDate" type="date"/><Field label="Designation" name="designation"/>
        <Field label="Department" name="department"/><label className="form-field"><span>Employment Type</span><select value={form.employmentType} onChange={e=>update("employmentType",e.target.value)}><option>Full Time</option><option>Part Time</option><option>Contract</option><option>Intern</option></select></label><label className="form-field"><span>Status</span><select value={form.status} onChange={e=>update("status",e.target.value)}><option>Active</option><option>Inactive</option><option>On Leave</option></select></label>
      </div><label className="form-field full"><span>Address</span><textarea rows="3" value={form.address} onChange={e=>update("address",e.target.value)}/></label></section>

      <section className="form-section"><h3>Attendance & Leave Balance</h3><div className="form-grid four"><LeaveField label="Casual Leave" name="casual"/><LeaveField label="Sick Leave" name="sick"/><LeaveField label="Earned Leave" name="earned"/><LeaveField label="Other Leave" name="other"/></div><p className="form-help">These are the employee's opening leave balances. Actual attendance, leave applications and approvals will be managed in the Employee Attendance & Leave module.</p></section>

      <section className="form-section"><h3>Salary & Banking</h3><div className="form-grid four"><Field label="Salary" name="salary" type="number"/><label className="form-field"><span>Salary Frequency</span><select value={form.salaryFrequency} onChange={e=>update("salaryFrequency",e.target.value)}><option>Monthly</option><option>Daily</option><option>Hourly</option></select></label><Field label="Bank Name" name="bankName"/><Field label="Account Number" name="accountNumber"/><Field label="IFSC" name="ifsc"/></div></section>

      <section className="form-section"><h3>Emergency Contact</h3><div className="form-grid three"><Field label="Contact Name" name="emergencyContactName"/><Field label="Contact Number" name="emergencyContactNumber"/></div></section>

      <section className="form-section"><h3>Skills</h3><p className="form-help">Select all skills the employee is qualified to teach or support. Multiple skills can be selected.</p>
        <div className="skill-groups">{groups.map(group=><div className="skill-group" key={group.title}><h4>{group.title}</h4><div className="skill-check-grid">{group.skills.filter(s=>skills.includes(s)).map(s=><label key={s} className={form.skills.includes(s)?"checked":""}><input type="checkbox" checked={form.skills.includes(s)} onChange={()=>toggleSkill(s)}/><span>{s}</span></label>)}</div></div>)}</div>
      </section>

      <section className="form-section"><h3>Notes</h3><textarea className="employee-notes" rows="4" value={form.notes} onChange={e=>update("notes",e.target.value)} placeholder="Internal HR notes…"/></section>

      {message && <div className={message.includes("successfully")?"success-msg":"error-msg"}>{message}</div>}
      <div className="form-actions"><a className="ghost-btn" href="/dashboard/employees">Cancel</a><button className="primary-btn" disabled={saving}><Save size={17}/>{saving?"Saving…":"Create Employee"}</button></div>
    </form>
  </ERPLayout>;
}
