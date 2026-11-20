import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Student from "@/models/Student";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Course from "@/models/Course";
import { resolveCourseFeeConfig } from "@/lib/student-import/course-fee-rules";
import { linkImportedStudentRecords } from "@/lib/student-import/import-payment-sheet";

export const runtime = "nodejs";



const FeeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, unique: true, index: true },
  totalFee: Number, discount: Number, admissionFee: Number, registrationFee: Number,
  payments: Array, updatedBy: String
}, { timestamps: true });
const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);

const COURSE_NAMES = {
  DOM: "Diploma in Office Management",
  DCST: "Diploma in Computer Software Technology",
  DCA: "Diploma in Computer Applications",
  KIDS: "Coding for Kids",
  ROBOTICS: "Robotics",
  CCA: "Certificate in Computer Applications",
  ADCA: "Advanced Diploma in Computer Applications",
  CCC: "Course on Computer Concepts",
  CAO: "Certificate in Advanced Office",
  DWPD: "Diploma in Web Page Designing",
  DCAP: "Diploma in Computer Applications & Programming",
  DHNT: "Diploma in Hardware & Networking Technology"
};
const clean = value => String(value ?? "").trim();
const headerKey = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases = {
  regnNo: ["regnno", "registrationno", "registrationnumber", "stcode", "studentcode", "enrollmentno"],
  name: ["studentname", "stname", "applicantname", "name"],
  admissionDate: ["doi", "doa", "dateofadmission", "dateofjoining", "joiningdate", "admissiondate"],
  sex: ["sex", "gender"],
  father: ["fathername", "stfather", "father", "fatherorhusbandname"],
  phone: ["phno", "phoneno", "phone", "phonenumber", "mobile", "mobileno", "contactnumber"],
  course: ["course", "coursecode", "semester", "coursesemester"],
  address: ["address"],
  dob: ["dob", "dateofbirth"],
  qualification: ["qualification"],
  formNo: ["formno", "formnumber"]
};
const digits = value => clean(value).replace(/\D/g, "");

function dateValue(value) {
  if (value === null || value === undefined || value === "") return "";
  let year, month, day;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // SheetJS Date cells represent Excel calendar dates; UTC getters avoid server-timezone day shifts.
    year = value.getUTCFullYear(); month = value.getUTCMonth() + 1; day = value.getUTCDate();
  } else if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    year = parsed.y; month = parsed.m; day = parsed.d;
  } else {
    const raw = clean(value);
    let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
    else {
      match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
      if (!match) return "";
      day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
      if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    }
  }
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (check.getUTCFullYear() !== Number(year) || check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(day)) return "";
  return [String(year).padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function cleanName(value, registrationNo) {
  let name = clean(value).normalize("NFKC").replace(/\s+/g, " ").trim();
  if (registrationNo) name = name.replace(new RegExp("_" + String(registrationNo) + "$", "i"), "");
  return name.replace(/_\d+\s*$/, "").replace(/\s+/g, " ").trim();
}

function genderValue(value) {
  const raw = clean(value);
  const normalized = raw.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "").toUpperCase();
  if (normalized === "M" || normalized === "MALE") return { value: "M", cleaned: raw !== "M" && raw !== "Male" };
  if (normalized === "F" || normalized === "FEMALE") return { value: "F", cleaned: raw !== "F" && raw !== "Female" };
  return { value: "", cleaned: Boolean(raw) };
}

function parsePhoneValues(value) {
  const parts = clean(value).split(",").map(item => item.trim().replace(/,+$/, "")).filter(Boolean);
  const valid = parts.map(digits).filter(item => item.length === 10);
  const primary = valid[0] || "";
  const secondary = valid[1] || "";
  const warnings = [];
  if (!primary) warnings.push(parts.length ? "No valid 10-digit primary phone number." : "Phone number is missing.");
  if (parts.length > valid.length) warnings.push("One or more phone values were invalid and were ignored.");
  if (valid.length > 2) warnings.push("More than two valid phone values were supplied; only the first two were mapped.");
  return { primary, secondary, source: parts.join(", "), warnings };
}

