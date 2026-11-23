"use client";

import { useState } from "react";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import { useErpCache, useErpToast } from "@/components/providers/ERPUIProvider";

export default function StudentFeeImportPage() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const notify = useErpToast();
  const { invalidate } = useErpCache();

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/students/fee-import", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Fee import failed.");
      setReport(data);
      notify("Fee workbook imported. Student and course fee summaries are ready.", "success");
      invalidate(["lookup:", "students:", "student-detail:", "student-fees:", "dashboard-stats", "batches:"]);
    } catch (err) {
      setError(err.message || "Unable to upload fee workbook.");
      notify(err.message || "Unable to upload fee workbook.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ERPLayout active="/dashboard/students/fee-import">
      <header className="topbar">
        <div><div className="crumb">Students / Fee Mapping</div><h1>Excel Fee Upload & Student Mapping</h1></div>
        <a className="ghost-btn" href="/dashboard/students/import"><ArrowLeft size={16} /> Back to Student Import</a>
      </header>

      <section className="welcome">
        <div>
          <span className="eyebrow">COURSE-WISE FEE RECONCILIATION</span>
          <h2>Upload one workbook to map fees across courses</h2>
          <p>Supports .xlsx, .xls and .csv up to 15 MB. The importer detects common column names automatically and keeps each receipt attached to its exact student and course enrollment, including completed courses.</p>
        </div>
        <FileSpreadsheet size={28} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><h3>1. Select fee workbook</h3><p>Required: Student ID or Student Name + Phone, Course, and at least one fee column.</p></div>
          <Upload size={22} />
        </div>
        <div style={{ padding: 24, display: "grid", gap: 16 }}>
          <label className="form-field">
            <span>Excel / CSV file</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={event => { setFile(event.target.files?.[0] || null); setReport(null); setError(""); }} />
          </label>
          {file && <p className="form-help">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
          <div className="form-help">
            <b>Recognized columns</b>
            <p>Student ID / Registration Code, Student Name, Phone, Course Name / Code, Total Fee, Discount, Paid Amount, Due Amount, Receipt No, Payment Date, Payment Mode and Course Status.</p>
            <p>Existing populated student details are not overwritten. Receipts are updated by receipt number within the course enrollment, or by payment date and amount when no receipt number is supplied. Uncertain matches are listed for review.</p>
          </div>
          {error && <div className="error-text" role="alert">{error}</div>}
          <div><button className="primary-btn" type="button" disabled={!file || busy} onClick={upload}><Upload size={16} /> {busy ? "Mapping students & recalculating fees…" : "Upload & Map Course Fees"}</button></div>
        </div>
      </section>

      {report && (
        <>
          <section className="panel" style={{ marginTop: 18 }}>
            <div className="panel-head"><div><h3>2. Import result</h3><p>{report.message}</p></div><CheckCircle2 size={22} /></div>
            <div className="student-summary-grid" style={{ padding: 20 }}>
              <div className="summary-card"><span>Total Rows Processed</span><strong>{report.totalRowsProcessed ?? 0}</strong></div>
              <div className="summary-card"><span>Students Updated</span><strong>{report.studentsUpdated?.length ?? 0}</strong></div>
              <div className="summary-card"><span>New Fee Records Created</span><strong>{report.newFeeRecordsCreated ?? 0}</strong></div>
              <div className="summary-card"><span>Existing Fee Records Updated</span><strong>{report.existingFeeRecordsUpdated ?? 0}</strong></div>
              <div className="summary-card"><span>Rows Requiring Review</span><strong>{report.unmatchedRows?.length ?? 0}</strong></div>
            </div>
          </section>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="panel-head"><div><h3>Students & courses mapped</h3><p>Course count includes all course enrollments represented by the uploaded rows.</p></div></div>
            <div style={{ overflowX: "auto", padding: 16 }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead><tr><th>Student</th><th>Courses Mapped</th><th>Total Fee</th><th>Discount</th><th>Paid</th><th>Balance Due</th><th>Status</th></tr></thead>
                <tbody>
                  {(report.studentsUpdated || []).map(item => (
                    <tr key={item.studentId}>
                      <td>{item.name || item.studentId}</td><td>{item.coursesMapped}</td>
                      <td>₹{Number(item.feeSummary?.totalFee || 0).toLocaleString("en-IN")}</td>
                      <td>₹{Number(item.feeSummary?.discount || 0).toLocaleString("en-IN")}</td>
                      <td>₹{Number(item.feeSummary?.totalPaid || 0).toLocaleString("en-IN")}</td>
                      <td>₹{Number(item.feeSummary?.balanceDue || 0).toLocaleString("en-IN")}</td>
                      <td>{item.feeSummary?.feeStatus || "—"}</td>
                    </tr>
                  ))}
                  {!report.studentsUpdated?.length && <tr><td colSpan="7">No student records were updated.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="panel-head"><div><h3>Rows requiring review</h3><p>Correct these rows in Excel and upload the workbook again. Re-uploading matched receipts is idempotent.</p></div><AlertTriangle size={22} /></div>
            <div style={{ overflowX: "auto", padding: 16 }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead><tr><th>Excel Row</th><th>Student ID</th><th>Course</th><th>Reason</th></tr></thead>
                <tbody>
                  {(report.unmatchedRows || []).map((item, index) => (
                    <tr key={String(item.row) + "-" + index}><td>{item.row}</td><td>{item.studentId || "—"}</td><td>{item.course || "—"}</td><td>{item.reason}</td></tr>
                  ))}
                  {!report.unmatchedRows?.length && <tr><td colSpan="4">No unmatched or validation rows.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ERPLayout>
  );
}
