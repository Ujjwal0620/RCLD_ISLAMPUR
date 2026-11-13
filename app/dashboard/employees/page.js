"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, Users, BriefcaseBusiness, Pencil, Trash2, SlidersHorizontal, RotateCcw, Filter, X } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const emptyFilters = {
  search:"", skill:"", status:"", department:"", designation:"", employmentType:"", gender:"",
  employeeId:"", name:"", mobile:"", email:"", address:"", emergencyContactName:"",
  emergencyContactNumber:"", ageMin:"", ageMax:"", salaryMin:"", salaryMax:"",
  joiningFrom:"", joiningTo:"", dateOfBirth:"", salaryFrequency:"", offDay:"", casualLeaveMin:"", sickLeaveMin:"", earnedLeaveMin:"", otherLeaveMin:"", notes:""
};

const advancedFields = [
  ["employeeId","Employee ID"],["name","Employee name"],["mobile","Mobile number"],["email","Email address"],
  ["department","Department"],["designation","Designation"],["gender","Gender"],["employmentType","Employment type"],
  ["address","Address"],["emergencyContactName","Emergency contact name"],["emergencyContactNumber","Emergency contact number"],["notes","HR notes"]
];

export default function EmployeesPage() {
  const [employees,setEmployees]=useState([]);
  const [skills,setSkills]=useState([]);
  const [filters,setFilters]=useState(emptyFilters);
  const [advanced,setAdvanced]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function load(override=filters) {
    setLoading(true);setError("");
    try {
      const params=new URLSearchParams();
      Object.entries(override).forEach(([key,value])=>{if(value)params.set(key,value)});
      const response=await fetch("/api/employees?"+params.toString(),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to load employees.");
      setEmployees(data.employees||[]);
      setSkills(data.skills||[]);
    } catch(e) { setError(e.message||"Unable to load employees."); }
    finally { setLoading(false); }
  }

  useEffect(()=>{load()},[]);
  function update(key,value){setFilters(current=>({...current,[key]:value}))}
  function clearFilters(){setFilters(emptyFilters);load(emptyFilters)}
  const activeCount=Object.values(filters).filter(Boolean).length;

  return (
    <ERPLayout active="/dashboard/employees">
      <header className="topbar">
        <div><div className="crumb">People / Employees</div><h1>Employees</h1></div>
        <a className="primary-btn" href="/dashboard/employees/create"><UserPlus size={17}/> Create Employee</a>
      </header>
      <section className="directory-overview">
        <div><span className="eyebrow">PEOPLE OPERATIONS</span><h2>Employee directory</h2><p>Search across employee identity, contact, role, department, skills and employment details.</p></div>
        <div className="directory-overview-meta"><span>{employees.length} employees in current view</span><span>{skills.length} skills in catalogue</span></div>
      </section>
      <section className="metric-grid employee-metrics">
        <div className="metric"><div className="metric-icon blue"><Users size={19}/></div><span>Employees in current view</span><strong>{employees.length}</strong></div>
        <div className="metric"><div className="metric-icon green"><BriefcaseBusiness size={19}/></div><span>Active employees</span><strong>{employees.filter(e=>e.status==="Active").length}</strong></div>
        <div className="metric"><div className="metric-icon purple"><Users size={19}/></div><span>Skills in catalogue</span><strong>{skills.length}</strong></div>
      </section>
      <section className="panel filter-panel">
        <div className="filter-title"><div><h3>Employee search & filters</h3><p>Search every employee directory field, then narrow results with multiple advanced conditions.</p></div><button type="button" className="filter-toggle" onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal size={17}/>{advanced?"Hide filters":"Advanced filters"}{activeCount>0&&<span>{activeCount}</span>}</button></div>
        <div className="filters primary-filters">
          <div className="search-box"><Search size={17}/><input value={filters.search} onChange={e=>update("search",e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Search ID, name, mobile, email, role, department, address…"/></div>
          <select value={filters.skill} onChange={e=>{update("skill",e.target.value);load({...filters,skill:e.target.value})}}><option value="">All skills</option>{skills.map(s=><option key={s}>{s}</option>)}</select>
          <button className="search-action" type="button" onClick={()=>load()}><Search size={16}/> Search</button>
        </div>
        {advanced&&<div className="advanced-filters advanced-filters-expanded">
          <div className="filter-field"><label>Status</label><select value={filters.status} onChange={e=>update("status",e.target.value)}><option value="">Active records</option><option>Active</option><option>Inactive</option><option>On Leave</option><option>Resigned</option></select></div>
          <div className="filter-field"><label>Gender</label><select value={filters.gender} onChange={e=>update("gender",e.target.value)}><option value="">All genders</option><option>Male</option><option>Female</option><option>Other</option></select></div>
          <div className="filter-field"><label>Employment type</label><select value={filters.employmentType} onChange={e=>update("employmentType",e.target.value)}><option value="">All types</option><option>Full Time</option><option>Part Time</option><option>Contract</option><option>Intern</option></select></div>
          <div className="filter-field"><label>Age from</label><input type="number" min="16" value={filters.ageMin} onChange={e=>update("ageMin",e.target.value)}/></div>
          <div className="filter-field"><label>Age to</label><input type="number" min="16" value={filters.ageMax} onChange={e=>update("ageMax",e.target.value)}/></div>
          <div className="filter-field"><label>Salary from (₹)</label><input type="number" min="0" value={filters.salaryMin} onChange={e=>update("salaryMin",e.target.value)}/></div>
          <div className="filter-field"><label>Salary to (₹)</label><input type="number" min="0" value={filters.salaryMax} onChange={e=>update("salaryMax",e.target.value)}/></div>
          <div className="filter-field"><label>Date of birth</label><input type="date" value={filters.dateOfBirth} onChange={e=>update("dateOfBirth",e.target.value)}/></div>
          <div className="filter-field"><label>Salary frequency</label><select value={filters.salaryFrequency} onChange={e=>update("salaryFrequency",e.target.value)}><option value="">All</option><option>Monthly</option><option>Weekly</option><option>Daily</option><option>Annual</option></select></div>
          <div className="filter-field"><label>Weekly off day</label><select value={filters.offDay} onChange={e=>update("offDay",e.target.value)}><option value="">Any</option>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(x=><option key={x}>{x}</option>)}</select></div>
          {[["casualLeaveMin","Casual leave balance min"],["sickLeaveMin","Sick leave balance min"],["earnedLeaveMin","Earned leave balance min"],["otherLeaveMin","Other leave balance min"]].map(([key,label])=><div className="filter-field" key={key}><label>{label}</label><input type="number" min="0" value={filters[key]} onChange={e=>update(key,e.target.value)}/></div>)}
          <div className="filter-field"><label>Joined from</label><input type="date" value={filters.joiningFrom} onChange={e=>update("joiningFrom",e.target.value)}/></div>
          <div className="filter-field"><label>Joined to</label><input type="date" value={filters.joiningTo} onChange={e=>update("joiningTo",e.target.value)}/></div>
          {advancedFields.map(([key,label])=><div className="filter-field" key={key}><label>{label}</label><input value={filters[key]} onChange={e=>update(key,e.target.value)} placeholder={"Filter by "+label.toLowerCase()}/></div>)}
          <button className="clear-btn" type="button" onClick={clearFilters}><RotateCcw size={15}/> Reset all</button>
        </div>}
        <div className="filter-summary"><span><Filter size={14}/> {employees.length} matching employees</span><button className="clear-inline" type="button" onClick={clearFilters} disabled={!activeCount}><X size={14}/> Clear filters</button></div>
      </section>
      <section className="panel table-panel directory-table-panel" aria-busy={loading}>
        {error?<div className="empty" role="alert">{error}</div>:loading?<div className="empty">Loading employees…</div>:employees.length===0?<div className="empty">No employees match the selected filters.</div>:
          <div className="table-wrap"><table><thead><tr><th>Employee ID</th><th>Name</th><th>Designation</th><th>Department</th><th>Mobile</th><th>Skills</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {employees.map(e=><tr key={e._id} className="student-row" onClick={()=>window.location.href="/dashboard/employees/"+e._id} tabIndex="0" onKeyDown={ev=>ev.key==="Enter"&&(window.location.href="/dashboard/employees/"+e._id)}>
              <td><strong>{e.employeeId}</strong></td><td>{e.name}</td><td>{e.designation||"—"}</td><td>{e.department||"—"}</td><td>{e.mobile||"—"}</td><td><span className="skill-count">{e.skills?.length||0} skills</span></td><td><span className="badge">{e.status}</span></td>
              <td><div className="top-actions" onClick={ev=>ev.stopPropagation()}><a className="ghost-btn" href={"/dashboard/employees/"+e._id+"?edit=1"}><Pencil size={14}/> Edit</a><button className="ghost-btn" onClick={async ev=>{ev.stopPropagation();if(!confirm("Archive this employee?"))return;const r=await fetch("/api/employees/"+e._id,{method:"DELETE"});const d=await r.json();if(!r.ok)return alert(d.error||"Unable to archive employee");load()}}><Trash2 size={14}/> Archive</button></div></td>
            </tr>)}
          </tbody></table></div>}
      </section>
    </ERPLayout>
  );
}
