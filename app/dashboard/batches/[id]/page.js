"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Users, BookOpen, Clock3, Save, Ban, Trash2, Pencil, LockKeyhole } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export default function BatchDetailPage({params}){
  const [batch,setBatch]=useState(null),[batchId,setBatchId]=useState(""),[courses,setCourses]=useState([]),[series,setSeries]=useState([]),[faculty,setFaculty]=useState([]),[allBatches,setAllBatches]=useState([]),[batchStudents,setBatchStudents]=useState([]),[availableStudents,setAvailableStudents]=useState([]),[selectedStudents,setSelectedStudents]=useState([]),[studentLoading,setStudentLoading]=useState(false);
  const [selectedSeries,setSelectedSeries]=useState([]),[room,setRoom]=useState(""),[facultyId,setFacultyId]=useState(""),[facultyId2,setFacultyId2]=useState(""),[classDate,setClassDate]=useState(new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"})),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[contentProgress,setContentProgress]=useState(null),[openModules,setOpenModules]=useState({});

  async function loadBatchStudents(id){const r=await fetch("/api/batches/"+id+"/students",{cache:"no-store"});const d=await r.json();if(r.ok){setBatchStudents(d.students||[]);setAvailableStudents(d.available||[]);}}
  async function assignSelectedStudents(){if(!selectedStudents.length)return alert("Select at least one student.");setStudentLoading(true);try{const r=await fetch("/api/batches/"+batchId+"/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentIds:selectedStudents})});const d=await r.json();if(!r.ok)return alert(d.error||"Unable to assign students.");setSelectedStudents([]);await loadBatchStudents(batchId);}finally{setStudentLoading(false)}}
  async function removeStudentsFromBatch(ids){if(!ids.length)return;if(!confirm("Remove the selected student(s) from this batch? They will become available for another batch."))return;const r=await fetch("/api/batches/"+batchId+"/students",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentIds:ids})});const d=await r.json();if(!r.ok)return alert(d.error||"Unable to remove students.");await loadBatchStudents(batchId);}

  async function load(id){
    setLoading(true);
    try{
      const [br,sr,cr]=await Promise.all([
        fetch("/api/batches/"+id,{cache:"no-store"}),
        fetch("/api/batch-series",{cache:"no-store"}),
        fetch("/api/courses",{cache:"no-store"})
      ]);
      const ar=await fetch("/api/batches",{cache:"no-store"});
      const [bd,sd,cd,ad]=await Promise.all([br.json(),sr.json(),cr.json(),ar.json()]);
      if(!br.ok) throw new Error(bd.error||"Unable to load batch.");
      setBatch(bd.batch); setRoom(bd.batch.room||(bd.batch.schedules||[]).find(slot=>slot.room)?.room||""); setSeries(sd.series||[]); setCourses(cd.courses||[]); setAllBatches(ad.batches||[]);
      setSelectedSeries(bd.batch.series||[]); setFacultyId(bd.batch.facultyIds?.[0]||bd.batch.facultyId||""); setFacultyId2(bd.batch.facultyIds?.[1]||""); await loadBatchStudents(id); const pr=await fetch("/api/batches/"+id+"/course-content",{cache:"no-store"}); const pd=await pr.json(); setContentProgress(pd.progress||null); if(new URLSearchParams(window.location.search).get("edit")==="1") setEditing(true);
    }catch(e){alert(e.message)}finally{setLoading(false)}
  }

  useEffect(()=>{(async()=>{const {id}=await params;setBatchId(id);const requestedDate=new URLSearchParams(window.location.search).get("date");if(requestedDate)setClassDate(requestedDate);await load(id)})()},[params]);

  const course=useMemo(()=>courses.find(c=>String(c._id)===String(batch?.courseId)),[courses,batch]);
  useEffect(()=>{
    if(!editing||!batch?.courseId)return;
    const qs=new URLSearchParams({courseId:String(batch.courseId),series:selectedSeries.join(","),excludeBatchId:batchId});
    fetch("/api/batches/faculty-options?"+qs.toString(),{cache:"no-store"}).then(r=>r.json()).then(d=>setFaculty(d.faculty||[])).catch(()=>setFaculty([]));
  },[editing,batch?.courseId,selectedSeries,batchId]);

  function toggleSeries(code){
    setSelectedSeries(current=>current.includes(code)?current.filter(x=>x!==code):[...current,code]);
  }

  async function save(){
    if(!batch)return;
    if(course && selectedSeries.length!==Number(batch.classFrequency)) return alert(`Select exactly ${batch.classFrequency} series.`);
    const selected=faculty.find(f=>f.employeeId===facultyId); const selected2=faculty.find(f=>f.employeeId===facultyId2); if(facultyId&&facultyId===facultyId2)return alert("Select two different faculty members.");
    setSaving(true);
    try{
      const r=await fetch("/api/batches/"+batchId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        name:batch.name,capacity:batch.capacity,startDate:batch.startDate?new Date(batch.startDate).toISOString().slice(0,10):"",endDate:batch.endDate?new Date(batch.endDate).toISOString().slice(0,10):"",
        notes:batch.notes||"",status:batch.status,room
      })});
      const d=await r.json();
      if(!r.ok)return alert(d.detail||d.error||"Unable to update batch.");
      setBatch(d.batch);setSelectedSeries(d.batch.series||[]);setFacultyId(d.batch.facultyIds?.[0]||d.batch.facultyId||"");setFacultyId2(d.batch.facultyIds?.[1]||"");setEditing(false);alert("Batch updated successfully.");
    }finally{setSaving(false)}
  }

  async function updateTopic(topic,completed,date){
    const r=await fetch("/api/batches/"+batchId+"/course-content",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({contentTopicId:topic.contentTopicId,completed,completedDate:date,date:classDate})});
    const d=await r.json();if(!r.ok)return alert(d.error||"Unable to update topic.");setContentProgress(d.progress);
  }

  async function uploadTopicNote(topic,file){
    if(!file)return;
    const formData=new FormData();formData.append("file",file);formData.append("topicId",String(topic.contentTopicId));formData.append("date",classDate);
    const r=await fetch("/api/batches/"+batchId+"/notes",{method:"POST",body:formData});const d=await r.json();
    if(!r.ok)return alert(d.error||"Unable to upload notes.");
    setContentProgress(d.progress);alert("Notes uploaded successfully.");
  }

  async function setStatus(status){
    const r=await fetch("/api/batches/"+batchId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
    const d=await r.json();if(!r.ok)return alert(d.error||"Unable to update status.");setBatch(d.batch);
  }

  async function remove(){
    if(!confirm("Archive/cancel this batch? Its timetable hours will become available again."))return;
    const r=await fetch("/api/batches/"+batchId,{method:"DELETE"}),d=await r.json();
    if(!r.ok)return alert(d.error||"Unable to cancel batch.");
    window.location.href="/dashboard/batches";
  }

  if(loading)return <ERPLayout active="/dashboard/batches"><div className="empty">Loading batch…</div></ERPLayout>;
  if(!batch)return <ERPLayout active="/dashboard/batches"><div className="empty">Batch not found.</div></ERPLayout>;

  const occupiedSeries=new Set(allBatches.filter(b=>String(b._id)!==String(batchId)&&["Draft","Active"].includes(b.status)).flatMap(b=>b.series||[]));

  return <ERPLayout active="/dashboard/batches">
    <header className="topbar"><div><div className="crumb">RCLD Islampur / Batches / {batch.batchCode}</div><h1>{batch.name}</h1></div><div className="top-actions"><button className="ghost-btn" onClick={()=>setEditing(v=>!v)}><Pencil size={16}/> {editing?"Close Edit":"Edit Batch"}</button><a className="ghost-btn" href="/dashboard/batches"><ArrowLeft size={16}/> Back</a></div></header>
    <div className="welcome"><div><span className="eyebrow">{batch.batchCode}</span><h2>{batch.courseCode} — {batch.courseName}</h2><p>Course → Batch → Series → Schedule. Editing re-validates timetable and faculty conflicts before saving.</p></div><div className="form-actions" style={{padding:0,background:"transparent"}}>{batch.status==="Active"?<button className="ghost-btn" onClick={()=>setStatus("Draft")}><Save size={16}/> Move to Draft</button>:batch.status==="Draft"?<button className="primary-btn" onClick={()=>setStatus("Active")}><Save size={16}/> Activate</button>:null}{batch.status!=="Cancelled"&&<><button className="ghost-btn" onClick={()=>setStatus("Suspended")}><Ban size={16}/> Suspend</button><button className="ghost-btn" onClick={remove}><Trash2 size={16}/> Delete</button></>}</div></div>

    <div className="metric-grid">
      <div className="metric"><div className="metric-icon blue"><BookOpen size={20}/></div><span>Course</span><strong>{batch.courseCode}</strong><small>{batch.courseName}</small></div>
      <div className="metric"><div className="metric-icon green"><CalendarDays size={20}/></div><span>Series</span><strong>{batch.series?.length||0}</strong><small>{(batch.series||[]).join(", ")}</small></div>
      <div className="metric"><div className="metric-icon purple"><Clock3 size={20}/></div><span>Frequency</span><strong>{batch.classFrequency}/week</strong><small>{batch.schedules?.length||0} schedule records</small></div>
      <div className="metric"><div className="metric-icon orange"><Users size={20}/></div><span>Faculty</span><strong>{batch.facultyName||"Unassigned"}</strong><small>Capacity {batch.capacity}</small></div>
    </div>

    {editing&&<section className="panel">
      <div className="panel-head"><div><h3>Edit Batch Details</h3><p>Batch metadata can be updated here. Day-wise faculty assignments remain preserved; use Task Manager to assign a dated substitute.</p></div><span className="badge">{selectedSeries.length}/{batch.classFrequency} series</span></div>
      <div className="form-grid four" style={{padding:"18px 20px"}}>
        <label className="form-field"><span>Batch Name</span><input value={batch.name||""} onChange={e=>setBatch({...batch,name:e.target.value})}/></label>
        <label className="form-field"><span>Capacity</span><input type="number" min="1" value={batch.capacity||50} onChange={e=>setBatch({...batch,capacity:e.target.value})}/></label>
        <label className="form-field"><span>Start Date</span><input type="date" value={batch.startDate?new Date(batch.startDate).toISOString().slice(0,10):""} onChange={e=>setBatch({...batch,startDate:e.target.value})}/></label>
        <label className="form-field"><span>End Date</span><input type="date" value={batch.endDate?new Date(batch.endDate).toISOString().slice(0,10):""} onChange={e=>setBatch({...batch,endDate:e.target.value})}/></label><label className="form-field"><span>Class / Lab Work Area</span><select value={room} onChange={e=>setRoom(e.target.value)}><option value="">Select work area</option>{["T1","T2","L1/L2","L3/L4","L1","L2","L3","L4"].map(area=><option key={area} value={area}>{area}</option>)}</select></label>
      </div>
      <div className="builder-step" style={{margin:0,border:0,borderRadius:0}}><div className="step-title"><span>01</span><div><h3>Day-wise Faculty Assignments</h3><p>Each timetable day keeps its own assigned faculty. Use Task Manager to assign a substitute for a specific class date when the scheduled faculty is absent.</p></div></div><div className="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Series</th><th>Assigned Faculty</th><th>Work Area</th></tr></thead><tbody>{(batch.schedules||[]).map((slot,index)=><tr key={index}><td>{slot.day}</td><td>{slot.time}</td><td>{slot.series}</td><td>{slot.facultyName||"Unassigned"}</td><td>{slot.room||room||"Not set"}</td></tr>)}</tbody></table></div></div><div style={{padding:"0 20px 18px"}}><label className="form-field"><span>Notes</span><textarea rows="3" value={batch.notes||""} onChange={e=>setBatch({...batch,notes:e.target.value})}/></label></div><div className="form-actions"><button className="ghost-btn" onClick={()=>{setEditing(false);setSelectedSeries(batch.series||[]);setFacultyId(batch.facultyIds?.[0]||batch.facultyId||"");setFacultyId2(batch.facultyIds?.[1]||"")}}>Cancel</button><button className="primary-btn" disabled={saving} onClick={save}><Save size={16}/> {saving?"Saving…":"Save Batch Changes"}</button></div>
    </section>}

<section className="panel"><div className="panel-head"><div><h3>Students in this Batch</h3><p>Students are assigned from the Student Registry. This batch page only shows students already assigned to this batch.</p></div><a className="primary-btn" href={"/dashboard/batches/"+batchId+"/students?date="+classDate}><Users size={16}/> Students ({batchStudents.length})</a></div><div style={{padding:"20px"}}><div className="student-batch-summary"><div><span>Assigned students</span><strong>{batchStudents.length}</strong></div><div><span>Capacity</span><strong>{batch.capacity||50}</strong></div><div><span>Seats remaining</span><strong>{Math.max(0,Number(batch.capacity||50)-batchStudents.length)}</strong></div></div><p className="form-help" style={{marginTop:"14px"}}>Use <strong>Students</strong> to open the complete batch roster, mark attendance and record fee payments in one table.</p></div></section>

    <section className="panel batch-course-progress"><div className="panel-head"><div><h3>Course Content Progress</h3><p>Tick each topic when completed and record the actual completion date. Progress belongs to this batch only.</p></div><span>{contentProgress?contentProgress.modules.reduce((n,m)=>n+(m.topics||[]).filter(t=>t.completed).length,0)+"/"+contentProgress.modules.reduce((n,m)=>n+(m.topics||[]).length,0):"Not mapped"}</span></div>{contentProgress?<div className="progress-module-list">{contentProgress.modules.map(m=><div className="progress-module" key={String(m.contentModuleId)}><button type="button" className="progress-module-head progress-module-toggle" onClick={()=>setOpenModules(v=>({...v,[String(m.contentModuleId)]:!v[String(m.contentModuleId)]}))}><strong>{openModules[String(m.contentModuleId)]?"▾":"▸"} Module {m.moduleNo}: {m.module}</strong><span>{(m.topics||[]).filter(t=>t.completed).length}/{m.topics?.length||0} completed</span></button>{openModules[String(m.contentModuleId)]&&(m.topics||[]).map(t=><div className="progress-topic-wrapper" key={String(t.contentTopicId)}><div className={"progress-topic "+(t.completed?"done":"")}><label><input type="checkbox" checked={!!t.completed} onChange={e=>updateTopic(t,e.target.checked,e.target.checked?(t.completedDate||new Date().toISOString().slice(0,10)):"")}/><b>{t.sNo}.</b><span>{t.topic}</span></label><input type="date" value={t.completedDate||""} disabled={!t.completed} onChange={e=>updateTopic(t,true,e.target.value)}/></div><div className="topic-note-tools" key={String(t.contentTopicId)+"-notes"}><div className="topic-note-list">{(t.notes||[]).map((note,i)=><a key={note.publicId||i} href={note.url} target="_blank" rel="noreferrer">📎 {note.name||"Class notes"} <small>{note.uploadedBy||"Faculty"}</small></a>)}</div><label className="ghost-btn">Upload notes<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" hidden onChange={e=>uploadTopicNote(t,e.target.files?.[0])}/></label></div></div>)}</div>)}</div>:<div className="empty">No Course Content has been mapped to {batch.courseCode} yet. Add it from Course Content, then reload this batch.</div>}</section>

    <section className="panel"><div className="panel-head"><div><h3>Current Weekly Schedule</h3><p>Each occupied day + time is reserved for this batch.</p></div><span>{batch.schedules?.length||0} records</span></div>
      <div className="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Series</th><th>Slot</th><th>Faculty</th><th>Work Area</th></tr></thead><tbody>{(batch.schedules||[]).map((s,i)=><tr key={i}><td><strong>{s.day}</strong></td><td>{s.time}</td><td>{s.series}</td><td>{s.slot}</td><td>{s.facultyName||"Unassigned"}</td><td>{s.room||batch.room||"Not set"}</td></tr>)}</tbody></table></div>
    </section>
  </ERPLayout>;
}