function normalizeCourse(value) {
  const raw = clean(value).toUpperCase().replace(/_/g, "-").replace(/\s+/g, "");
  if (raw === "ROBOTICS") return { code: "ROBOTICS", label: raw };
  if (/^SM-(I|II|III|IV|V|VI)$/i.test(raw)) return { code: raw, label: raw };
  return { code: raw, label: raw };
}

function parseAddress(value) {
  const raw = String(value ?? "").replace(/\r/g, "").trim();
  const lines = raw.split(/[\n,;|]+/).map(item => item.trim()).filter(Boolean);
  const takeAfter = (line, pattern) => line ? line.replace(pattern, "").trim().replace(/^[.:+\- ]+|[,. ]+$/g, "") : "";
  const wardLine = lines.find(line => /^(?:VILL(?:AGE)?\.?|WARD(?:\s*NO\.?)?|COLONY|TOWN)/i.test(line)) || "";
  const ward = takeAfter(wardLine, /^(?:VILL(?:AGE)?\.?|WARD(?:\s*NO\.?)?|COLONY|TOWN)\s*[:.\-]?\s*/i);
  const sharedLine = lines.find(line => /P\.?\s*O\.?\s*\+?\s*P\.?\s*S\.?/i.test(line)) || "";
  let po = "", ps = "";
  if (sharedLine) {
    const shared = takeAfter(sharedLine, /^.*?P\.?\s*O\.?\s*\+?\s*P\.?\s*S\.?\s*[:.\-+]*\s*/i);
    po = shared; ps = shared;
  } else {
    const poLine = lines.find(line => /(?:^|\s)P\.?\s*O\.?(?:\s|[:.\-]|$)/i.test(line)) || "";
    const psLine = lines.find(line => /(?:^|\s)P\.?\s*S\.?(?:\s|[:.\-]|$)/i.test(line)) || "";
    po = takeAfter(poLine, /^.*?P\.?\s*O\.?\s*[:.\-]*\s*/i);
    ps = takeAfter(psLine, /^.*?P\.?\s*S\.?\s*[:.\-]*\s*/i);
  }
  const districtLine = lines.find(line => /^DIST(?:RICT)?\.?\s*[:.\-]?/i.test(line)) || "";
  let district = takeAfter(districtLine, /^DIST(?:RICT)?\.?\s*[:.\-]?\s*/i);
  if (/^(?:U\s*\/\s*D|U\.?D\.?)$/i.test(district)) district = "Uttar Dinajpur";
  const pinLine = lines.find(line => /\bPIN(?:NO|O|N)?\.?\s*[:.\-]?\s*\d{6}/i.test(line)) || raw;
  const pincode = pinLine.match(/\bPIN(?:NO|O|N)?\.?\s*[:.\-]?\s*(\d{6})/i)?.[1] || "";
  const titleCasePlace = value => String(value || "").toLocaleLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, prefix, letter) => prefix + letter.toLocaleUpperCase());
  const cleanWard = titleCasePlace(ward);
  const cleanPo = titleCasePlace(po);
  const cleanPs = titleCasePlace(ps);
  const cleanDistrict = titleCasePlace(district);
  return { address: raw, ward: cleanWard, village: cleanWard, po: cleanPo, ps: cleanPs, postOffice: cleanPo, policeStation: cleanPs, district: cleanDistrict, pincode, pin: pincode, sourceAddressRaw: raw };
}

function findStudentSheet(workbook, requestedSheet = "") {
  const compatible = [];
  for (const sheetName of workbook.SheetNames || []) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = grid.findIndex(row => {
      const keys = row.map(headerKey);
      return aliases.regnNo.some(key => keys.includes(key))
        && aliases.admissionDate.some(key => keys.includes(key))
        && !keys.includes("mrno") && !keys.includes("amtpaid");
    });
    if (headerIndex >= 0) compatible.push({ sheetName, grid, headerIndex });
  }
  if (requestedSheet) {
    const selected = compatible.find(item => item.sheetName === requestedSheet);
    if (!selected) throw new Error("Selected worksheet is not a compatible student-data sheet.");
    return { ...selected, availableSheets: workbook.SheetNames || [], studentSheets: compatible.map(item => item.sheetName) };
  }
  const selected = compatible.find(item => /^student\s*data$/i.test(item.sheetName))
    || compatible.find(item => /^st\s*list$/i.test(item.sheetName)) || compatible[0];
  if (!selected) throw new Error("No student worksheet found. Expected St_Code/Regn_No and D_O_A/DOI columns; payment-only sheets are ignored.");
  return { ...selected, availableSheets: workbook.SheetNames || [], studentSheets: compatible.map(item => item.sheetName) };
}

