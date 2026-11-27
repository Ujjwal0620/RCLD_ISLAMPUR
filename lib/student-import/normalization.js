import * as XLSX from "xlsx";

const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;
export const cleanText = value => String(value ?? "").normalize("NFKC").replace(INVISIBLE, "").replace(/\u00A0/g, " ").trim();
export const normalizeHeader = value => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
export const normalizeName = value => cleanText(value)
  .replace(/_\d+\s*$/, "")
  .replace(/[',.]+$/, "")
  .toUpperCase()
  .replace(/\s+/g, " ")
  .replace(/[',.]+$/g, "")
  .trim();
export const normalizeFatherName = value => normalizeName(value).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export const normalizeStCode = value => {
  let code = String(value ?? "").normalize("NFKC").replace(INVISIBLE, "").replace(/[\u00A0\s]+/g, "").trim().toUpperCase();
  code = code.replace(/\.0+$/, "");
  if (/^\d+$/.test(code)) code = code.replace(/^0+(?=\d)/, "");
  return code;
};
export const normalizeReceiptNo = value => cleanText(value).replace(/\.0+$/, "").replace(/\s+/g, "");
export const parseMoney = value => {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (value === null || value === undefined || value === "") return NaN;
  let raw = cleanText(value);
  if (!raw) return NaN;
  const negative = /^\(.*\)$/.test(raw);
  raw = raw.replace(/^\(|\)$/g, "").replace(/(?:₹|INR|RS\.?)/gi, "").replace(/,/g, "").replace(/\s+/g, "");
  raw = raw.replace(/\/[-–—]?$/, "").replace(/[-–—]$/, "").replace(/[^0-9.+-]/g, "");
  if (!raw || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return NaN;
  const amount = Number(raw);
  return Number.isFinite(amount) ? (negative ? -Math.abs(amount) : amount) : NaN;
};
export const parsePhones = value => [...new Set(cleanText(Array.isArray(value) ? value.join(",") : value).split(/[,;/|]/)
  .map(item => item.replace(/\D/g, ""))
  .map(item => item.length > 10 ? item.slice(-10) : item)
  .filter(item => item.length === 10))];

export function parseExcelDate(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const raw = cleanText(value);
  let match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (match) {
    const parsedYear = Number(match[3]);
    const year = parsedYear < 100 ? (parsedYear < 50 ? 2000 + parsedYear : 1900 + parsedYear) : parsedYear;
    const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));
    return date.getUTCFullYear() === year && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[1]) ? date : null;
  }
  match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function findHeaderRow(grid, requiredHeaders) {
  return grid.findIndex(row => {
    const headers = row.map(normalizeHeader);
    return requiredHeaders.every(header => headers.includes(header));
  });
}
