"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, FileText, RefreshCw, Search, GraduationCap } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function DashboardPage() {
  const [data, setData] = useState({ students: 0, registered: 0, recent: [] });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      setData(await response.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <ERPLayout active="/dashboard" hideAssistant>
      <header className="topbar"><div><div className="crumb">RCLD Islampur / ERP</div><h1>Dashboard</h1></div><button className="icon-btn" onClick={load} title="Refresh" aria-label="Refresh"><RefreshCw size={18}/></button></header>
      <div className="welcome"><div><span className="eyebrow">ERP CONTROL CENTER</span><h2>Student Management</h2><p>Manage RCLD registrations from one place.</p></div><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></div>
      <div className="metric-grid">
        <div className="metric"><div className="metric-icon blue"><Users size={21}/></div><span>Total Students</span><strong>{loading ? "—" : data.students}</strong><small>All registered records</small></div>
        <div className="metric"><div className="metric-icon green"><GraduationCap size={21}/></div><span>Registered</span><strong>{loading ? "—" : data.registered}</strong><small>Current registration status</small></div>
        <div className="metric"><div className="metric-icon orange"><FileText size={21}/></div><span>Records / Page</span><strong>50</strong><small>Maximum records per page</small></div>
        <div className="metric"><div className="metric-icon purple"><Search size={21}/></div><span>Student Search</span><strong>Ready</strong><small>Multi-field and advanced filters</small></div>
      </div>
      <section className="panel"><div className="panel-head"><div><h3>Recently Registered</h3><p>Latest student registration records</p></div><a href="/dashboard/students">View all students →</a></div>
        {data.recent.length === 0 ? <div className="empty">No student registrations found yet.</div> : <div className="table-wrap"><table><thead><tr><th>Form No.</th><th>Student</th><th>Course</th><th>Mobile</th><th>Status</th></tr></thead><tbody>{data.recent.map(s => <tr key={s._id}><td>{s.formNo}</td><td>{s.applicantName}</td><td>{s.courseName || "—"}</td><td>{s.mobileNumber}</td><td><span className="badge">{s.status}</span></td></tr>)}</tbody></table></div>}
      </section>
    </ERPLayout>
  );
}
