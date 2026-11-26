// Shared, deterministic identity resolution for workbook imports and migrations.
export const cleanText = value => String(value ?? "").normalize("NFKC").trim();

export function normalizeStudentName(value) {
  const firstLine = cleanText(value).split(/\r?\n/)[0];
  return firstLine.replace(/_\d+[\s\S]*$/, "").replace(/\s+/g, " ").trim().toUpperCase();
}
export function normalizeIdentityText(value) {
  return normalizeStudentName(value).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
export function normalizeFatherName(value) {
  return cleanText(value).replace(/[^A-Z0-9 ]/gi, " ").replace(/\s+/g, " ").trim().toUpperCase();
}
export function normalizeIndianPhones(value) {
  const values = Array.isArray(value) ? value : [value];
  const found = new Set();
  for (const raw of values) {
    for (const part of cleanText(raw).split(/[,/;|\s]+/)) {
      const digits = part.replace(/\D/g, "");
      if (digits.length === 10) found.add(digits);
      else if (digits.length >= 11) {
        found.add(digits.slice(-10));
        found.add(digits.slice(0, 10));
      }
    }
  }
  return [...found].filter(value => value.length === 10);
}
export function normalizeIdentityDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
function levenshtein(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.5) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}
function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatch = Array(a.length).fill(false), bMatch = Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = Math.max(0, i - range); j < Math.min(i + range + 1, b.length); j += 1) {
      if (!bMatch[j] && a[i] === b[j]) { aMatch[i] = true; bMatch[j] = true; matches += 1; break; }
    }
  }
  if (!matches) return 0;
  let k = 0, transpositions = 0;
  for (let i = 0; i < a.length; i += 1) if (aMatch[i]) {
    while (!bMatch[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}
export function textSimilarity(left, right) {
  const a = normalizeIdentityText(left), b = normalizeIdentityText(right);
  if (!a || !b) return 0;
  return Math.max(levenshtein(a, b), jaroWinkler(a, b));
}
const list = value => Array.isArray(value) ? value : value ? [value] : [];
const namesOf = item => [...new Set([item?.cleanName, item?.fullName, item?.normalizedFullName, item?.applicantName, ...(item?.alternateNames || [])].map(normalizeStudentName).filter(Boolean))];
const fathersOf = item => [...new Set([item?.fatherName, item?.fatherOrHusbandName, item?.normalizedFatherName, ...(item?.fatherNames || [])].map(normalizeFatherName).filter(Boolean))];
const phonesOf = item => normalizeIndianPhones([...(item?.phones || []), ...(item?.phoneNumbers || []), item?.phone, item?.mobileNumber, item?.whatsappNumber, item?.guardianContactNumber]);
const codesOf = item => [...new Set([...(item?.studentCodes || []), ...(item?.stCodes || []), item?.primaryStCode, item?.currentStCode, item?.stCode, item?.regnNo, item?.enrollmentNo].map(value => cleanText(value).replace(/\.0+$/, "")).filter(Boolean))];
const bestSimilarity = (a, b) => {
  let score = 0;
  for (const x of a) for (const y of b) score = Math.max(score, textSimilarity(x, y));
  return score;
};
export function isSiblingPair(a, b) {
  const dobA = normalizeIdentityDate(a?.dob || a?.dateOfBirth), dobB = normalizeIdentityDate(b?.dob || b?.dateOfBirth);
  if (!dobA || !dobB || dobA === dobB) return false;
  const fatherSim = bestSimilarity(fathersOf(a), fathersOf(b));
  const sharedPhone = phonesOf(a).some(phone => phonesOf(b).includes(phone));
  const nameSim = bestSimilarity(namesOf(a), namesOf(b));
  return (fatherSim >= 0.85 || sharedPhone) && nameSim < 0.75;
}
export function resolveStudentIdentity(incoming, candidate) {
  if (isSiblingPair(incoming, candidate)) return { matched: false, siblingGuard: true, tier: null, nameSimilarity: 0, fatherSimilarity: 0 };
  const incomingNames = namesOf(incoming), candidateNames = namesOf(candidate);
  const nameSim = bestSimilarity(incomingNames, candidateNames);
  const incomingFathers = fathersOf(incoming), candidateFathers = fathersOf(candidate);
  const fatherSim = bestSimilarity(incomingFathers, candidateFathers);
  const incomingPhones = phonesOf(incoming), candidatePhones = phonesOf(candidate);
  const sharedPhone = incomingPhones.some(phone => candidatePhones.includes(phone));
  const incomingDob = normalizeIdentityDate(incoming?.dob || incoming?.dateOfBirth);
  const candidateDob = normalizeIdentityDate(candidate?.dob || candidate?.dateOfBirth);
  const exactDob = Boolean(incomingDob && candidateDob && incomingDob === candidateDob);
  const hasSameSex = Boolean(incoming?.sex && candidate?.sex && String(incoming.sex).trim().toUpperCase() === String(candidate.sex).trim().toUpperCase());
  const sameSex = !incoming?.sex || !candidate?.sex || hasSameSex;
  const exactName = incomingNames.some(name => candidateNames.includes(name));
  const bothFathersBlank = incomingFathers.length === 0 && candidateFathers.length === 0;
  const incomingCodes = codesOf(incoming), candidateCodes = codesOf(candidate);
  const sameCode = incomingCodes.some(code => candidateCodes.includes(code));
  let tier = null;
  if (sameCode && (nameSim >= 0.75 || fatherSim >= 0.75)) tier = 0;
  else if (exactName && exactDob && (fatherSim >= 0.75 || sharedPhone || bothFathersBlank)) tier = 1;
  else if (nameSim >= 0.82 && exactDob && sameSex && (fatherSim >= 0.80 || sharedPhone)) tier = 2;
  else if (exactName && fatherSim >= 0.85 && sharedPhone) tier = 3;
  else if (nameSim >= 0.85 && fatherSim >= 0.90 && sharedPhone && hasSameSex) tier = 4;
  return { matched: tier !== null, siblingGuard: false, tier, nameSimilarity: nameSim, fatherSimilarity: fatherSim, sharedPhone, exactDob };
}
export function clusterStudentRegistrations(records = []) {
  const parent = new Map(records.map((_, index) => [index, index]));
  const members = new Map(records.map((_, index) => [index, [index]]));
  const find = index => {
    let root = index;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(index) !== index) { const next = parent.get(index); parent.set(index, root); index = next; }
    return root;
  };
  const canMergeClusters = (leftRoot, rightRoot) => {
    for (const left of members.get(leftRoot) || []) for (const right of members.get(rightRoot) || []) {
      if (isSiblingPair(records[left], records[right])) return false;
    }
    return true;
  };
  const buckets = new Map();
  const add = (key, index) => { if (!key) return; buckets.set(key, [...(buckets.get(key) || []), index]); };
  records.forEach((item, index) => {
    const dob = normalizeIdentityDate(item.dob);
    if (dob) add("dob:" + dob, index);
    fathersOf(item).forEach(value => add("father:" + value, index));
    phonesOf(item).forEach(value => add("phone:" + value, index));
    codesOf(item).forEach(value => add("code:" + value, index));
  });
  const pairs = new Set();
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i += 1) for (let j = i + 1; j < bucket.length; j += 1) {
      pairs.add(bucket[i] + ":" + bucket[j]);
    }
  }
  for (const pair of pairs) {
    const [left, right] = pair.split(":").map(Number);
    const a = records[left], b = records[right];
    if (!resolveStudentIdentity(a, b).matched) continue;
    const leftRoot = find(left), rightRoot = find(right);
    if (leftRoot === rightRoot || !canMergeClusters(leftRoot, rightRoot)) continue;
    parent.set(rightRoot, leftRoot);
    members.set(leftRoot, [...(members.get(leftRoot) || []), ...(members.get(rightRoot) || [])]);
    members.delete(rightRoot);
  }
  const groups = new Map();
  records.forEach((item, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), item]);
  });
  return [...groups.values()];
}
