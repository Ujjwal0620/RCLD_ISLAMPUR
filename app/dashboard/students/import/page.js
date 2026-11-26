"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, ImagePlus } from "lucide-react";
import * as XLSX from "xlsx";
import ERPLayout from "@/components/ERPLayout";
import BulkStudentPhotoUploadDialog from "@/components/students/BulkStudentPhotoUploadDialog";
import { useErpCache, useErpToast } from "@/components/providers/ERPUIProvider";
import { clusterStudentRegistrations, normalizeStudentName, normalizeIndianPhones } from "@/lib/student-import/identity-resolution.mjs";

const clean = value => String(value ?? "").trim();
const headerKey = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeName = value => normalizeStudentName(value);


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
  const suffix = firstLine.match(/_(\d+)(?![\s\S]*_\d+)/);
  const name = normalizeStudentName(firstLine);
  let code = suffix?.[1] || "";
  if (!code) code = clean(fallbackCode).replace(/\.0+$/, "").replace(/\D/g, "");
  if (!name || !code) return { cleanName: name, stCode: code, registrationId: "" };
  return { cleanName: name, stCode: code, registrationId: name + "_" + code };
}

function phonesFrom(value) {
  return normalizeIndianPhones(value);
}

function findSheet(workbook, kind) {
  const matches = [];
  for (const name of workbook.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: true });
    const index = grid.findIndex(row => {
      const keys = row.map(headerKey);
      if (kind === "student") return ["stcode","stname","doa","course"].every(key => keys.includes(key));
      return ["amtpaid","mrno","dop"].every(key => keys.includes(key)) && (keys.includes("stname") || keys.includes("stnamecr"));
    });
    if (index >= 0) matches.push({ name, grid, headerIndex: index });
  }
  if (kind === "student") return matches.find(item => /^student\s*data$/i.test(item.name)) || matches[0] || null;
  return matches.find(item => !/^student\s*data$/i.test(item.name)) || matches[0] || null;
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
  let studentDataRows = 0;
  for (let index = studentSheet.headerIndex + 1; index < studentSheet.grid.length; index += 1) {
    const row = studentSheet.grid[index];
    if (!row.some(value => clean(value))) continue;
    studentDataRows += 1;
    const identity = parseIdentity(studentGet(row, "stname"), studentGet(row, "stcode"));
    if (!identity.registrationId) {
      studentWarnings.push({ sheet: studentSheet.name, row: index + 1, studentId: studentGet(row, "stcode"), reason: "Student row has no usable registration code or name suffix." });
      continue;
    }
    const record = {
      ...identity,
      rawStName: clean(studentGet(row, "stname")),
      course: clean(studentGet(row, "course")) || "Previous Course (Legacy)",
      dateOfAdmission: parseDate(studentGet(row, "doa")),
      formNo: clean(studentGet(row, "formno")).replace(/\.0+$/, ""),
      dob: parseDate(studentGet(row, "dob")),
      invalidDob: Boolean(parseDate(studentGet(row, "dob")) && (new Date(parseDate(studentGet(row, "dob"))).getUTCFullYear() < 1965 || new Date(parseDate(studentGet(row, "dob"))).getUTCFullYear() > 2023)),
      sex: clean(studentGet(row, "sex")).toUpperCase(),
      fatherName: clean(studentGet(row, "stfather")),
      address: clean(studentGet(row, "address")),
      phones: phonesFrom(studentGet(row, "phno")),
      qualification: clean(studentGet(row, "qualification")),
      rowNo: index + 1
    };
    if (record.invalidDob) { studentWarnings.push({ sheet: studentSheet.name, row: index + 1, studentId: identity.registrationId, reason: "DOB year is outside the allowed 1965–2023 range; DOB was ignored for identity matching." }); record.dob = null; }
    const previous = registrations.get(identity.registrationId);
    if (!previous) registrations.set(identity.registrationId, record);
    else {
      previous.phones = [...new Set([...previous.phones, ...record.phones])];
      for (const key of ["course","dateOfAdmission","formNo","dob","sex","fatherName","address","qualification"]) if (!previous[key] && record[key]) previous[key] = record[key];
    }
  }

  const rawRecords = [...registrations.values()];
  const clusters = clusterStudentRegistrations(rawRecords);
  const profiles = clusters.map(items => {
    items.sort((a,b) => new Date(b.dateOfAdmission || 0) - new Date(a.dateOfAdmission || 0));
    const latest = items[0];
    const names = [...new Set(items.map(item => item.cleanName).filter(Boolean))];
    const enrollmentMap = new Map();
    for (const item of items) {
      const admissionDateKey = item.dateOfAdmission ? new Date(item.dateOfAdmission).toISOString().slice(0, 10) : "";
      const enrollmentKey = [item.stCode, String(item.course || "").toUpperCase(), admissionDateKey].join("|");
      const previous = enrollmentMap.get(enrollmentKey);
      if (!previous) enrollmentMap.set(enrollmentKey, { ...item });
      else {
        previous.phones = [...new Set([...(previous.phones || []), ...(item.phones || [])])];
        previous.alternateNames = [...new Set([...(previous.alternateNames || []), item.cleanName].filter(Boolean))];
        if (!previous.formNo && item.formNo) previous.formNo = item.formNo;
        if (!previous.qualification && item.qualification) previous.qualification = item.qualification;
        if (!previous.address && item.address) previous.address = item.address;
        if (!previous.rawStName && item.rawStName) previous.rawStName = item.rawStName;
      }
    }
    const uniqueItems = [...enrollmentMap.values()].sort((a,b) => new Date(b.dateOfAdmission || b.earliestPaymentDate || 0) - new Date(a.dateOfAdmission || a.earliestPaymentDate || 0));
    return {
      cleanName: latest.cleanName,
      alternateNames: names,
      dob: items.find(item => item.dob && !item.invalidDob)?.dob || null,
      dobs: [...new Set(items.map(item => item.dob).filter(Boolean))],
      fatherName: items.find(item => item.fatherName)?.fatherName || "",
      fatherNames: [...new Set(items.map(item => item.fatherName).filter(Boolean))],
      phones: [...new Set(items.flatMap(item => item.phones))],
      studentCodes: [...new Set(uniqueItems.map(item => item.stCode))],
      registrations: uniqueItems.map(item => ({ ...item, alternateNames: names, isCurrent: item.stCode === latest.stCode && item.course === latest.course && String(item.dateOfAdmission || "") === String(latest.dateOfAdmission || "") }))
    };
  });
  const studentCodeProfiles = new Map();
  for (const [profileIndex, profile] of profiles.entries()) for (const record of profile.registrations) {
    studentCodeProfiles.set(record.stCode, new Set([...(studentCodeProfiles.get(record.stCode) || []), profileIndex]));
  }
  for (const profile of profiles) for (const record of profile.registrations) {
    record.stCodeUnique = studentCodeProfiles.get(record.stCode)?.size === 1;
    if (!record.stCodeUnique) studentWarnings.push({
      sheet: studentSheet.name, row: record.rowNo, studentId: record.registrationId,
      stCode: record.stCode, name: record.cleanName,
      reason: "St_Code collision: this code belongs to more than one distinct identity in the workbook; manual review required."
    });
  }
  const feeHeaders = feeSheet.grid[feeSheet.headerIndex].map(headerKey);
  const feeAt = key => feeHeaders.indexOf(key);
  const feeGet = (row, key) => feeAt(key) >= 0 ? row[feeAt(key)] : "";
  const profileByName = new Map();
  for (const profile of profiles) for (const alias of new Set([profile.cleanName, ...(profile.alternateNames || [])])) {
    profileByName.set(alias, [...(profileByName.get(alias) || []), profile]);
  }
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
    const primaryIdentity = parseIdentity(feeGet(row, "stname"), feeGet(row, "stcode"));
    const identity = primaryIdentity.cleanName ? primaryIdentity : parseIdentity(feeGet(row, "stnamecr"), feeGet(row, "stcode"));
    const feeName = feeGet(row, "stname") || feeGet(row, "stnamecr");
    if (!identity.cleanName || !identity.stCode) {
      feeWarnings.push({ sheet: feeSheet.name, row: index + 1, studentId: clean(feeGet(row,"stcode")), name: feeName, mrNo: clean(feeGet(row,"mrno")), paymentDate: parseDate(feeGet(row,"dop")), amountPaid: feeGet(row,"amtpaid"), reason: "Fee row has no valid name/code identity." });
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
        const profile = nameMatches[0];
        const sameCodeAdmissions = profile.registrations.filter(item => String(item.stCode) === String(identity.stCode));
        if (sameCodeAdmissions.length === 1) {
          registration = sameCodeAdmissions[0];
          registrationId = registration.registrationId;
        } else if (sameCodeAdmissions.length === 0) {
          const legacy = {
            ...identity, course: "Previous Course (Legacy)", dateOfAdmission: null,
            earliestPaymentDate: parseDate(feeGet(row,"dop")), formNo: "", dob: null,
            sex: "", fatherName: "", address: "", phones: [], qualification: ""
          };
          profile.registrations.push(legacy);
          registration = legacy;
          registrationId = legacy.registrationId;
          registrationById.set(registrationId, registration);
        } else {
          feeWarnings.push({ sheet: feeSheet.name, row: index + 1, studentId: identity.registrationId, name: identity.cleanName, stCode: identity.stCode, mrNo: clean(feeGet(row,"mrno")), paymentDate: parseDate(feeGet(row,"dop")), amountPaid: feeGet(row,"amtpaid"), reason: "This student has multiple admissions under the same St_Code; fee row could not be assigned to one course without a matching registration identity." });
          continue;
        }
      } else {
        feeWarnings.push({ sheet: feeSheet.name, row: index + 1, studentId: identity.registrationId, name: identity.cleanName, stCode: identity.stCode, mrNo: clean(feeGet(row,"mrno")), paymentDate: parseDate(feeGet(row,"dop")), amountPaid: feeGet(row,"amtpaid"), reason: nameMatches.length > 1 ? "Legacy registration name is ambiguous across multiple student profiles." : "Fee registration does not match Student Data." });
        continue;
      }
    }
    const paymentDate = parseDate(feeGet(row, "dop"));
    const amountPaid = Number(clean(feeGet(row, "amtpaid")).replace(/[₹,\s]/g, ""));
    const mrNo = clean(feeGet(row, "mrno")).replace(/\.0+$/, "");
    if (!paymentDate || !mrNo || !Number.isFinite(amountPaid) || amountPaid < 0) {
      feeWarnings.push({ sheet: feeSheet.name, row: index + 1, studentId: registrationId, name: identity.cleanName, stCode: identity.stCode, mrNo, paymentDate, amountPaid: feeGet(row,"amtpaid"), reason: "Receipt number, date, or amount is invalid." });
      continue;
    }
    if (!registration.course || registration.course === "Previous Course (Legacy)") registration.course = "Previous Course (Legacy)";
    feeRows.push({ registrationId, stCode: registration.stCode || identity.stCode, cleanName: registration.cleanName || identity.cleanName, course: registration.course, paymentDate, amountPaid, mrNo, sourceSheet: feeSheet.name, rowNo: index + 1 });
    if (registration.course === "Previous Course (Legacy)") {
      const priorDate = parseDate(registration.earliestPaymentDate);
      if (!priorDate || new Date(paymentDate) < new Date(priorDate)) registration.earliestPaymentDate = paymentDate;
    }
  }
  const allRegistrationCodeProfiles = new Map();
  for (const [profileIndex, profile] of profiles.entries()) for (const item of profile.registrations) {
    allRegistrationCodeProfiles.set(item.stCode, new Set([...(allRegistrationCodeProfiles.get(item.stCode) || []), profileIndex]));
  }
  for (const profile of profiles) {
    const seen = new Set();
    profile.registrations = profile.registrations.filter(item => {
      if (seen.has(item.registrationId)) return false;
      seen.add(item.registrationId); return true;
    }).sort((a,b) => new Date(b.dateOfAdmission || b.earliestPaymentDate || 0) - new Date(a.dateOfAdmission || a.earliestPaymentDate || 0));
    profile.registrations.forEach(item => { item.stCodeUnique = allRegistrationCodeProfiles.get(item.stCode)?.size === 1; });
    profile.registrations.forEach((item,index) => { item.isCurrent = index === 0; });
  }
  return { studentSheetName: studentSheet.name, feeSheetName: feeSheet.name, studentRows: studentDataRows, registrationCount: registrations.size, profiles, feeRows, warnings: [...studentWarnings, ...feeWarnings] };
}

