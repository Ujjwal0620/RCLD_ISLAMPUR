const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;

export function normalizeStudentCode(value) {
  let code = String(value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(/[\u00A0\s]+/g, "")
    .trim()
    .toUpperCase();
  code = code.replace(/\.0+$/, "");
  if (/^\d+$/.test(code)) code = code.replace(/^0+(?=\d)/, "");
  return code;
}

export function normalizeImportName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function parseImportAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (value === null || value === undefined || value === "") return NaN;
  let raw = String(value).normalize("NFKC").replace(INVISIBLE, "").trim();
  if (!raw) return NaN;
  const negative = /^\(.*\)$/.test(raw);
  raw = raw.replace(/^\(|\)$/g, "");
  raw = raw.replace(/(?:₹|INR|RS\.?)/gi, "").replace(/,/g, "").replace(/\s+/g, "");
  raw = raw.replace(/\/[-–—]?$/, "").replace(/[-–—]$/, "");
  raw = raw.replace(/[^0-9.+-]/g, "");
  if (!raw || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return NaN;
  const amount = Number(raw);
  return Number.isFinite(amount) ? (negative ? -Math.abs(amount) : amount) : NaN;
}

export function normalizeReceiptNumber(value) {
  return String(value ?? "").normalize("NFKC").replace(INVISIBLE, "").trim().replace(/\.0+$/, "").replace(/\s+/g, "").toUpperCase();
}

export function makeReceiptBusinessKey(stCode, mrNo, paymentDate) {
  const date = paymentDate instanceof Date ? paymentDate.toISOString().slice(0, 10) : String(paymentDate ?? "").slice(0, 10);
  return [normalizeStudentCode(stCode), normalizeReceiptNumber(mrNo), date].join("|");
}
