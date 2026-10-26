"use client";
import { useEffect, useState } from "react";
import { Search, UserPlus, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
const courses = ["CCA","DCA","ADCA","CCC","CAO","DWPD","DOM","DCST","DCAP","DHNT"];
export default function StudentsPage() {
  const [students,setStudents]=useState([]);
  const [pagination,setPagination]=useState({page:1,limit:50,total:0,totalPages:1});
  const [filters,setFilters]=useState({search:"",sex:"",course:"",status:""});
  const [loading,setLoading]=useState(true);
  async function load(page=1) {
    setLoading(true);
    const params=new URLSearchParams({page:String(page),limit:"50"});
    Object.entries(filters).forEach(([k,v])=>v&&params.set(k,v));
    const r=await fetch("/api/students?"+params.toString(),{cache:"no-store"});
    const j=await r.json(); setStudents(j.students||[]); setPagination(j.pagination||{page:1,limit:50,total:0,totalPages:1}); setLoading(false);
  }
  useEffect(()=>{load(1)},[filters.sex,filters.course,filters.status]);
  function clearFilters(){setFilters({search:"",sex:"",course:"",status:""});}
  return <main className="erp-shell"><aside className="erp-sidebar"><div className="brand"><div className="brand-mark">R</div><div><strong>RCLD</strong><span>Islampur ERP</span></div></div><div className="side-label">STUDENT MANAGEMENT</div><a className="side-link" href="/dashboard">Dashboard</a><a className="side-link active" href="/dashboard/students">Students</a><a className="side-link" href="/dashboard/students/register">Registration</a></aside>
  <section className="erp-main"><header className="topbar"><div><div className="crumb">Students / Registry</div><h1>Students</h1></div><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></header>
  <section className="panel filter-panel"><div className="filter-title"><div><h3>Student Registry</h3><p>Server-side filters with a maximum of 50 records per page.</p></div><SlidersHorizontal size={19}/></div>
  <div className="filters"><div className="search-box"><Search size={17}/><input value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} onKeyDown={e=>e.key==="Enter"&&load(1)} placeholder="Search name, form no., mobile, course"/></div>
  <select value={filters.sex} onChange={e=>setFilters({...filters,sex:e.target.value})}><option value="">All Sex</option><option value="M">Male</option><option value="F">Female</option></select>
  <select value={filters.course} onChange={e=>setFilters({...filters,course:e.target.value})}><option value="">All Courses</option>{courses.map(c=><option key={c}>{c}</option>)}</select>
  <select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All Status</option><option>Registered</option></select>
  <button className="clear-btn" onClick={clearFilters}><X size={15}/> Clear</button></div></section>
  <section className="panel table-panel">{loading?<div className="empty">Loading students…</div>:students.length===0?<div className="empty">No students match the selected filters.</div>:<div className="table-wrap"><table><thead><tr><th>Form No.</th><th>Applicant Name</th><th>Course</th><th>Sex</th><th>DOB</th><th>Mobile</th><th>Registration No.</th><th>Status</th></tr></thead><tbody>{students.map(s=><tr key={s._id}><td><strong>{s.formNo}</strong></td><td>{s.applicantName}</td><td>{s.courseName||"—"}</td><td>{s.sex||"—"}</td><td>{s.dateOfBirth||"—"}</td><td>{s.mobileNumber}</td><td>{s.regnNo||"—"}</td><td><span className="badge">{s.status}</span></td></tr>)}</tbody></table></div>}
  <div className="pagination"><span>Showing {students.length?((pagination.page-1)*50)+1:0}–{Math.min(pagination.page*50,pagination.total)} of {pagination.total}</span><div><button disabled={pagination.page<=1} onClick={()=>load(pagination.page-1)}><ChevronLeft size={17}/></button><span className="page-no">Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page>=pagination.totalPages} onClick={()=>load(pagination.page+1)}><ChevronRight size={17}/></button></div></div></section></section></main>
}