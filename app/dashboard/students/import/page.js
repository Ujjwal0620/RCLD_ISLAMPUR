"use client";

import { useState } from "react";
import { ArrowLeft, Download, Upload, FileSpreadsheet, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import * as XLSX from "xlsx";

const templateHeaders = ["DOI", "Regn_No", "STUDENT NAME", "Sex", "FATHER NAME", "Ph_no", "Course"];
const templateRow = ["17-11-2026", "21693", "SOUPTIK DUTTA_21693", "M", "FATHER NAME", "7001559440,6297675145", "SM-I"];

function downloadTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders, templateRow]);
  worksheet["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 26 }, { wch: 26 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "St List");
  XLSX.writeFile(workbook, "RCLD_Student_Import_Template.xlsx");
}

async function sendFile(file, mode, importMode = "fill_and_import", sheetName = "") {
  const form = new FormData();
  form.append("file", file);
  form.append("mode", mode);
  form.append("importMode", importMode);
  if (sheetName) form.append("sheetName", sheetName);
  const response = await fetch("/api/students/bulk-import", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.error || "Student import request failed.");
  return data;
}

export default function BulkImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importMode, setImportMode] = useState("fill_and_import");
  const [sheetName, setSheetName] = useState("");
  const [error, setError] = useState("");

  async function createPreview(selectedFile, selectedSheet = sheetName) {
    if (!selectedFile) return;
    setPreviewing(true);
    setError("");
    setResult(null);
    try {
      const data = await sendFile(selectedFile, "preview", importMode, selectedSheet);
      setPreview(data);
      setSheetName(data.sheetName || "");
    } catch (err) {
      setError(err.message || "Unable to preview this spreadsheet.");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function importStudents() {
    if (!file || !preview?.validRows) return;
    const verb = importMode === "update_existing_only"
      ? "update matching existing students only and skip new students"
      : "fill missing fields on existing students and create new students";
    if (!window.confirm("Process " + preview.validRows.toLocaleString("en-IN") + " valid rows from " + preview.sheetName + " and " + verb + "?")) return;
    setBusy(true);
    setError("");
    try {
      const data = await sendFile(file, "import", importMode, sheetName);
      setResult(data);
      setPreview(null);
    } catch (err) {
      setError(err.message || "Unable to import students.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ERPLayout active="/dashboard/students">
      <header className="topbar">
        <div><div className="crumb">Students / Bulk Import</div><h1>Bulk Student Import</h1></div>
        <a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={16} /> Back</a>
      </header>

      <section className="welcome">
        <div>
          <span className="eyebrow">RCLD ADMISSION WORKBOOK</span>
          <h2>Import student records from Excel or CSV</h2>
          <p>Detects student-data worksheets automatically. Payment-receipt sheets are excluded from this student import. Existing student records are enriched only where fields are missing.</p>
        </div>
        <button className="ghost-btn" type="button" onClick={downloadTemplate}><Download size={16} /> Download Template</button>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><h3>1. Select workbook</h3><p>Supports .xlsx, .xls and .csv files up to 15 MB. Preview starts automatically after file selection.</p></div>
          <FileSpreadsheet size={22} />
        </div>
        <div style={{ padding: 24 }}>
          <label className="form-field">
            <span>Student admission file</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={event => {
              const selected = event.target.files?.[0] || null;
              setFile(selected); setPreview(null); setResult(null); setError(""); setSheetName("");
              if (selected) createPreview(selected, "");
            }} />
          </label>
          {file && <p className="form-help" style={{ margin: "10px 0 16px" }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
          {preview?.availableSheets?.length > 1 && (
            <label className="form-field" style={{ marginTop: 18, maxWidth: 420 }}>
              <span>Student worksheet</span>
              <select value={sheetName} onChange={event => { setSheetName(event.target.value); createPreview(file, event.target.value); }}>
                {preview.availableSheets.map(name => <option key={name} value={name} disabled={!preview.studentSheets?.includes(name)}>{name}{preview.studentSheets?.includes(name) ? "" : " (payment / non-student sheet)"}</option>)}
              </select>
              <small className="form-help">Choose a student-compatible worksheet. Payment-only sheets are shown but disabled for student import.</small>
            </label>
          )}
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <strong>Import mode</strong>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="radio" name="importMode" checked={importMode === "fill_and_import"} onChange={() => setImportMode("fill_and_import")} />
              <span><b>Fill Missing Fields on Existing + Import New</b><br /><small className="form-help">Default. Preserve populated student details, photos and ID numbers; create students not already found.</small></span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="radio" name="importMode" checked={importMode === "update_existing_only"} onChange={() => setImportMode("update_existing_only")} />
              <span><b>Only Update Existing Students (Skip New)</b><br /><small className="form-help">Enrich matching records only. New registration numbers are counted as skipped.</small></span>
            </label>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <button className="primary-btn" type="button" disabled={!file || previewing || busy} onClick={() => createPreview(file, sheetName)}>
                <Eye size={16} /> {previewing ? "Reading file…" : "Refresh Preview"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {preview && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div><h3>2. Review cleaned student records</h3><p>{preview.message} · Sheet: {preview.sheetName}</p></div>
            <CheckCircle2 size={22} />
          </div>
          <div style={{ padding: 20 }}>
            <div className="student-summary-grid" style={{ marginBottom: 18 }}>
              <div className="summary-card"><span>Total rows</span><strong>{preview.totalRows?.toLocaleString("en-IN")}</strong></div>
              <div className="summary-card"><span>Ready</span><strong>{preview.validRows?.toLocaleString("en-IN")}</strong></div>
              <div className="summary-card"><span>Rows needing correction</span><strong>{preview.invalidRows?.toLocaleString("en-IN")}</strong></div>
            </div>
            {preview.errors?.length > 0 && (
              <div className="error-msg" style={{ marginBottom: 14 }}>
                {preview.errors.slice(0, 30).map((item, index) => <div key={item.row + "-" + index}>Excel row {item.row} · Regn_No {item.Regn_No || "—"}: {item.reason}</div>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
              <AlertTriangle size={16} />
              <strong>{preview.warnings?.length || 0} non-blocking warnings</strong>
              <span className="form-help">Missing phone/father name, normalized gender, invalid secondary phone, or missing DOI are retained as warnings.</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Regn_No</th><th>Student Name</th><th>DOI</th><th>Sex</th><th>Father Name</th><th>Primary Phone</th><th>Secondary Phone</th><th>Course</th><th>Warnings</th></tr></thead>
                <tbody>
                  {preview.previewRows?.map((row, index) => (
                    <tr key={row.regnNo + "-" + row.rowNo + "-" + index}>
                      <td>{row.regnNo || "—"}</td><td>{row.name || "—"}</td><td>{row.admissionDate || "—"}</td>
                      <td>{row.gender || "—"}</td><td>{row.fatherName || "—"}</td>
                      <td>{row.phone || "—"}</td><td>{row.secondaryPhone || "—"}</td><td>{row.course || "—"}</td>
                      <td>{row.warnings?.length ? row.warnings.map((warning, i) => <div key={i} style={{ color: "#b7791f", fontSize: 12 }}>{warning}</div>) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.totalRows > 100 && <p className="form-help" style={{ marginTop: 10 }}>Showing first 100 rows. All {preview.totalRows.toLocaleString("en-IN")} rows are included in the import.</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button className="primary-btn" type="button" disabled={!preview.validRows || busy || previewing} onClick={importStudents}>
                <Upload size={16} /> {busy ? "Importing…" : "Import " + preview.validRows.toLocaleString("en-IN") + " Students"}
              </button>
            </div>
          </div>
        </section>
      )}

      {error && <div className="error-msg" role="alert" style={{ marginTop: 18 }}>{error}</div>}
      {result && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head"><div><h3>Import summary</h3><p>{result.message}</p></div><CheckCircle2 size={22} /></div>
          <div style={{ padding: 20 }}>
            <div className="student-summary-grid">
              <div className="summary-card"><span>Existing Students Enriched (missing fields filled)</span><strong>{result.existingStudentsEnriched ?? 0}</strong></div>
              <div className="summary-card"><span>Existing Students Unchanged (already complete)</span><strong>{result.existingStudentsUnchanged ?? 0}</strong></div>
              {result.importMode === "update_existing_only" ? (
                <div className="summary-card"><span>Skipped New Students</span><strong>{result.skippedNew ?? 0}</strong></div>
              ) : (
                <div className="summary-card"><span>New Students Created</span><strong>{result.newStudentsCreated ?? 0}</strong></div>
              )}
              <div className="summary-card"><span>Warnings / Duplicate IDs Flagged</span><strong>{result.warningCount ?? result.warnings?.length ?? 0}</strong></div>
            </div>
            {result.warnings?.length > 0 && <details style={{ marginTop: 18 }} open><summary><b>Warnings / Duplicate IDs Flagged ({result.warningCount ?? result.warnings.length})</b></summary><div className="form-help" style={{ marginTop: 10 }}>{result.warnings.map((item, index) => <div key={index}>Row {item.row ?? "—"} · Regn_No {item.Regn_No || "—"}: {item.reason}</div>)}</div><button className="ghost-btn" type="button" onClick={() => { const ws = XLSX.utils.json_to_sheet(result.warnings); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Import Warnings"); XLSX.writeFile(wb, "RCLD_Student_Import_Warnings.xlsx"); }}><Download size={15} /> Download warning details</button></details>}
            {result.errors?.length > 0 && <><h4 style={{ marginTop: 18 }}>Row errors ({result.errors.length})</h4><div className="error-msg">{result.errors.slice(0, 100).map((item, index) => <div key={index}>Row {item.row ?? "—"} · Regn_No {item.Regn_No || "—"}: {item.reason}</div>)}</div></>}
            <p className="form-help" style={{ marginTop: 14 }}>Student rows are saved independently. Review any warnings or row errors before using the imported records.</p>
            <a className="primary-btn" href="/dashboard/students">Open Student Directory</a>
          </div>
        </section>
      )}
    </ERPLayout>
  );
}
