"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Search, History, UserRoundX } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function DropoutsPage(){
  const [students,setStudents]=useState([]),[batches,setBatches]=useState([]),[search,setSearch]=useState(""),[loading,setLoading]=useState(true),[message,setMessage]=useState(""),[open,setOpen]=useState(null);
  async function load(){
    setLoading(true);
    try{
      const [sr,br]=await Promise.all([
        fetch("/api/students?status=Dropped%20Out&limit=200",{cache:"no-store"}),
        fetch("/api/batches",{cache:"no-store"})
      ]);
      const sd=await sr.json(),bd=await br.json();
      setStudents(sd.students||[]);setBatches(bd.batches||[]);
    }finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  const filtered=students.filter(s=>!search||[s.applicantName,s.formNo,s.enrollmentNo,s.courseCode,s.courseName].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <ERPLayout active="/dashboard/dropouts">
    <header className="topbar"><div><div className="crumb">Students / Dropouts</div><h1>Dropout Students</h1></div><div className="top-actions"><span className="badge">{students.length} Dropouts</span></div></header>
    <section className="panel filter-panel"><div className="filter-title"><div><h3>Dropout Register</h3><p>Students remain here until they are dropped back into a batch. Their original batch, faculty, schedule, attendance footprint and dropout remark remain preserved.</p></div></div><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search dropout student…"/></div></section>
    <section className="panel table-panel">
      {message&&<div className="success-msg">{message}</div>}
      {loading?<div className="empty">Loading dropout records…</div>:filtered.length===0?<div className="empty"><UserRoundX size={30}/><br/>No dropout students found.</div>:<div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Previous Batch</th><th>Dropout Remark</th><th>Dropped On</th><th>Action</th></tr></thead><tbody>{filtered.map(s=>{
        return <DropoutRow key={s._id} student={s} batches={batches} open={open===s._id} onOpen={()=>setOpen(open===s._id?null:s._id)} onDone={async msg=>{setMessage(msg);setOpen(null);await load();}}/>
      })}</tbody></table></div>}
    </section>
  </ERPLayout>
}

function DropoutRow({student,batches,open,onOpen,onDone}){
  const [history,setHistory]=useState([]),[batchId,setBatchId]=useState(""),[remark,setRemark]=useState(""),[saving,setSaving]=useState(false);
  async function show(){
    onOpen();
    if(!open){const r=await fetch("/api/students/"+student._id+"/batch-history",{cache:"no-store"});const d=await r.json();setHistory(d.history||[]);const last=d.history?.find(x=>x.action==="DROPPED_OUT");setBatchId(String(last?.fromBatch?.batchId||""));setRemark("");}
  }
  const drop=history.find(x=>x.action==="DROPPED_OUT");
  const previous=drop?.fromBatch;
  return <>
    <tr><td><strong>{student.applicantName}</strong><div className="muted">{student.formNo} · {student.mobileNumber}</div></td><td>{student.courseCode||student.courseName}</td><td>{previous?.batchCode||"—"}<div className="muted">{(previous?.faculty||[]).map(x=>x.name).join(", ")||"Faculty not captured"}</div></td><td>{drop?.remark||"—"}</td><td>{drop?.occurredAt?new Date(drop.occurredAt).toLocaleDateString():"—"}</td><td><button className="primary-btn" onClick={show}><RotateCcw size={15}/> Drop Back to Batch</button></td></tr>
    {open&&<tr><td colSpan="6"><div className="dropback-panel"><div className="movement-history-title"><History size={16}/> Restore Previous Academic Footprint</div><div className="form-grid two"><label className="form-field"><span>Batch</span><select value={batchId} onChange={e=>setBatchId(e.target.value)}><option value="">Select batch</option>{batches.filter(b=>["Draft","Active"].includes(b.status)&&String(b.courseCode||"").toUpperCase()===String(student.courseCode||"").toUpperCase()).map(b=><option key={b._id} value={b._id}>{b.batchCode} — {b.name}</option>)}</select></label><label className="form-field"><span>Rejoin Remark *</span><textarea rows="2" value={remark} onChange={e=>setRemark(e.target.value)} placeholder="Why is the student rejoining?"/></label></div><div className="top-actions"><button className="ghost-btn" onClick={onOpen}>Cancel</button><button className="primary-btn" disabled={saving||!batchId||remark.trim().length<3} onClick={async()=>{setSaving(true);try{const r=await fetch("/api/students/"+student._id+"/batch-history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"REJOINED",toBatchId:batchId,remark,actor:"superadmin",actorRole:"superadmin"})});const d=await r.json();if(!r.ok)return alert(d.error||"Unable to restore student.");await onDone(d.message||"Student restored.");}finally{setSaving(false)}}}>{saving?"Restoring…":"Confirm Drop Back"}</button></div></div></td></tr>}
  </>
}
