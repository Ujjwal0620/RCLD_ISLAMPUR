"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, ImagePlus } from "lucide-react";
import * as XLSX from "xlsx";
import ERPLayout from "@/components/ERPLayout";
import BulkStudentPhotoUploadDialog from "@/components/students/BulkStudentPhotoUploadDialog";
import { useErpCache, useErpToast } from "@/components/providers/ERPUIProvider";
import { normalizeIndianPhones } from "@/lib/student-import/identity-resolution.mjs";
import { normalizeStudentCode, normalizeImportName, parseImportAmount, normalizeReceiptNumber } from "@/lib/student-import/normalization.mjs";

const clean = value => String(value ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ").trim();
const headerKey = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const COLUMN_ALIASES = {
  stcode: ["stcode", "studentcode", "registrationcode", "regnno", "enrollmentno"],
  stname: ["stname", "studentname", "name"],
  stnamecr: ["stnamecr", "studentnamecr"],
  doa: ["doa", "dateofadmission", "admissiondate"],
  course: ["course", "coursename", "coursecode"],
  formno: ["formno", "formnumber", "applicationno"],
  dob: ["dob", "dateofbirth"],
  sex: ["sex", "gender"],
  stfather: ["stfather", "fathername", "guardianname"],
  address: ["address", "presentaddress"],
  phno: ["phno", "phone", "mobile", "mobilenumber", "contactnumber"],
  qualification: ["qualification", "education"],
  amtpaid: ["amtpaid", "amountpaid", "paidamount", "paymentamount", "amount"],
  mrno: ["mrno", "receiptno", "receipt", "receiptnumber", "mrnumber"],
  dop: ["dop", "dateofpayment", "paymentdate", "paymentdate", "date"]
};
const columnIndex = (headers, key) => (COLUMN_ALIASES[key] || [key]).map(alias => headers.indexOf(alias)).find(index => index >= 0) ?? -1;
const normalizeName = value => normalizeImportName(value);


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

function parseIdentity(rawName, explicitCode) {
  const firstLine = clean(rawName).split(/\\r?\\n/)[0].replace(/[\\u200B-\\u200D\\uFEFF]/g, "").replace(/\\s+/g, " ").trim();
  const nameWithoutSuffix = firstLine.replace(/_\\s*\\d+\\s*$/, "").trim();
  const name = normalizeName(nameWithoutSuffix || firstLine);
  const stCode = normalizeStudentCode(explicitCode);
  if (!stCode) return { cleanName: name, stCode, registrationId: "", missingCode: true };
  return { cleanName: name || ("STUDENT " + stCode), stCode, registrationId: stCode, missingName: !name };
}

function phonesFrom(value) {
  return normalizeIndianPhones(value);
}

function findSheet(workbook, kind) {
  const matches = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: true });
    for (const merge of sheet["!merges"] || []) {
      if (merge.s.r !== merge.e.r) continue;
      const row = grid[merge.s.r] || (grid[merge.s.r] = []);
      const value = row[merge.s.c] ?? "";
      for (let col = merge.s.c; col <= merge.e.c; col += 1) if (row[col] === "" || row[col] === undefined) row[col] = value;
    }
    const index = grid.findIndex(row => {
      const keys = row.map(headerKey);
      if (kind === "student") return ["stcode", "stname", "doa", "course"].every(key => columnIndex(keys, key) >= 0);
      return ["amtpaid", "mrno", "dop"].every(key => columnIndex(keys, key) >= 0) && (columnIndex(keys, "stname") >= 0 || columnIndex(keys, "stnamecr") >= 0 || columnIndex(keys, "stcode") >= 0);
    });
    if (index >= 0) {
      // Carry vertically merged identifiers (e.g. one Student Code merged over several course/payment rows).
      for (const merge of sheet["!merges"] || []) {
        if (merge.s.c !== merge.e.c || merge.s.r <= index || merge.e.r <= merge.s.r) continue;
        const value = grid[merge.s.r]?.[merge.s.c] ?? "";
        for (let rowIndex = merge.s.r + 1; rowIndex <= merge.e.r; rowIndex += 1) {
          const row = grid[rowIndex] || (grid[rowIndex] = []);
          if (row[merge.s.c] === "" || row[merge.s.c] === undefined) row[merge.s.c] = value;
        }
      }
      matches.push({ name, grid, headerIndex: index });
    }
  }
  if (kind === "student") return matches.find(item => /^student\\s*data$/i.test(item.name)) || matches[0] || null;
  return matches.find(item => !/^student\\s*data$/i.test(item.name)) || matches[0] || null;
}

function chooseRegistration(candidates, paymentDate, courseValue) {
  let matches = [...candidates];
  const courseKey = normalizeImportName(courseValue);
  if (courseKey) {
    const byCourse = matches.filter(item => normalizeImportName(item.course) === courseKey);
    if (byCourse.length) matches = byCourse;
  }
  const paymentTime = paymentDate ? new Date(paymentDate).getTime() : NaN;
  if (matches.length === 1) {
    const admission = parseDate(matches[0].dateOfAdmission);
    if (admission && Number.isFinite(paymentTime) && new Date(admission).getTime() > paymentTime) return null;
    return matches[0];
  }
  if (Number.isFinite(paymentTime)) {
    const eligible = matches.filter(item => {
      const admission = parseDate(item.dateOfAdmission);
      return !admission || new Date(admission).getTime() <= paymentTime;
    });
    if (eligible.length) matches = eligible;
    else return null;
    if (matches.length > 1 && matches.some(item => !parseDate(item.dateOfAdmission))) return null;
  }
  const dated = matches.filter(item => parseDate(item.dateOfAdmission));
  if (dated.length) {
    const latest = Math.max(...dated.map(item => new Date(item.dateOfAdmission).getTime()));
    const latestMatches = dated.filter(item => new Date(item.dateOfAdmission).getTime() === latest);
    return latestMatches.length === 1 ? latestMatches[0] : null;
  }
  return matches.length === 1 ? matches[0] : null;
}

