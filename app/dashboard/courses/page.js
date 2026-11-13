"use client";

import { useEffect, useState } from "react";
import { BookOpen, RefreshCw, Plus, Clock3, CalendarDays, Pencil, Trash2 } from "lucide-react";
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

      <section className="panel table-panel directory-table-panel" aria-busy={loading}>
        <div className="panel-head">
          <div><h3>Course catalogue</h3><p>Review course codes, duration, class frequency, fees and required faculty skills.</p></div>
          <span className="badge">{courses.length} listed</span>
        </div>
        {loading ? <div className="empty">Loading course catalogue…</div> : courses.length === 0 ? (
          <div className="empty"><strong>No courses found.</strong><p>Add the first course to begin configuring academic batches.</p><button className="primary-btn" type="button" onClick={add}><Plus size={16}/> Add Course</button></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Code</th><th scope="col">Course</th><th scope="col">Category</th><th scope="col">Duration</th><th scope="col">Classes / Week</th><th scope="col">Course Fee</th><th scope="col">Required Skills</th><th scope="col">Actions</th></tr></thead>
              <tbody>{courses.map((course) => (
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
