import * as XLSX from "xlsx";
import {
  cleanImportText,
  detectRepeatingPaymentGroups
} from "./universal-import-helpers.mjs";

const CORE_FIELDS = [
  "primaryCode", "allCodes", "name", "fatherName", "dob", "sex", "phone",
  "address", "qualification", "formNo", "admissionDate", "course",
  "totalPaid", "matchedPayments"
];

const normalizeHeader = value => cleanImportText(value).toLowerCase().replace(/[^a-z0-9]/g, "");

function inferCellShape(value, header) {
  const key = normalizeHeader(header);
  if (value === null || value === undefined || value === "") return null;
  if (/(name|father|guardian|address|phone|mobile|whatsapp|aadhaar|mrno|receipt)/.test(key)) {
    if (/phone|mobile|whatsapp/.test(key)) return "[PHONE]";
    if (/address/.test(key)) return "[ADDRESS]";
    if (/mrno|receipt/.test(key)) return "[RECEIPT]";
    return "[TEXT]";
  }
  if (/(date|dob|admission)/.test(key) || value instanceof Date) return "[DATE]";
  if (/(amount|paid|fee|total)/.test(key) && Number.isFinite(Number(value))) return Number(value);
  if (typeof value === "number") return Number.isInteger(value) ? 123 : 123.45;
  if (typeof value === "boolean") return true;
  return "[TEXT]";
}

export function extractWorkbookMetadata(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false });
    let headerIndex = grid.findIndex(row => Array.isArray(row) && row.some(cell => cleanImportText(cell)));
    if (headerIndex < 0) headerIndex = 0;
    const headers = (grid[headerIndex] || []).map(value => cleanImportText(value));
    const samples = grid.slice(headerIndex + 1).filter(row => row?.some(value => value !== null && value !== "")).slice(0, 5)
      .map(row => headers.map((header, index) => inferCellShape(row[index], header)));
    return {
      name,
      headerRow: headerIndex + 1,
      headers,
      sampleRows: samples,
      repeatingPaymentGroups: detectRepeatingPaymentGroups(headers).slice(0, 5).map(({ slot, ...fields }) => ({
        slot, fields: Object.keys(fields)
      }))
    };
  });
  return { sheetNames: workbook.SheetNames, sheets };
}

function aliasesFor(field) {
  const aliases = {
    primaryCode: ["primarystcode", "stcode", "studentcode", "registrationcode", "regnno", "enrollmentno", "primarycode"],
    allCodes: ["allregistrationcodes", "allcodes", "previouscodes", "registrationcodes"],
    name: ["studentname", "stname", "name", "applicantname", "fullname"],
    fatherName: ["fathername", "fatherorhusbandname", "guardianname", "father"],
    dob: ["dob", "dateofbirth", "birthdate"],
    sex: ["sex", "gender"],
    phone: ["phone", "phno", "mobile", "mobilenumber", "contactnumber", "whatsappnumber"],
    address: ["address", "presentaddress", "permanentaddress"],
    qualification: ["qualification", "education"],
    formNo: ["formno", "formnumber", "applicationno"],
    admissionDate: ["admissiondate", "dateofadmission", "doa"],
    course: ["course", "coursename", "coursecode", "program"],
    totalPaid: ["totalpaid", "amtpaid", "amountpaid", "paidamount"],
    matchedPayments: ["matchedpayments", "paymentcount", "matchedpaymentcount"]
  };
  return aliases[field] || [];
}

function findHeader(headers, field) {
  const normalized = headers.map(normalizeHeader);
  const aliases = aliasesFor(field);
  const exact = aliases.map(alias => normalized.indexOf(alias)).find(index => index >= 0);
  if (exact !== undefined) return headers[exact];
  if (field === "name") {
    const index = normalized.findIndex(value => value.includes("studentname") || value === "fullname");
    if (index >= 0) return headers[index];
  }
  return null;
}

function findPaymentHeader(headers, field) {
  const aliases = {
    sourceCode: ["sourcestcode", "stcode", "studentcode", "registrationcode", "regnno", "enrollmentno"],
    name: ["studentname", "stname", "name", "applicantname", "fullname"],
    amount: ["amount", "amt", "amtpaid", "amountpaid", "paidamount", "paymentamount", "receivedamount"],
    mrNo: ["mrno", "mrnumber", "receiptno", "receiptnumber", "receipt", "challanno"],
    date: ["dop", "dateofpayment", "paymentdate", "paiddate", "transactiondate", "date"],
    course: ["course", "coursename", "coursecode", "program"]
  };
  const normalized = headers.map(normalizeHeader);
  const index = (aliases[field] || []).map(alias => normalized.indexOf(alias)).find(value => value >= 0);
  return index === undefined ? null : headers[index];
}

