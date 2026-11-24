"use client";

import { useState } from "react";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, ImagePlus } from "lucide-react";
import * as XLSX from "xlsx";
import ERPLayout from "@/components/ERPLayout";
import BulkStudentPhotoUploadDialog from "@/components/students/BulkStudentPhotoUploadDialog";
import { useErpCache, useErpToast } from "@/components/providers/ERPUIProvider";

const clean = value => String(value ?? "").trim();
const headerKey = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeName = value => clean(value).normalize("NFKC").toUpperCase().replace(/\s+/g, " ").trim();
const normalizeFather = value => normalizeName(value).replace(/[^A-Z0-9 ]/g, " ").replace(/\bKR\b/g, "KUMAR").replace(/\bMD\b|\bMOHD\b/g, "MOHAMMAD").replace(/\bSK\b/g, "SHEIKH").replace(/\s+/g, " ").trim();

function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;
  let year, month, day;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    year = value.getUTCFullYear(); month = value.getUTCMonth() + 1; day = value.getUTCDate();
  } else if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    ({ y: year, m: month, d: day } = parsed);
  } else {
    const raw = clean(value).split(/\r?\n/)[0];
    let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
    else {
      match = raw.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
      if (match) {
        const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
        day = Number(match[1]); month = months.indexOf(match[2].toUpperCase()) + 1; year = Number(match[3]);
      } else {
        match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
        if (!match) return null;
        day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
      }
      if (year < 100) year += year < 50 ? 2000 : 1900;
    }
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return date.toISOString();
}

function parseIdentity(rawName, fallbackCode) {
  const firstLine = clean(rawName).split(/\r?\n/)[0].replace(/\s+/g, " ").trim().toUpperCase();
  const splitAt = firstLine.lastIndexOf("_");
  let name = splitAt > 0 ? firstLine.slice(0, splitAt).replace(/\s+/g, " ").trim() : firstLine;
  let code = splitAt > 0 ? firstLine.slice(splitAt + 1).trim() : "";
  if (!code) code = clean(fallbackCode).split(/\r?\n/)[0].replace(/\.0+$/, "").replace(/[^A-Za-z0-9-]/g, "").trim().toUpperCase();
  code = code.replace(/\.0+$/, "");
  if (!name || !code) return { cleanName: name, stCode: code, registrationId: "" };
  return { cleanName: name, stCode: code, registrationId: name + "_" + code };
}

function phonesFrom(value) {
  return [...new Set(clean(value).split(/[,/;|\s]+/).map(part => part.replace(/\D/g, "")).filter(part => part.length === 10))];
}

function findSheet(workbook, kind) {
  for (const name of workbook.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: true });
    const index = grid.findIndex(row => {
      const keys = row.map(headerKey);
      if (kind === "student") return ["stcode","stname","doa","course"].every(key => keys.includes(key));
      return ["amtpaid","mrno","dop","stname"].every(key => keys.includes(key));
    });
    if (index >= 0) return { name, grid, headerIndex: index };
  }
  return null;
}

