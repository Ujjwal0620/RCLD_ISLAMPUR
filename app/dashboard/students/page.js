"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, ChevronLeft, ChevronRight, SlidersHorizontal, X, RotateCcw, Filter } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const fallbackCourses = ["CCA","DCA","ADCA","CCC","CAO","DWPD","DOM","DCST","DCAP","DHNT"];

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [options, setOptions] = useState({ courses: fallbackCourses, statuses: ["Registered"], sexes: ["M", "F"] });
  const [filters, setFilters] = useState({ search: "", sex: "", course: "", status: "", registration: "", fromDate: "", toDate: "" });
  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(page = 1, override = filters) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      Object.entries(override).forEach(([key, value]) => { if (value) params.set(key, value); });
      const response = await fetch("/api/students?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      setStudents(data.students || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
      if (data.filterOptions) setOptions({
        courses: data.filterOptions.courses?.length ? data.filterOptions.courses : fallbackCourses,
        statuses: data.filterOptions.statuses?.length ? data.filterOptions.statuses : ["Registered"],
        sexes: data.filterOptions.sexes?.length ? data.filterOptions.sexes : ["M", "F"],
      });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(1); }, [filters.sex, filters.course, filters.status, filters.registration, filters.fromDate, filters.toDate]);

  function updateFilter(key, value) { setFilters(current => ({ ...current, [key]: value })); }
  function clearFilters() {
    const empty = { search: "", sex: "", course: "", status: "", registration: "", fromDate: "", toDate: "" };
    setFilters(empty);
    load(1, empty);
  }

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <ERPLayout active="/dashboard/students">
      <header className="topbar"><div><div className="crumb">Students / Registry</div><h1>Students</h1></div><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></header>
      <section className="panel filter-panel">
        <div className="filter-title"><div><h3>Student Registry</h3><p>Search, filter and review a maximum of 50 records at a time.</p></div><button className="filter-toggle" onClick={() => setAdvanced(value => !value)}><SlidersHorizontal size={17}/>{advanced ? "Hide filters" : "Advanced filters"}{activeCount > 0 && <span>{activeCount}</span>}</button></div>
        <div className="filters primary-filters">
          <div className="search-box"><Search size={17}/><input value={filters.search} onChange={e => updateFilter("search", e.target.value)} onKeyDown={e => e.key === "Enter" && load(1)} placeholder="Search name, form no., mobile, course, registration no."/></div>
          <select value={filters.course} onChange={e => updateFilter("course", e.target.value)}><option value="">All Courses</option>{options.courses.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select value={filters.status} onChange={e => updateFilter("status", e.target.value)}><option value="">All Status</option>{options.statuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <button className="search-action" onClick={() => load(1)}><Search size={16}/> Search</button>
        </div>
        {advanced && <div className="advanced-filters">
          <div className="filter-field"><label>Sex</label><select value={filters.sex} onChange={e => updateFilter("sex", e.target.value)}><option value="">All</option>{options.sexes.map(s => <option key={s} value={s}>{s === "M" ? "Male" : s === "F" ? "Female" : s}</option>)}</select></div>
          <div className="filter-field"><label>Registration No.</label><select value={filters.registration} onChange={e => updateFilter("registration", e.target.value)}><option value="">All records</option><option value="assigned">Assigned</option><option value="unassigned">Not assigned</option></select></div>
          <div className="filter-field"><label>Registered From</label><input type="date" value={filters.fromDate} onChange={e => updateFilter("fromDate", e.target.value)}/></div>
          <div className="filter-field"><label>Registered To</label><input type="date" value={filters.toDate} onChange={e => updateFilter("toDate", e.target.value)}/></div>
          <button className="clear-btn" onClick={clearFilters}><RotateCcw size={15}/> Reset all</button>
        </div>}
        <div className="filter-summary"><span><Filter size={14}/> {pagination.total} matching student records</span><button className="clear-inline" onClick={clearFilters} disabled={!activeCount}><X size={14}/> Clear filters</button></div>
      </section>
      <section className="panel table-panel">
        {loading ? <div className="empty">Loading students…</div> : students.length === 0 ? <div className="empty">No students match the selected filters.</div> : <div className="table-wrap"><table><thead><tr><th>Form No.</th><th>Applicant Name</th><th>Course</th><th>Sex</th><th>DOB</th><th>Mobile</th><th>Registration No.</th><th>Status</th></tr></thead><tbody>{students.map(s => <tr key={s._id}><td><strong>{s.formNo}</strong></td><td>{s.applicantName}</td><td>{s.courseName||"—"}</td><td>{s.sex||"—"}</td><td>{s.dateOfBirth||"—"}</td><td>{s.mobileNumber}</td><td>{s.regnNo||"—"}</td><td><span className="badge">{s.status}</span></td></tr>)}</tbody></table></div>}
        <div className="pagination"><span>Showing {students.length ? ((pagination.page - 1) * 50) + 1 : 0}–{Math.min(pagination.page * 50, pagination.total)} of {pagination.total}</span><div><button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}><ChevronLeft size={17}/></button><span className="page-no">Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}><ChevronRight size={17}/></button></div></div>
      </section>
    </ERPLayout>
  );
}