function buildWorkbookPayload(workbook) {
  const studentSheet = findSheet(workbook, "student");
  const feeSheet = findSheet(workbook, "fee");
  if (!studentSheet || !feeSheet || studentSheet.name === feeSheet.name) {
    throw new Error("Workbook must contain a Student Data sheet and a separate Fee sheet with St_Code, Amt_Paid, MR_No and D_O_P.");
  }
  const studentHeaders = studentSheet.grid[studentSheet.headerIndex].map(headerKey);
  const studentAt = key => columnIndex(studentHeaders, key);
  const studentGet = (row, key) => studentAt(key) >= 0 ? row[studentAt(key)] : "";
  const recordsByKey = new Map();
  const studentWarnings = [];
  let studentRowsRead = 0;
  let studentRowsValid = 0;
  for (let index = studentSheet.headerIndex + 1; index < studentSheet.grid.length; index += 1) {
    const row = studentSheet.grid[index] || [];
    if (!row.some(value => clean(value))) continue;
    studentRowsRead += 1;
    const identity = parseIdentity(studentGet(row, "stname"), studentGet(row, "stcode"));
    if (!identity.stCode) {
      studentWarnings.push({ sheet: studentSheet.name, row: index + 1, stCode: identity.stCode, name: identity.cleanName, reason: "Student row is missing a usable explicit St_Code; it cannot be safely upserted." });
      continue;
    }
    if (identity.missingName) studentWarnings.push({
      sheet: studentSheet.name, row: index + 1, stCode: identity.stCode, name: "",
      reason: "Student name is blank; a Student Code-based placeholder name was used so the valid coded record is retained."
    });
    const course = clean(studentGet(row, "course")) || "Previous Course (Legacy)";
    const dateOfAdmission = parseDate(studentGet(row, "doa"));
    const dateKey = dateOfAdmission ? dateOfAdmission.slice(0, 10) : "";
    const recordKey = [identity.stCode, normalizeName(identity.cleanName), normalizeImportName(course), dateKey].join("|");
    const record = {
      ...identity,
      registrationId: recordKey,
      rawStName: clean(studentGet(row, "stname")),
      course,
      dateOfAdmission,
      formNo: clean(studentGet(row, "formno")).replace(/\\.0+$/, ""),
      dob: parseDate(studentGet(row, "dob")),
      sex: clean(studentGet(row, "sex")).toUpperCase(),
      fatherName: clean(studentGet(row, "stfather")),
      address: clean(studentGet(row, "address")),
      phones: phonesFrom(studentGet(row, "phno")),
      qualification: clean(studentGet(row, "qualification")),
      rowNo: index + 1
    };
    const previous = recordsByKey.get(recordKey);
    if (!previous) recordsByKey.set(recordKey, record);
    else {
      previous.phones = [...new Set([...(previous.phones || []), ...(record.phones || [])])];
      for (const key of ["dob", "sex", "fatherName", "address", "qualification", "formNo", "rawStName"]) if (!previous[key] && record[key]) previous[key] = record[key];
    }
    studentRowsValid += 1;
  }

  // One import profile per normalized Student Code + name. Different codes are never clustered by name or demographics.
  const profileMap = new Map();
  for (const record of recordsByKey.values()) {
    const key = [record.stCode, normalizeName(record.cleanName)].join("|");
    if (!profileMap.has(key)) profileMap.set(key, {
      cleanName: record.cleanName, alternateNames: [record.cleanName], studentCodes: [record.stCode],
      dob: record.dob || null, dobs: record.dob ? [record.dob] : [],
      fatherName: record.fatherName || "", fatherNames: record.fatherName ? [record.fatherName] : [],
      phones: [...(record.phones || [])], registrations: []
    });
    const profile = profileMap.get(key);
    profile.registrations.push({ ...record, stCodeUnique: true, isCurrent: false });
    profile.phones = [...new Set([...profile.phones, ...(record.phones || [])])];
    if (!profile.dob && record.dob) profile.dob = record.dob;
    if (record.dob) profile.dobs = [...new Set([...profile.dobs, record.dob])];
    if (record.fatherName) profile.fatherNames = [...new Set([...profile.fatherNames, record.fatherName])];
    if (!profile.fatherName && record.fatherName) profile.fatherName = record.fatherName;
  }
  const profiles = [...profileMap.values()];
  const codeToProfiles = new Map();
  const nameToCodes = new Map();
  for (const [profileIndex, profile] of profiles.entries()) {
    const code = normalizeStudentCode(profile.studentCodes[0]);
    codeToProfiles.set(code, [...(codeToProfiles.get(code) || []), profileIndex]);
    const name = normalizeName(profile.cleanName);
    nameToCodes.set(name, new Set([...(nameToCodes.get(name) || []), code]));
    profile.registrations.sort((a, b) => new Date(b.dateOfAdmission || 0) - new Date(a.dateOfAdmission || 0));
    profile.registrations.forEach((item, index) => { item.isCurrent = index === 0; });
  }
  for (const [code, indexes] of codeToProfiles) {
    if (indexes.length > 1) {
      for (const profileIndex of indexes) {
        const profile = profiles[profileIndex];
        for (const registration of profile.registrations) registration.stCodeUnique = false;
        studentWarnings.push({
          sheet: studentSheet.name, row: profile.registrations[0]?.rowNo || "", stCode: code,
          name: profile.cleanName,
          reason: "The same Student Code appears under multiple different student names. Payments for this code are ambiguous and will not be assigned automatically."
        });
      }
    }
  }

  const feeHeaders = feeSheet.grid[feeSheet.headerIndex].map(headerKey);
  const feeAt = key => columnIndex(feeHeaders, key);
  const feeGet = (row, key) => feeAt(key) >= 0 ? row[feeAt(key)] : "";
  const feeRows = [];
  const unmatchedPayments = [];
  let paymentRowsRead = 0;
  let paymentAmountRead = 0;
  let matchedPaymentAmount = 0;
  for (let index = feeSheet.headerIndex + 1; index < feeSheet.grid.length; index += 1) {
    const row = feeSheet.grid[index] || [];
    if (!row.some(value => clean(value))) continue;
    paymentRowsRead += 1;
    const sourceStCode = normalizeStudentCode(feeGet(row, "stcode"));
    const feeNameRaw = feeGet(row, "stname") || feeGet(row, "stnamecr");
    const feeName = normalizeName(clean(feeNameRaw).split(/\\r?\\n/)[0].replace(/_\\s*\\d+\\s*$/, ""));
    const paymentDate = parseDate(feeGet(row, "dop"));
    const amountPaid = parseImportAmount(feeGet(row, "amtpaid"));
    const mrNo = normalizeReceiptNumber(feeGet(row, "mrno"));
    const sourceCourse = clean(feeGet(row, "course"));
    if (Number.isFinite(amountPaid)) paymentAmountRead += amountPaid;

    let resolvedCode = sourceStCode;
    let matchMethod = "ST_CODE";
    let candidates = resolvedCode ? (codeToProfiles.get(resolvedCode) || []).flatMap(profileIndex => profiles[profileIndex].registrations) : [];
    if (!candidates.length) {
      const nameCodes = nameToCodes.get(feeName) || new Set();
      if (nameCodes.size === 1) {
        resolvedCode = [...nameCodes][0];
        matchMethod = "UNAMBIGUOUS_NAME_FALLBACK";
        candidates = (codeToProfiles.get(resolvedCode) || []).flatMap(profileIndex => profiles[profileIndex].registrations);
      } else {
        unmatchedPayments.push({
          sheet: feeSheet.name, row: index + 1, stCode: sourceStCode, name: feeNameRaw || "",
          amountPaid: Number.isFinite(amountPaid) ? amountPaid : clean(feeGet(row, "amtpaid")),
          mrNo, paymentDate: paymentDate || clean(feeGet(row, "dop")),
          reason: nameCodes.size > 1
            ? "No Student Code match; normalized name maps to multiple Student Codes, so the payment was not guessed."
            : "No Student Code match and no unique normalized student-name fallback exists."
        });
        continue;
      }
    }
    const matchingProfiles = codeToProfiles.get(resolvedCode) || [];
    if (matchingProfiles.length !== 1) {
      unmatchedPayments.push({
        sheet: feeSheet.name, row: index + 1, stCode: sourceStCode, name: feeNameRaw || "",
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : clean(feeGet(row, "amtpaid")),
        mrNo, paymentDate: paymentDate || clean(feeGet(row, "dop")),
        reason: "Student Code is duplicated across different student names in Student Data; payment cannot be safely assigned."
      });
      continue;
    }
    const registration = chooseRegistration(candidates, paymentDate, sourceCourse);
    if (!registration) {
      unmatchedPayments.push({
        sheet: feeSheet.name, row: index + 1, stCode: sourceStCode, name: feeNameRaw || "",
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : clean(feeGet(row, "amtpaid")),
        mrNo, paymentDate: paymentDate || clean(feeGet(row, "dop")),
        reason: "Student Code matched, but multiple course/admission records remain ambiguous for this payment date."
      });
      continue;
    }
    if (!paymentDate || !mrNo || !Number.isFinite(amountPaid) || amountPaid < 0) {
      unmatchedPayments.push({
        sheet: feeSheet.name, row: index + 1, stCode: sourceStCode, name: feeNameRaw || "",
        amountPaid: Number.isFinite(amountPaid) ? amountPaid : clean(feeGet(row, "amtpaid")),
        mrNo, paymentDate: paymentDate || clean(feeGet(row, "dop")),
        reason: "Receipt number, payment date, or amount is invalid."
      });
      continue;
    }
    feeRows.push({
      registrationId: registration.registrationId,
      stCode: resolvedCode,
      sourceStCode,
      cleanName: registration.cleanName,
      course: registration.course,
      paymentDate,
      amountPaid,
      mrNo,
      sourceSheet: feeSheet.name,
      rowNo: index + 1,
      matchMethod
    });
    matchedPaymentAmount += amountPaid;
    if (registration.course === "Previous Course (Legacy)") {
      const priorDate = parseDate(registration.earliestPaymentDate);
      if (!priorDate || new Date(paymentDate) < new Date(priorDate)) registration.earliestPaymentDate = paymentDate;
    }
  }

  const duplicateNameStudents = [...nameToCodes.entries()]
    .filter(([, codes]) => codes.size > 1)
    .map(([name, codes]) => ({ name, studentCodes: [...codes].sort() }));
  return {
    studentSheetName: studentSheet.name,
    feeSheetName: feeSheet.name,
    studentRows: studentRowsRead,
    studentRowsRead,
    studentRowsValid,
    studentRowsSkipped: studentRowsRead - studentRowsValid,
    registrationCount: new Set([...recordsByKey.values()].map(item => item.stCode)).size,
    profileCount: profiles.length,
    profiles,
    paymentRowsRead,
    feeRows,
    unmatchedPayments,
    warnings: studentWarnings,
    duplicateNameStudentCount: duplicateNameStudents.length,
    duplicateNameStudents,
    paymentAmountRead: Number(paymentAmountRead.toFixed(2)),
    matchedPaymentAmount: Number(matchedPaymentAmount.toFixed(2)),
    unmatchedPaymentAmount: Number((paymentAmountRead - matchedPaymentAmount).toFixed(2))
  };
}

