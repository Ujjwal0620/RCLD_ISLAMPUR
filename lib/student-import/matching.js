import { normalizeFatherName, normalizeName, parsePhones } from "./normalization";

function tokenOverlap(left, right) {
  const a = new Set(normalizeFatherName(left).split(" ").filter(Boolean));
  const b = new Set(normalizeFatherName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return false;
  const common = [...a].filter(token => b.has(token)).length;
  return common / Math.min(a.size, b.size) >= 0.6;
}

export function findIdentityMatch(row, candidates) {
  const name = normalizeName(row.fullName);
  const father = normalizeFatherName(row.fatherName);
  const phones = new Set(parsePhones((row.phoneNumbers || []).join(",")));
  const dob = row.dob ? new Date(row.dob).toISOString().slice(0, 10) : "";
  const matches = [];

  for (const candidate of candidates) {
    if (candidate.normalizedFullName !== name) continue;
    const candidateDob = candidate.dob ? new Date(candidate.dob).toISOString().slice(0, 10) : "";
    if (dob && candidateDob === dob && tokenOverlap(father, candidate.fatherName)) {
      matches.push({ candidate, method: "NAME_DOB_FATHER_TOKEN" });
      continue;
    }
    if (father && normalizeFatherName(candidate.fatherName) === father) {
      const candidatePhones = new Set(candidate.phoneNumbers || []);
      if ([...phones].some(phone => phone.length === 10 && candidatePhones.has(phone))) {
        matches.push({ candidate, method: "NAME_FATHER_PHONE" });
      }
    }
  }
  if (matches.length === 1) return { match: matches[0].candidate, method: matches[0].method, ambiguous: false };
  if (matches.length > 1) return { match: null, method: "AMBIGUOUS", ambiguous: true, candidates: matches.map(item => item.candidate._id) };
  return { match: null, method: "NEW_PROFILE", ambiguous: false };
}
