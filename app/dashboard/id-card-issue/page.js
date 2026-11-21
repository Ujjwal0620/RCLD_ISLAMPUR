"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, IdCard, RefreshCw, Search } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import CodingForKidsIcardDialog from "@/components/students/profile/CodingForKidsIcardDialog";
import { printStudentICard } from "@/features/students/print/printStudentICard";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function IdCardIssuePage() {
  const [issues, setIssues] = useState([]);
  const [totalIssued, setTotalIssued] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState("");

  const load = useCallback(async (term = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set("search", term.trim());
      const response = await fetch("/api/id-card-issues?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load ID-card issue records.");
      setIssues(data.issues || []);
      setTotalIssued(Number(data.totalIssued ?? data.total ?? 0));
    } catch (loadError) {
      setError(loadError.message || "Unable to load ID-card issue records.");
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openRedownload(issue) {
    const student = issue.studentId && typeof issue.studentId === "object" ? issue.studentId : null;
    if (!student?._id) {
      setError("The original student record is unavailable, so this ID card cannot be re-rendered.");
      return;
    }
    setMessage("");
    setError("");
    setSelectedStudent({
      ...student,
      idCardNumber: issue.idCardNumber,
      idCardNo: issue.idCardNumber,
      isIdDownloaded: true,
      isDownloaded: true,
    });
    setDialogOpen(true);
  }

  return (
    <ERPLayout active="/dashboard/id-card-issue">
      <header className="topbar">
        <div><div className="crumb">Students / ID Card Issue</div><h1>ID CARD ISSUE</h1></div>
        <div className="top-actions">
          <button type="button" className="ghost-btn" onClick={() => load(query)} disabled={loading}><RefreshCw size={15}/> Refresh</button>
        </div>
      </header>

      <section className="id-issue-summary">
        <div className="id-issue-summary-icon"><IdCard size={22}/></div>
        <div><span>Total ID Cards Issued</span><strong>{totalIssued.toLocaleString("en-IN")}</strong></div>
        <small>Confirmed student ID-card downloads</small>
      </section>

      {message && <div className="success-msg" role="status">{message}</div>}
      {error && <div className="error-msg" role="alert">{error}</div>}

      <section className="panel id-issue-panel">
        <div className="id-issue-heading">
          <div><h2>Issued ID-card register</h2><p>Permanent issue history, ordered by the sequential ID-card number.</p></div>
          <form className="id-issue-search" onSubmit={event => { event.preventDefault(); setQuery(search); load(search); }}>
            <Search size={16}/>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search ID no., form no., name or mobile"/>
            <button type="submit" className="primary-btn" disabled={loading}>Search</button>
          </form>
        </div>

        {loading ? <div className="empty">Loading issued ID cards…</div> : issues.length === 0 ? (
          <div className="empty">{query ? "No issued ID cards match this search." : "No ID cards have been confirmed for download yet."}</div>
        ) : (
          <div className="table-wrap">
            <table className="id-issue-table">
              <thead><tr>
                <th>ID Card No.</th><th>Form No.</th><th>Student Photo & Applicant Name</th>
                <th>Course</th><th>Batch</th><th>Mobile</th><th>Issued Date & Time</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>{issues.map(issue => (
                <tr key={issue._id}>
                  <td><strong className="id-issue-number">{issue.idCardNumber}</strong></td>
                  <td>{issue.formNo || "—"}</td>
                  <td><div className="id-issue-student">
                    {issue.photoUrl ? <img src={issue.photoUrl} alt="" loading="lazy"/> : <span className="id-issue-avatar">{String(issue.applicantName || "S").charAt(0).toUpperCase()}</span>}
                    <strong>{issue.applicantName || "Unnamed student"}</strong>
                  </div></td>
                  <td>{issue.course || "—"}</td><td>{issue.batch || "—"}</td><td>{issue.mobile || "—"}</td>
                  <td>{formatDate(issue.issuedAt)}</td>
                  <td><span className="id-issue-badge">Downloaded</span></td>
                  <td><button type="button" className="ghost-btn id-issue-download" disabled={!issue.studentId?._id || (dialogOpen && selectedStudent?._id === issue.studentId?._id)} onClick={() => openRedownload(issue)}>
                    <Download size={14}/> Re-download ID Card
                  </button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="id-issue-footer"><span>{issues.length.toLocaleString("en-IN")} record(s) shown</span><span>All issued numbers remain permanent on re-download.</span></div>
      </section>

      <CodingForKidsIcardDialog
        open={dialogOpen}
        student={selectedStudent}
        mode="jpg"
        onClose={() => setDialogOpen(false)}
        onSelect={async (templateName) => {
          if (!selectedStudent) return;
          setDownloading(selectedStudent._id);
          try {
            const success = await printStudentICard(
              selectedStudent,
              setMessage,
              "",
              "jpg",
              templateName,
              updated => {
                setSelectedStudent(current => current?._id === updated._id ? { ...current, ...updated } : current);
                setIssues(current => current.map(issue => issue.studentId?._id === updated._id
                  ? { ...issue, lastDownloadedAt: updated.lastDownloadedAt }
                  : issue
                ));
              },
            );
            if (!success) return;
            setDialogOpen(false);
            await load(query);
          } finally {
            setDownloading("");
          }
        }}
      />

      <style jsx>{`
        .id-issue-summary{display:flex;align-items:center;gap:15px;padding:20px 22px;margin:0 0 20px;border:1px solid var(--border-color,#e5e9f0);border-radius:14px;background:var(--card-bg,#fff)}
        .id-issue-summary-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:13px;background:rgba(55,111,220,.1);color:#376fdc}
        .id-issue-summary div:nth-child(2){display:flex;flex-direction:column;gap:3px}
        .id-issue-summary span{font-size:12px;color:var(--text-muted,#778397)}.id-issue-summary strong{font-size:26px;line-height:1.1}
        .id-issue-summary small{margin-left:auto;color:var(--text-muted,#778397);font-size:12px}
        .id-issue-panel{overflow:hidden}.id-issue-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px}
        .id-issue-heading h2{margin:0 0 5px;font-size:17px}.id-issue-heading p{margin:0;color:var(--text-muted,#778397);font-size:12px}
        .id-issue-search{display:flex;align-items:center;gap:8px;min-width:min(480px,52%);padding:5px 6px 5px 11px;border:1px solid var(--border-color,#dfe4ec);border-radius:9px;color:var(--text-muted,#778397)}
        .id-issue-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--text-color,inherit);font:inherit;font-size:13px}
        .id-issue-table{min-width:1250px}.id-issue-table th{white-space:nowrap}
        .id-issue-number{font-size:12px;white-space:nowrap;color:var(--heading-color,inherit)}
        .id-issue-student{display:flex;align-items:center;gap:9px;min-width:190px}.id-issue-student img,.id-issue-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid var(--border-color,#e1e6ed)}
        .id-issue-avatar{display:grid;place-items:center;background:var(--subtle-bg,#f1f4f8);font-weight:700}
        .id-issue-student strong{font-size:12px}.id-issue-badge{display:inline-flex;padding:3px 8px;border-radius:20px;background:#e8f7ee;color:#187344;font-size:10px;font-weight:700;white-space:nowrap}
        .id-issue-download{white-space:nowrap;font-size:11px}.id-issue-footer{display:flex;justify-content:space-between;gap:12px;padding:13px 20px;border-top:1px solid var(--border-color,#edf0f4);font-size:12px;color:var(--text-muted,#778397)}
        @media(max-width:760px){.id-issue-heading{align-items:stretch;flex-direction:column}.id-issue-search{min-width:0;width:100%}.id-issue-summary small{display:none}.id-issue-footer{flex-direction:column}}
      `}</style>
    </ERPLayout>
  );
}