export function buildHeuristicBlueprint(metadata) {
  const sheets = metadata.sheets || [];
  const ranked = sheets.map(sheet => {
    const normalized = sheet.headers.map(normalizeHeader);
    const paymentGroups = detectRepeatingPaymentGroups(sheet.headers);
    const studentScore = ["name", "primaryCode", "admissionDate", "course"].reduce((sum, field) => sum + (findHeader(sheet.headers, field) ? 1 : 0), 0);
    const paymentScore = ["amount", "mrNo", "date"].reduce((sum, field) => sum + (normalized.some(value => {
      const aliases = field === "amount" ? ["amount", "amountpaid", "amtpaid"] : field === "mrNo" ? ["mrno", "receiptno", "receiptnumber"] : ["date", "paymentdate", "dop"];
      return aliases.includes(value);
    }) ? 1 : 0), 0);
    return { sheet, paymentGroups, studentScore, paymentScore };
  });
  const student = [...ranked].sort((a, b) => b.studentScore - a.studentScore)[0];
  const separatePayment = ranked.filter(item => item !== student).sort((a, b) => b.paymentScore - a.paymentScore)[0];
  const hasWide = Boolean(student?.paymentGroups.length);
  const hasTall = Boolean(separatePayment && separatePayment.paymentScore >= 2);
  const layoutType = hasWide ? "wide_repeating_payments" : hasTall ? "multi_sheet_linked" : "single_sheet_flat";
  const studentSheet = student?.sheet || sheets[0];
  const paymentSheet = hasWide ? null : (hasTall ? separatePayment.sheet : null);
  const columns = Object.fromEntries(CORE_FIELDS.map(field => [field, findHeader(studentSheet?.headers || [], field)]));
  const paymentColumns = paymentSheet ? {
    sourceCode: findPaymentHeader(paymentSheet.headers, "sourceCode"),
    name: findPaymentHeader(paymentSheet.headers, "name"),
    amount: findPaymentHeader(paymentSheet.headers, "amount"),
    mrNo: findPaymentHeader(paymentSheet.headers, "mrNo"),
    date: findPaymentHeader(paymentSheet.headers, "date"),
    course: findPaymentHeader(paymentSheet.headers, "course")
  } : null;
  return {
    layoutType,
    studentSheet: studentSheet?.name || "",
    paymentSheet: paymentSheet?.name || null,
    headerRows: Object.fromEntries(sheets.map(item => [item.name, item.headerRow])),
    columns,
    paymentColumns,
    repeatingPayments: {
      headerPattern: "^(?:Payment|Payment Slot)\\s*(?<slot>\\d+)\\s*[-_]\\s*(?<field>Source Code|St Code|Student Code|Amount|Amount Paid|MR No|Receipt No|Date|Payment Date)$",
      slotsDetected: student?.paymentGroups?.length || 0,
      groups: student?.paymentGroups || []
    },
    confidence: "heuristic",
    notes: ["Mapping was generated deterministically; review every mapped field before preview."]
  };
}

export function validateImportBlueprint(blueprint, metadata) {
  const errors = [];
  const sheetNames = new Set((metadata.sheets || []).map(sheet => sheet.name));
  if (!blueprint || !["wide_repeating_payments", "single_sheet_flat", "multi_row_per_student", "multi_sheet_linked"].includes(blueprint.layoutType)) {
    errors.push("Invalid or unsupported layoutType.");
  }
  if (!sheetNames.has(blueprint.studentSheet)) errors.push("studentSheet does not exist in this workbook.");
  if (blueprint.paymentSheet && !sheetNames.has(blueprint.paymentSheet)) errors.push("paymentSheet does not exist in this workbook.");
  const student = (metadata.sheets || []).find(sheet => sheet.name === blueprint.studentSheet);
  const headers = new Set(student?.headers || []);
  for (const [field, header] of Object.entries(blueprint.columns || {})) {
    if (header && !headers.has(header)) errors.push("Mapped student header for " + field + " is not present.");
  }
  return { valid: errors.length === 0, errors };
}

export async function analyzeWorkbookWithGroq(buffer) {
  const metadata = extractWorkbookMetadata(buffer);
  const fallback = buildHeuristicBlueprint(metadata);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { blueprint: fallback, provider: "heuristic", reason: "GROQ_API_KEY is not configured.", metadata };

  const system = [
    "You are a spreadsheet schema analyst. Analyze workbook structure only.",
    "Never infer or return student identities or personal data. Sample cells are redacted type placeholders.",
    "Return exactly one JSON object, no markdown, with keys: layoutType, studentSheet, paymentSheet, headerRows, columns, paymentColumns, repeatingPayments, confidence, notes.",
    "layoutType must be wide_repeating_payments, single_sheet_flat, multi_row_per_student, or multi_sheet_linked.",
    "columns must map primaryCode, allCodes, name, fatherName, dob, sex, phone, address, qualification, formNo, admissionDate, course, totalPaid, matchedPayments to exact header strings or null.",
    "For repeating payment slots provide a general headerPattern and detected slot field mappings; do not enumerate every slot in prose.",
    "Use only sheet names and headers supplied. Do not invent headers."
  ].join(" ");
  const user = JSON.stringify(metadata);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }]
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error("Groq request failed with HTTP " + response.status);
    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
    const validation = validateImportBlueprint(parsed, metadata);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    return { blueprint: { ...fallback, ...parsed, confidence: parsed.confidence || "ai" }, provider: "groq", metadata };
  } catch (error) {
    return { blueprint: fallback, provider: "heuristic", reason: error.message || "Groq analysis failed.", metadata };
  }
}
