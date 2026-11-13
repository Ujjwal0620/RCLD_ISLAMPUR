"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, RefreshCw, Plus, Clock3, CalendarDays, Pencil, Trash2, Search, SlidersHorizontal, Filter, RotateCcw, X } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const empty = {
  code: "",
  name: "",
  category: "Diploma",
  durationMonths: 12,
  classesPerWeek: 2,
  fee: 0,
  admissionFee: 0,
  description: "",
  requiredSkills: [],
};

const money = (value) => "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [query,setQuery]=useState("");
  const [advanced,setAdvanced]=useState(false);
  const [filters,setFilters]=useState({category:"",durationMin:"",durationMax:"",classesMin:"",classesMax:"",feeMin:"",feeMax:"",admissionMin:"",admissionMax:"",skill:""});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load courses.");
      setCourses(data.courses || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load courses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const visibleCourses=useMemo(()=>courses.filter(course=>{
    const haystack=[course.code,course.name,course.category,course.description,(course.requiredSkills||[]).join(" "),course.durationMonths,course.classesPerWeek,course.fee,course.admissionFee].join(" ").toLowerCase();
    return (!query||haystack.includes(query.toLowerCase()))
      &&(!filters.category||course.category===filters.category)
      &&(!filters.skill||(course.requiredSkills||[]).some(s=>s.toLowerCase().includes(filters.skill.toLowerCase())))
      &&(!filters.durationMin||Number(course.durationMonths)>=Number(filters.durationMin))
      &&(!filters.durationMax||Number(course.durationMonths)<=Number(filters.durationMax))
      &&(!filters.classesMin||Number(course.classesPerWeek)>=Number(filters.classesMin))
      &&(!filters.classesMax||Number(course.classesPerWeek)<=Number(filters.classesMax))
      &&(!filters.feeMin||Number(course.fee)>=Number(filters.feeMin))
      &&(!filters.feeMax||Number(course.fee)<=Number(filters.feeMax))
      &&(!filters.admissionMin||Number(course.admissionFee)>=Number(filters.admissionMin))
      &&(!filters.admissionMax||Number(course.admissionFee)<=Number(filters.admissionMax));
  }),[courses,query,filters]);
  const clearDirectoryFilters=()=>{setQuery("");setFilters({category:"",durationMin:"",durationMax:"",classesMin:"",classesMax:"",feeMin:"",feeMax:"",admissionMin:"",admissionMax:"",skill:""})};


  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function add() {
    setEditing(null);
    setForm(empty);
    setError("");
    setShow(true);
  }

  function edit(course) {
    window.location.href = "/dashboard/courses/" + course._id;
  }

  async function save(event) {
    event.preventDefault();
    const response = await fetch(editing ? "/api/courses/" + editing : "/api/courses", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Unable to save the course.");
      return;
    }
    setShow(false);
    await load();
  }

  async function remove(course) {
    if (!confirm("Archive " + course.code + "? This is blocked when active/draft batches depend on the course.")) return;
    const response = await fetch("/api/courses/" + course._id, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Unable to archive the course.");
      return;
    }
    await load();
  }

  return (
    <ERPLayout active="/dashboard/courses">
      <header className="topbar">
        <div><div className="crumb">RCLD Islampur / Master Data</div><h1>Course Management</h1></div>
        <div className="top-actions">
          <button className="icon-btn" type="button" onClick={load} disabled={loading} aria-label="Refresh courses"><RefreshCw size={17}/></button>
          <button className="primary-btn" type="button" onClick={add}><Plus size={17}/> Add Course</button>
        </div>
      </header>

      <section className="directory-overview">
        <div>
          <span className="eyebrow">ACADEMIC MASTER DATA</span>
          <h2>Courses & class frequency</h2>
          <p>Maintain the course catalogue used by student registration, fee setup and batch creation. Course changes are reflected in the connected academic workflows.</p>
        </div>
        <div className="directory-overview-meta">
          <span>{loading ? "Loading catalogue" : courses.length + " courses in catalogue"}</span>
          <span>Course master</span>
        </div>
      </section>

      <section className="metric-grid directory-metrics course-metrics" aria-label="Course scheduling defaults">
        <div className="metric"><div className="metric-icon blue"><BookOpen size={18}/></div><span>Courses in catalogue</span><strong>{loading ? "—" : courses.length}</strong></div>
        <div className="metric"><div className="metric-icon green"><CalendarDays size={18}/></div><span>3-month course default</span><strong>4 / week</strong></div>
        <div className="metric"><div className="metric-icon purple"><Clock3 size={18}/></div><span>1-year course default</span><strong>2 / week</strong></div>
      </section>

      {error && <div className="error-msg" role="alert">{error}</div>}

      <section className="panel filter-panel">
        <div className="filter-title"><div><h3>Search & filter courses</h3><p>Search every catalogue field and combine category, duration, class frequency, fee and skill filters.</p></div><button type="button" className="filter-toggle" onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal size={17}/>{advanced?"Hide filters":"Advanced filters"}</button></div>
        <div className="filters primary-filters"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search course code, name, description, category, skills, fees…"/></div><button className="search-action" type="button"><Search size={16}/> Search</button></div>
        {advanced&&<div className="advanced-filters advanced-filters-expanded">
          <div className="filter-field"><label>Category</label><select value={filters.category} onChange={e=>setFilters(f=>({...f,category:e.target.value}))}><option value="">All categories</option>{[...new Set(courses.map(x=>x.category).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select></div>
          {[["durationMin","Duration from (months)"],["durationMax","Duration to (months)"],["classesMin","Classes / week min"],["classesMax","Classes / week max"],["feeMin","Course fee min (₹)"],["feeMax","Course fee max (₹)"],["admissionMin","Admission fee min (₹)"],["admissionMax","Admission fee max (₹)"]].map(([key,label])=><div className="filter-field" key={key}><label>{label}</label><input type="number" min="0" value={filters[key]} onChange={e=>setFilters(f=>({...f,[key]:e.target.value}))}/></div>)}
          <div className="filter-field"><label>Required skill</label><input value={filters.skill} onChange={e=>setFilters(f=>({...f,skill:e.target.value}))} placeholder="Type a skill"/></div>
          <button type="button" className="clear-btn" onClick={clearDirectoryFilters}><RotateCcw size={15}/> Reset all</button>
        </div>}
        <div className="filter-summary"><span><Filter size={14}/> {visibleCourses.length} matching courses</span><button className="clear-inline" type="button" onClick={clearDirectoryFilters} disabled={!query&&!Object.values(filters).some(Boolean)}><X size={14}/> Clear filters</button></div>
      </section>
      <section className="panel table-panel directory-table-panel" aria-busy={loading}>
        <div className="panel-head">
          <div><h3>Course catalogue</h3><p>Review course codes, duration, class frequency, fees and required faculty skills.</p></div>
          <span className="badge">{visibleCourses.length} listed</span>
        </div>
        {loading ? <div className="empty">Loading course catalogue…</div> : visibleCourses.length === 0 ? (
          <div className="empty"><strong>No courses match your filters.</strong><p>Add the first course to begin configuring academic batches.</p><button className="primary-btn" type="button" onClick={add}><Plus size={16}/> Add Course</button></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Code</th><th scope="col">Course</th><th scope="col">Category</th><th scope="col">Duration</th><th scope="col">Classes / Week</th><th scope="col">Course Fee</th><th scope="col">Required Skills</th><th scope="col">Actions</th></tr></thead>
              <tbody>{visibleCourses.map((course) => (
                <tr key={course._id}>
                  <td><strong>{course.code}</strong></td>
                  <td><strong>{course.name}</strong>{course.description && <small className="course-description-cell">{course.description}</small>}</td>
                  <td>{course.category || "—"}</td>
                  <td>{course.durationMonths} months</td>
                  <td><span className="badge">{course.classesPerWeek} / week</span></td>
                  <td>{money(course.fee)}</td>
                  <td><div className="course-skill-list">{(course.requiredSkills || []).slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}{!course.requiredSkills?.length && "—"}</div></td>
                  <td><div className="top-actions"><button className="ghost-btn" type="button" onClick={() => edit(course)}><Pencil size={14}/> Edit</button><button className="ghost-btn" type="button" onClick={() => remove(course)}><Trash2 size={14}/> Archive</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {show && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={save}>
            <div className="modal-head">
              <div><h3>{editing ? "Edit Course" : "Add Course"}</h3><p>{editing ? "Update the course master record." : "Create a course master record for the institute catalogue."}</p></div>
              <button type="button" className="icon-btn" onClick={() => setShow(false)} aria-label="Close course form">×</button>
            </div>
            <div className="form-grid two">
              {[["code", "Course Code"], ["name", "Course Name"], ["durationMonths", "Duration (months)"], ["classesPerWeek", "Classes / Week"], ["fee", "Total Fee"], ["admissionFee", "Admission Fee"]].map(([name, label]) => (
                <label className="form-field" key={name}><span>{label}</span><input name={name} type={["durationMonths", "classesPerWeek", "fee", "admissionFee"].includes(name) ? "number" : "text"} value={form[name]} onChange={change} required={name === "code" || name === "name"}/></label>
              ))}
              <label className="form-field"><span>Category</span><select name="category" value={form.category} onChange={change}><option>Certificate</option><option>Foundation</option><option>Diploma</option><option>Advanced Diploma</option><option>Professional</option><option>Special</option></select></label>
            </div>
            <label className="form-field full"><span>Required Skills (comma separated)</span><input value={(form.requiredSkills || []).join(", ")} onChange={(event) => setForm({ ...form, requiredSkills: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}/></label>
            <label className="form-field full"><span>Description</span><textarea name="description" value={form.description} onChange={change} rows="4"/></label>
            {error && <div className="error-msg" role="alert">{error}</div>}
            <div className="form-actions"><button type="button" className="ghost-btn" onClick={() => setShow(false)}>Cancel</button><button className="primary-btn">{editing ? "Save Changes" : "Save Course"}</button></div>
          </form>
        </div>
      )}
    </ERPLayout>
  );
}
