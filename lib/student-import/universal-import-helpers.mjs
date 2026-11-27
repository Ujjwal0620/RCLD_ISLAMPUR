const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;
const CONTROL = /[\u0000-\u001F\u007F]/;

export function cleanImportText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

export function sanitizeStudentCode(value) {
  const raw = cleanImportText(value);
  if (!raw || CONTROL.test(raw)) return "";
  const code = raw.replace(/\.0+$/, "").toUpperCase();
  if (code.length > 32 || !/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) return "";
  return code;
}

export function normalizeImportName(value) {
  return cleanImportText(value).replace(/\s+/g, " ").toUpperCase();
}

export function normalizePhoneNumbers(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(/[;,/|]+/);
  const numbers = [...new Set(values.map(item => String(item ?? "").replace(/\D/g, ""))
    .filter(number => number.length >= 7 && number.length <= 15))];
  return { primaryPhone: numbers[0] || "", alternatePhones: numbers.slice(1) };
}

export function normalizeImportAddress(value) {
  return cleanImportText(value)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ");
}

function validCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function parseImportDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return validCalendarDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 1 || value > 2958465) return null;
    const milliseconds = Math.round(value * 86400000);
    const date = new Date(Date.UTC(1899, 11, 30) + milliseconds);
    return validCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const raw = cleanImportText(value);
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (match) return validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    return validCalendarDate(year, Number(match[2]), Number(match[1]));
  }
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return validCalendarDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

