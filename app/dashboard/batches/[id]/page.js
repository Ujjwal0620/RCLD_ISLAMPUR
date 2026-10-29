"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Users, BookOpen, Clock3, Save, Ban, Trash2, Pencil, LockKeyhole } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export default function BatchDetailPage({params}){
  const [batch,setBatch]=useState(null),[batchId,setBatchId]=useState(""),[courses,setCourses]=useState([]),[series,setSeries]=useState([]),[faculty,setFaculty]=useState([]),[allBatches,setAllBatches]=useState([]),[batchStudents,setBatchStudents]=useState([]),[availableStudents,setAvailableStudents]=useState([]),[selectedStudents,setSelectedStudents]=useState([]),[studentLoading,setStudentLoading]=useState(false);
  const [selectedSeries,setSelectedSeries]=useState([]),[facultyId,setFacultyId]=useState(""),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[contentProgress,setContentProgress]=useState(null);

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
      setBatch(bd.batch); setSeries(sd.series||[]); setCourses(cd.courses||[]); setAllBatches(ad.batches||[]);
      setSelectedSeries(bd.batch.series||[]); setFacultyId(bd.batch.facultyId||""); await loadBatchStudents(id); const pr=await fetch("/api/batches/"+id+"/course-content",{cache:"no-store"}); const pd=await pr.json(); setContentProgress(pd.progress||null); if(new URLSearchParams(window.location.search).get("edit")==="1") setEditing(true);
    }catch(e){alert(e.message)}finally{setLoading(false)}
  }

  useEffect(()=>{(async()=>{const {id}=await params;setBatchId(id);await load(id)})()},[params]);

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
    const selected=faculty.find(f=>f.employeeId===facultyId);
    setSaving(true);
    try{
      const r=await fetch("/api/batches/"+batchId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        name:batch.name,capacity:batch.capacity,startDate:batch.startDate?new Date(batch.startDate).toISOString().slice(0,10):"",endDate:batch.endDate?new Date(batch.endDate).toISOString().slice(0,10):"",
        notes:batch.notes||"",status:batch.status,series:selectedSeries,classFrequency:batch.classFrequency,facultyId,facultyName:selected?.name||batch.facultyName||""
      })});
      const d=await r.json();
      if(!r.ok)return alert(d.detail||d.error||"Unable to update batch.");
      setBatch(d.batch);setSelectedSeries(d.batch.series||[]);setFacultyId(d.batch.facultyId||"");setEditing(false);alert("Batch updated successfully.");
    }finally{setSaving(false)}
  }

  async function updateTopic(topic,completed,date){
    const r=await fetch("/api/batches/"+batchId+"/course-content",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({contentTopicId:topic.contentTopicId,completed,completedDate:date})});
    const d=await r.json();if(!r.ok)return alert(d.error||"Unable to update topic.");setContentProgress(d.progress);
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
      <div className="panel-head"><div><h3>Edit Batch & Timetable</h3><p>Changing series or faculty is blocked when it conflicts with another active/draft batch or faculty schedule.</p></div><span className="badge">{selectedSeries.length}/{batch.classFrequency} series</span></div>
      <div className="form-grid four" style={{padding:"18px 20px"}}>
        <label className="form-field"><span>Batch Name</span><input value={batch.name||""} onChange={e=>setBatch({...batch,name:e.target.value})}/></label>
        <label className="form-field"><span>Capacity</span><input type="number" min="1" value={batch.capacity||50} onChange={e=>setBatch({...batch,capacity:e.target.value})}/></label>
        <label className="form-field"><span>Start Date</span><input type="date" value={batch.startDate?new Date(batch.startDate).toISOString().slice(0,10):""} onChange={e=>setBatch({...batch,startDate:e.target.value})}/></label>
        <label className="form-field"><span>End Date</span><input type="date" value={batch.endDate?new Date(batch.endDate).toISOString().slice(0,10):""} onChange={e=>setBatch({...batch,endDate:e.target.value})}/></label>
      </div>
      <div className="builder-step" style={{margin:0,border:0,borderRadius:0}}>
        <div className="step-title"><span>01</span><div><h3>Weekly Series</h3><p>Only series already assigned to another active/draft batch are disabled. Other series remain selectable even when they share the same time.</p></div></div>
        <div className="series-grid">{series.map(s=>{const locked=occupiedSeries.has(s.code) && !selectedSeries.includes(s.code);return <button type="button" key={s.code} disabled={locked} className={selectedSeries.includes(s.code)?"series-chip selected":locked?"series-chip occupied":"series-chip"} onClick={()=>toggleSeries(s.code)} title={locked?"This series is already assigned to another active/draft batch":"Select series"}>{s.code}{locked&&<LockKeyhole size={12}/>}</button>})}</div>
      </div>
      <div style={{padding:"0 20px 18px"}}>
        <label className="form-field"><span>Faculty / Trainer</span><select value={facultyId} onChange={e=>setFacultyId(e.target.value)}><option value="">Unassigned</option>{faculty.map(f=><option key={f.employeeId} value={f.employeeId}>{f.name} — {f.designation||"Faculty"} · {f.skillMatch} matched skills</option>)}</select></label>
        <label className="form-field"><span>Notes</span><textarea rows="3" value={batch.notes||""} onChange={e=>setBatch({...batch,notes:e.target.value})}/></label>
      </div>
      <div className="form-actions"><button className="ghost-btn" onClick={()=>{setEditing(false);setSelectedSeries(batch.series||[]);setFacultyId(batch.facultyId||"")}}>Cancel</button><button className="primary-btn" disabled={saving} onClick={save}><Save size={16}/> {saving?"Saving…":"Save Batch Changes"}</button></div>
    </section>}