const IMPORT_CHECKPOINT_KEY = "rcld-unified-import-checkpoint-v2";
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

  async function parseSelectedWorkbook(selectedFile) {
    if (!selectedFile) return;
    setError(""); setResult(null); setPreview(null);
    setProgress({ stage: "Parsing Excel", percent: 2, done: 0, total: 0 });
    try {
      const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: "array", cellDates: true });
      const payload = buildWorkbookPayload(workbook);
      const fingerprint = [selectedFile.name, selectedFile.size, selectedFile.lastModified].join("|");
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
      setProgress({ stage: "Ready to import", percent: 10, done: 0, total: 0 });
    } catch (err) {
      setError(err.message || "Unable to parse workbook.");
      setProgress({ stage: "Error", percent: 0, done: 0, total: 0 });
    }
  }

  async function runImport(resume = false) {
    if (!preview || busy || runningRef.current) return;
    const fingerprint = [file?.name, file?.size, file?.lastModified].join("|");
    let checkpoint = resume ? checkpointRef.current : null;
    if (!resume && !window.confirm(
      "Import this workbook in automatic chunks?\\n\\n" +
      preview.profileCount.toLocaleString("en-IN") + " unified student profiles\\n" +
      preview.registrationCount.toLocaleString("en-IN") + " registration codes\\n" +
      preview.feeRows.length.toLocaleString("en-IN") + " fee receipts\\n\\n" +
      "Students (200 at a time), fees (500 at a time), and fee summaries will run sequentially."
    )) return;
    if (!checkpoint) {
      checkpoint = {
        fingerprint, studentIndex: 0, feeIndex: 0, registrationMap: {}, studentIds: [],
        summary: { created: 0, updated: 0, enrollmentsLinked: 0, newReceiptsAdded: 0, existingReceiptsUpdatedOrSkipped: 0, duplicateReceiptsSkipped: 0, existingReceiptsUpdated: 0, warnings: [] },
        percent: 0, telemetry: { studentsDone: 0, studentsTotal: preview.profiles.length, registrationsDone: 0, registrationsTotal: preview.registrationCount, feesDone: 0, feesTotal: preview.feeRows.length, elapsedSeconds: 0 }
      };
    }
    const startedAt = Date.now() - Number(checkpoint.elapsedMs || 0);
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
    runningRef.current = true; setBusy(true); setError(""); setResult(null);
    try {
      const studentChunkSize = 200;
      const registrationTotal = preview.registrationCount;
      for (let offset = checkpoint.studentIndex; offset < preview.profiles.length; offset += studentChunkSize) {
        const chunkIndex = Math.floor(offset / studentChunkSize);
        const groups = preview.profiles.slice(offset, offset + studentChunkSize);
        setProgress({ stage: "Phase 1 · Students & Enrollments", percent: Math.max(checkpoint.percent, Math.floor(offset / Math.max(preview.profiles.length,1) * 45)), done: offset, total: preview.profiles.length, message: "Saving student chunk " + (chunkIndex + 1) });
        const data = await postBatch({ action: "students", phase: "students", chunkIndex, groups });
        for (const item of data.registrationMapChunk || []) checkpoint.registrationMap[item.registrationId] = item;
        checkpoint.studentIds = [...new Set([...(checkpoint.studentIds || []), ...(data.studentIds || [])])];
        checkpoint.summary.created += Number(data.created || 0);
        checkpoint.summary.updated += Number(data.updated || 0);
        checkpoint.summary.enrollmentsLinked += Number(data.enrollmentsLinked || 0);
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
        const mapping = rows.map(row => checkpoint.registrationMap[row.registrationId]).filter(Boolean);
        const data = await postBatch({ action: "fees", phase: "fees", chunkIndex, rows, registrationMap: mapping });
        checkpoint.summary.newReceiptsAdded += Number(data.newReceiptsAdded || 0);
        checkpoint.summary.existingReceiptsUpdatedOrSkipped += Number(data.existingReceiptsUpdatedOrSkipped || 0);
        checkpoint.summary.duplicateReceiptsSkipped += Number(data.duplicateReceiptsSkipped || 0);
        checkpoint.summary.existingReceiptsUpdated += Number(data.existingReceiptsUpdated || 0);
        checkpoint.summary.warnings.push(...(data.unmatchedRows || []));
        checkpoint.feeIndex = Math.min(offset + rows.length, preview.feeRows.length);
        checkpoint.telemetry.feesDone = checkpoint.feeIndex;
        checkpoint.percent = Math.min(92, 45 + Math.round(checkpoint.feeIndex / Math.max(preview.feeRows.length,1) * 47));
        saveCheckpoint();
      }

      setProgress({ stage: "Phase 3 · Finalizing Fee Summaries", percent: 94, done: 0, total: checkpoint.studentIds.length, message: "Recalculating totals for affected Master Students" });
      const finalized = await postBatch({ action: "finalize", phase: "finalize", studentIds: checkpoint.studentIds });
      checkpoint.percent = 100;
      checkpoint.complete = true;
      saveCheckpoint();
      const summary = {
        studentsMatchedUpdated: checkpoint.summary.updated,
        newStudentsCreated: checkpoint.summary.created,
        registrationsLinked: checkpoint.summary.enrollmentsLinked,
        newReceiptsAdded: checkpoint.summary.newReceiptsAdded,
        existingReceiptsUpdatedOrSkipped: checkpoint.summary.existingReceiptsUpdatedOrSkipped,
        duplicateReceiptsSkipped: checkpoint.summary.duplicateReceiptsSkipped,
        existingReceiptsUpdated: checkpoint.summary.existingReceiptsUpdated,
        unmatchedRows: [...preview.warnings, ...checkpoint.summary.warnings],
        studentProfilesProcessed: preview.profiles.length,
        feeRowsProcessed: preview.feeRows.length,
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
      setError("Import paused at student chunk " + (Math.floor(checkpoint.studentIndex / 200) + 1) + " / fee chunk " + (Math.floor(checkpoint.feeIndex / 500) + 1) + ": " + checkpoint.error + ". Completed chunks are saved. Select Resume Import to continue.");
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
  const unmatchedFeeCodes = new Set((result?.unmatchedRows || [])
    .filter(item => /fee registration|no matching registration\/enrollment|fee-only|legacy registration name is ambiguous/i.test(String(item.reason || "")))
    .map(item => String(item.stCode || item.studentId || "").trim()).filter(Boolean)).size;

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
            <div className="summary-card"><span>Student Data rows</span><strong>{preview.studentRows.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Unified profiles</span><strong>{preview.profileCount.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Registration codes</span><strong>{preview.registrationCount.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Fee receipts</span><strong>{preview.feeRows.length.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Legacy registrations</span><strong>{preview.legacyRegistrations.toLocaleString("en-IN")}</strong></div>
            <div className="summary-card"><span>Rows flagged</span><strong>{preview.warnings.length.toLocaleString("en-IN")}</strong></div>
          </div>}
          {preview && <div className="form-help"><b>Detected:</b> {preview.studentSheetName} (Student Data) · {preview.feeSheetName} (Fee Sheet). Name suffixes drive registration identity; the corrupted fee St_Code / St_Name_cr columns are not trusted when St_Name contains a code.</div>}
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
            <div className="summary-card"><span>Fee Receipts Added</span><strong>{result.newReceiptsAdded}</strong></div>
            <div className="summary-card"><span>Duplicate Receipts Skipped</span><strong>{result.duplicateReceiptsSkipped}</strong></div>
            <div className="summary-card"><span>Existing Receipts Repaired</span><strong>{result.existingReceiptsUpdated}</strong></div>
            <div className="summary-card"><span>St_Code Collisions Flagged</span><strong>{collisionCount}</strong></div>
            <div className="summary-card"><span>Unmatched Fee-Only Codes</span><strong>{unmatchedFeeCodes}</strong></div>
            <div className="summary-card"><span>Rows Requiring Review</span><strong>{result.unmatchedRows.length}</strong></div>
          </div>
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
