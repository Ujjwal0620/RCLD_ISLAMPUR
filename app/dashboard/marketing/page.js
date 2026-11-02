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

  const groups = useMemo(() => {
    const map = new Map();
    data.marketingEmployees.forEach((employee) => {
      map.set(employee.employeeId, { employee, referrals: [] });
    });

    data.referrals.forEach((referral) => {
      if (!map.has(referral.marketingEmployeeId)) {
        map.set(referral.marketingEmployeeId, {
          employee: {
            name: referral.marketingEmployeeName,
            employeeId: referral.marketingEmployeeId,
            designation: "Marketing",
          },
          referrals: [],
        });
      }

      const attributedStudents = students.filter(
        (student) => String(student.referralId || "") === String(referral._id)
      );
      map.get(referral.marketingEmployeeId).referrals.push({
        ...referral,
        students: attributedStudents,
      });
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        studentCount: group.referrals.reduce((total, referral) => total + referral.students.length, 0),
      }))
      .filter((group) => {
        const searchable = [
          group.employee.name,
          ...group.referrals.map((referral) => referral.name),
          ...group.referrals.flatMap((referral) => referral.students.map((student) => student.applicantName)),
        ].join(" ").toLowerCase();
        return !search || searchable.includes(search.toLowerCase());
      });
  }, [data, students, search]);

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
        <div className="marketing-employee-head"><div className="marketing-avatar"><UserRound size={20}/></div><div><strong>{g.employee.name}</strong><span>{g.employee.employeeId} · {g.employee.designation || "Marketing"}</span></div><div className="marketing-employee-totals"><b>{g.referrals.length}</b><small>referrals</small><b>{g.studentCount}</b><small>students</small></div></div>
        <div className="marketing-referral-list">
          {g.referrals.map((referral) => <section className="marketing-referral-block" key={referral._id}>
            <div className="marketing-referral-row">
              <div><UserCheck size={15}/><strong>{referral.name}</strong><span>{referral.students.length} linked student(s)</span></div>
              <span className={"marketing-status "+String(referral.status).toLowerCase()}>{referral.status}</span>
            </div>
            <div className="marketing-student-list">
              {referral.students.length ? referral.students.map((student) => (
                <a href={"/dashboard/students/"+student._id} key={student._id}>
                  <span>{student.applicantName}</span>
                  <small>{student.courseCode || student.courseName || "Course"} · {student.formNo}</small>
                </a>
              )) : <p className="marketing-empty">No students attributed to this referral yet.</p>}
            </div>
          </section>)}
          {!g.referrals.length && <p className="marketing-empty">No referrals assigned yet.</p>}
        </div>
      </article>)}</div> : <div className="empty">No marketing employees found. Add employees with Marketing in their department or designation to begin.</div>}
    </section>
  </ERPLayout>;
}