function parseRows(workbook, requestedSheet = "") {
  const { sheetName, grid, headerIndex, availableSheets = [], studentSheets = [] } = findStudentSheet(workbook, requestedSheet);
  const headers = grid[headerIndex].map(headerKey);
  const indexFor = key => headers.findIndex(header => aliases[key].includes(header));
  const indexes = Object.fromEntries(Object.keys(aliases).map(key => [key, indexFor(key)]));
  const rows = [];
  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const values = grid[i];
    if (!values.some(value => clean(value))) continue;
    const get = key => indexes[key] >= 0 ? values[indexes[key]] : "";
    const regnNo = clean(get("regnNo")).replace(/\.0+$/, "");
    const gender = genderValue(get("sex"));
    const phones = parsePhoneValues(get("phone"));
    const course = normalizeCourse(get("course"));
    const admissionDate = dateValue(get("admissionDate"));
    const name = cleanName(get("name"), regnNo);
    const address = parseAddress(get("address"));
    const warnings = [...phones.warnings];
    if (!clean(get("father"))) warnings.push("Father name is missing.");
    if (gender.cleaned) warnings.push("Gender value was cleaned or normalized.");
    if (!clean(get("sex")) || !gender.value) warnings.push("Gender is blank or invalid; left empty for later completion.");
    if (!admissionDate) warnings.push("DOI is missing or invalid.");
    if (!course.code) warnings.push("Course/Semester is missing.");
    const errors = [];
    if (!regnNo) errors.push("Registration number is missing.");
    if (!name) errors.push("Student name is missing.");
    rows.push({
      rowNo: i + 1, regnNo, name, sourceName: clean(get("name")), admissionDate,
      gender: gender.value, fatherName: clean(get("father")), phone: phones.primary,
      secondaryPhone: phones.secondary, altPhone: phones.secondary, sourcePhone: phones.source, course: course.code,
      courseLabel: course.label, ...address, dob: dateValue(get("dob")),
      qualification: clean(get("qualification")), formNo: clean(get("formNo")).replace(/\.0+$/, ""),
      warnings, errors
    });
  }
  return { sheetName, availableSheets, studentSheets, rows };
}

function previewPayload(parsed) {
  const valid = parsed.rows.filter(row => !row.errors.length);
  return {
    sheetName: parsed.sheetName,
    availableSheets: parsed.availableSheets || [parsed.sheetName],
    studentSheets: parsed.studentSheets || [parsed.sheetName],
    totalRows: parsed.rows.length,
    validRows: valid.length,
    invalidRows: parsed.rows.length - valid.length,
    previewRows: parsed.rows.slice(0, 100).map(row => ({
      rowNo: row.rowNo, regnNo: row.regnNo, name: row.name,
      admissionDate: row.admissionDate, gender: row.gender, fatherName: row.fatherName,
      phone: row.phone, secondaryPhone: row.secondaryPhone, course: row.course,
      warnings: row.warnings, errors: row.errors
    })),
    warnings: parsed.rows.flatMap(row => row.warnings.map(reason => ({ row: row.rowNo, Regn_No: row.regnNo, reason }))),
    errors: parsed.rows.filter(row => row.errors.length).map(row => ({ row: row.rowNo, Regn_No: row.regnNo, reason: row.errors.join(" ") })).slice(0, 200),
    message: "Preview parsed from " + parsed.sheetName + ". Review cleaned values and warnings before importing."
  };
}

async function removeLegacyFormNoUniqueIndex() {
  const indexes = await Student.collection.indexes().catch(error => {
    if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
    throw error;
  });
  const legacy = indexes.find(index => index.name === "formNo_1" && index.unique);
  if (legacy) await Student.collection.dropIndex(legacy.name);
}

