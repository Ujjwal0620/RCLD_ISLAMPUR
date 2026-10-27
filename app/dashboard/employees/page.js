"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, Users, ChevronRight, BriefcaseBusiness, Pencil, Trash2 } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [skills, setSkills] = useState([]);
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (skill) params.set("skill", skill);
      const r = await fetch("/api/employees?" + params.toString(), { cache: "no-store" });
      const data = await r.json();
      setEmployees(data.employees || []);
      setSkills(data.skills || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [skill]);

  return (
    <ERPLayout active="/dashboard/employees">
      <header className="topbar">
        <div><div className="crumb">People / Employees</div><h1>Employees</h1></div>
        <a className="primary-btn" href="/dashboard/employees/create"><UserPlus size={17}/> Create Employee</a>
      </header>

      <section className="metric-grid employee-metrics">
        <div className="metric"><div className="metric-icon blue"><Users size={19}/></div><span>Total Employees</span><strong>{employees.length}</strong></div>
        <div className="metric"><div className="metric-icon green"><BriefcaseBusiness size={19}/></div><span>Active Employees</span><strong>{employees.filter(e => e.status === "Active").length}</strong></div>
        <div className="metric"><div className="metric-icon purple"><Users size={19}/></div><span>Skills in Catalog</span><strong>{skills.length}</strong></div>
      </section>

      <section className="panel filter-panel">
        <div className="filters">
          <div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Search employee ID, name, mobile, designation…"/></div>
          <select value={skill} onChange={e => setSkill(e.target.value)}><option value="">All Skills</option>{skills.map(s => <option key={s}>{s}</option>)}</select>
          <button className="search-action" onClick={load}><Search size={16}/> Search</button>
        </div>
      </section>

      <section className="panel table-panel">
        {loading ? <div className="empty">Loading employees…</div> : employees.length === 0 ? <div className="empty">No employees found. Create the first employee record.</div> :
          <div className="table-wrap"><table><thead><tr><th>Employee ID</th><th>Name</th><th>Designation</th><th>Department</th><th>Mobile</th><th>Skills</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{employees.map(e => <tr key={e._id} className="student-row" onClick={() => window.location.href = `/dashboard/employees/${e._id}`} tabIndex="0" onKeyDown={ev => ev.key === "Enter" && (window.location.href = `/dashboard/employees/${e._id}`)}>
            <td><strong>{e.employeeId}</strong></td><td>{e.name}</td><td>{e.designation || "—"}</td><td>{e.department || "—"}</td><td>{e.mobile || "—"}</td><td><span className="skill-count">{e.skills?.length || 0} skills</span></td><td><span className="badge">{e.status}</span></td><td><div className="top-actions" onClick={ev => ev.stopPropagation()}><a className="ghost-btn" href={`/dashboard/employees/${e._id}?edit=1`}><Pencil size={14}/> Edit</a><button className="ghost-btn" onClick={async ev => { ev.stopPropagation(); if (!confirm("Archive this employee?")) return; const r = await fetch(`/api/employees/${e._id}`, { method: "DELETE" }); const d = await r.json(); if (!r.ok) return alert(d.error || "Unable to archive employee"); load(); }}><Trash2 size={14}/> Delete</button></div></td>
          </tr>)}</tbody></table></div>}
      </section>
    </ERPLayout>
  );
}