export function dateISO(value) {
  const date = value instanceof Date ? value : parseImportDate(value);
  return date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

export function detectRepeatingPaymentGroups(headers = []) {
  const groups = new Map();
  const patterns = [
    ["sourceCode", /^(?:payment|payment\s*slot)\s*(\d+)\s*[-_ ]\s*(?:source\s*code|st\s*code|student\s*code)$/i],
    ["amount", /^(?:payment|payment\s*slot)\s*(\d+)\s*[-_ ]\s*(?:amount|amount\s*paid)$/i],
    ["mrNo", /^(?:payment|payment\s*slot)\s*(\d+)\s*[-_ ]\s*(?:mr\s*no|receipt(?:\s*no)?|receipt\s*number)$/i],
    ["date", /^(?:payment|payment\s*slot)\s*(\d+)\s*[-_ ]\s*(?:date|payment\s*date)$/i]
  ];
  headers.forEach((header, index) => {
    const text = cleanImportText(header);
    for (const [field, pattern] of patterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const slot = Number(match[1]);
      if (!groups.has(slot)) groups.set(slot, { slot });
      groups.get(slot)[field] = index;
      break;
    }
  });
  return [...groups.values()].sort((a, b) => a.slot - b.slot);
}

export function paymentCompositeKey(payment = {}) {
  const code = sanitizeStudentCode(payment.sourceCode || payment.stCode);
  const date = dateISO(payment.paymentDate || payment.date);
  const amount = Number(payment.amountPaid ?? payment.amount);
  if (!code || !date || !Number.isFinite(amount)) return "";
  const mrNo = cleanImportText(payment.mrNo).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return mrNo
    ? [mrNo, date, amount.toFixed(2), code].join("|")
    : [date, amount.toFixed(2), code].join("|");
}

function numericCodeCompare(a, b) {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const left = BigInt(a), right = BigInt(b);
    return left < right ? -1 : left > right ? 1 : 0;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function resolveCurrentStudentCode({
  existingCodes = [],
  existingCurrentCode = "",
  incomingPrimaryCode = "",
  allRegistrationCodes = [],
  paymentRecords = [],
  admissionRecords = [],
  existingTimeline = []
} = {}) {
  const codeSet = new Set();
  const add = value => {
    const code = sanitizeStudentCode(value);
    if (code) codeSet.add(code);
  };
  [existingCurrentCode, incomingPrimaryCode, ...existingCodes, ...allRegistrationCodes].forEach(add);
  paymentRecords.forEach(item => add(item.sourceCode || item.stCode));
  admissionRecords.forEach(item => add(item.code || item.stCode));
  existingTimeline.forEach(item => add(item.code || item.stCode));

  const timeline = [];
  const push = (items, source) => items.forEach(item => {
    const code = sanitizeStudentCode(item.sourceCode || item.code || item.stCode);
    const date = parseImportDate(item.date || item.paymentDate || item.admissionDate);
    if (code && date) timeline.push({ code, date, source });
  });
  push(paymentRecords, "incoming-payment");
  push(admissionRecords, "incoming-admission");
  push(existingTimeline, "existing-database");

  if (!codeSet.size) return { currentCode: "", previousCodes: [], sourceDate: null, source: "NONE", timeline };
  const latestDate = timeline.reduce((latest, item) => Math.max(latest, item.date.getTime()), -Infinity);
  let winner = "";
  let source = "ALL_REGISTRATION_CODES";
  let sourceDate = null;

  if (Number.isFinite(latestDate)) {
    const latest = timeline.filter(item => item.date.getTime() === latestDate);
    const existingLatest = latest.filter(item => item.source === "existing-database");
    const excelLatest = latest.filter(item => item.source !== "existing-database");
    const pool = existingLatest.length && !excelLatest.length ? existingLatest : latest;
    winner = pool.map(item => item.code).sort(numericCodeCompare).at(-1);
    source = pool[0]?.source || source;
    sourceDate = new Date(latestDate);
  } else {
    const preferred = allRegistrationCodes.map(sanitizeStudentCode).filter(Boolean);
    winner = (preferred.length ? preferred : [...codeSet]).sort(numericCodeCompare).at(-1);
  }

  if (!winner && existingCurrentCode) winner = sanitizeStudentCode(existingCurrentCode);
  return {
    currentCode: winner,
    previousCodes: [...codeSet].filter(code => code !== winner).sort(numericCodeCompare),
    sourceDate,
    source,
    timeline
  };
}

export function matchStudentByIdentity(incoming = {}, candidates = []) {
  const incomingName = normalizeImportName(incoming.name);
  const incomingCodes = new Set((incoming.codes || []).map(sanitizeStudentCode).filter(Boolean));
  const hits = [];
  for (const candidate of candidates) {
    const candidateCodes = new Set([
      candidate.currentStCode, candidate.primaryStCode, candidate.normalizedStCode,
      candidate.regnNo, candidate.enrollmentNo,
      ...(candidate.previousCodes || []), ...(candidate.allRegistrationCodes || []),
      ...(candidate.normalizedStCodes || []), ...(candidate.studentCodes || []),
      ...(candidate.stCodes || [])
    ].map(sanitizeStudentCode).filter(Boolean));
    const sharedCodes = [...incomingCodes].filter(code => candidateCodes.has(code));
    if (sharedCodes.length) hits.push({ candidate, sharedCodes });
  }
  if (!hits.length) return { status: "NEW", candidate: null, conflicts: [] };

  const exactNameHits = hits.filter(hit => {
    const existingName = normalizeImportName(hit.candidate.fullName || hit.candidate.applicantName || hit.candidate.name);
    return incomingName && existingName && incomingName === existingName;
  });
  const nameConflicts = hits.filter(hit => {
    const existingName = normalizeImportName(hit.candidate.fullName || hit.candidate.applicantName || hit.candidate.name);
    return incomingName && existingName && incomingName !== existingName;
  });
  if (nameConflicts.length && !exactNameHits.length) {
    return { status: "CONFLICT", candidate: null, conflicts: nameConflicts.map(hit => ({
      studentId: String(hit.candidate._id), sharedCodes: hit.sharedCodes,
      existingName: hit.candidate.fullName || hit.candidate.applicantName || hit.candidate.name || ""
    })) };
  }
  if (exactNameHits.length === 1) return { status: "MATCH", candidate: exactNameHits[0].candidate, sharedCodes: exactNameHits[0].sharedCodes, conflicts: [] };
  if (exactNameHits.length > 1) return { status: "CONFLICT", candidate: null, conflicts: exactNameHits.map(hit => ({ studentId: String(hit.candidate._id), sharedCodes: hit.sharedCodes })) };
  if (hits.length === 1 && !incomingName) return { status: "REVIEW", candidate: null, conflicts: hits.map(hit => ({ studentId: String(hit.candidate._id), sharedCodes: hit.sharedCodes, reason: "Incoming name is blank; identity cannot be verified." })) };
  return { status: "REVIEW", candidate: null, conflicts: hits.map(hit => ({ studentId: String(hit.candidate._id), sharedCodes: hit.sharedCodes, reason: "Code match requires identity verification." })) };
}