function asStudentPayload(row, course, sourceName) {
  return {
    regnNo: row.regnNo, enrollmentNo: row.regnNo, formNo: row.formNo,
    applicantName: row.name, name: row.name, sourceStudentName: row.sourceName,
    dateOfBirth: row.dob, dob: row.dob,
    admissionDate: row.admissionDate, dateOfAdmission: row.admissionDate,
    sex: row.gender, gender: row.gender, sourceSex: row.gender,
    fatherOrHusbandName: row.fatherName, fatherName: row.fatherName,
    address: row.address, presentAddress: row.address, permanentAddress: row.address,
    sameAsPresentAddress: Boolean(row.address),
    ward: row.ward, village: row.village, po: row.po, ps: row.ps,
    postOffice: row.postOffice, policeStation: row.policeStation,
    district: row.district, pincode: row.pincode, pin: row.pin,
    sourceAddressRaw: row.sourceAddressRaw,
    mobileNumber: row.phone, phone: row.phone, whatsappNumber: row.phone,
    guardianContactNumber: row.altPhone, alternatePhoneNumber: row.altPhone, altPhone: row.altPhone,
    sourcePhone: row.sourcePhone, qualification: row.qualification, sourceQualification: row.qualification,
    course: row.course, courseCode: course.code, courseName: course.name || course.code,
    sourceCourseLabel: row.courseLabel || row.course,
    importSource: sourceName, sourceRowNo: row.rowNo,
    sourceRowKey: [sourceName, row.regnNo || "NO-REGN", row.rowNo, row.course || "NO-COURSE"].join("|")
  };
}

