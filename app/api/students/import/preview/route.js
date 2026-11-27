import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Student from "@/models/Student";
import StudentMaster from "@/models/StudentMaster";
import StudentEnrollment from "@/models/StudentEnrollment";
import StudentFeePayment from "@/models/StudentFeePayment";
import ImportLog from "@/models/ImportLog";
import StudentImportStaging from "@/models/StudentImportStaging";
import { parseImportAmount } from "@/lib/student-import/normalization.mjs";
import {
  cleanImportText, sanitizeStudentCode, normalizeImportName, normalizePhoneNumbers,
  normalizeImportAddress, parseImportDate, dateISO, detectRepeatingPaymentGroups,
  resolveCurrentStudentCode, paymentCompositeKey, matchStudentByIdentity
} from "@/lib/student-import/universal-import-helpers.mjs";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([".xlsx", ".xls", ".csv"]);

const asHeaderIndex = (headers, name) => headers.indexOf(name);
const toDate = value => parseImportDate(value);
const parseCodeList = value => String(value ?? "").split(/[,;|]+/).map(sanitizeStudentCode).filter(Boolean);

function getSheetRows(workbook, sheetName, headerRow = 1) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Mapped worksheet not found: " + sheetName);
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, cellDates: true, blankrows: false });
  const index = Math.max(0, Number(headerRow || 1) - 1);
  const headers = (grid[index] || []).map(value => cleanImportText(value));
  return { headers, rows: grid.slice(index + 1), sheet };
}

function getValue(row, headers, header) {
  if (!header) return null;
  const index = asHeaderIndex(headers, header);
  return index < 0 ? null : row[index];
}

function normalizeStudentRow(row, headers, columns, rowNo, sheetName) {
  const value = field => getValue(row, headers, columns?.[field]);
  const rawName = cleanImportText(value("name"));
  const rawPrimary = value("primaryCode");
  const primaryCode = sanitizeStudentCode(rawPrimary);
  const rawPaymentCode = value("paymentSourceCode");
  const paymentSourceCode = sanitizeStudentCode(rawPaymentCode) || primaryCode;
  const allCodes = [...new Set([
    ...parseCodeList(value("allCodes")),
    primaryCode,
    paymentSourceCode
  ].filter(Boolean))];
  const phones = normalizePhoneNumbers(value("phone"));
  const dob = toDate(value("dob"));
  const admissionDate = toDate(value("admissionDate"));
  const warnings = [];
  if (!rawName) warnings.push("Student Name is blank; choose Create as New Student or Skip after review.");
  if (rawPrimary && !primaryCode) warnings.push("Primary Student Code is malformed and was excluded from code history.");
  if (rawPaymentCode && !sanitizeStudentCode(rawPaymentCode)) warnings.push("Payment Student Code is malformed and was excluded from code history.");
  const rawTallAmount = value("paymentAmount");
  const tallAmount = parseImportAmount(rawTallAmount);
  const tallMrNo = cleanImportText(value("paymentMrNo"));
  const rawTallDate = value("paymentDate");
  const tallDate = toDate(rawTallDate);
  const tallPaymentPresent = (rawTallAmount !== null && rawTallAmount !== "") || Boolean(tallMrNo) || Boolean(rawTallDate);
  const tallPayments = tallPaymentPresent ? [{
    sourceCode: paymentSourceCode,
    rawSourceCode: rawPaymentCode,
    amountPaid: tallAmount,
    mrNo: tallMrNo,
    paymentDate: tallDate,
    rawPaymentDate: rawTallDate,
    sourceSheet: sheetName,
    sourceRowNo: rowNo,
    warnings: [
      ...(!Number.isFinite(tallAmount) || tallAmount < 0 ? ["Payment amount is missing or invalid."] : []),
      ...(tallMrNo ? [] : ["Payment receipt number is missing."]),
      ...(tallDate ? [] : ["Payment date is missing or invalid."])
    ]
  }] : [];
  return {
    rowNo, sourceSheet: sheetName, name: rawName, normalizedName: normalizeImportName(rawName),
    fatherName: cleanImportText(value("fatherName")),
    dob, sex: cleanImportText(value("sex")),
    phone: phones.primaryPhone, alternatePhones: phones.alternatePhones,
    address: normalizeImportAddress(value("address")),
    qualification: cleanImportText(value("qualification")),
    formNo: cleanImportText(value("formNo")).replace(/\.0+$/, ""),
    admissionDate, course: cleanImportText(value("course")),
    totalPaid: Number.isFinite(parseImportAmount(value("totalPaid"))) ? parseImportAmount(value("totalPaid")) : null,
    matchedPayments: value("matchedPayments"),
    primaryCode, codes: allCodes, warnings, payments: tallPayments,
    registrations: primaryCode ? [{
      stCode: primaryCode, course: cleanImportText(value("course")),
      admissionDate, formNo: cleanImportText(value("formNo")).replace(/\\.0+$/, ""),
      qualification: cleanImportText(value("qualification")),
      address: normalizeImportAddress(value("address")),
      earliestPaymentDate: null
    }] : []
  };
}

