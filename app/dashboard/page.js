"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, FileText, RefreshCw, Search, LayoutDashboard, GraduationCap } from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState({ students: 0, registered: 0, recent: [] });
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    setData(await response.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  return (
    <main className="erp-shell">
      <aside className="erp-sidebar">
        <div className="brand"><div className="brand-mark">R</div><div><strong>RCLD</strong><span>Islampur ERP</span></div></div>
        <div className="side-label">MAIN MENU</div>
        <a className="side-link active" href="/dashboard"><LayoutDashboard size={18}/>Dashboard</a>
        <a className="side-link" href="/dashboard/students"><Users size={18}/>Students</a>
        <a className="side-link" href="/dashboard/students/register"><UserPlus size={18}/>Registration</a>
      </aside>
      <section className="erp-main">
        <header className="topbar"><div><div className="crumb">RCLD Islampur / ERP</div><h1>Dashboard</h1></div><button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={18}/></button></header>
        <div className="welcome"><div><span className="eyebrow">ERP CONTROL CENTER</span><h2>Student Management</h2><p>Manage RCLD registrations from one place.</p></div><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></div>
        <div className="metric-grid">
          <div className="metric"><div className="metric-icon blue"><Users size={21}/></div><span>Total Students</span><strong>{loading ? "—" : data.students}</strong><small>All registered records</small></div>
          <div className="metric"><div className="metric-icon green"><GraduationCap size={21}/></div><span>Registered</span><strong>{loading ? "—" : data.registered}</strong><small>Current registration status</small></div>
          <div className="metric"><div className="metric-icon orange"><FileText size={21}/></div><span>Records / Page</span><strong>50</strong><small>Fixed server pagination</small></div>
          <div className="metric"><div className="metric-icon purple"><Search size={21}/></div><span>Student Search</span><strong>Ready</strong><small>Name, form, mobile, course</small></div>
        </div>
        <section className="panel"><div className="panel-head"><div><h3>Recently Registered</h3><p>Latest student registration records</p></div><a href="/dashboard/students">View all students →</a></div>
          {data.recent.length === 0 ? <div className="empty">No student registrations found yet.</div> : <div className="table-wrap"><table><thead><tr><th>Form No.</th><th>Student</th><th>Course</th><th>Mobile</th><th>Status</th></tr></thead><tbody>{data.recent.map(s => <tr key={s._id}><td>{s.formNo}</td><td>{s.applicantName}</td><td>{s.courseName || "—"}</td><td>{s.mobileNumber}</td><td><span className="badge">{s.status}</span></td></tr>)}</tbody></table></div>}
        </section>
      </section>
    </main>
  );
}
