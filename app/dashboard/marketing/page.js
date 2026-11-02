"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, Search, RefreshCw, UserRound, ChevronRight, Megaphone, UserCheck } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function MarketingPage() {
  const [data, setData] = useState({ referrals: [], marketingEmployees: [] });
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [rr, sr] = await Promise.all([
        fetch("/api/referrals", { cache: "no-store" }),
        fetch("/api/students?limit=500&status=all", { cache: "no-store" }),
      ]);
      const [rd, sd] = await Promise.all([rr.json(), sr.json()]);
      setData({ referrals: rd.referrals || [], marketingEmployees: rd.marketingEmployees || [] });
      setStudents(sd.students || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const referralMap = useMemo(() => new Map(data.referrals.map((r) => [String(r._id), r])), [data.referrals]);
  const groups = useMemo(() => {
    const map = new Map();
    data.marketingEmployees.forEach((e) => map.set(e.employeeId, { employee: e, referrals: [], students: [] }));
    data.referrals.forEach((r) => {
      if (!map.has(r.marketingEmployeeId)) map.set(r.marketingEmployeeId, { employee: { name: r.marketingEmployeeName, employeeId: r.marketingEmployeeId }, referrals: [], students: [] });
      map.get(r.marketingEmployeeId).referrals.push(r);
    });
    students.forEach((s) => {
      const r = referralMap.get(String(s.referralId || ""));
      const employeeId = s.marketingEmployeeId || r?.marketingEmployeeId;
      if (employeeId && map.has(employeeId)) map.get(employeeId).students.push(s);
    });
    return [...map.values()].filter((g) => !search || (g.employee.name + " " + g.referrals.map((r) => r.name).join(" ") + " " + g.students.map((s) => s.applicantName).join(" ")).toLowerCase().includes(search.toLowerCase()));
  }, [data, students, referralMap, search]);

  const referralCount = data.referrals.length;
  const referredStudents = students.filter((s) => s.referralId).length;
  return <ERPLayout active="/dashboard/marketing">
    <header className="topbar"><div><div className="crumb">Marketing / CRM</div><h1>Marketing CRM</h1></div><div className="top-actions"><button className="ghost-btn" onClick={load}><RefreshCw size={16}/> Refresh</button><a className="primary-btn" href="/dashboard/referrals"><UserPlus size={16}/> Manage Referrals</a></div></header>
    <section className="marketing-hero"><div><span>GROWTH & ACQUISITION</span><h2>Marketing relationship center</h2><p>Track every marketing employee, the referrals they manage, and the students who joined through each referral.</p><a href="/dashboard/referrals">Open referral directory <ChevronRight size={15}/></a></div><div className="marketing-hero-icon"><Megaphone size={36}/></div></section>
    <section className="marketing-kpis">
      <article><span>Marketing employees</span><strong>{data.marketingEmployees.length}</strong><small>Active team members</small></article>
      <article><span>Referral sources</span><strong>{referralCount}</strong><small>Active and inactive referrals</small></article>
      <article><span>Referred students</span><strong>{referredStudents}</strong><small>Linked student records</small></article>
    </section>
    <section className="panel marketing-directory">
      <div className="panel-head"><div><h3>Marketing team & referral pipeline</h3><p>Employee → Referral → Students</p></div><div className="marketing-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search employees, referrals, students"/></div></div>
      {loading ? <div className="empty">Loading marketing CRM…</div> : groups.length ? <div className="marketing-groups">{groups.map((g) => <article className="marketing-employee-card" key={g.employee.employeeId}>
        <div className="marketing-employee-head"><div className="marketing-avatar"><UserRound size={20}/></div><div><strong>{g.employee.name}</strong><span>{g.employee.employeeId} · {g.employee.designation || "Marketing"}</span></div><div className="marketing-employee-totals"><b>{g.referrals.length}</b><small>referrals</small><b>{g.students.length}</b><small>students</small></div></div>
        <div className="marketing-referral-list">{g.referrals.map((r) => <div className="marketing-referral-row" key={r._id}><div><UserCheck size={15}/><strong>{r.name}</strong><span>{r.studentCount || 0} linked student(s)</span></div><span className={"marketing-status "+String(r.status).toLowerCase()}>{r.status}</span></div>)}{!g.referrals.length && <p className="marketing-empty">No referrals assigned yet.</p>}</div>
        <div className="marketing-student-list"><strong>Referred students</strong>{g.students.slice(0,5).map((s)=><a href={"/dashboard/students/"+s._id} key={s._id}><span>{s.applicantName}</span><small>{s.courseCode || s.courseName || "Course"} · {s.formNo}</small></a>)}{g.students.length>5&&<span className="marketing-more">+{g.students.length-5} more students</span>}{!g.students.length&&<p className="marketing-empty">No students linked to this employee yet.</p>}</div>
      </article>)}</div> : <div className="empty">No marketing employees found. Add employees with Marketing in their department or designation to begin.</div>}
    </section>
  </ERPLayout>;
}
