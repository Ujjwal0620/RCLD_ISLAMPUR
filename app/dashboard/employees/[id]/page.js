"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, UserRound, CalendarDays, WalletCards, BadgeCheck, Pencil, Trash2, Save } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const v=(x)=>x===undefined||x===null||x===""?"—":x;

export default function EmployeeDetailsPage({params}){
 const [employee,setEmployee]=useState(null); const [error,setError]=useState(""); const [loading,setLoading]=useState(true); const [editing,setEditing]=useState(false); const [form,setForm]=useState({});
 useEffect(()=>{(async()=>{try{const {id}=await params;const r=await fetch("/api/employees/"+id,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load employee.");setEmployee(d.employee);setForm(d.employee);}catch(e){setError(e.message)}finally{setLoading(false)}})()},[params]);
 async function save(e){e.preventDefault();const r=await fetch("/api/employees/"+employee._id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}),d=await r.json();if(!r.ok)return setError(d.error||"Unable to update employee.");setEmployee(d.employee);setForm(d.employee);setEditing(false);}
 async function remove(){if(!confirm("Archive this employee? The employee will become Inactive so assignment/history data is preserved."))return;const r=await fetch("/api/employees/"+employee._id,{method:"DELETE"}),d=await r.json();if(!r.ok)return setError(d.error||"Unable to archive employee.");window.location.href="/dashboard/employees";}
 return <ERPLayout active="/dashboard/employees">
  <header className="topbar"><div><div className="crumb">People / Employees / Details</div><h1>{employee?.name||"Employee Details"}</h1></div><div className="top-actions">{employee&&<><button className="ghost-btn" onClick={()=>setEditing(true)}><Pencil size={16}/> Edit</button><button className="ghost-btn" onClick={remove}><Trash2 size={16}/> Delete</button></>}<a className="ghost-btn" href="/dashboard/employees"><ArrowLeft size={17}/> Back</a></div></header>
  {loading&&<section className="panel"><div className="empty">Loading employee…</div></section>}
  {error&&<section className="panel"><div className="empty error-text">{error}</div></section>}
  {employee&&<main className="student-details">
   {editing&&<section className="detail-section"><div className="detail-section-title"><Pencil size={17}/><h3>Edit Employee</h3></div><form onSubmit={save}><div className="form-grid three">{[["name","Name"],["mobile","Mobile"],["email","Email"],["designation","Designation"],["department","Department"],["joiningDate","Joining Date"],["employmentType","Employment Type"],["salary","Salary"],["address","Address"],["notes","Notes"]].map(([k,l])=><label className="form-field" key={k}><span>{l}</span><input value={form[k]||""} onChange={e=>setForm(x=>({...x,[k]:e.target.value}))}/></label>)}<label className="form-field"><span>Status</span><select value={form.status||"Active"} onChange={e=>setForm(x=>({...x,status:e.target.value}))}><option>Active</option><option>Inactive</option><option>On Leave</option></select></label></div><div className="form-actions"><button type="button" className="ghost-btn" onClick={()=>setEditing(false)}>Cancel</button><button className="primary-btn"><Save size={16}/> Save Changes</button></div></form></section>}
   <section className="student-profile-card"><div className="student-avatar"><UserRound size={30}/></div><div><div className="eyebrow">Employee Profile</div><h2>{employee.name}</h2><p>{employee.employeeId} · {v(employee.designation)}</p></div><span className="badge profile-status">{employee.status}</span></section>
   <section className="detail-section"><div className="detail-section-title"><UserRound size={17}/><h3>Personal & Employment Details</h3></div><div className="student-detail-grid">
    {[
      ["Employee ID",employee.employeeId],["Name",employee.name],["Age",employee.age],["Date of Birth",employee.dateOfBirth],["Gender",employee.gender],["Mobile",employee.mobile],["Email",employee.email],["Joining Date",employee.joiningDate],["Designation",employee.designation],["Department",employee.department],["Employment Type",employee.employmentType],["Status",employee.status]
    ].map(([label,val])=><div className="student-detail-field" key={label}><span>{label}</span><strong>{v(val)}</strong></div>)}</div><div className="student-address"><div><span>Address</span><strong>{v(employee.address)}</strong></div></div></section>
   <section className="detail-section"><div className="detail-section-title"><BadgeCheck size={17}/><h3>Skills</h3></div><div className="skill-pill-list">{(employee.skills||[]).map(s=><span key={s}>{s}</span>)}{!employee.skills?.length&&<div className="empty">No skills selected.</div>}</div></section>
   <section className="detail-section"><div className="detail-section-title"><CalendarDays size={17}/><h3>Attendance & Leave</h3></div><div className="student-detail-grid">
    {Object.entries(employee.leaveBalance||{}).map(([k,val])=><div className="student-detail-field" key={k}><span>{k} Leave Balance</span><strong>{v(val)} days</strong></div>)}
    </div><div className="empty">Daily in/out time, breaks, official/personal out-time, attendance records and leave requests will be managed here as the Employee Attendance module is added.</div></section>
   <section className="detail-section"><div className="detail-section-title"><WalletCards size={17}/><h3>Salary</h3></div><div className="student-detail-grid">
    <div className="student-detail-field"><span>Salary</span><strong>{employee.salary ? `₹${Number(employee.salary).toLocaleString("en-IN")}` : "—"}</strong></div><div className="student-detail-field"><span>Frequency</span><strong>{v(employee.salaryFrequency)}</strong></div><div className="student-detail-field"><span>Bank</span><strong>{v(employee.bankName)}</strong></div><div className="student-detail-field"><span>IFSC</span><strong>{v(employee.ifsc)}</strong></div>
   </div></section>
   <section className="detail-section"><div className="detail-section-title"><WalletCards size={17}/><h3>Emergency Contact & Notes</h3></div><div className="student-detail-grid"><div className="student-detail-field"><span>Contact Name</span><strong>{v(employee.emergencyContactName)}</strong></div><div className="student-detail-field"><span>Contact Number</span><strong>{v(employee.emergencyContactNumber)}</strong></div></div><div className="student-address"><div><span>Internal Notes</span><strong>{v(employee.notes)}</strong></div></div></section>
  </main>}
 </ERPLayout>
}
