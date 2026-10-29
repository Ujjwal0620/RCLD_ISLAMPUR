"use client";

import { useEffect, useMemo, useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { BarChart3, RefreshCw, Users, IndianRupee, GraduationCap, UserRound, CheckCircle2, Download } from "lucide-react";

function money(n){ return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0)); }
function pct(n){ return Number(n||0).toFixed(1)+"%"; }

export default function ReportsPage(){
  const [batches,setBatches]=useState([]);
  const [selectedId,setSelectedId]=useState("");
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);

  async function loadBatches(){
    setLoading(true);
    try{
      const r=await fetch("/api/reports/batches",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Unable to load reports.");
      setBatches(d.batches||[]);
      if(!selectedId && d.batches?.length) setSelectedId(String(d.batches[0]._id));
    }catch(e){ alert(e.message); }
    finally{ setLoading(false); }
  }

  async function loadReport(id){
    if(!id) return;
    setDetailLoading(true);
    try{
      const r=await fetch("/api/reports/batches?batchId="+encodeURIComponent(id),{cache:"no-store"});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"Unable to load batch report.");
      setReport(d);
    }catch(e){ alert(e.message); }
    finally{ setDetailLoading(false); }
  }

  useEffect(()=>{ loadBatches(); },[]);
  useEffect(()=>{ if(selectedId) loadReport(selectedId); },[selectedId]);

  const selectedSummary=useMemo(()=>batches.find(x=>String(x._id)===String(selectedId)),[batches,selectedId]);

  function exportCsv(){
    if(!report?.students?.length) return;
    const headers=["Student","Enrollment No","Form No","Course","Mobile","Guardian","Status","Payable","Paid","Due","Payment Status"];
    const rows=report.students.map(s=>[
      s.applicantName,s.enrollmentNo,s.formNo,s.courseName||s.courseCode,s.mobileNumber,s.guardianContactNumber,
      s.status,s.payable,s.paid,s.due,s.paymentStatus
    ]);
    const csv=[headers,...rows].map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=(report.batch.batchCode||"batch")+"-report.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <ERPLayout active="/dashboard/reports">
    <header className="topbar">
      <div><div className="crumb">RCLD Islampur / Reports</div><h1>Report Center</h1></div>
      <div className="top-actions"><button className="icon-btn" onClick={loadBatches}><RefreshCw size={17}/></button></div>
    </header>

    <div className="welcome">
      <div><span className="eyebrow">ERP REPORTING</span><h2>Batch Reports</h2><p>Complete batch-wise academic, student, faculty and fee collection reporting from the live database.</p></div>
      <button className="ghost-btn" onClick={exportCsv} disabled={!report?.students?.length}><Download size={16}/> Export Students CSV</button>
    </div>

    <section className="panel" style={{marginBottom:20}}>
      <div className="panel-head"><div><h3>Report Selection</h3><p>Select a batch to generate its complete report.</p></div><span>{batches.length} batches</span></div>
      <div style={{padding:20}}>
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} style={{width:"100%",maxWidth:620}}>
          <option value="">Select batch</option>
          {batches.map(b=><option key={b._id} value={b._id}>{b.batchCode} — {b.name} — {b.courseCode} ({b.studentCount} students)</option>)}
        </select>
      </div>
    </section>

    {loading ? <div className="empty">Loading reports…</div> : !batches.length ? <div className="empty">No batches available for reporting.</div> : detailLoading ? <div className="empty">Generating batch report…</div> : report ? <>
      <section className="report-kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:16,marginBottom:20}}>
        <div className="panel"><div style={{padding:20}}><Users size={20}/><small>Total Students</small><h2>{report.summary.studentCount}</h2><span>{pct(report.summary.completionPercentage)} course-completed</span></div></div>
        <div className="panel"><div style={{padding:20}}><IndianRupee size={20}/><small>Total Payable</small><h2>{money(report.summary.payable)}</h2><span>{money(report.summary.due)} due</span></div></div>
        <div className="panel"><div style={{padding:20}}><BarChart3 size={20}/><small>Collection</small><h2>{money(report.summary.collected)}</h2><span>{pct(report.summary.collectionPercentage)} collected</span></div></div>
        <div className="panel"><div style={{padding:20}}><GraduationCap size={20}/><small>Course Completed</small><h2>{report.summary.completedCount}</h2><span>of {report.summary.studentCount} students</span></div></div>
      </section>

      <section className="panel" style={{marginBottom:20}}>
        <div className="panel-head"><div><h3>{report.batch.batchCode} — {report.batch.name}</h3><p>{report.batch.courseCode} · {report.batch.courseName} · {report.batch.status}</p></div><span>{report.batch.classFrequency} classes/week</span></div>
        <div style={{padding:20,display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14}}>
          <div className="report-info-card"><small>Faculty Assigned</small><strong>{report.faculty.name||"Not assigned"}</strong><span>{report.faculty.employeeId||"—"}</span></div>
          <div className="report-info-card"><small>Students</small><strong>{report.summary.studentCount}</strong><span>Capacity {report.batch.capacity||50}</span></div>
          <div className="report-info-card"><small>Course Completion</small><strong>{pct(report.summary.completionPercentage)}</strong><span>{report.summary.completedCount} completed</span></div>
          <div className="report-info-card"><small>Fee Collection</small><strong>{pct(report.summary.collectionPercentage)}</strong><span>{money(report.summary.collected)} / {money(report.summary.payable)}</span></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Complete Student & Fee Report</h3><p>Every student assigned to this batch with course status and live fee position.</p></div><span>{report.students.length} records</span></div>
        <div className="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th>Enrollment</th><th>Course</th><th>Mobile</th><th>Status</th><th>Payable</th><th>Paid</th><th>Due</th><th>Collection</th></tr></thead>
        <tbody>{report.students.map((s,i)=><tr key={s._id}>
          <td>{i+1}</td><td><strong>{s.applicantName}</strong><br/><small>{s.formNo}</small></td><td>{s.enrollmentNo||"—"}</td><td>{s.courseCode}<br/><small>{s.courseName}</small></td><td>{s.mobileNumber||"—"}</td>
          <td><span className="badge">{s.status||"—"}</span></td><td>{money(s.payable)}</td><td>{money(s.paid)}</td><td><strong>{money(s.due)}</strong></td>
          <td>{s.payable?pct(Math.min(100,s.paid/s.payable*100)):"0.0%"}</td>
        </tr>)}{!report.students.length&&<tr><td colSpan="10"><div className="empty">No students are assigned to this batch.</div></td></tr>}</tbody></table></div>
      </section>
    </> : null}
  </ERPLayout>;
}
