"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Play, RefreshCw, Upload } from "lucide-react";

const STUDENT_FIELDS = [
  ["primaryCode", "Primary Student Code"], ["allCodes", "All / Previous Codes"],
  ["name", "Student Name"], ["fatherName", "Father / Guardian Name"],
  ["dob", "Date of Birth"], ["sex", "Gender"], ["phone", "Phone"],
  ["address", "Address"], ["qualification", "Qualification"],
  ["formNo", "Form Number"], ["admissionDate", "Admission Date"],
  ["course", "Course"], ["totalPaid", "Total Paid"], ["matchedPayments", "Payment Count"],
  ["paymentSourceCode", "Payment Student Code"], ["paymentAmount", "Single-row Payment Amount"],
  ["paymentMrNo", "Single-row Payment MR No"], ["paymentDate", "Single-row Payment Date"]
];
const PAYMENT_FIELDS = [
  ["sourceCode", "Student Code"], ["name", "Student Name"], ["amount", "Amount"],
  ["mrNo", "MR / Receipt Number"], ["date", "Payment Date"], ["course", "Course"]
];

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.detail || payload.error || "Request failed.");
    error.payload = payload;
    throw error;
  }
  return payload;
}

export default function UniversalWorkbookImport() {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [preview, setPreview] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [commitResult, setCommitResult] = useState(null);
  const [status, setStatus] = useState(null);

  const sheetOptions = useMemo(() => analysis?.metadata?.sheets || [], [analysis]);
  const updateMapping = (section, field, value) => {
    setMapping(current => ({ ...current, [section]: { ...(current?.[section] || {}), [field]: value || null } }));
  };

  async function analyzeWorkbook() {
    if (!file) return setError("Choose an Excel or CSV workbook first.");
    setBusy("analyze"); setError(""); setAnalysis(null); setPreview(null); setCommitResult(null); setStatus(null);
    try {
      const form = new FormData(); form.append("file", file);
      const result = await readJson(await fetch("/api/students/import/analyze", { method: "POST", body: form }));
      setAnalysis(result);
      setMapping(result.blueprint);
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function createPreview() {
    if (!file || !mapping?.studentSheet) return setError("Analyze the workbook and review the sheet mapping first.");
    setBusy("preview"); setError(""); setPreview(null); setCommitResult(null); setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mapping", JSON.stringify(mapping));
      const result = await readJson(await fetch("/api/students/import/preview", { method: "POST", body: form }));
      setPreview(result);
      setDecisions({});
      setStatus({ status: "PREVIEW_READY", pendingGroups: result.stagedGroups, totalGroups: result.stagedGroups });
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function refreshStatus() {
    if (!preview?.importBatchId) return;
    setBusy("status"); setError("");
    try {
      const result = await readJson(await fetch("/api/students/import/status?importBatchId=" + encodeURIComponent(preview.importBatchId)));
      setStatus(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function commitNextChunk() {
    if (!preview?.importBatchId) return;
    setBusy("commit"); setError(""); setCommitResult(null);
    try {
      const decisionRows = Object.entries(decisions).map(([sequence, value]) => ({ sequence: Number(sequence), ...value }));
      const result = await readJson(await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importBatchId: preview.importBatchId, chunkSize: 50, decisions: decisionRows })
      }));
      setCommitResult(result);
      setStatus(current => ({ ...(current || {}), status: result.status, pendingGroups: result.pendingGroups, committedGroups: (current?.committedGroups || 0) + result.processed }));
    } catch (err) {
      setError(err.message);
      if (err.payload?.requiresDecision) setCommitResult({ requiresDecision: err.payload.requiresDecision });
      else {
        try {
          const result = await readJson(await fetch("/api/students/import/status?importBatchId=" + encodeURIComponent(preview.importBatchId)));
          setStatus(result);
        } catch {}
      }
    } finally { setBusy(""); }
  }

  function setDecision(sequence, decision, masterId = "") {
    setDecisions(current => ({ ...current, [sequence]: { decision, ...(masterId ? { masterId } : {}) } }));
  }

  const conflicts = [...(preview?.conflicts || []), ...(commitResult?.requiresDecision || []).filter(item => !(preview?.conflicts || []).some(existing => existing.sequence === item.sequence))];
  const done = status?.status === "COMPLETED";

  return (
    <section style={{ margin: "18px 0 24px", padding: 20, border: "1px solid var(--border,#dce2eb)", borderRadius: 16, background: "var(--surface,#fff)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, background: "var(--primary-soft,#eef2ff)", color: "var(--primary,#4f46e5)" }}><FileSpreadsheet size={21}/></span>
        <div><h2 style={{ margin: 0, fontSize: 19 }}>Universal Student Workbook Import</h2><p style={{ margin: "4px 0 0", color: "var(--text-muted,#687386)", fontSize: 13 }}>AI-assisted mapping · dry-run preview · conflict review · resumable 50-record commits</p></div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 16 }}>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={event => { setFile(event.target.files?.[0] || null); setAnalysis(null); setMapping(null); setPreview(null); setError(""); }} />
        <button type="button" className="primary-btn" disabled={!file || Boolean(busy)} onClick={analyzeWorkbook}>{busy === "analyze" ? <Loader2 size={15}/> : <Upload size={15}/>} Analyze workbook</button>
        {file && <span style={{ fontSize: 12, color: "var(--text-muted,#687386)" }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
      </div>

      {analysis && mapping && <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "var(--surface-muted,#f7f8fb)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div><strong>Review detected workbook layout</strong><div style={{ fontSize: 12, color: "var(--text-muted,#687386)" }}>Analyzer: {analysis.provider}{analysis.fallbackReason ? " · " + analysis.fallbackReason : ""} · Layout: {mapping.layoutType}</div></div>
          <span style={{ fontSize: 12, fontWeight: 700 }}>{sheetOptions.length} sheet(s) detected</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>Student worksheet
            <select value={mapping.studentSheet || ""} onChange={event => setMapping(current => ({ ...current, studentSheet: event.target.value }))}>
              {sheetOptions.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700 }}>Separate payment worksheet (optional)
            <select value={mapping.paymentSheet || ""} onChange={event => setMapping(current => ({ ...current, paymentSheet: event.target.value || null }))}>
              <option value="">No separate payment sheet</option>
              {sheetOptions.filter(sheet => sheet.name !== mapping.studentSheet).map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}
            </select>
          </label>
        </div>
        <h4 style={{ margin: "16px 0 8px" }}>Student column mapping</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          {STUDENT_FIELDS.map(([field, label]) => <label key={field} style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 700 }}>{label}
            <select value={mapping.columns?.[field] || ""} onChange={event => updateMapping("columns", field, event.target.value)}>
              <option value="">— Not mapped —</option>
              {(sheetOptions.find(sheet => sheet.name === mapping.studentSheet)?.headers || []).map((header, index) => <option key={index + ":" + header} value={header}>{header || "(blank header " + (index + 1) + ")"}</option>)}
            </select>
          </label>)}
        </div>
        {mapping.paymentSheet && <><h4 style={{ margin: "16px 0 8px" }}>Payment column mapping</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            {PAYMENT_FIELDS.map(([field, label]) => <label key={field} style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 700 }}>{label}
              <select value={mapping.paymentColumns?.[field] || ""} onChange={event => updateMapping("paymentColumns", field, event.target.value)}>
                <option value="">— Not mapped —</option>
                {(sheetOptions.find(sheet => sheet.name === mapping.paymentSheet)?.headers || []).map((header, index) => <option key={index + ":" + header} value={header}>{header || "(blank header " + (index + 1) + ")"}</option>)}
              </select>
            </label>)}
          </div>
        </>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" className="primary-btn" disabled={Boolean(busy)} onClick={createPreview}>{busy === "preview" ? <Loader2 size={15}/> : <CheckCircle2 size={15}/>} Generate safe preview</button>
        </div>
      </div>}

      {preview && <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <strong>Dry-run results · Batch {preview.importBatchId}</strong>
          <span style={{ fontSize: 12, color: "var(--text-muted,#687386)" }}>No Student, Enrollment or Payment records have been changed yet.</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginTop: 10 }}>
          {[
            ["Workbook rows", preview.summary?.totalRows], ["Unique student groups", preview.summary?.totalGroups],
            ["Existing profiles", preview.summary?.existingStudentsToUpdate], ["New profiles", preview.summary?.newStudents],
            ["Payments to add", preview.summary?.newPaymentsToAdd], ["Duplicate payments", preview.summary?.duplicatePaymentsSkipped],
            ["Payment rows needing review", preview.summary?.paymentRowsNeedingReview],
            ["Conflicts / review", preview.summary?.conflicts], ["Warnings", preview.summary?.warnings]
          ].map(([label, value]) => <div key={label} style={{ padding: 12, border: "1px solid var(--border,#e2e6ed)", borderRadius: 10 }}><small style={{ color: "var(--text-muted,#687386)" }}>{label}</small><strong style={{ display: "block", fontSize: 20 }}>{Number(value || 0).toLocaleString("en-IN")}</strong></div>)}
        </div>
        {conflicts.length > 0 && <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}><AlertTriangle size={15} style={{ verticalAlign: "middle" }}/> Review required ({conflicts.length} shown)</h4>
          <div style={{ display: "grid", gap: 8 }}>
            {conflicts.map(item => <div key={item.sequence} style={{ padding: 12, border: "1px solid var(--border,#e2e6ed)", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>Row group #{item.sequence + 1} · {item.student?.name || "Unnamed student"}</strong><small>{item.action}</small></div>
              <div style={{ fontSize: 12, color: "var(--text-muted,#687386)", margin: "5px 0" }}>Codes: {(item.student?.codes || []).join(", ") || "None"} · {(item.warnings || []).join(" ")}</div>
              {(item.conflicts || []).map((conflict, index) => <div key={index} style={{ fontSize: 12, marginBottom: 3 }}>Possible match: {conflict.existingName || conflict.studentId} · {conflict.studentId}</div>)}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <select value={decisions[item.sequence]?.decision || ""} onChange={event => setDecision(item.sequence, event.target.value)} style={{ minWidth: 190 }}>
                  <option value="">Choose action…</option>
                  <option value="CREATE_NEW">Create as new profile</option>
                  <option value="SKIP">Skip this group</option>
                  {(item.conflicts || []).length > 0 && <option value="LINK_EXISTING">Link to selected existing profile</option>}
                </select>
                {decisions[item.sequence]?.decision === "LINK_EXISTING" && <select value={decisions[item.sequence]?.masterId || ""} onChange={event => setDecision(item.sequence, "LINK_EXISTING", event.target.value)}>
                  <option value="">Select existing profile…</option>
                  {(item.conflicts || []).map((conflict, index) => <option key={conflict.studentId || index} value={conflict.studentId}>{conflict.existingName || conflict.studentId}</option>)}
                </select>}
              </div>
            </div>)}
          </div>
        </div>}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 16 }}>
          <button type="button" className="primary-btn" disabled={Boolean(busy) || done} onClick={commitNextChunk}><Play size={15}/> Commit next 50 records</button>
          <button type="button" className="ghost-btn" disabled={Boolean(busy)} onClick={refreshStatus}><RefreshCw size={15}/> Refresh status</button>
          {status && <span style={{ fontSize: 12, fontWeight: 700 }}>{status.status} · {Number(status.committedGroups || 0).toLocaleString("en-IN")} committed · {Number(status.pendingGroups || 0).toLocaleString("en-IN")} pending</span>}
          {done && <span style={{ color: "var(--success,#15803d)", fontWeight: 700 }}><CheckCircle2 size={15} style={{ verticalAlign: "middle" }}/> Import completed</span>}
        </div>
        {commitResult && <p style={{ fontSize: 12, marginTop: 8 }}>Last commit: {commitResult.processed ?? 0} processed · {commitResult.pendingGroups ?? "—"} pending.</p>}
      </div>}

      {error && <div role="alert" style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "var(--danger-soft,#fff1f2)", color: "var(--danger,#be123c)", fontSize: 13 }}>{error}</div>}
      <p style={{ fontSize: 11, color: "var(--text-muted,#687386)", margin: "14px 0 0" }}>The preview writes only audit and staging records. Operational student, enrollment and payment records are written only after you explicitly commit. Commit runs in resumable chunks of up to 50 groups.</p>
    </section>
  );
}