const IMPORT_CHECKPOINT_KEY = "rcld-unified-import-checkpoint-v3";
async function postBatch(body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/students/unified-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.detail || data.error || ("Import request failed with HTTP " + response.status));
        error.status = response.status;
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else return data;
    } catch (error) {
      if (error.status && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
  }
  throw lastError || new Error("Chunk failed after 3 attempts.");
}

export default function BulkImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const runningRef = useRef(false);
  const [progress, setProgress] = useState({ stage: "Idle", percent: 0, done: 0, total: 0 });
  const checkpointRef = useRef(null);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [telemetry, setTelemetry] = useState({ studentsDone: 0, studentsTotal: 0, registrationsDone: 0, registrationsTotal: 0, feesDone: 0, feesTotal: 0, elapsedSeconds: 0 });
  const notify = useErpToast();
  const { invalidate } = useErpCache();
  useEffect(() => {
    if (!busy) return undefined;
    const interval = setInterval(() => {
      const active = checkpointRef.current;
      if (!active?.startedAt) return;
      setTelemetry(previous => ({ ...previous, elapsedSeconds: Math.floor((Date.now() - active.startedAt) / 1000) }));
    }, 1000);
    return () => clearInterval(interval);
  }, [busy]);

  async function parseSelectedWorkbook(selectedFile) {
    if (!selectedFile) return;
    setError(""); setResult(null); setPreview(null);
    setProgress({ stage: "Parsing Excel", percent: 2, done: 0, total: 0 });
    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array", cellDates: true });
      const payload = buildWorkbookPayload(workbook);
      const digest = await crypto.subtle.digest("SHA-256", fileBuffer);
      const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
      payload.fingerprint = fingerprint;
      payload.batchKey = "RCLD_UNIFIED_" + fingerprint;
      let savedCheckpoint = null;
      try {
        const rawCheckpoint = localStorage.getItem(IMPORT_CHECKPOINT_KEY);
        const parsedCheckpoint = rawCheckpoint ? JSON.parse(rawCheckpoint) : null;
        if (parsedCheckpoint?.fingerprint === fingerprint && !parsedCheckpoint?.complete) savedCheckpoint = parsedCheckpoint;
      } catch {}
      checkpointRef.current = savedCheckpoint;
      setResumeAvailable(Boolean(savedCheckpoint));
      if (savedCheckpoint) {
        setTelemetry(savedCheckpoint.telemetry || { studentsDone: 0, studentsTotal: payload.profiles.length, registrationsDone: 0, registrationsTotal: payload.registrationCount, feesDone: 0, feesTotal: payload.feeRows.length, elapsedSeconds: 0 });
        setProgress({ stage: "Paused import found", percent: Number(savedCheckpoint.percent || 0), done: 0, total: payload.profiles.length + payload.feeRows.length, message: "Select Resume Import to continue from the saved chunk." });
      } else {
        setTelemetry({ studentsDone: 0, studentsTotal: payload.profiles.length, registrationsDone: 0, registrationsTotal: payload.registrationCount, feesDone: 0, feesTotal: payload.feeRows.length, elapsedSeconds: 0 });
      }
      setPreview({
        ...payload,
        profileCount: payload.profiles.length,
        legacyRegistrations: payload.profiles.reduce((sum, profile) => sum + profile.registrations.filter(item => item.course === "Previous Course (Legacy)").length, 0)
      });
      if (!savedCheckpoint) setProgress({ stage: "Ready to import", percent: 0, done: 0, total: 0 });
    } catch (err) {
      setError(err.message || "Unable to parse workbook.");
      setProgress({ stage: "Error", percent: 0, done: 0, total: 0 });
    }
  }

  async function runImport(resume = false) {
    if (!preview || busy || runningRef.current) return;
    const fingerprint = preview.fingerprint || preview.batchKey?.replace(/^RCLD_UNIFIED_/, "") || "";
    let checkpoint = resume ? checkpointRef.current : null;
    if (!resume && !window.confirm(
      "Import this workbook in automatic chunks?\\n\\n" +
      preview.profileCount.toLocaleString("en-IN") + " unified student profiles\\n" +
      preview.registrationCount.toLocaleString("en-IN") + " registration codes\\n" +
      preview.paymentRowsRead.toLocaleString("en-IN") + " source payment rows (" + preview.feeRows.length.toLocaleString("en-IN") + " matched)\\n\\n" +
      "Students (200 at a time), fees (500 at a time), and fee summaries will run sequentially."
    )) return;
    if (!checkpoint) {
      checkpoint = {
        fingerprint, studentIndex: 0, feeIndex: 0, registrationMap: {}, studentIds: [],
        summary: { created: 0, updated: 0, enrollmentsLinked: 0, duplicatesSkipped: 0, unmatchedPayments: [], newReceiptsAdded: 0, existingReceiptsUpdatedOrSkipped: 0, duplicateReceiptsSkipped: 0, existingReceiptsUpdated: 0, warnings: [] },
        percent: 0, telemetry: { studentsDone: 0, studentsTotal: preview.profiles.length, registrationsDone: 0, registrationsTotal: preview.registrationCount, feesDone: 0, feesTotal: preview.feeRows.length, elapsedSeconds: 0 }
      };
    }
    const startedAt = Date.now() - Number(checkpoint.elapsedMs || 0);
    checkpoint.startedAt = startedAt;
    const saveCheckpoint = () => {
      checkpoint.elapsedMs = Date.now() - startedAt;
      checkpoint.telemetry = { ...checkpoint.telemetry, elapsedSeconds: Math.floor(checkpoint.elapsedMs / 1000) };
      checkpointRef.current = checkpoint;
      try { localStorage.setItem(IMPORT_CHECKPOINT_KEY, JSON.stringify(checkpoint)); } catch (storageError) {
        console.warn("[unified-import] checkpoint storage unavailable", storageError);
      }
      setTelemetry(checkpoint.telemetry);
      setProgress(p => ({ ...p, percent: checkpoint.percent }));
    };
    saveCheckpoint();
    runningRef.current = true; setBusy(true); setError(""); setResult(null);
    try {
      const studentChunkSize = 200;
      const registrationTotal = preview.registrationCount;
      for (let offset = checkpoint.studentIndex; offset < preview.profiles.length; offset += studentChunkSize) {
        const chunkIndex = Math.floor(offset / studentChunkSize);
        const groups = preview.profiles.slice(offset, offset + studentChunkSize);
        setProgress({ stage: "Phase 1 · Students & Enrollments", percent: Math.max(checkpoint.percent, Math.floor(offset / Math.max(preview.profiles.length,1) * 45)), done: offset, total: preview.profiles.length, message: "Saving student chunk " + (chunkIndex + 1) });
        checkpoint.failedPhase = "students"; checkpoint.failedChunk = chunkIndex + 1; saveCheckpoint();
        const data = await postBatch({ action: "students", phase: "students", chunkIndex, groups });
        checkpoint.failedPhase = null; checkpoint.failedChunk = null;
        for (const item of data.registrationMapChunk || []) {
          const code = normalizeStudentCode(item.stCode);
          if (!code) continue;
          const prior = checkpoint.registrationMap[code];
          if (!prior) checkpoint.registrationMap[code] = { ...item, stCode: code, enrollmentIds: [item.enrollmentId].filter(Boolean) };
          else {
            const enrollmentIds = [...new Set([...(prior.enrollmentIds || []), item.enrollmentId].filter(Boolean))];
            checkpoint.registrationMap[code] = { ...prior, enrollmentIds, ambiguous: Boolean(prior.ambiguous || String(prior.studentId) !== String(item.studentId)) };
          }
        }
        checkpoint.studentIds = [...new Set([...(checkpoint.studentIds || []), ...(data.studentIds || [])])];
        checkpoint.summary.created += Number(data.created || 0);
        checkpoint.summary.updated += Number(data.updated || 0);
        checkpoint.summary.enrollmentsLinked += Number(data.enrollmentsLinked || 0);
        checkpoint.summary.duplicatesSkipped = Number(checkpoint.summary.duplicatesSkipped || 0) + Number(data.duplicatesSkipped || 0);
        checkpoint.summary.warnings.push(...(data.warnings || []));
        checkpoint.studentIndex = Math.min(offset + groups.length, preview.profiles.length);
        checkpoint.telemetry.studentsDone = checkpoint.studentIndex;
        checkpoint.telemetry.registrationsDone = preview.profiles.slice(0, checkpoint.studentIndex).reduce((sum, group) => sum + (group.registrations || []).length, 0);
        checkpoint.percent = Math.min(45, Math.round(checkpoint.studentIndex / Math.max(preview.profiles.length,1) * 45));
        saveCheckpoint();
      }

      const feeChunkSize = 500;
      for (let offset = checkpoint.feeIndex; offset < preview.feeRows.length; offset += feeChunkSize) {
        const chunkIndex = Math.floor(offset / feeChunkSize);
        const rows = preview.feeRows.slice(offset, offset + feeChunkSize);
        setProgress({ stage: "Phase 2 · Fee Receipts", percent: Math.max(45, 45 + Math.floor(offset / Math.max(preview.feeRows.length,1) * 47)), done: offset, total: preview.feeRows.length, message: "Saving fee receipt chunk " + (chunkIndex + 1) });
        const mapping = [...new Set(rows.map(row => normalizeStudentCode(row.stCode)).filter(Boolean))].map(code => checkpoint.registrationMap[code]).filter(Boolean);
        checkpoint.failedPhase = "fees"; checkpoint.failedChunk = chunkIndex + 1; saveCheckpoint();
        const data = await postBatch({ action: "fees", phase: "fees", chunkIndex, rows, registrationMap: mapping, batchKey: preview.batchKey });
        checkpoint.failedPhase = null; checkpoint.failedChunk = null;
        checkpoint.summary.newReceiptsAdded += Number(data.newReceiptsAdded || 0);
        checkpoint.summary.existingReceiptsUpdatedOrSkipped += Number(data.existingReceiptsUpdatedOrSkipped || 0);
        checkpoint.summary.duplicateReceiptsSkipped += Number(data.duplicateReceiptsSkipped || 0);
        checkpoint.summary.existingReceiptsUpdated += Number(data.existingReceiptsUpdated || 0);
        checkpoint.summary.unmatchedPayments.push(...(data.unmatchedRows || []));
        checkpoint.summary.warnings.push(...(data.unmatchedRows || []));
        checkpoint.feeIndex = Math.min(offset + rows.length, preview.feeRows.length);
        checkpoint.telemetry.feesDone = checkpoint.feeIndex;
        checkpoint.percent = Math.min(92, 45 + Math.round(checkpoint.feeIndex / Math.max(preview.feeRows.length,1) * 47));
        saveCheckpoint();
      }

      setProgress({ stage: "Phase 3 · Finalizing Fee Summaries", percent: 94, done: 0, total: checkpoint.studentIds.length, message: "Recalculating totals for affected Master Students" });
      checkpoint.failedPhase = "finalize"; checkpoint.failedChunk = 1; saveCheckpoint();
      const finalized = await postBatch({ action: "finalize", phase: "finalize", studentIds: checkpoint.studentIds, studentCodes: preview.profiles.map(profile => profile.studentCodes?.[0]).filter(Boolean), batchKey: preview.batchKey, expectedPaymentRows: preview.feeRows.length, expectedPaymentTotal: preview.matchedPaymentAmount, sourcePaymentRows: preview.paymentRowsRead, sourcePaymentTotal: preview.paymentAmountRead });
      checkpoint.failedPhase = null; checkpoint.failedChunk = null;
      checkpoint.percent = 100;
      checkpoint.complete = true;
      saveCheckpoint();
      const finalUnmatchedPayments = [...preview.unmatchedPayments, ...(checkpoint.summary.unmatchedPayments || [])];
      const finalUnmatchedPaymentTotal = finalUnmatchedPayments.reduce((sum, item) => {
        const amount = parseImportAmount(item.amountPaid);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      const sourcePaymentReconciliationMatches =
        preview.paymentRowsRead === Number(finalized.databasePaymentRows || 0) + finalUnmatchedPayments.length
        && Math.abs(Number(preview.paymentAmountRead || 0) - (Number(finalized.databasePaymentTotal || 0) + finalUnmatchedPaymentTotal)) < 0.01;
      const summary = {
        studentsMatchedUpdated: checkpoint.summary.updated,
        newStudentsCreated: checkpoint.summary.created,
        registrationsLinked: checkpoint.summary.enrollmentsLinked,
        studentEnrollmentDuplicatesSkipped: Number(checkpoint.summary.duplicatesSkipped || 0),
        newReceiptsAdded: checkpoint.summary.newReceiptsAdded,
        existingReceiptsUpdatedOrSkipped: checkpoint.summary.existingReceiptsUpdatedOrSkipped,
        duplicateReceiptsSkipped: checkpoint.summary.duplicateReceiptsSkipped,
        existingReceiptsUpdated: checkpoint.summary.existingReceiptsUpdated,
        unmatchedRows: [...preview.warnings, ...preview.unmatchedPayments, ...checkpoint.summary.warnings],
        unmatchedPayments: finalUnmatchedPayments,
        studentRowsRead: preview.studentRowsRead,
        studentRowsValid: preview.studentRowsValid,
        studentProfilesProcessed: preview.profiles.length,
        paymentRowsRead: preview.paymentRowsRead,
        feeRowsSubmitted: preview.feeRows.length,
        feeRowsMatched: Number(finalized.databasePaymentRows || 0),
        feeRowsProcessed: Number(finalized.databasePaymentRows || 0),
        duplicateNameStudentCount: preview.duplicateNameStudentCount,
        duplicateNameStudents: preview.duplicateNameStudents,
        sourcePaymentTotal: preview.paymentAmountRead,
        matchedPaymentTotal: preview.matchedPaymentAmount,
        unmatchedPaymentTotal: finalUnmatchedPaymentTotal,
        databasePaymentRows: Number(finalized.databasePaymentRows || 0),
        databasePaymentTotal: Number(finalized.databasePaymentTotal || 0),
        paymentReconciliationMatches: Boolean(finalized.paymentReconciliationMatches),
        sourcePaymentReconciliationMatches,
        duplicatePaymentDocumentsFound: Number(finalized.duplicatePaymentDocumentsFound || 0),
        studentsFinalized: Number(finalized.studentsFinalized || 0),
        enrollmentsFinalized: Number(finalized.enrollmentsFinalized || 0)
      };
      setProgress({ stage: "Complete", percent: 100, done: preview.profiles.length + preview.feeRows.length, total: preview.profiles.length + preview.feeRows.length, message: "All import phases completed successfully." });
      setResult(summary); setSummaryOpen(true); setPreview(null); setResumeAvailable(false);
      try { localStorage.removeItem(IMPORT_CHECKPOINT_KEY); } catch {}
      checkpointRef.current = null;
      notify("Complete workbook import finished successfully.", "success");
      invalidate(["lookup:", "students:", "student-detail:", "student-fees:", "dashboard-stats", "batches:"]);
    } catch (err) {
      checkpoint.percent = Math.min(checkpoint.percent || 0, 99);
      checkpoint.error = err.message || "Import chunk failed.";
      saveCheckpoint();
      setResumeAvailable(true);
      setError("Import paused during " + (checkpoint.failedPhase || "finalize") + " chunk " + (checkpoint.failedChunk || 1) + ": " + checkpoint.error + ". Completed chunks are saved. Select Resume Import to continue.");
      setProgress(p => ({ ...p, stage: "Paused · Resume available", message: checkpoint.error }));
      notify(checkpoint.error, "error");
    } finally {
      runningRef.current = false; setBusy(false);
    }
  }

  function downloadWarnings(format = "csv") {
    if (!result?.unmatchedRows?.length) return;
    const isJson = format === "json";
    const content = isJson ? JSON.stringify(result.unmatchedRows, null, 2) : XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(result.unmatchedRows));
    const blob = new Blob([content], { type: isJson ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = isJson ? "RCLD_Student_Import_Review.json" : "RCLD_Student_Import_Review.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const collisionCount = new Set((result?.unmatchedRows || [])
    .filter(item => /st.?code collision|registration code is reused/i.test(String(item.reason || "")))
    .flatMap(item => Array.isArray(item.stCode) ? item.stCode : String(item.stCode || item.studentId || "").split(","))
    .map(value => String(value).trim()).filter(Boolean)).size;
  return (
    <ERPLayout active="/dashboard/students">
      <header className="topbar">
        <div><div className="crumb">Students / Bulk Import</div><h1>Bulk Import & Photos</h1></div>
        <a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={16}/> Back to Students</a>
      </header>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><div><h3>1. Bulk Import — Unified Excel Upload</h3><p>Upload one .xlsx workbook with Student Data and Fee sheets. Students, course registrations and receipts are synced in batches.</p></div><FileSpreadsheet size={22}/></div>
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          <label className="form-field"><span>Admission + Fee workbook (.xlsx)</span><input type="file" accept=".xlsx" disabled={busy} onChange={event => { const selected = event.target.files?.[0] || null; setFile(selected); parseSelectedWorkbook(selected); event.target.value = ""; }}/></label>
          {file && <div className="form-help">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
          {preview && <div className="student-summary-grid">
            <div className="summary-card"><span>Student Rows Read</span><strong>{preview.studentRowsRead.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Student Codes / Profiles</span><strong>{preview.registrationCount.toLocaleString("en-IN")} / {preview.profileCount.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Payment Rows Read</span><strong>{preview.paymentRowsRead.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Payments Matched</span><strong>{preview.feeRows.length.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Payments Unmatched</span><strong>{preview.unmatchedPayments.length.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Names Shared by Multiple Codes</span><strong>{preview.duplicateNameStudentCount.toLocaleString("en-IN")}</strong></div>
          </div>}
          {preview && <div className="form-help"><b>Detected:</b> {preview.studentSheetName} (Student Data) · {preview.feeSheetName} (Fee Sheet). Payments are matched by normalized explicit St_Code; name fallback is allowed only when it identifies exactly one Student Code.</div>}
          {progress.stage !== "Idle" && <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{progress.stage}</strong><b>{progress.percent}%</b></div>
            <div style={{ height: 10, borderRadius: 99, background: "var(--border,#e5e7eb)", overflow: "hidden" }}><div style={{ height: "100%", width: progress.percent + "%", background: "var(--primary,#315efb)", transition: "width .2s ease" }}/></div>
            {progress.message && <small className="form-help">{progress.message}</small>}
            {progress.total > 0 && <small className="form-help">{progress.done.toLocaleString("en-IN")} / {progress.total.toLocaleString("en-IN")} records</small>}
            <div className="form-help" style={{ display: "grid", gap: 4 }}>
              <span>Students: {telemetry.studentsDone.toLocaleString("en-IN")} / {telemetry.studentsTotal.toLocaleString("en-IN")} · Registrations: {telemetry.registrationsDone.toLocaleString("en-IN")} / {telemetry.registrationsTotal.toLocaleString("en-IN")}</span>
              <span>Fee Receipts: {telemetry.feesDone.toLocaleString("en-IN")} / {telemetry.feesTotal.toLocaleString("en-IN")} · Elapsed: {Math.floor(telemetry.elapsedSeconds / 60)}m {telemetry.elapsedSeconds % 60}s</span>
            </div>
          </div>}
          {error && <div className="error-msg" role="alert">{error}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="primary-btn" type="button" disabled={!preview || busy} onClick={() => runImport(false)}><Upload size={16}/>{busy ? "Import running…" : "Import Students + Fees"}</button>
            {resumeAvailable && <button className="ghost-btn" type="button" disabled={!preview || busy} onClick={() => runImport(true)}>Resume Import</button>}
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><div><h3>2. Bulk Photo Upload</h3><p>Upload student photos using registration-code filenames. Existing Cloudinary photo mapping remains unchanged.</p></div><ImagePlus size={22}/></div>
        <div style={{ padding: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p className="form-help" style={{ margin: 0 }}>Supports JPG, JPEG, PNG and WebP files or an entire photo folder.</p>
          <button className="ghost-btn" type="button" onClick={() => setPhotoDialogOpen(true)}><ImagePlus size={16}/> Open Bulk Photo Upload</button>
        </div>
      </section>

      {result && summaryOpen && <div role="presentation" onClick={() => setSummaryOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(15,23,42,.62)", display: "grid", placeItems: "center", padding: 18 }}>
        <section role="dialog" aria-modal="true" aria-labelledby="import-summary-title" onClick={event => event.stopPropagation()} className="panel" style={{ width: "min(920px, 100%)", maxHeight: "min(88vh, 900px)", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
          <div className="panel-head"><div><h3 id="import-summary-title">Import Summary</h3><p>Student profiles and fee receipts have been processed. Review any flagged records before relying on them.</p></div><button className="ghost-btn" type="button" onClick={() => setSummaryOpen(false)}>Close</button></div>
          <div className="student-summary-grid" style={{ padding: 20 }}>
            <div className="summary-card"><span>New Profiles Created</span><strong>{result.newStudentsCreated}</strong></div>
            <div className="summary-card"><span>Existing Profiles Updated / Merged</span><strong>{result.studentsMatchedUpdated}</strong></div>
            <div className="summary-card"><span>New St_Codes Linked</span><strong>{result.registrationsLinked}</strong></div>
            <div className="summary-card"><span>Duplicate Student / Enrollment Inserts Skipped</span><strong>{result.studentEnrollmentDuplicatesSkipped}</strong></div>
            <div className="summary-card"><span>Fee Receipts Added</span><strong>{result.newReceiptsAdded}</strong></div>
            <div className="summary-card"><span>Duplicate Receipts Skipped</span><strong>{result.duplicateReceiptsSkipped}</strong></div>
            <div className="summary-card"><span>Existing Receipts Repaired</span><strong>{result.existingReceiptsUpdated}</strong></div>
            <div className="summary-card"><span>Duplicate Names Across Student Codes</span><strong>{result.duplicateNameStudentCount}</strong></div>
            <div className="summary-card"><span>Student Code Collisions</span><strong>{collisionCount}</strong></div>
            <div className="summary-card"><span>Student Rows Read / Valid</span><strong>{result.studentRowsRead} / {result.studentRowsValid}</strong></div>
            <div className="summary-card"><span>Payment Rows Read / Saved</span><strong>{result.paymentRowsRead} / {result.databasePaymentRows}</strong></div>
            <div className="summary-card"><span>Matched Payment Rows Submitted</span><strong>{result.feeRowsSubmitted}</strong></div>
            <div className="summary-card"><span>Unmatched Payment Rows</span><strong>{result.unmatchedPayments?.length || 0}</strong></div>
            <div className="summary-card"><span>Excel Source Payment Total</span><strong>₹{Number(result.sourcePaymentTotal || 0).toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Excel Matched Payment Total</span><strong>₹{Number(result.matchedPaymentTotal || 0).toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Database Matched Payment Total</span><strong>₹{Number(result.databasePaymentTotal || 0).toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Unmatched Payment Amount</span><strong>₹{Number(result.unmatchedPaymentTotal || 0).toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Database Payment Rows / Expected</span><strong>{result.databasePaymentRows} / {result.feeRowsSubmitted}</strong></div>
            <div className="summary-card"><span>Rows Requiring Review</span><strong>{result.unmatchedRows.length}</strong></div>
            <div className="summary-card"><span>Database vs Matched Excel</span><strong>{result.paymentReconciliationMatches ? "Matched" : "Needs Review"}</strong></div>
            <div className="summary-card"><span>All Source Rows + Amounts Accounted</span><strong>{result.sourcePaymentReconciliationMatches ? "Matched" : "Needs Review"}</strong></div>
            <div className="summary-card"><span>Duplicate Payment Documents in DB</span><strong>{result.duplicatePaymentDocumentsFound}</strong></div>
          </div>
          {result.unmatchedPayments?.length > 0 && <div style={{ padding: "0 20px 20px" }}>
            <h4>Unmatched / Rejected Payment Rows ({result.unmatchedPayments.length})</h4>
            <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--border,#e5e7eb)", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr><th style={{ padding: 8, textAlign: "left" }}>Excel Row</th><th style={{ padding: 8, textAlign: "left" }}>Student Code</th><th style={{ padding: 8, textAlign: "left" }}>Student Name</th><th style={{ padding: 8, textAlign: "right" }}>Amount</th><th style={{ padding: 8, textAlign: "left" }}>Receipt</th><th style={{ padding: 8, textAlign: "left" }}>Reason</th></tr></thead>
                <tbody>{result.unmatchedPayments.map((item, index) => <tr key={String(item.row || index) + "-" + String(item.stCode || "") + "-" + String(item.mrNo || "")}>
                  <td style={{ padding: 8 }}>{item.row || "—"}</td>
                  <td style={{ padding: 8 }}>{item.stCode || "—"}</td>
                  <td style={{ padding: 8 }}>{item.name || "—"}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{item.amountPaid ?? "—"}</td>
                  <td style={{ padding: 8 }}>{item.mrNo || "—"}</td>
                  <td style={{ padding: 8 }}>{item.reason || "Unspecified import issue"}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>}
          {result.unmatchedRows.length > 0 && <div style={{ padding: "0 20px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AlertTriangle size={16}/><span>{result.unmatchedRows.length} rows need manual review.</span>
            <button className="ghost-btn" type="button" onClick={() => downloadWarnings("csv")}><Download size={15}/> Download CSV</button>
            <button className="ghost-btn" type="button" onClick={() => downloadWarnings("json")}><Download size={15}/> Download JSON</button>
          </div>}
        </section>
      </div>}

      <BulkStudentPhotoUploadDialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)} onComplete={() => invalidate(["students:", "student-detail:"])} />
    </ERPLayout>
  );
}
