"use client";
import { useEffect, useState } from "react";
import { Search, UserPlus, ChevronLeft, ChevronRight, SlidersHorizontal, X, RotateCcw, Filter, Pencil, Trash2, Send, Upload } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const fallbackCourses=["CCA","DCA","ADCA","CCC","CAO","DWPD","DOM","DCST","DCAP","DHNT"];

export default function StudentsPage(){
  const [students,setStudents]=useState([]),[pagination,setPagination]=useState({page:1,limit:50,total:0,totalPages:1});
  const [options,setOptions]=useState({courses:fallbackCourses,statuses:["Registered"],sexes:["M","F"]});
  const [filters,setFilters]=useState({search:"",sex:"",course:"",status:"",registration:"",fromDate:"",toDate:""});
  const [advanced,setAdvanced]=useState(false),[loading,setLoading]=useState(true);
  const [selectedStudents,setSelectedStudents]=useState([]),[batches,setBatches]=useState([]),[selectedBatch,setSelectedBatch]=useState(""),[assigning,setAssigning]=useState(false);

  async function load(page=1,override=filters){
    setLoading(true);
    try{
      const params=new URLSearchParams({page:String(page),limit:"50"});
      Object.entries(override).forEach(([k,v])=>{if(v)params.set(k,v)});
      const r=await fetch("/api/students?"+params.toString(),{cache:"no-store"}),d=await r.json();
      setStudents(d.students||[]);setPagination(d.pagination||{page:1,limit:50,total:0,totalPages:1});
      if(d.filterOptions)setOptions({courses:d.filterOptions.courses?.length?d.filterOptions.courses:fallbackCourses,statuses:d.filterOptions.statuses?.length?d.filterOptions.statuses:["Registered"],sexes:d.filterOptions.sexes?.length?d.filterOptions.sexes:["M","F"]});
    }finally{setLoading(false)}
  }
  async function loadBatches(){const r=await fetch("/api/students/bulk-assign-batch",{cache:"no-store"});const d=await r.json();setBatches(d.batches||[])}
  useEffect(()=>{load(1)},[filters.sex,filters.course,filters.status,filters.registration,filters.fromDate,filters.toDate]);
  useEffect(()=>{loadBatches()},[]);
  useEffect(()=>{setSelectedStudents([]);setSelectedBatch("")},[students]);

  function updateFilter(k,v){setFilters(c=>({...c,[k]:v}))}
  function clearFilters(){const e={search:"",sex:"",course:"",status:"",registration:"",fromDate:"",toDate:""};setFilters(e);load(1,e)}
  const activeCount=Object.values(filters).filter(Boolean).length;
  const selectedRecords=students.filter(s=>selectedStudents.includes(s._id));
  const unassignedStudents=students.filter(s=>!s.batchId&&!s.batchCode);
  const selectedCourses=[...new Set(selectedRecords.map(s=>String(s.courseCode||"").toUpperCase()).filter(Boolean))];
  const compatibleBatches=batches.filter(b=>b.available&&(!selectedCourses.length||selectedCourses.length!==1||String(b.courseCode||"").toUpperCase()===selectedCourses[0]));
  async function sendToBatch(){
    if(!selectedStudents.length||!selectedBatch)return alert("Select students and an available batch.");
    setAssigning(true);
    try{
      const r=await fetch("/api/students/bulk-assign-batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentIds:selectedStudents,batchId:selectedBatch})});
      const d=await r.json();if(!r.ok)return alert(d.error||"Unable to send students to batch.");
      alert(d.message||"Students assigned.");setSelectedStudents([]);setSelectedBatch("");await load(pagination.page);await loadBatches();
    }finally{setAssigning(false)}
  }

  return <ERPLayout active="/dashboard/students">
    <header className="topbar"><div><div className="crumb">Students / Registry</div><h1>Students</h1></div><div className="top-actions"><a className="ghost-btn" href="/dashboard/students/import"><Upload size={17}/> Bulk Import</a><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></div></header>
    <section className="panel filter-panel">
      <div className="filter-title"><div><h3>Student Registry</h3><p>Search a student by name, course, form number or mobile. Select multiple unassigned students and send them to an available batch.</p></div><button className="filter-toggle" onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal size={17}/>{advanced?"Hide filters":"Advanced filters"}{activeCount>0&&<span>{activeCount}</span>}</button></div>
      <div className="filters primary-filters"><div className="search-box"><Search size={17}/><input value={filters.search} onChange={e=>updateFilter("search",e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(1)} placeholder="Search student name, course, form no., mobile…"/></div><select value={filters.course} onChange={e=>updateFilter("course",e.target.value)}><option value="">All Courses</option>{options.courses.map(c=><option key={c} value={c}>{c}</option>)}</select><select value={filters.status} onChange={e=>updateFilter("status",e.target.value)}><option value="">All Status</option>{options.statuses.map(s=><option key={s}>{s}</option>)}</select><button className="search-action" onClick={()=>load(1)}><Search size={16}/> Search</button></div>
      {advanced&&<div className="advanced-filters"><div className="filter-field"><label>Sex</label><select value={filters.sex} onChange={e=>updateFilter("sex",e.target.value)}><option value="">All</option>{options.sexes.map(s=><option key={s} value={s}>{s==="M"?"Male":s==="F"?"Female":s}</option>)}</select></div><div className="filter-field"><label>Registration No.</label><select value={filters.registration} onChange={e=>updateFilter("registration",e.target.value)}><option value="">All records</option><option value="assigned">Assigned</option><option value="unassigned">Not assigned</option></select></div><div className="filter-field"><label>Registered From</label><input type="date" value={filters.fromDate} onChange={e=>updateFilter("fromDate",e.target.value)}/></div><div className="filter-field"><label>Registered To</label><input type="date" value={filters.toDate} onChange={e=>updateFilter("toDate",e.target.value)}/></div><button className="clear-btn" onClick={clearFilters}><RotateCcw size={15}/> Reset all</button></div>}
      <div className="filter-summary"><span><Filter size={14}/> {pagination.total} matching student records</span><button className="clear-inline" onClick={clearFilters} disabled={!activeCount}><X size={14}/> Clear filters</button></div>
    </section>
    <section className="panel table-panel">
      {selectedStudents.length>0&&<div className="batch-assignment-toolbar"><div><strong>{selectedStudents.length} student{selectedStudents.length>1?"s":""} selected</strong><span>Only unassigned students can be sent to a batch. Multiple selected students must match the selected batch course.</span></div><div className="top-actions"><select value={selectedBatch} onChange={e=>setSelectedBatch(e.target.value)}><option value="">Select available batch</option>{compatibleBatches.map(b=><option key={b._id} value={b._id}>{b.batchCode} — {b.courseCode} · {b.remaining} seats left</option>)}</select><button className="primary-btn" disabled={assigning||!selectedBatch} onClick={sendToBatch}><Send size={16}/>{assigning?"Sending…":"Send to Batch"}</button></div></div>}
      {loading?<div className="empty">Loading students…</div>:students.length===0?<div className="empty">No students match the selected filters.</div>:<div className="table-wrap"><table><thead><tr><th><input type="checkbox" checked={unassignedStudents.length>0&&unassignedStudents.every(s=>selectedStudents.includes(s._id))} onChange={e=>setSelectedStudents(e.target.checked?unassignedStudents.map(s=>s._id):[])}/></th><th>Form No.</th><th>Applicant Name</th><th>Course</th><th>Batch</th><th>Mobile</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>{students.map(s=><tr key={s._id} className="student-row" onClick={()=>window.location.href=`/dashboard/students/${s._id}`}><td onClick={e=>e.stopPropagation()}><input type="checkbox" disabled={!!s.batchId||!!s.batchCode} checked={selectedStudents.includes(s._id)} onChange={e=>setSelectedStudents(v=>e.target.checked?[...v,s._id]:v.filter(id=>id!==s._id))}/></td><td><strong>{s.formNo}</strong></td><td>{s.applicantName}</td><td>{s.courseCode||s.courseName||"—"}</td><td>{s.batchCode||"Unassigned"}</td><td>{s.mobileNumber}</td><td>₹{Number(s.dueAmount||0).toLocaleString("en-IN")}</td><td><span className="badge">{s.status}</span></td><td><div className="top-actions" onClick={e=>e.stopPropagation()}><a className="ghost-btn" href={`/dashboard/students/${s._id}?edit=1`}><Pencil size={14}/> Edit</a><button className="ghost-btn" onClick={async e=>{e.stopPropagation();if(!confirm("Permanently delete this student?"))return;const r=await fetch(`/api/students/${s._id}`,{method:"DELETE"});const d=await r.json();if(!r.ok)return alert(d.error||"Unable to delete student");load(pagination.page)}}><Trash2 size={14}/> Delete</button></div></td></tr>)}</tbody></table></div>}
      <div className="pagination"><span>Showing {students.length?((pagination.page-1)*50)+1:0}–{Math.min(pagination.page*50,pagination.total)} of {pagination.total}</span><div><button disabled={pagination.page<=1} onClick={()=>load(pagination.page-1)}><ChevronLeft size={17}/></button><span className="page-no">Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page>=pagination.totalPages} onClick={()=>load(pagination.page+1)}><ChevronRight size={17}/></button></div></div>
    </section>
  </ERPLayout>
}