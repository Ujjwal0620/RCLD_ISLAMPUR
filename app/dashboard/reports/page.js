"use client";

import { useEffect, useMemo, useState } from "react";
import ERPLayout from "@/components/ERPLayout";
import { BarChart3, RefreshCw, Users, IndianRupee, GraduationCap, UserRound, CheckCircle2, Download, Printer } from "lucide-react";

function money(n){ return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0)); }
function pct(n){ return Number(n||0).toFixed(1)+"%"; }

export default function ReportsPage(){
  const [batches,setBatches]=useState([]);
  const [selectedId,setSelectedId]=useState("");
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false); const [overview,setOverview]=useState(null);

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

  useEffect(()=>{ loadBatches(); fetch("/api/reports/overview",{cache:"no-store"}).then(r=>r.json()).then(setOverview).catch(()=>{}); },[]);
  useEffect(()=>{ if(selectedId) loadReport(selectedId); },[selectedId]);

  const selectedSummary=useMemo(()=>batches.find(x=>String(x._id)===String(selectedId)),[batches,selectedId]);

  function printReport(){if(!report)return;const w=window.open("","_blank");const rows=report.students.map((s,i)=>"<tr><td>"+(i+1)+"</td><td>"+s.applicantName+"</td><td>"+(s.enrollmentNo||"—")+"</td><td>"+s.courseCode+"</td><td>"+money(s.payable)+"</td><td>"+money(s.paid)+"</td><td>"+money(s.due)+"</td></tr>").join("");w.document.write('<html><head><title>'+report.batch.batchCode+' Report</title><style>body{font-family:Arial;padding:28px;color:#111}h1{margin:0}.meta{margin:8px 0 20px;color:#555}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.k{border:1px solid #bbb;padding:12px}.k b{display:block;font-size:18px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#eee}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>RCLD ISLAMPUR</h1><div class="meta">Batch Report · '+report.batch.batchCode+' · '+report.batch.courseName+' · Generated '+new Date().toLocaleString()+'</div><div class="kpis"><div class="k">Students<b>'+report.summary.studentCount+'</b></div><div class="k">Payable<b>'+money(report.summary.payable)+'</b></div><div class="k">Collected<b>'+money(report.summary.collected)+'</b></div><div class="k">Due<b>'+money(report.summary.due)+'</b></div></div><p><b>Faculty:</b> '+((report.faculty.names||[]).join(", ")||report.faculty.name||"Not assigned")+'</p><table><thead><tr><th>#</th><th>Student</th><th>Enrollment</th><th>Course</th><th>Payable</th><th>Paid</th><th>Due</th></tr></thead><tbody>'+rows+'</tbody></table></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),300);}
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
      <div className="top-actions"><button className="ghost-btn" onClick={printReport} disabled={!report}><Printer size={16}/> Print / PDF</button><button className="ghost-btn" onClick={exportCsv} disabled={!report?.students?.length}><Download size={16}/> Export CSV</button></div>
    </div>

    {overview?.summary&&<><section className="report-kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:16,marginBottom:20}}><div className="panel"><div style={{padding:20}}><small>All Students</small><h2>{overview.summary.students}</h2></div></div><div className="panel"><div style={{padding:20}}><small>Total Collection</small><h2>{money(overview.summary.collected)}</h2><span>{pct(overview.summary.collectionPercentage)} collected</span></div></div><div className="panel"><div style={{padding:20}}><small>Total Outstanding</small><h2>{money(overview.summary.due)}</h2></div></div><div className="panel"><div style={{padding:20}}><small>Employees / Batches</small><h2>{overview.summary.employees} / {overview.summary.batches}</h2></div></div></section><section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><h3>Additional ERP Reports</h3><p>Live management views across students, fees, batches and faculty.</p></div></div><div className="table-wrap"><table><thead><tr><th>Report</th><th>Details</th></tr></thead><tbody><tr><td><strong>Outstanding Fee Report</strong></td><td>{overview.dueStudents?.length||0} students have outstanding balances · {money(overview.summary.due)} total</td></tr><tr><td><strong>Collection Report</strong></td><td>{money(overview.summary.collected)} collected from {money(overview.summary.payable)} payable</td></tr><tr><td><strong>Batch Capacity & Faculty</strong></td><td>{overview.batchRows?.length||0} batches with enrollment, capacity and assigned faculty</td></tr><tr><td><strong>Course-wise Students</strong></td><td>{overview.courses?.map(x=>x.course+" ("+x.count+")").join(" · ")}</td></tr><tr><td><strong>Faculty Workload</strong></td><td>{overview.faculty?.map(x=>x.name+" — "+x.assignedBatches+" batch(es)").join(" · ")||"No faculty data"}</td></tr></tbody></table></div></section><section className="panel" style={{marginBottom:20}}><div className="panel-head"><div><h3>Outstanding Fee Details</h3><p>Student-wise payable, collected and pending amount.</p></div><span>{overview.dueStudents?.length||0} students</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Batch</th><th>Mobile</th><th>Payable</th><th>Paid</th><th>Due</th></tr></thead><tbody>{(overview.dueStudents||[]).slice(0,100).map(s=><tr key={s._id}><td><strong>{s.name}</strong><br/><small>{s.formNo}</small></td><td>{s.course}</td><td>{s.batch}</td><td>{s.mobile}</td><td>{money(s.payable)}</td><td>{money(s.paid)}</td><td><strong>{money(s.due)}</strong></td></tr>)}</tbody></table></div></section></>}
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
          <div className="report-info-card"><small>Faculty Assigned</small><strong>{(report.faculty.names||[]).join(", ")||report.faculty.name||"Not assigned"}</strong><span>{(report.faculty.employeeIds||[]).join(", ")||report.faculty.employeeId||"—"}</span></div>
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