function parseWidePayments(row, headers, slots, profile) {
  const payments = [];
  for (const slot of slots) {
    const rawSourceCode = slot.sourceCode === undefined ? "" : cleanImportText(row[slot.sourceCode]);
    const sourceCode = sanitizeStudentCode(rawSourceCode) || profile.primaryCode || "";
    const rawAmount = slot.amount === undefined ? null : row[slot.amount];
    const amountPaid = parseImportAmount(rawAmount);
    const mrNo = slot.mrNo === undefined ? "" : cleanImportText(row[slot.mrNo]);
    const rawDate = slot.date === undefined ? null : row[slot.date];
    const paymentDate = toDate(rawDate);
    if ((rawAmount === null || rawAmount === "") && !mrNo && !rawDate && !rawSourceCode) continue;
    const warnings = [];
    if (rawSourceCode && !sanitizeStudentCode(rawSourceCode)) warnings.push("Malformed Source Code retained as raw payment metadata and excluded from student code history.");
    if (!Number.isFinite(amountPaid) || amountPaid < 0) warnings.push("Payment amount is missing or invalid.");
    if (!paymentDate) warnings.push("Payment date is missing or invalid.");
    if (rawSourceCode && !sanitizeStudentCode(rawSourceCode)) {
      // The payment remains attached to the containing student row; the malformed value is not a code candidate.
    }
    payments.push({
      slot: slot.slot, rawSourceCode, sourceCode, amountPaid, mrNo,
      paymentDate, rawPaymentDate: rawDate, warnings
    });
  }
  return payments;
}

