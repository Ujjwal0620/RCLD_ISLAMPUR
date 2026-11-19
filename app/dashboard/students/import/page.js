"use client";

import { useState } from "react";
import { ArrowLeft, Download, Upload, FileSpreadsheet, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import * as XLSX from "xlsx";

const headers = [
  "St_Code", "St_Name", "D.O.B", "Sex", "St_father", "Address",
  "Ph_No", "Qualification", "Form_no", "D.O.A", "Course"
];

function downloadTemplate() {
  const sample = [
    "21919",
    "RAJDEEP DEY",
    "03-07-2017",
    "M",
    "LITAN DEY",
    "VILL. SHIBDANGIPARA\nPO. +PS. ISLAMPUR\nDIST. U/D\nPINNO. 733202",
    "9564896071,7001263275",
    "IV",
    "101463",
    "17-11-2026",
    "SM-I"
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([headers, sample]);
  worksheet["!cols"] = [ { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 38 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 18 } ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Student Data");
  XLSX.writeFile(workbook, "RCLD_Student_Import_Template.xlsx");
}

async function sendFile(file, mode) {
  const form = new FormData();
  form.append("file", file);
  form.append("mode", mode);
  const response = await fetch("/api/students/bulk-import", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Student import request failed.");
  return data;
}

export default function BulkImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createPreview() {
    if (!file) return;
    setPreviewing(true);
    setError("");
    setResult(null);
    try {
      const data = await sendFile(file, "preview");
      setPreview(data);
    } catch (err) {
      setError(err.message || "Unable to preview this spreadsheet.");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function importStudents() {
    if (!file || !preview?.validRows) return;
    if (!window.confirm("Import " + preview.validRows.toLocaleString("en-IN") + " student records into the RCLD database? Existing matching records from this source will be updated, not duplicated.")) return;
    setBusy(true);
    setError("");
    try {
      const data = await sendFile(file, "import");
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
        <div>
          <div className="crumb">Students / Bulk Import</div>
          <h1>Bulk Student Import</h1>
        </div>
        <a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={16} /> Back</a>
      </header>

      <section className="welcome">
        <div>
          <span className="eyebrow">RCLD ADMISSION WORKBOOK</span>
          <h2>Import student records from your Excel sheet</h2>
          <p>Upload the workbook containing the <strong>Student Data</strong> sheet. Review the field mapping and missing values before importing. The payment-history worksheet is not imported as student records.</p>
        </div>
        <button className="ghost-btn" type="button" onClick={downloadTemplate}><Download size={16} /> Download Template</button>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>1. Select Excel workbook</h3>
            <p>Supports .xlsx and .xls files up to 15 MB. The Student Data worksheet is selected automatically.</p>
          </div>
          <FileSpreadsheet size={22} />
        </div>
        <div style={{ padding: 24 }}>
          <label className="form-field">
            <span>Student admission workbook</span>
            <input type="file" accept=".xlsx,.xls" onChange={event => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
              setResult(null);
              setError("");
            }} />
          </label>
          {file && <p className="form-help" style={{ margin: "10px 0 16px" }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
          <button className="primary-btn" type="button" disabled={!file || previewing || busy} onClick={createPreview}>
            <Eye size={16} /> {previewing ? "Reading workbook…" : "Preview Student Data"}
          </button>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-head">
          <div>
            <h3>2. Excel-to-ERP field mapping</h3>
            <p>Source columns are mapped into the existing RCLD student profile fields.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Excel column</th><th>Student profile field</th><th>Import handling</th></tr></thead>
            <tbody>
              <tr><td>St_Code</td><td>Registration No. (regnNo)</td><td>Kept as text; duplicate codes are allowed and reported.</td></tr>
              <tr><td>St_Name</td><td>Student name</td><td>Matching trailing _St_Code suffix is removed; original is retained.</td></tr>
              <tr><td>D.O.B / Sex</td><td>Date of birth / Gender</td><td>Blank or unrecognized values remain blank.</td></tr>
              <tr><td>St_father</td><td>Father name</td><td>Imported as supplied.</td></tr>
              <tr><td>Address — line 1</td><td>Village / Colony / Ward</td><td>Stored as present and permanent address.</td></tr>
              <tr><td>Address — line 2</td><td>Post Office / Police Station</td><td>PO and PS are split; a shared place name fills both.</td></tr>
              <tr><td>Address — remaining lines</td><td>District / PIN</td><td>District and six-digit PIN are extracted separately.</td></tr>
              <tr><td>Ph_No</td><td>Mobile / Guardian Mobile</td><td>First comma-separated number is mobile; second is guardian.</td></tr>
              <tr><td>Qualification</td><td>Source Qualification</td><td>Original value is retained in the profile.</td></tr>
              <tr><td>Form_no / D.O.A / Course</td><td>Form No. / Admission Date / Course</td><td>Course label is retained; known course prefixes are mapped.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {preview && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div>
              <h3>3. Review import preview</h3>
              <p>{preview.message}</p>
            </div>
            <CheckCircle2 size={22} />
          </div>
          <div style={{ padding: 20 }}>
            <div className="student-summary-grid" style={{ marginBottom: 18 }}>
              <div className="summary-card"><span>Total rows</span><strong>{preview.totalRows?.toLocaleString("en-IN")}</strong></div>
              <div className="summary-card"><span>Ready to import</span><strong>{preview.validRows?.toLocaleString("en-IN")}</strong></div>
              <div className="summary-card"><span>Rows with required errors</span><strong>{preview.invalidRows?.toLocaleString("en-IN")}</strong></div>
            </div>
            <h4>Missing optional information</h4>
            <div className="form-help" style={{ margin: "8px 0 18px" }}>
              DOB: {preview.missing?.dateOfBirth} · Gender: {preview.missing?.sex} · Father name: {preview.missing?.fatherName} · Address: {preview.missing?.address} · Phone: {preview.missing?.phone} · Form No.: {preview.missing?.formNo} · Qualification: {preview.missing?.qualification} · DOB outside expected range: {preview.missing?.dobOutsideExpectedRange} · DOB after admission: {preview.missing?.dobAfterAdmission} · Rows with non-10-digit phone values: {preview.missing?.phoneWithInvalidDigits}
            </div>
            {(preview.duplicateRegistrationCodes > 0 || preview.duplicateFormNumbers > 0 || preview.invalidRows > 0) && (
              <div className="form-help" style={{ padding: 12, borderRadius: 8, background: "rgba(217,119,6,.08)", marginBottom: 16 }}>
                <AlertTriangle size={15} style={{ display: "inline", verticalAlign: "middle" }} /> Duplicate registration-code groups: {preview.duplicateRegistrationCodes} · Duplicate form-number groups: {preview.duplicateFormNumbers}. Duplicate codes are retained as separate source records.
              </div>
            )}
            {preview.errors?.length > 0 && (
              <div className="error-msg" style={{ marginBottom: 16 }}>
                {preview.errors.map(item => <div key={item.row}>Excel row {item.row}: {item.errors.join(" ")}</div>)}
              </div>
            )}
            <h4>First 8 mapped records</h4>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead><tr><th>Registration No.</th><th>Student</th><th>DOB</th><th>PO / PS</th><th>Mobile / Guardian</th><th>Form No.</th><th>Admission</th><th>Course</th></tr></thead>
                <tbody>
                  {preview.sampleRows?.map((row, index) => (
                    <tr key={row.registrationNo + "-" + row.formNo + "-" + index}>
                      <td>{row.registrationNo}</td><td>{row.name}</td><td>{row.dob || "—"}</td>
                      <td>{row.postOffice || "—"} / {row.policeStation || "—"}<small style={{ display: "block" }}>{row.pin || "PIN missing"}</small></td>
                      <td>{row.mobile || "—"}<small style={{ display: "block" }}>{row.guardian || "Guardian missing"}</small></td>
                      <td>{row.formNo || "—"}</td><td>{row.admissionDate}</td><td>{row.course}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button className="primary-btn" type="button" disabled={!preview.validRows || busy} onClick={importStudents}>
                <Upload size={16} /> {busy ? "Importing students…" : "Import " + preview.validRows.toLocaleString("en-IN") + " Students"}
              </button>
            </div>
          </div>
        </section>
      )}

      {error && <div className="error-msg" role="alert" style={{ marginTop: 18 }}>{error}</div>}
      {result && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head"><div><h3>Import completed</h3><p>{result.message}</p></div><CheckCircle2 size={22} /></div>
          <div style={{ padding: 20 }}>
            <p><strong>{result.imported?.toLocaleString("en-IN")}</strong> rows processed · <strong>{result.created?.toLocaleString("en-IN")}</strong> new students · <strong>{result.matched?.toLocaleString("en-IN")}</strong> matching records · <strong>{result.skipped}</strong> skipped.</p>
            <p className="form-help">New records are marked Registered. Missing personal information remains blank. Open each student profile to verify details and upload the student photograph.</p>
            <a className="primary-btn" href="/dashboard/students">Open Student Directory</a>
          </div>
        </section>
      )}
    </ERPLayout>
  );
}
