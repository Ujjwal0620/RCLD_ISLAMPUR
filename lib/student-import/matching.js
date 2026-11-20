import { normalizeFatherName, normalizeName, parsePhones } from "./normalization";

function tokenOverlap(left, right) {
  const a = new Set(normalizeFatherName(left).split(" ").filter(Boolean));
  const b = new Set(normalizeFatherName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return false;
  const common = [...a].filter(token => b.has(token)).length;
  return common / Math.min(a.size, b.size) >= 0.6;
}

function similarity(left, right) {
  const a = normalizeName(left), b = normalizeName(right);
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

const isoDate = value => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

export function findIdentityMatch(row, candidates) {
  const name = normalizeName(row.fullName);
  const father = normalizeFatherName(row.fatherName);
  const phones = new Set(parsePhones(row.phoneNumbers || []));
  const dob = isoDate(row.dob);
  const exact = [];
  const spelling = [];

  for (const candidate of candidates) {
    const candidateName = normalizeName(candidate.fullName || candidate.normalizedFullName);
    const candidateFather = normalizeFatherName(candidate.fatherName);
    const candidateDob = isoDate(candidate.dob);
    const candidatePhones = new Set(parsePhones(candidate.phoneNumbers || []));
    const sameDob = Boolean(dob && candidateDob && dob === candidateDob);
    const sameFather = Boolean(father && candidateFather && (father === candidateFather || tokenOverlap(father, candidateFather)));
    const samePhone = [...phones].some(phone => candidatePhones.has(phone));

    if (candidateName === name && (sameDob || sameFather || samePhone)) {
      exact.push({ candidate, method: sameDob ? "NAME_DOB" : sameFather ? "NAME_FATHER_TOKEN" : "NAME_PHONE" });
      continue;
    }
    const score = similarity(name, candidateName);
    if (sameDob && father && candidateFather && father === candidateFather && score >= 0.85) {
      spelling.push({ candidate, method: "DOB_FATHER_NAME_SIMILARITY", score });
    }
  }

  const matches = exact.length ? exact : spelling;
  // Multiple legacy Student documents can be duplicate rows for the same identity.
  // Collapse equivalent candidates, but keep genuinely different identity matches ambiguous.
  const distinct = [];
  for (const item of matches) {
    const candidate = item.candidate;
    const equivalent = distinct.some(existing => {
      const other = existing.candidate;
      const sameName = normalizeName(candidate.fullName || candidate.normalizedFullName) === normalizeName(other.fullName || other.normalizedFullName);
      const sameDob = Boolean(isoDate(candidate.dob) && isoDate(candidate.dob) === isoDate(other.dob));
      const sameFather = tokenOverlap(candidate.fatherName, other.fatherName);
      const candidatePhones = new Set(parsePhones(candidate.phoneNumbers || []));
      const samePhone = parsePhones(other.phoneNumbers || []).some(phone => candidatePhones.has(phone));
      return sameName && (sameDob || sameFather || samePhone);
    });
    if (!equivalent) distinct.push(item);
  }
  if (distinct.length === 1) return { match: distinct[0].candidate, method: distinct[0].method, ambiguous: false };
  if (distinct.length > 1) return { match: null, method: "AMBIGUOUS", ambiguous: true, candidates: distinct.map(item => item.candidate._id) };
  return { match: null, method: "NEW_PROFILE", ambiguous: false };
}