function dedupePayments(payments) {
  const unique = new Map();
  let duplicates = 0;
  for (const payment of payments) {
    const key = paymentCompositeKey(payment);
    if (!key) continue;
    if (unique.has(key)) { duplicates += 1; continue; }
    unique.set(key, payment);
  }
  return { payments: [...unique.values()], duplicates };
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to preview this import." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to preview student imports." }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const mappingRaw = form.get("mapping");
    if (!file || typeof file.arrayBuffer !== "function" || !mappingRaw) {
      return NextResponse.json({ error: "Workbook and reviewed mapping are required." }, { status: 400 });
    }
    const extension = "." + String(file.name || "").split(".").pop().toLowerCase();
    if (!ALLOWED.has(extension)) return NextResponse.json({ error: "Unsupported workbook format." }, { status: 415 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Workbook exceeds the 25 MB upload limit." }, { status: 413 });
    const mapping = JSON.parse(String(mappingRaw));
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", raw: true, cellDates: true });
    if (!workbook.SheetNames.includes(mapping.studentSheet)) throw new Error("Selected student sheet is not present in workbook.");

    const studentSheet = getSheetRows(workbook, mapping.studentSheet, mapping.headerRows?.[mapping.studentSheet] || 1);
    const detectedSlots = detectRepeatingPaymentGroups(studentSheet.headers);
    const slots = detectedSlots.filter(slot => Number.isInteger(slot.sourceCode) || Number.isInteger(slot.amount) || Number.isInteger(slot.date) || Number.isInteger(slot.mrNo));
    const byIdentity = new Map();
    const warnings = [];
    let studentRowsRead = 0;
    for (let index = 0; index < studentSheet.rows.length; index += 1) {
      const row = studentSheet.rows[index] || [];
      if (!row.some(value => value !== null && value !== "")) continue;
      studentRowsRead += 1;
      const profile = normalizeStudentRow(row, studentSheet.headers, mapping.columns || {}, index + Number(mapping.headerRows?.[mapping.studentSheet] || 1) + 1, mapping.studentSheet);
      profile.payments = [...(profile.payments || []), ...parseWidePayments(row, studentSheet.headers, slots, profile)];
      const identityKey = profile.normalizedName
        ? [profile.normalizedName, normalizeImportName(profile.fatherName), dateISO(profile.dob), profile.phone].join("|")
        : "ROW|" + profile.rowNo;
      const previous = byIdentity.get(identityKey);
      if (!previous) byIdentity.set(identityKey, profile);
      else {
        previous.codes = [...new Set([...previous.codes, ...profile.codes])];
        previous.payments.push(...profile.payments);
        const registrationKeys = new Set((previous.registrations || []).map(item => [item.stCode, normalizeImportName(item.course), dateISO(item.admissionDate)].join("|")));
        for (const registration of profile.registrations || []) {
          const key = [registration.stCode, normalizeImportName(registration.course), dateISO(registration.admissionDate)].join("|");
          if (!registrationKeys.has(key)) {
            previous.registrations = [...(previous.registrations || []), registration];
            registrationKeys.add(key);
          }
        }
        for (const field of ["fatherName", "dob", "sex", "phone", "address", "qualification", "formNo", "admissionDate", "course"]) {
          if (!previous[field] && profile[field]) previous[field] = profile[field];
        }
        previous.alternatePhones = [...new Set([...previous.alternatePhones, ...profile.alternatePhones])];
        previous.warnings.push(...profile.warnings);
      }
    }

    if (mapping.paymentSheet && mapping.paymentSheet !== mapping.studentSheet) {
      const paymentSheet = getSheetRows(workbook, mapping.paymentSheet, mapping.headerRows?.[mapping.paymentSheet] || 1);
      const paymentColumns = mapping.paymentColumns || {};
      const codeToProfiles = new Map();
      for (const profile of byIdentity.values()) for (const code of profile.codes) {
        codeToProfiles.set(code, [...(codeToProfiles.get(code) || []), profile]);
      }
      for (let index = 0; index < paymentSheet.rows.length; index += 1) {
        const row = paymentSheet.rows[index] || [];
        if (!row.some(value => value !== null && value !== "")) continue;
        const rawCode = getValue(row, paymentSheet.headers, paymentColumns.sourceCode);
        const code = sanitizeStudentCode(rawCode);
        const name = normalizeImportName(getValue(row, paymentSheet.headers, paymentColumns.name));
        const amountPaid = parseImportAmount(getValue(row, paymentSheet.headers, paymentColumns.amount));
        const mrNo = cleanImportText(getValue(row, paymentSheet.headers, paymentColumns.mrNo));
        const paymentDate = toDate(getValue(row, paymentSheet.headers, paymentColumns.date));
        const candidates = code ? (codeToProfiles.get(code) || []) : [...byIdentity.values()].filter(item => item.normalizedName === name);
        if (candidates.length !== 1) {
          warnings.push({ row: index + Number(mapping.headerRows?.[mapping.paymentSheet] || 1) + 1, sheet: mapping.paymentSheet, code: rawCode, reason: candidates.length ? "Payment identity is ambiguous." : "Payment row has no safe student match." });
          continue;
        }
        candidates[0].payments.push({ sourceCode: code || candidates[0].primaryCode, rawSourceCode: rawCode, amountPaid, mrNo, paymentDate, warnings: [] });
      }
    }

    const groups = [...byIdentity.values()].map(profile => {
      const deduped = dedupePayments(profile.payments);
      profile.payments = deduped.payments;
      profile.duplicatePaymentsInWorkbook = deduped.duplicates;
      profile.codes = [...new Set([...profile.codes, ...profile.payments.map(item => sanitizeStudentCode(item.sourceCode)).filter(Boolean)])];
      profile.payments.forEach(payment => {
        if (payment.warnings?.length) profile.warnings.push(...payment.warnings);
      });
      return profile;
    });

    await connectMongoDB();
    const allCodes = [...new Set(groups.flatMap(group => group.codes))];
    const codeQuery = allCodes.length ? { $in: allCodes } : { $in: ["__NO_IMPORT_CODES__"] };
    const [masters, legacyStudents] = await Promise.all([
      StudentMaster.find({ mergedIntoMasterId: null, $or: [
        { normalizedStCodes: codeQuery }, { studentCodes: codeQuery }, { stCodes: codeQuery },
        { primaryStCode: codeQuery }, { currentStCode: codeQuery },
        { previousCodes: codeQuery }, { allRegistrationCodes: codeQuery },
        { "registrations.stCode": codeQuery }, { "enrollments.stCode": codeQuery }
      ] }).lean(),
      Student.find({ $or: [
        { normalizedStCode: codeQuery }, { regnNo: codeQuery }, { enrollmentNo: codeQuery },
        { previousCodes: codeQuery }, { allRegistrationCodes: codeQuery }
      ] }).lean()
    ]);
    const masterIds = masters.map(item => item._id);
    const [enrollments, payments] = await Promise.all([
      masterIds.length ? StudentEnrollment.find({ studentId: { $in: masterIds } }).lean() : [],
      (masterIds.length || allCodes.length) ? StudentFeePayment.find({ $or: [
        ...(masterIds.length ? [{ studentId: { $in: masterIds } }, { masterStudentId: { $in: masterIds } }] : []),
        ...(allCodes.length ? [{ normalizedStCode: { $in: allCodes } }, { stCode: { $in: allCodes } }] : [])
      ] }).lean() : []
    ]);

    const existingPaymentKeys = new Set();
    for (const payment of payments) {
      const key = paymentCompositeKey({
        sourceCode: payment.sourceStCode || payment.normalizedStCode || payment.stCode,
        mrNo: payment.normalizedMrNo || payment.mrNo,
        paymentDate: payment.paymentDate,
        amountPaid: payment.amountPaid
      });
      if (key) existingPaymentKeys.add(key);
    }

    const staged = [];
    const summary = {
      totalRows: studentRowsRead,
      existingStudentsToUpdate: 0,
      codeChangesDetected: [],
      newPaymentsToAdd: 0,
      duplicatePaymentsSkipped: 0,
      newStudents: 0,
      conflicts: 0,
      warnings: 0,
      paymentRowsRead: groups.reduce((sum, group) => sum + group.payments.length + group.duplicatePaymentsInWorkbook, 0)
    };

    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      // Match canonical master profiles first. A legacy Student document already
      // linked through legacyStudentIds is the same person, not a second candidate.
      const linkedLegacyIds = new Set(masters.flatMap(item => (item.legacyStudentIds || []).map(id => String(id))));
      const masterMatch = matchStudentByIdentity({ name: group.name, codes: group.codes }, masters);
      let match = masterMatch;
      if (masterMatch.status === "NEW") {
        const unlinkedLegacyStudents = legacyStudents.filter(item => !linkedLegacyIds.has(String(item._id)));
        match = matchStudentByIdentity({ name: group.name, codes: group.codes }, unlinkedLegacyStudents);
      }
      const matchedMaster = match.status === "MATCH" && masters.find(item => String(item._id) === String(match.candidate._id));
      const matchedLegacy = match.status === "MATCH" && legacyStudents.find(item => String(item._id) === String(match.candidate._id));
      const existingCodeValues = matchedMaster
        ? [...(matchedMaster.previousCodes || []), ...(matchedMaster.allRegistrationCodes || []), ...(matchedMaster.normalizedStCodes || []), ...(matchedMaster.studentCodes || []), ...(matchedMaster.stCodes || []), matchedMaster.primaryStCode, matchedMaster.currentStCode]
        : matchedLegacy ? [...(matchedLegacy.previousCodes || []), ...(matchedLegacy.allRegistrationCodes || []), matchedLegacy.normalizedStCode, matchedLegacy.regnNo, matchedLegacy.enrollmentNo] : [];
      const relatedPayments = matchedMaster ? payments.filter(item => String(item.studentId) === String(matchedMaster._id) || String(item.masterStudentId) === String(matchedMaster._id)) : [];
      const relatedEnrollments = matchedMaster ? enrollments.filter(item => String(item.studentId) === String(matchedMaster._id)) : [];
      const timeline = [
        ...relatedPayments.map(item => ({ code: item.sourceStCode || item.normalizedStCode || item.stCode, date: item.paymentDate })),
        ...relatedEnrollments.map(item => ({ code: item.normalizedStCode || item.stCode, date: item.admissionDate })),
        ...(matchedMaster?.currentAdmissionDate ? [{ code: matchedMaster.currentStCode || matchedMaster.primaryStCode, date: matchedMaster.currentAdmissionDate }] : [])
      ];
      const resolution = resolveCurrentStudentCode({
        existingCodes: existingCodeValues,
        existingCurrentCode: matchedMaster?.currentStCode || matchedMaster?.primaryStCode || matchedLegacy?.normalizedStCode || matchedLegacy?.regnNo,
        incomingPrimaryCode: group.primaryCode,
        allRegistrationCodes: group.codes,
        paymentRecords: group.payments.map(item => ({ sourceCode: item.sourceCode, paymentDate: item.paymentDate })),
        admissionRecords: (group.registrations || []).filter(item => item.admissionDate).map(item => ({ code: item.stCode, admissionDate: item.admissionDate })),
        existingTimeline: timeline
      });
      const codeSet = new Set(group.codes);
      const paymentKeys = group.payments.map(paymentCompositeKey).filter(Boolean);
      const duplicateCount = paymentKeys.filter(key => existingPaymentKeys.has(key)).length;
      const newCount = paymentKeys.length - duplicateCount;
      summary.duplicatePaymentsSkipped += duplicateCount + group.duplicatePaymentsInWorkbook;
      summary.newPaymentsToAdd += newCount;
      const action = match.status === "MATCH" ? "UPDATE" : match.status === "NEW" && group.name ? "NEW" : match.status === "CONFLICT" ? "CONFLICT" : "REVIEW";
      if (action === "UPDATE") summary.existingStudentsToUpdate += 1;
      if (action === "NEW") summary.newStudents += 1;
      if (action === "CONFLICT" || action === "REVIEW") summary.conflicts += 1;
      if (resolution.currentCode && (matchedMaster?.currentStCode || matchedMaster?.primaryStCode || matchedLegacy?.regnNo) && resolution.currentCode !== (matchedMaster?.currentStCode || matchedMaster?.primaryStCode || matchedLegacy?.regnNo)) {
        summary.codeChangesDetected.push({
          studentName: group.name, oldCode: matchedMaster?.currentStCode || matchedMaster?.primaryStCode || matchedLegacy?.regnNo,
          newCode: resolution.currentCode, latestDate: resolution.sourceDate ? dateISO(resolution.sourceDate) : null
        });
      }
      const groupWarnings = [...group.warnings];
      if (action === "REVIEW" && !group.name) groupWarnings.push("Student name is required for safe matching; skip or explicitly create after review.");
      summary.warnings += groupWarnings.length;
      staged.push({
        importBatchId: "", sequence: index, groupKey: createHash("sha256").update([group.normalizedName, [...codeSet].sort().join(",")].join("|")).digest("hex"),
        action, matchedMasterId: matchedMaster?._id || null, matchedLegacyStudentId: matchedLegacy?._id || null,
        resolvedCurrentCode: resolution.currentCode, codeHistory: resolution.previousCodes,
        codeSourceDate: resolution.sourceDate, student: group,
        registrations: (group.registrations || []).map(item => ({ ...item })),
        payments: group.payments, warnings: groupWarnings, conflicts: match.conflicts || []
      });
    }

    summary.totalGroups = staged.length;
    const importBatchId = randomUUID();
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    await ImportLog.create({
      importBatchId, importType: "UNIVERSAL_STUDENT_WORKBOOK", sourceFileName: String(file.name || ""),
      sourceFileHash: fileHash, actorId: String(session.sub), actorRole: String(session.role || ""),
      status: "PREVIEW_READY", layoutType: mapping.layoutType, mapping,
      summary, warnings, conflictCount: summary.conflicts, totalGroups: staged.length,
      totalChunks: Math.ceil(staged.length / 100)
    });
    if (staged.length) {
      await StudentImportStaging.insertMany(staged.map(item => ({ ...item, importBatchId })), { ordered: true });
    }
    return NextResponse.json({ importBatchId, summary, stagedGroups: staged.length, warnings, conflicts: staged.filter(item => item.conflicts?.length || ["CONFLICT", "REVIEW"].includes(item.action)).slice(0, 500) });
  } catch (error) {
    console.error("[student-import-preview]", error);
    return NextResponse.json({ error: "Student import preview failed.", detail: error.message }, { status: 500 });
  }
}
