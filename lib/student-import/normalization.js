import * as XLSX from "xlsx";

export const cleanText = value => String(value ?? "").trim();
export const normalizeHeader = value => cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
export const normalizeName = value => cleanText(value)
  .normalize("NFKC")
  .replace(/[',.]+$/, "")
  .replace(/_\d+\s*$/, "")
  .toUpperCase()
  .replace(/\s+/g, " ")
  .replace(/[',.]+$/g, "")
  .trim();
export const normalizeFatherName = value => normalizeName(value).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
export const normalizeStCode = value => String(value ?? "").replace(/\.0$/, "").trim();
export const parsePhones = value => [...new Set(cleanText(Array.isArray(value) ? value.join(",") : value).split(/[,;/|]/)
  .map(item => item.replace(/\D/g, ""))
  .map(item => item.length > 10 ? item.slice(-10) : item)
  .filter(item => item.length === 10))];

export function parseExcelDate(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const raw = cleanText(value);
  let match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

export function findHeaderRow(grid, requiredHeaders) {
  return grid.findIndex(row => {
    const headers = row.map(normalizeHeader);
    return requiredHeaders.every(header => headers.includes(header));
  });
}