function buildWorkbookPayload(workbook) {
  const studentSheet = findSheet(workbook, "student");
  const feeSheet = findSheet(workbook, "fee");
  if (!studentSheet || !feeSheet || studentSheet.name === feeSheet.name) {
    throw new Error("Workbook must contain a Student Data sheet and a separate Fee sheet with Amt_Paid, MR_No and D_O_P.");
  }
  const studentHeaders = studentSheet.grid[studentSheet.headerIndex].map(headerKey);
  const studentAt = key => studentHeaders.indexOf(key);
  const studentGet = (row, key) => studentAt(key) >= 0 ? row[studentAt(key)] : "";
  const registrations = new Map();
  const studentWarnings = [];
  for (let index = studentSheet.headerIndex + 1; index < studentSheet.grid.length; index += 1) {
    const row = studentSheet.grid[index];
    if (!row.some(value => clean(value))) continue;
    const identity = parseIdentity(studentGet(row, "stname"), studentGet(row, "stcode"));
    if (!identity.registrationId) {
      studentWarnings.push({ sheet: studentSheet.name, row: index + 1, studentId: studentGet(row, "stcode"), reason: "Student row has no usable registration code or name suffix." });
      continue;
    }
    const record = {
      ...identity,
      course: clean(studentGet(row, "course")) || "Previous Course (Legacy)",
      dateOfAdmission: parseDate(studentGet(row, "doa")),
      formNo: clean(studentGet(row, "formno")).replace(/\.0+$/, ""),
      dob: parseDate(studentGet(row, "dob")),
      sex: clean(studentGet(row, "sex")).toUpperCase(),
      fatherName: clean(studentGet(row, "stfather")),
      address: clean(studentGet(row, "address")),
      phones: phonesFrom(studentGet(row, "phno")),
      qualification: clean(studentGet(row, "qualification")),
      rowNo: index + 1
    };
    const previous = registrations.get(identity.registrationId);
    if (!previous) registrations.set(identity.registrationId, record);
    else {
      previous.phones = [...new Set([...previous.phones, ...record.phones])];
      for (const key of ["course","dateOfAdmission","formNo","dob","sex","fatherName","address","qualification"]) if (!previous[key] && record[key]) previous[key] = record[key];
    }
  }

  const byName = new Map();
  for (const record of registrations.values()) byName.set(record.cleanName, [...(byName.get(record.cleanName) || []), record]);
  const parent = new Map([...registrations.keys()].map(key => [key, key]));
  const find = key => { let root = key; while (parent.get(root) !== root) root = parent.get(root); while (parent.get(key) !== key) { const next = parent.get(key); parent.set(key, root); key = next; } return root; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const list of byName.values()) {
    for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i], b = list[j];
      const overlap = a.phones.some(phone => b.phones.includes(phone));
      const dobMatch = Boolean(a.dob && b.dob && a.dob.slice(0,10) === b.dob.slice(0,10));
      const fatherMatch = Boolean(normalizeFather(a.fatherName) && normalizeFather(a.fatherName) === normalizeFather(b.fatherName));
      if (overlap || dobMatch || fatherMatch) union(a.registrationId, b.registrationId);
    }
  }
  const grouped = new Map();
  for (const record of registrations.values()) {
    const root = find(record.registrationId);
    grouped.set(root, [...(grouped.get(root) || []), record]);
  }
  const profiles = [...grouped.values()].map(items => {
    items.sort((a,b) => new Date(b.dateOfAdmission || 0) - new Date(a.dateOfAdmission || 0));
    const latest = items[0];
    return {
      cleanName: latest.cleanName,
      dob: items.find(item => item.dob)?.dob || null,
      fatherName: items.find(item => item.fatherName)?.fatherName || "",
      phones: [...new Set(items.flatMap(item => item.phones))],
      registrations: items.map(item => ({ ...item, isCurrent: item.registrationId === latest.registrationId }))
    };
  });

  const feeHeaders = feeSheet.grid[feeSheet.headerIndex].map(headerKey);
  const feeAt = key => feeHeaders.indexOf(key);
  const feeGet = (row, key) => feeAt(key) >= 0 ? row[feeAt(key)] : "";
  const profileByName = new Map();
  for (const profile of profiles) profileByName.set(profile.cleanName, [...(profileByName.get(profile.cleanName) || []), profile]);
  const registrationById = new Map();
  const registrationByCode = new Map();
  for (const profile of profiles) for (const registration of profile.registrations) {
    registrationById.set(registration.registrationId, registration);
    registrationByCode.set(registration.stCode, [...(registrationByCode.get(registration.stCode) || []), registration]);
  }
  const feeRows = [];
  const feeWarnings = [];
  for (let index = feeSheet.headerIndex + 1; index < feeSheet.grid.length; index += 1) {
    const row = feeSheet.grid[index];
    if (!row.some(value => clean(value))) continue;
    const identity = parseIdentity(feeGet(row, "stname"), feeGet(row, "stcode"));
    if (!identity.cleanName || !identity.stCode) {
      feeWarnings.push({ sheet: feeSheet.name, row: index + 1, studentId: clean(feeGet(row,"stcode")), reason: "Fee row has no valid name/code identity." });
      continue;
    }
    let registrationId = identity.registrationId;
    let registration = registrationById.get(registrationId);
    if (!registration && (registrationByCode.get(identity.stCode) || []).length === 1) {
      registration = registrationByCode.get(identity.stCode)[0];
      registrationId = registration.registrationId;
    }
    if (!registration) {
      const nameMatches = profileByName.get(identity.cleanName) || [];
      if (nameMatches.length === 1) {
        const legacy = {
          ...identity, course: "Previous Course (Legacy)", dateOfAdmission: null,
          earliestPaymentDate: parseDate(feeGet(row,"dop")), formNo: "", dob: null,
          sex: "", fatherName: "", address: "", phones: [], qualification: ""
        };
        const profile = nameMatches[0];
        profile.registrations.push(legacy);
        registration = legacy;
        registrationId = legacy.registrationId;
        registrationById.set(registrationId, registration);
      } else {
        feeWarnings.push({ sheet: feeSheet.name, row: index + 1, studentId: identity.registrationId, reason: nameMatches.length > 1 ? "Legacy registration name is ambiguous across multiple student profiles." : "Fee registration does not match Student Data." });
        continue;
      }
    }
    const paymentDate = parseDate(feeGet(row, "dop"));
    const amountPaid = Number(clean(feeGet(row, "amtpaid")).replace(/[₹,\s]/g, ""));
    const mrNo = clean(feeGet(row, "mrno")).replace(/\.0+$/, "");
    if (!paymentDate || !mrNo || !Number.isFinite(amountPaid) || amountPaid < 0) {
      feeWarnings.push({ sheet: feeSheet.name, row: index + 1, studentId: registrationId, reason: "Receipt number, date, or amount is invalid." });
      continue;
    }
    if (!registration.course || registration.course === "Previous Course (Legacy)") registration.course = "Previous Course (Legacy)";
    feeRows.push({ registrationId, stCode: identity.stCode, cleanName: identity.cleanName, course: registration.course, paymentDate, amountPaid, mrNo, sourceSheet: feeSheet.name, rowNo: index + 1 });
    if (registration.course === "Previous Course (Legacy)" && !registration.earliestPaymentDate) registration.earliestPaymentDate = paymentDate;
  }
  for (const profile of profiles) {
    const seen = new Set();
    profile.registrations = profile.registrations.filter(item => {
      if (seen.has(item.registrationId)) return false;
      seen.add(item.registrationId); return true;
    }).sort((a,b) => new Date(b.dateOfAdmission || b.earliestPaymentDate || 0) - new Date(a.dateOfAdmission || a.earliestPaymentDate || 0));
    profile.registrations.forEach((item,index) => { item.isCurrent = index === 0; });
  }
  return { studentSheetName: studentSheet.name, feeSheetName: feeSheet.name, studentRows: registrations.size, profiles, feeRows, warnings: [...studentWarnings, ...feeWarnings] };
}