function normalizePersonName(value) {
  return clean(value).replace(/_\d+\s*$/, "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function nameSimilarity(left, right) {
  const a = normalizePersonName(left), b = normalizePersonName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aa = new Set(a.split(" ")), bb = new Set(b.split(" "));
  return (2 * [...aa].filter(token => bb.has(token)).length) / (aa.size + bb.size);
}
function isMissing(value, field) {
  if (value === null || value === undefined || String(value).trim() === "") return true;
  if (field === "sex" || field === "gender" || field === "sourceSex") {
    const normalized = String(value).trim().toUpperCase();
    return !["M", "F", "MALE", "FEMALE"].includes(normalized);
  }
  return false;
}
function buildMissingFields(existing, payload) {
  const fields = {};
  const put = (target, aliases, source, extras = []) => {
    if (aliases.some(key => !isMissing(existing[key], key)) || isMissing(payload[source], source)) return;
    fields[target] = payload[source];
    for (const [key, value] of extras) if (isMissing(existing[key], key) && !isMissing(value, key)) fields[key] = value;
  };
  put("applicantName", ["applicantName", "name"], "applicantName", [["name", payload.name]]);
  put("admissionDate", ["admissionDate", "dateOfAdmission"], "admissionDate", [["dateOfAdmission", payload.dateOfAdmission]]);
  put("dateOfBirth", ["dateOfBirth", "dob"], "dateOfBirth", [["dob", payload.dob]]);
  put("sex", ["sex", "gender"], "sex", [["gender", payload.gender]]);
  put("fatherOrHusbandName", ["fatherOrHusbandName", "fatherName"], "fatherOrHusbandName", [["fatherName", payload.fatherName]]);
  put("mobileNumber", ["mobileNumber", "phone", "whatsappNumber"], "mobileNumber", [["phone", payload.phone], ["whatsappNumber", payload.whatsappNumber]]);
  put("alternatePhoneNumber", ["alternatePhoneNumber", "guardianContactNumber", "altPhone"], "alternatePhoneNumber", [["altPhone", payload.altPhone], ["guardianContactNumber", payload.guardianContactNumber]]);
  put("address", ["address", "presentAddress", "permanentAddress"], "address", [["presentAddress", payload.presentAddress], ["permanentAddress", payload.permanentAddress]]);
  put("ward", ["ward"], "ward"); put("village", ["village"], "village");
  put("postOffice", ["postOffice", "po"], "postOffice", [["po", payload.po]]);
  put("policeStation", ["policeStation", "ps"], "policeStation", [["ps", payload.ps]]);
  put("district", ["district"], "district");
  put("pin", ["pin", "pincode"], "pin", [["pincode", payload.pincode]]);
  put("sourceQualification", ["sourceQualification", "qualification"], "sourceQualification", [["qualification", payload.qualification]]);
  put("formNo", ["formNo"], "formNo");
  put("courseCode", ["courseCode", "courseName", "sourceCourseLabel", "course"], "courseCode", [["course", payload.course], ["courseName", payload.courseName], ["sourceCourseLabel", payload.sourceCourseLabel]]);
  if (isMissing(existing.sourceAddressRaw, "sourceAddressRaw") && !isMissing(payload.sourceAddressRaw, "sourceAddressRaw")) fields.sourceAddressRaw = payload.sourceAddressRaw;
  if (isMissing(existing.sourcePhone, "sourcePhone") && !isMissing(payload.sourcePhone, "sourcePhone")) fields.sourcePhone = payload.sourcePhone;
  return fields;
}

function buildMissingOnlyFilter(existing, fields) {
  const clauses = [{ _id: existing._id }];
  const addGroup = (keys, gender = false) => {
    if (!keys.some(key => Object.prototype.hasOwnProperty.call(fields, key))) return;
    for (const key of keys) {
      clauses.push(gender
        ? { [key]: { $nin: ["M", "F", "MALE", "FEMALE"] } }
        : { [key]: { $in: [null, ""] } });
    }
  };
  addGroup(["applicantName", "name"]);
  addGroup(["admissionDate", "dateOfAdmission"]);
  addGroup(["dateOfBirth", "dob"]);
  addGroup(["sex", "gender"], true);
  addGroup(["fatherOrHusbandName", "fatherName"]);
  addGroup(["mobileNumber", "phone", "whatsappNumber"]);
  addGroup(["alternatePhoneNumber", "altPhone", "guardianContactNumber"]);
  addGroup(["address", "presentAddress", "permanentAddress"]);
  addGroup(["ward"]);
  addGroup(["village"]);
  addGroup(["postOffice", "po"]);
  addGroup(["policeStation", "ps"]);
  addGroup(["district"]);
  addGroup(["pin", "pincode"]);
  addGroup(["sourceQualification", "qualification"]);
  addGroup(["formNo"]);
  addGroup(["courseCode", "courseName", "sourceCourseLabel", "course"]);
  addGroup(["sourceAddressRaw"]);
  addGroup(["sourcePhone"]);
  return { $and: clauses };
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to import students." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to bulk import students." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") || "preview");
    const importMode = String(form.get("importMode") || "fill_and_import").toLowerCase();
    if (!["fill_and_import", "update_existing_only"].includes(importMode)) {
      return NextResponse.json({ error: "Invalid student import mode." }, { status: 400 });
    }
    const requestedSheet = String(form.get("sheetName") || "").trim();
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose an Excel or CSV file." }, { status: 400 });
    if (!/\.(xlsx|xls|csv)$/i.test(String(file.name || ""))) return NextResponse.json({ error: "Only .xlsx, .xls and .csv files are supported." }, { status: 400 });
    if (Number(file.size || 0) > 15 * 1024 * 1024) return NextResponse.json({ error: "The file must be smaller than 15 MB." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const parsed = parseRows(workbook, requestedSheet);
    const preview = previewPayload(parsed);
    if (mode !== "import") return NextResponse.json(preview);

    await connectMongoDB();
    await removeLegacyFormNoUniqueIndex();
    const sourceName = String(file.name || "RCLD Student Import").slice(0, 180);
    const warnings = [...preview.warnings];
    const errors = [...preview.errors];
    const validRows = parsed.rows.filter(row => !row.errors.length);
    const registrationNumbers = [...new Set(validRows.map(row => row.regnNo).filter(Boolean))];
    const existingRecords = [];
    // Keep each lookup bounded; regnNo is indexed and enrollmentNo has a partial unique index.
    for (let offset = 0; offset < registrationNumbers.length; offset += 500) {
      const codeChunk = registrationNumbers.slice(offset, offset + 500);
      const numericChunk = codeChunk.filter(code => /^\d+$/.test(code)).map(Number);
      const decimalStringVariants = codeChunk.filter(code => /^\d+$/.test(code)).map(code => code + ".0");
      const variants = [...codeChunk, ...decimalStringVariants, ...numericChunk];
      const found = await Student.find({ $or: [
        { regnNo: { $in: variants } },
        { enrollmentNo: { $in: variants } }
      ] }).lean();
      existingRecords.push(...found);
    }
    const existingByCode = new Map();
    for (const student of existingRecords) {
      const identity = String(student._id);
      for (const rawCode of [student.regnNo, student.enrollmentNo]) {
        const key = String(rawCode ?? "").replace(/\.0+$/, "").trim();
        if (!key) continue;
        const candidates = existingByCode.get(key) || [];
        if (!candidates.some(item => String(item._id) === identity)) candidates.push(student);
        existingByCode.set(key, candidates);
      }
    }

    const grouped = new Map();
    for (const row of validRows) {
      const key = row.regnNo || "ROW-" + row.rowNo;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    const uniqueRows = [];
    const existingForRow = new Map();
    for (const [code, group] of grouped) {
      const candidates = existingByCode.get(code) || [];
      if (!candidates.length && group.length === 1) {
        uniqueRows.push(group[0]);
        continue;
      }
      const pairs = [];
      for (const row of group) {
        for (const student of candidates) {
          const existingName = student.applicantName || student.name || "";
          const score = nameSimilarity(existingName, row.name);
          if (score >= 0.75) pairs.push({ row, student, score });
        }
      }
      // Merge only when one unambiguous row-to-student match exists.
      if (pairs.length === 1) {
        uniqueRows.push(pairs[0].row);
        existingForRow.set(pairs[0].row, pairs[0].student);
        for (const row of group) {
          if (row !== pairs[0].row) warnings.push({
            row: row.rowNo, Regn_No: row.regnNo,
            reason: "Reused registration code has a different or ambiguous student name; row skipped to prevent cross-student merging."
          });
        }
      } else {
        const reason = candidates.length
          ? "Registration code matched an existing record, but the name match was missing, conflicting, or ambiguous; row skipped to protect existing student data."
          : "Duplicate registration code has no unique existing-student name match; rows skipped to prevent cross-student merging.";
        for (const row of group) warnings.push({ row: row.rowNo, Regn_No: row.regnNo, reason });
      }
    }

    const operations = []; const operationRows = [];
    let imported = 0, enriched = 0, unchanged = 0, skippedNew = 0;
    const courseCodes = [...new Set(uniqueRows.map(row => row.course).filter(Boolean))];
    const baseCodes = [...new Set(courseCodes.map(code => code.split("-")[0]))];
    const coursePatterns = [...new Set([...courseCodes, ...baseCodes])];
    const courses = coursePatterns.length ? await Course.find({ code: { $in: coursePatterns } }).lean() : [];
    const courseMap = new Map(courses.map(course => [String(course.code).toUpperCase(), course]));
    for (const row of uniqueRows) {
      const existing = existingForRow.get(row) || null;
      if (!existing && importMode === "update_existing_only") { skippedNew += 1; continue; }
      const course = courseMap.get(row.course) || courseMap.get(row.course.split("-")[0]) || null;
      const courseInfo = { code: row.course, name: course?.name || COURSE_NAMES[row.course] || row.course };
      const payload = asStudentPayload(row, courseInfo, sourceName);
      if (existing) {
        if ((existing.applicantName || existing.name) && nameSimilarity(existing.applicantName || existing.name, row.name) < 0.75) { warnings.push({ row: row.rowNo, Regn_No: row.regnNo, reason: "Registration number matched but student name did not; existing student left unchanged." }); continue; }
        const missing = buildMissingFields(existing, payload);
        if (!Object.keys(missing).length) { unchanged += 1; continue; }
        operations.push({ updateOne: { filter: buildMissingOnlyFilter(existing, missing), update: { $set: missing }, upsert: false } });
        operationRows.push({ row, kind: "existing" });
      } else {
        const insertFilter = row.regnNo
          ? { $or: [{ regnNo: row.regnNo }, { enrollmentNo: row.regnNo }] }
          : { sourceRowKey: row.sourceRowKey };
        operations.push({ updateOne: { filter: insertFilter, update: { $setOnInsert: { ...payload, status: "Registered" } }, upsert: true } });
        operationRows.push({ row, kind: "new" });
      }
    }
    const newStudentIds = [];
    for (let offset = 0; offset < operations.length; offset += 500) {
      const chunk = operations.slice(offset, offset + 500);
      try {
        const write = await Student.bulkWrite(chunk, { ordered: false });
        imported += Number(write.upsertedCount || 0); enriched += Number(write.modifiedCount || 0);
        for (const [index, value] of Object.entries(write.upsertedIds || {})) if (operationRows[offset + Number(index)]?.kind === "new") newStudentIds.push(value._id || value);
      } catch (writeError) {
        const failed = new Map((writeError.writeErrors || []).map(item => [item.index, item]));
        const result = writeError.result || writeError;
        imported += Number(result.upsertedCount || 0); enriched += Number(result.modifiedCount || 0);
        for (const [index, item] of operationRows.slice(offset, offset + chunk.length).entries()) {
          const failure = failed.get(index);
          if (failure) errors.push({ row: item.row.rowNo, Regn_No: item.row.regnNo, reason: failure.errmsg || failure.message || "Database rejected this row." });
          else if (item.kind === "new" && result.upsertedIds?.[index]) newStudentIds.push(result.upsertedIds[index]._id || result.upsertedIds[index]);
        }
      }
    }
    const importedStudents = newStudentIds.length ? await Student.find({ _id: { $in: newStudentIds } }).lean() : [];
    const feeConfigCache = new Map();
    const feeOperations = [];
    for (const student of importedStudents) {
      try {
        const rawCode = String(student.sourceCourseLabel || student.courseCode || "").trim().toUpperCase();
        if (!feeConfigCache.has(rawCode)) feeConfigCache.set(rawCode, await resolveCourseFeeConfig(rawCode, Course));
        const resolved = feeConfigCache.get(rawCode);
        feeOperations.push({
          updateOne: {
            filter: { studentId: student._id },
            update: { $setOnInsert: {
              totalFee: Number(resolved.feeConfig?.grossFee ?? 0),
              admissionFee: Number(resolved.feeConfig?.admissionFee ?? 0),
              registrationFee: Number(resolved.feeConfig?.registrationFee ?? 0),
              discount: 0, payments: [], updatedBy: "student-bulk-import"
            } },
            upsert: true
          }
        });
      } catch (rowError) {
        errors.push({ row: student.sourceRowNo, Regn_No: student.regnNo, reason: "Student saved, but fee initialization failed: " + rowError.message });
      }
    }
    for (let offset = 0; offset < feeOperations.length; offset += 500) {
      await StudentFee.bulkWrite(feeOperations.slice(offset, offset + 500), { ordered: false });
    }
    if (importedStudents.length) {
      try { await linkImportedStudentRecords(importedStudents); }
      catch (linkError) {
        errors.push({ row: null, Regn_No: "", reason: "New students were saved, but academic enrollment linking needs review: " + linkError.message });
      }
    }
    // Payment-receipt worksheets are deliberately excluded from this student import.
    // They contain MR_No/Amt_Paid rows and must be handled by a separate fee-import workflow.
    const paymentImport = { skipped: true, message: "Payment-only worksheets were not processed by student import." };

    return NextResponse.json({
      message: "Student import processing completed.",
      total: parsed.rows.length, imported, newStudentsCreated: imported,
      enriched, existingStudentsEnriched: enriched, unchanged, existingStudentsUnchanged: unchanged,
      skippedNew, skipped: skippedNew + errors.length,
      warnings, warningCount: warnings.length, errors,
      sheetName: parsed.sheetName, importMode, paymentImport
    });
  } catch (error) {
    console.error("[student-bulk-import]", error);
    return NextResponse.json({ error: "Unable to import students.", detail: error.message }, { status: 500 });
  }
}