<section className="panel"><div className="panel-head"><div><h3>Students in this Batch</h3><p>Students are assigned from the Student Registry. This batch page only shows students already assigned to this batch.</p></div><a className="primary-btn" href={"/dashboard/batches/"+batchId+"/students"}><Users size={16}/> Students ({batchStudents.length})</a></div><div style={{padding:"20px"}}><div className="student-batch-summary"><div><span>Assigned students</span><strong>{batchStudents.length}</strong></div><div><span>Capacity</span><strong>{batch.capacity||50}</strong></div><div><span>Seats remaining</span><strong>{Math.max(0,Number(batch.capacity||50)-batchStudents.length)}</strong></div></div><p className="form-help" style={{marginTop:"14px"}}>Use <strong>Students</strong> to open the complete batch roster, mark attendance and record fee payments in one table.</p></div></section>

    <section className="panel batch-course-progress"><div className="panel-head"><div><h3>Course Content Progress</h3><p>Tick each topic when completed and record the actual completion date. Progress belongs to this batch only.</p></div><span>{contentProgress?contentProgress.modules.reduce((n,m)=>n+(m.topics||[]).filter(t=>t.completed).length,0)+"/"+contentProgress.modules.reduce((n,m)=>n+(m.topics||[]).length,0):"Not mapped"}</span></div>{contentProgress?<div className="progress-module-list">{contentProgress.modules.map(m=><div className="progress-module" key={String(m.contentModuleId)}><div className="progress-module-head"><strong>Module {m.moduleNo}: {m.module}</strong><span>{(m.topics||[]).filter(t=>t.completed).length}/{m.topics?.length||0} completed</span></div>{(m.topics||[]).map(t=><div className={"progress-topic "+(t.completed?"done":"")} key={String(t.contentTopicId)}><label><input type="checkbox" checked={!!t.completed} onChange={e=>updateTopic(t,e.target.checked,e.target.checked?(t.completedDate||new Date().toISOString().slice(0,10)):"")}/><b>{t.sNo}.</b><span>{t.topic}</span></label><input type="date" value={t.completedDate||""} disabled={!t.completed} onChange={e=>updateTopic(t,true,e.target.value)}/></div>)}</div>)}</div>:<div className="empty">No Course Content has been mapped to {batch.courseCode} yet. Add it from Course Content, then reload this batch.</div>}</section>

    <section className="panel"><div className="panel-head"><div><h3>Current Weekly Schedule</h3><p>Each occupied day + time is reserved for this batch.</p></div><span>{batch.schedules?.length||0} records</span></div>
      <div className="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Series</th><th>Slot</th><th>Faculty</th></tr></thead><tbody>{(batch.schedules||[]).map((s,i)=><tr key={i}><td><strong>{s.day}</strong></td><td>{s.time}</td><td>{s.series}</td><td>{s.slot}</td><td>{s.facultyName||"Unassigned"}</td></tr>)}</tbody></table></div>
    </section>
  </ERPLayout>;
}