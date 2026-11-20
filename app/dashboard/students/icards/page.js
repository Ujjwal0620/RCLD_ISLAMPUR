"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Download, Filter, IdCard, Printer, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import CodingForKidsIcardDialog from "@/components/students/profile/CodingForKidsIcardDialog";
import { printStudentICard } from "@/features/students/print/printStudentICard";

const PAGE_SIZE = 30;
const EMPTY_FILTERS = {
  search: "",
  course: "",
  batchCode: "",
  status: "",
  sex: "",
  fromDate: "",
  toDate: "",
};

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (currentPage >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  return sorted.reduce((result, page, index) => {
    if (index && page - sorted[index - 1] > 1) result.push("ellipsis-" + page);
    result.push(page);
    return result;
  }, []);
}

function initials(name = "") {
  return String(name).trim().split(/\\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ST";
}

export default function StudentICardsPage() {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [filterOptions, setFilterOptions] = useState({ courses: [], statuses: [], sexes: [], batchCodes: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [icardOutputMode, setIcardOutputMode] = useState("print");

  const load = useCallback(async (page = 1, activeFilters = EMPTY_FILTERS) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        status: activeFilters.status || "all",
        icardEligible: "1",
      });
      Object.entries(activeFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const response = await fetch("/api/students?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load student I-Cards.");
      setStudents(data.students || []);
      setPagination(data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
      if (data.filterOptions) {
        setFilterOptions({
          courses: data.filterOptions.courses || [],
          statuses: data.filterOptions.statuses || [],
          sexes: data.filterOptions.sexes || [],
          batchCodes: data.filterOptions.batchCodes || [],
        });
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load student I-Cards.");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(1, EMPTY_FILTERS);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pageNumbers = useMemo(
    () => getPageNumbers(pagination.page, pagination.totalPages),
    [pagination.page, pagination.totalPages],
  );
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const firstRecord = pagination.total ? (pagination.page - 1) * PAGE_SIZE + 1 : 0;
  const lastRecord = Math.min(pagination.page * PAGE_SIZE, pagination.total);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    load(1, filters);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    load(1, EMPTY_FILTERS);
  }

  return (
    <ERPLayout active="/dashboard/students/icards">
      <header className="topbar">
        <div>
          <div className="crumb">Students / Identity Cards</div>
          <h1>Student I-Cards</h1>
        </div>
        <div className="top-actions">
          <span className="badge">{pagination.total.toLocaleString("en-IN")} students</span>
          <button type="button" className="ghost-btn" onClick={() => load(pagination.page, filters)}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </header>

      <CodingForKidsIcardDialog
        open={templateDialogOpen}
        student={selectedStudent}
        onClose={() => setTemplateDialogOpen(false)}
        onSelect={(templateName) => {
          setTemplateDialogOpen(false);
          if (selectedStudent) printStudentICard(selectedStudent, setMessage, "", icardOutputMode, templateName);
        }}
      />

      <section className="icard-directory-intro">
        <div className="icard-directory-icon"><IdCard size={23} /></div>
        <div>
          <h2>Identity card directory</h2>
          <p>Search eligible student records and print the same official I-Card layout used on the student profile.</p>
        </div>
        <div className="icard-directory-count">
          <strong>{pagination.total.toLocaleString("en-IN")}</strong>
          <span>Print-ready records</span>
        </div>
      </section>

      <section className="panel icard-filter-panel">
        <form onSubmit={applyFilters}>
          <div className="icard-filter-heading">
            <div>
              <h3>Find students</h3>
              <p>Optional student fields may remain blank; choose a template to preview the available details.</p>
            </div>
            <button type="button" className="clear-inline" onClick={clearFilters} disabled={!activeFilterCount}>
              <RotateCcw size={14} /> Reset filters
            </button>
          </div>
          <div className="icard-filter-grid">
            <label className="icard-search-field">
              <span>Search student</span>
              <div className="icard-input-with-icon">
                <Search size={16} />
                <input
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  placeholder="Name, enrolment no., mobile, email…"
                />
              </div>
            </label>
            <label>
              <span>Course</span>
              <select value={filters.course} onChange={(event) => updateFilter("course", event.target.value)}>
                <option value="">All courses</option>
                {filterOptions.courses.map((course) => <option key={course} value={course}>{course}</option>)}
              </select>
            </label>
            <label>
              <span>Batch</span>
              <select value={filters.batchCode} onChange={(event) => updateFilter("batchCode", event.target.value)}>
                <option value="">All batches</option>
                {filterOptions.batchCodes.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
              </select>
            </label>
            <label>
              <span>Student status</span>
              <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">All eligible statuses</option>
                {filterOptions.statuses.filter((status) => status !== "Admission Pending").map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Gender</span>
              <select value={filters.sex} onChange={(event) => updateFilter("sex", event.target.value)}>
                <option value="">All</option>
                {filterOptions.sexes.map((sex) => <option key={sex} value={sex}>{sex}</option>)}
              </select>
            </label>
            <label>
              <span>Registered from</span>
              <input type="date" value={filters.fromDate} onChange={(event) => updateFilter("fromDate", event.target.value)} />
            </label>
            <label>
              <span>Registered to</span>
              <input type="date" value={filters.toDate} onChange={(event) => updateFilter("toDate", event.target.value)} />
            </label>
            <div className="icard-filter-actions">
              <button type="submit" className="primary-btn"><Filter size={16} /> Apply filters</button>
            </div>
          </div>
        </form>
        <div className="icard-filter-summary">
          <span><Filter size={14} /> {pagination.total.toLocaleString("en-IN")} matching students</span>
          <span>{activeFilterCount ? activeFilterCount + " filter(s) selected" : "No filters applied"}</span>
        </div>
      </section>

      {message && <div className="success-msg icard-feedback" role="status">{message}</div>}
      {error && <div className="error-msg icard-feedback" role="alert">{error}</div>}

      <section className="panel icard-table-panel" aria-busy={loading}>
        <div className="icard-table-heading">
          <div>
            <h3>Eligible students</h3>
            <p>Showing {firstRecord}–{lastRecord} of {pagination.total.toLocaleString("en-IN")} records</p>
          </div>
          <span className="icard-page-size">30 students per page</span>
        </div>

        {loading ? (
          <div className="empty">Loading student I-Cards…</div>
        ) : students.length === 0 ? (
          <div className="empty">No students match these filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="icard-student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Enrolment No.</th>
                  <th>Course</th>
                  <th>Batch</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <div className="icard-student-identity">
                        {student.photoUrl ? (
                          <Image
                            src={student.photoUrl}
                            alt={student.applicantName + " photo"}
                            width={42}
                            height={42}
                            unoptimized
                            className="icard-student-avatar"
                          />
                        ) : (
                          <span className="icard-student-avatar icard-student-avatar-fallback">{initials(student.applicantName)}</span>
                        )}
                        <span className="icard-student-name">{student.applicantName || "Unnamed student"}</span>
                      </div>
                    </td>
                    <td><strong>{student.enrollmentNo || student.regnNo || student.formNo || "—"}</strong></td>
                    <td>{student.courseCode || student.courseName || "—"}</td>
                    <td>{student.batchCode || "Unassigned"}</td>
                    <td>{student.mobileNumber || "—"}</td>
                    <td><span className="badge">{student.status || "—"}</span></td>
                    <td>
                      <div className="icard-row-actions">
                        <button
                          type="button"
                          className="ghost-btn icard-print-button"
                          title="Print student I-Card"
                          onClick={() => {
                            setMessage("");
                            setSelectedStudent(student);
                            setIcardOutputMode("print");
                            setTemplateDialogOpen(true);
                          }}
                        >
                          <Printer size={14} /> Print
                        </button>
                        <button
                          type="button"
                          className="ghost-btn icard-print-button"
                          title="Download student I-Card as JPG"
                          onClick={() => {
                            setMessage("");
                            setSelectedStudent(student);
                            setIcardOutputMode("jpg");
                            setTemplateDialogOpen(true);
                          }}
                        >
                          <Download size={14} /> JPG
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav className="icard-pagination" aria-label="Student I-Card pages">
          <span>Showing {firstRecord}–{lastRecord} of {pagination.total}</span>
          <div className="icard-pagination-controls">
            <button type="button" aria-label="Previous page" disabled={loading || pagination.page <= 1} onClick={() => load(pagination.page - 1, filters)}>
              <ChevronLeft size={17} />
            </button>
            {pageNumbers.map((page) => typeof page === "number" ? (
              <button
                type="button"
                key={page}
                className={page === pagination.page ? "active" : ""}
                aria-current={page === pagination.page ? "page" : undefined}
                onClick={() => load(page, filters)}
                disabled={loading}
              >
                {page}
              </button>
            ) : <span className="icard-pagination-ellipsis" key={page}>…</span>)}
            <button type="button" aria-label="Next page" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1, filters)}>
              <ChevronRight size={17} />
            </button>
          </div>
        </nav>
      </section>

      <style jsx>{`
        .icard-directory-intro{display:flex;align-items:center;gap:15px;padding:19px 22px;margin:0 0 20px;border:1px solid var(--border-color,#e6eaf0);border-radius:14px;background:var(--card-bg,#fff)}
        .icard-directory-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:13px;background:rgba(55,111,220,.1);color:#376fdc;flex:none}
        .icard-directory-intro h2{font-size:18px;margin:0 0 5px;color:var(--heading-color,inherit)}
        .icard-directory-intro p,.icard-filter-heading p,.icard-table-heading p{margin:0;color:var(--text-muted,#778397);font-size:13px}
        .icard-directory-count{margin-left:auto;text-align:right;display:flex;flex-direction:column;gap:3px}
        .icard-directory-count strong{font-size:22px}.icard-directory-count span{font-size:12px;color:var(--text-muted,#778397)}
        .icard-filter-panel{margin-bottom:20px;padding:20px}
        .icard-filter-heading,.icard-table-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}
        .icard-filter-heading h3,.icard-table-heading h3{margin:0 0 5px;font-size:16px}
        .icard-filter-grid{display:grid;grid-template-columns:minmax(230px,2fr) repeat(3,minmax(135px,1fr));gap:13px;align-items:end}
        .icard-filter-grid label{display:flex;flex-direction:column;gap:7px;min-width:0}
        .icard-filter-grid label>span{font-size:12px;font-weight:600;color:var(--text-muted,#68758a)}
        .icard-filter-grid input,.icard-filter-grid select{width:100%;min-width:0;height:40px;padding:0 11px;border:1px solid var(--border-color,#dfe4ec);border-radius:8px;background:var(--input-bg,#fff);color:var(--text-color,inherit);font:inherit;font-size:13px}
        .icard-input-with-icon{display:flex;align-items:center;gap:8px;height:40px;padding:0 10px;border:1px solid var(--border-color,#dfe4ec);border-radius:8px;color:var(--text-muted,#7b8798)}
        .icard-input-with-icon input{height:36px;padding:0;border:0;outline:0}
        .icard-filter-actions{display:flex;align-items:end}
        .icard-filter-actions button{height:40px;white-space:nowrap}
        .icard-filter-summary{display:flex;justify-content:space-between;gap:10px;margin-top:16px;padding-top:13px;border-top:1px solid var(--border-color,#edf0f4);font-size:12px;color:var(--text-muted,#778397)}
        .icard-filter-summary span:first-child{display:flex;align-items:center;gap:6px}
        .icard-feedback{margin:0 0 16px}
        .icard-table-panel{padding:0;overflow:hidden}
        .icard-table-heading{padding:19px 20px 0;margin-bottom:15px}
        .icard-page-size{font-size:12px;padding:6px 10px;border-radius:20px;background:var(--subtle-bg,#f2f5f9);color:var(--text-muted,#68758a);white-space:nowrap}
        .icard-student-table{min-width:900px}
        .icard-student-table th{white-space:nowrap}
        .icard-student-identity{display:flex;align-items:center;gap:10px;min-width:190px}
        :global(.icard-student-avatar){width:42px;height:42px;min-width:42px;border-radius:50%;object-fit:cover;border:1px solid var(--border-color,#e1e6ed);background:#f1f4f8}
        .icard-student-avatar-fallback{display:grid;place-items:center;font-size:12px;font-weight:700;color:#52627a}
        .icard-student-name{font-weight:650;color:var(--heading-color,inherit)}
        .icard-row-actions{display:flex;align-items:center;gap:7px}.icard-print-button{white-space:nowrap}.icard-print-button:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
        .icard-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 20px;border-top:1px solid var(--border-color,#edf0f4);font-size:12px;color:var(--text-muted,#778397)}
        .icard-pagination-controls{display:flex;align-items:center;gap:5px}
        .icard-pagination-controls button{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--border-color,#dfe4ec);border-radius:7px;background:var(--card-bg,#fff);color:var(--text-color,inherit);cursor:pointer}
        .icard-pagination-controls button.active{background:#376fdc;border-color:#376fdc;color:#fff}
        .icard-pagination-controls button:disabled{opacity:.4;cursor:not-allowed}
        .icard-pagination-ellipsis{width:22px;display:grid;place-items:center}
        @media(max-width:1050px){.icard-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.icard-search-field{grid-column:span 2}}
        @media(max-width:600px){.icard-directory-intro{align-items:flex-start;padding:15px}.icard-directory-count{display:none}.icard-filter-panel{padding:15px}.icard-filter-grid{grid-template-columns:1fr}.icard-search-field{grid-column:auto}.icard-filter-heading,.icard-table-heading{align-items:flex-start;flex-direction:column}.icard-filter-summary,.icard-pagination{align-items:flex-start;flex-direction:column}.icard-pagination-controls{flex-wrap:wrap}}
      `}</style>
    </ERPLayout>
  );
}