async function postBatch(body) {
  const response = await fetch("/api/students/unified-import", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || data.error || "Import batch failed.");
  return data;
}

export default function BulkImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [progress, setProgress] = useState({ stage: "Idle", percent: 0, done: 0, total: 0 });
  const notify = useErpToast();
  const { invalidate } = useErpCache();

  async function parseSelectedWorkbook(selectedFile) {
    if (!selectedFile) return;
    setError(""); setResult(null); setPreview(null);
    setProgress({ stage: "Parsing Excel", percent: 2, done: 0, total: 0 });
    try {
      const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: "array", cellDates: true });
      const payload = buildWorkbookPayload(workbook);
      setPreview({
        ...payload,
        profileCount: payload.profiles.length,
        legacyRegistrations: payload.profiles.reduce((sum, profile) => sum + profile.registrations.filter(item => item.course === "Previous Course (Legacy)").length, 0)
      });
      setProgress({ stage: "Ready to import", percent: 10, done: 0, total: 0 });
    } catch (err) {
      setError(err.message || "Unable to parse workbook.");
      setProgress({ stage: "Error", percent: 0, done: 0, total: 0 });
    }
  }

  async function runImport() {
    if (!preview || busy) return;
    if (!window.confirm("Import " + preview.profileCount.toLocaleString("en-IN") + " unified student profiles and " + preview.feeRows.length.toLocaleString("en-IN") + " fee receipts? Existing photos, ID cards and populated profile fields will be preserved.")) return;
    setBusy(true); setError(""); setResult(null);
    const summary = { studentsMatchedUpdated: 0, newStudentsCreated: 0, registrationsLinked: 0, newReceiptsAdded: 0, existingReceiptsUpdatedOrSkipped: 0, unmatchedRows: [...preview.warnings] };
    try {
      const studentBatches = [];
      for (let i = 0; i < preview.profiles.length; i += 500) studentBatches.push(preview.profiles.slice(i, i + 500));
      setProgress({ stage: "Syncing Students", percent: 10, done: 0, total: studentBatches.length });
      for (let index = 0; index < studentBatches.length; index += 1) {
        const data = await postBatch({ action: "students", groups: studentBatches[index] });
        summary.studentsMatchedUpdated += Number(data.studentsMatchedUpdated || 0);
        summary.newStudentsCreated += Number(data.newStudentsCreated || 0);
        summary.registrationsLinked += Number(data.registrationsLinked || 0);
        summary.unmatchedRows.push(...(data.flaggedRows || []));
        setProgress({ stage: "Syncing Students", percent: 10 + Math.round(((index + 1) / studentBatches.length) * 45), done: index + 1, total: studentBatches.length });
      }
      const feeBatches = [];
      for (let i = 0; i < preview.feeRows.length; i += 1000) feeBatches.push(preview.feeRows.slice(i, i + 1000));
      setProgress({ stage: "Syncing Fees", percent: 55, done: 0, total: feeBatches.length });
      for (let index = 0; index < feeBatches.length; index += 1) {
        const data = await postBatch({ action: "fees", rows: feeBatches[index] });
        summary.newReceiptsAdded += Number(data.newReceiptsAdded || 0);
        summary.existingReceiptsUpdatedOrSkipped += Number(data.existingReceiptsUpdatedOrSkipped || 0);
        summary.unmatchedRows.push(...(data.unmatchedRows || []));
        setProgress({ stage: "Syncing Fees", percent: 55 + Math.round(((index + 1) / Math.max(1, feeBatches.length)) * 40), done: index + 1, total: feeBatches.length });
      }
      setProgress({ stage: "Complete", percent: 100, done: 1, total: 1 });
      setResult(summary);
      setPreview(null);
      notify("Unified student and fee import completed.", "success");
      invalidate(["lookup:", "students:", "student-detail:", "student-fees:", "dashboard-stats", "batches:"]);
    } catch (err) {
      setError(err.message || "The import stopped before completion. Re-upload is safe; already written batches will be skipped on retry.");
      notify(err.message || "Unified import failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  function downloadWarnings() {
    if (!result?.unmatchedRows?.length) return;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.unmatchedRows), "Review Rows");
    XLSX.writeFile(workbook, "RCLD_Unmapped_Import_Rows.xlsx");
  }

  return (
    <ERPLayout active="/dashboard/students">
      <header className="topbar">
        <div><div className="crumb">Students / Bulk Import</div><h1>Bulk Import & Photos</h1></div>
        <a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={16}/> Back to Students</a>
      </header>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><div><h3>1. Bulk Import — Unified Excel Upload</h3><p>Upload one .xlsx workbook with Student Data and Fee sheets. Students, course registrations and receipts are synced in batches.</p></div><FileSpreadsheet size={22}/></div>
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          <label className="form-field"><span>Admission + Fee workbook (.xlsx)</span><input type="file" accept=".xlsx" disabled={busy} onChange={event => { const selected = event.target.files?.[0] || null; setFile(selected); parseSelectedWorkbook(selected); }}/></label>
          {file && <div className="form-help">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
          {preview && <div className="student-summary-grid">
            <div className="summary-card"><span>Student Data rows</span><strong>{preview.studentRows.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Unified profiles</span><strong>{preview.profileCount.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Registration codes</span><strong>{preview.profiles.reduce((sum, item) => sum + item.registrations.length, 0).toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Fee receipts</span><strong>{preview.feeRows.length.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Legacy registrations</span><strong>{preview.legacyRegistrations.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Rows flagged</span><strong>{preview.warnings.length.toLocaleString("en-IN")}</strong></div>
          </div>}
          {preview && <div className="form-help"><b>Detected:</b> {preview.studentSheetName} (Student Data) · {preview.feeSheetName} (Fee Sheet). Name suffixes drive registration identity; the corrupted fee St_Code / St_Name_cr columns are not trusted when St_Name contains a code.</div>}
          {progress.stage !== "Idle" && <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{progress.stage}</strong><b>{progress.percent}%</b></div>
            <div style={{ height: 10, borderRadius: 99, background: "var(--border,#e5e7eb)", overflow: "hidden" }}><div style={{ height: "100%", width: progress.percent + "%", background: "var(--primary,#315efb)", transition: "width .2s ease" }}/></div>
            {progress.total > 0 && <small className="form-help">Batch {progress.done} of {progress.total}</small>}
          </div>}
          {error && <div className="error-msg" role="alert">{error}</div>}
          <div><button className="primary-btn" type="button" disabled={!preview || busy} onClick={runImport}><Upload size={16}/>{busy ? "Import running…" : "Import Students + Fees"}</button></div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><div><h3>2. Bulk Photo Upload</h3><p>Upload student photos using registration-code filenames. Existing Cloudinary photo mapping remains unchanged.</p></div><ImagePlus size={22}/></div>
        <div style={{ padding: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p className="form-help" style={{ margin: 0 }}>Supports JPG, JPEG, PNG and WebP files or an entire photo folder.</p>
          <button className="ghost-btn" type="button" onClick={() => setPhotoDialogOpen(true)}><ImagePlus size={16}/> Open Bulk Photo Upload</button>
        </div>
      </section>

      {result && <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><div><h3>Import Summary</h3><p>Completed in resumable student and fee batches. Existing receipts were not duplicated.</p></div><CheckCircle2 size={22}/></div>
        <div className="student-summary-grid" style={{ padding: 20 }}>
          <div className="summary-card"><span>Students Matched / Updated</span><strong>{result.studentsMatchedUpdated}</strong></div>
          <div className="summary-card"><span>New Students Created</span><strong>{result.newStudentsCreated}</strong></div>
          <div className="summary-card"><span>Registrations Linked</span><strong>{result.registrationsLinked}</strong></div>
          <div className="summary-card"><span>New Fee Receipts Added</span><strong>{result.newReceiptsAdded}</strong></div>
          <div className="summary-card"><span>Existing Receipts Updated / Skipped</span><strong>{result.existingReceiptsUpdatedOrSkipped}</strong></div>
          <div className="summary-card"><span>Rows Requiring Review</span><strong>{result.unmatchedRows.length}</strong></div>
        </div>
        {result.unmatchedRows.length > 0 && <div style={{ padding: "0 20px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><AlertTriangle size={16}/><span>{result.unmatchedRows.length} rows need manual review.</span><button className="ghost-btn" type="button" onClick={downloadWarnings}><Download size={15}/> Download flagged rows</button></div>}
      </section>}

      <BulkStudentPhotoUploadDialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} onComplete={() => invalidate(["students:", "student-detail:"])} />
    </ERPLayout>
  );
}
