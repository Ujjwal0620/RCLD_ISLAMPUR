import { NextResponse } from "next/server";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Course from "@/models/Course";
import { resolveCourseFeeConfig } from "@/lib/student-import/course-fee-rules";
import { importPaymentWorksheet, linkImportedStudentRecords, parsePaymentWorksheet } from "@/lib/student-import/import-payment-sheet";

export const runtime = "nodejs";

const StudentSchema = new mongoose.Schema({
  formNo: String, enrollmentNo: String, regnNo: String, applicantName: String,
  sourceStudentName: String, courseCode: String, courseName: String, sourceCourseLabel: String,
  admissionDate: String, dateOfAdmission: String, dateOfBirth: String, sex: String, sourceSex: String,
  fatherOrHusbandName: String, address: String, presentAddress: String, permanentAddress: String,
  sameAsPresentAddress: Boolean, postOffice: String, policeStation: String, district: String,
  state: String, pin: String, sourceAddressRaw: String, mobileNumber: String, whatsappNumber: String,
  guardianContactNumber: String, alternatePhoneNumber: String, sourcePhone: String,
  sourceQualification: String, photoUrl: String, status: String, importSource: String,
  sourceRowNo: Number, sourceRowKey: String, batchId: mongoose.Schema.Types.ObjectId, batchCode: String
}, { timestamps: true, strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);

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
    year = value.getFullYear(); month = value.getMonth() + 1; day = value.getDate();
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
  return { value: "Other", cleaned: Boolean(raw) };
}

function parsePhoneValues(value) {
  const parts = clean(value).split(",").map(item => item.trim()).filter(Boolean);
  const firstValid = parts.find(item => digits(item).length === 10) || "";
  const second = parts.find(item => item !== firstValid) || "";
  const primary = firstValid ? digits(firstValid) : "";
  const secondary = second ? digits(second) : "";
  const warnings = [];
  if (!primary) warnings.push(parts.length ? "No valid 10-digit primary phone number." : "Phone number is missing.");
  if (second && secondary.length !== 10) warnings.push("Secondary phone is not 10 digits and was retained for reference.");
  if (parts.length > 2) warnings.push("More than two phone values were supplied; remaining values were not mapped.");
  return { primary, secondary, source: parts.join(", "), warnings };
}

function normalizeCourse(value) {
  const raw = clean(value).toUpperCase().replace(/_/g, "-").replace(/\s+/g, "");
  if (raw === "ROBOTICS") return { code: "ROBOTICS", label: raw };
  if (/^SM-(I|II|III|IV|V|VI)$/i.test(raw)) return { code: raw, label: raw };
  return { code: raw, label: raw };
}

function parseAddress(value) {
  const raw = clean(value);
  const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);
  const first = lines[0] || "";
  const address = first.replace(/^(?:VILL(?:AGE)?|WARD(?:\s*NO\.?)?|COLONY|TOWN)\s*\.?\s*[:\-]?\s*/i, "").trim();
  const pin = raw.match(/\b(\d{6})\b/)?.[1] || "";
  const districtLine = lines.find(line => /^DIST(?:RICT)?\b/i.test(line)) || "";
  const district = districtLine.replace(/^DIST(?:RICT)?\s*\.?\s*[:\-]?\s*/i, "").trim();
  const po = lines.find(line => /\b(?:P\.?\s*O\.?|POST\s*OFFICE)\b/i.test(line)) || "";
  const ps = lines.find(line => /\b(?:P\.?\s*S\.?|POLICE\s*STATION)\b/i.test(line)) || "";
  const extract = line => line.replace(/^.*?(?:P\.?\s*O\.?|POST\s*OFFICE|P\.?\s*S\.?|POLICE\s*STATION)\s*[:.+-]*/i, "").trim();
  return { address, postOffice: po ? extract(po) : "", policeStation: ps ? extract(ps) : "", district, pin, sourceAddressRaw: raw };
}

function findStudentSheet(workbook) {
  const names = workbook.SheetNames || [];
  const ordered = [...names].sort((a, b) => Number(/^st\s*list$/i.test(b)) - Number(/^st\s*list$/i.test(a)));
  for (const sheetName of ordered) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
    const headerIndex = grid.findIndex(row => {
      const keys = row.map(headerKey);
      return aliases.regnNo.some(key => keys.includes(key)) && aliases.name.some(key => keys.includes(key));
    });
    if (headerIndex >= 0) return { sheetName, grid, headerIndex };
  }
  throw new Error("No worksheet with Registration Number and Student Name headers was found. Expected the St List sheet or a compatible legacy template.");
}

function parseRows(workbook) {
  const { sheetName, grid, headerIndex } = findStudentSheet(workbook);
  const headers = grid[headerIndex].map(headerKey);
  const indexFor = key => headers.findIndex(header => aliases[key].includes(header));
  const indexes = Object.fromEntries(Object.keys(aliases).map(key => [key, indexFor(key)]));
  const rows = [];
  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const values = grid[i];
    if (!values.some(value => clean(value))) continue;
    const get = key => indexes[key] >= 0 ? values[indexes[key]] : "";
    const regnNo = clean(get("regnNo")).replace(/\.0$/, "");
    const gender = genderValue(get("sex"));
    const phones = parsePhoneValues(get("phone"));
    const course = normalizeCourse(get("course"));
    const admissionDate = dateValue(get("admissionDate"));
    const name = cleanName(get("name"), regnNo);
    const address = parseAddress(get("address"));
    const warnings = [...phones.warnings];
    if (!clean(get("father"))) warnings.push("Father name is missing.");
    if (gender.cleaned) warnings.push("Gender value was cleaned or normalized.");
    if (!clean(get("sex")) || gender.value === "Other") warnings.push("Gender is blank or unrecognized; stored as Other.");
    if (!admissionDate) warnings.push("DOI is missing or invalid.");
    if (!course.code) warnings.push("Course/Semester is missing.");
    const errors = [];
    rows.push({
      rowNo: i + 1, regnNo, name, sourceName: clean(get("name")), admissionDate,
      gender: gender.value, fatherName: clean(get("father")), phone: phones.primary,
      secondaryPhone: phones.secondary, sourcePhone: phones.source, course: course.code,
      courseLabel: course.label, ...address, dob: dateValue(get("dob")),
      qualification: clean(get("qualification")), formNo: clean(get("formNo")),
      warnings, errors
    });
  }
  return { sheetName, rows };
}

function previewPayload(parsed) {
  const valid = parsed.rows.filter(row => !row.errors.length);
  return {
    sheetName: parsed.sheetName,
    totalRows: parsed.rows.length,
    validRows: valid.length,
    invalidRows: parsed.rows.length - valid.length,
    previewRows: parsed.rows.slice(0, 100).map(row => ({
      rowNo: row.rowNo, regnNo: row.regnNo, name: row.name,
      admissionDate: row.admissionDate, gender: row.gender, fatherName: row.fatherName,
      phone: row.phone, secondaryPhone: row.secondaryPhone, course: row.course,
      warnings: row.warnings, errors: row.errors
    })),
    warnings: parsed.rows.flatMap(row => row.warnings.map(reason => ({ row: row.rowNo, Regn_No: row.regnNo, reason }))).slice(0, 500),
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
    applicantName: row.name, sourceStudentName: row.sourceName,
    dateOfBirth: row.dob, admissionDate: row.admissionDate, dateOfAdmission: row.admissionDate,
    sex: row.gender, sourceSex: row.gender, fatherOrHusbandName: row.fatherName,
    address: row.address, presentAddress: row.address, permanentAddress: row.address,
    sameAsPresentAddress: Boolean(row.address), postOffice: row.postOffice,
    policeStation: row.policeStation, district: row.district, pin: row.pin,
    sourceAddressRaw: row.sourceAddressRaw, mobileNumber: row.phone,
    whatsappNumber: row.phone, guardianContactNumber: row.secondaryPhone,
    alternatePhoneNumber: row.secondaryPhone, sourcePhone: row.sourcePhone,
    sourceQualification: row.qualification, courseCode: course.code,
    courseName: course.name || COURSE_NAMES[course.code] || course.code,
    sourceCourseLabel: row.courseLabel || row.course,
    importSource: sourceName, sourceRowNo: row.rowNo,
    sourceRowKey: [sourceName, row.regnNo || "NO-REGN", row.rowNo, row.course || "NO-COURSE"].join("|")
  };
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
    const duplicateMode = String(form.get("duplicateMode") || "skip").toLowerCase();
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose an Excel or CSV file." }, { status: 400 });
    if (!/\.(xlsx|xls|csv)$/i.test(String(file.name || ""))) return NextResponse.json({ error: "Only .xlsx, .xls and .csv files are supported." }, { status: 400 });
    if (Number(file.size || 0) > 15 * 1024 * 1024) return NextResponse.json({ error: "The file must be smaller than 15 MB." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const parsed = parseRows(workbook);
    const preview = previewPayload(parsed);
    if (mode !== "import") return NextResponse.json(preview);

    await connectMongoDB();
    await removeLegacyFormNoUniqueIndex();
    const sourceName = String(file.name || "RCLD Student Import").slice(0, 180);
    const validRows = parsed.rows.filter(row => !row.errors.length);
    const uniqueRows = [];
    const seen = new Set();
    const warnings = [...preview.warnings];
    const errors = [...preview.errors];
    let skipped = parsed.rows.length - validRows.length;
    for (const row of validRows) {
      if (row.regnNo && seen.has(row.regnNo)) {
        skipped += 1;
        warnings.push({ row: row.rowNo, Regn_No: row.regnNo, reason: "Duplicate registration number within this workbook; the first occurrence was retained." });
        continue;
      }
      if (row.regnNo) seen.add(row.regnNo);
      uniqueRows.push(row);
    }

    const registrationNumbers = uniqueRows.map(row => row.regnNo).filter(Boolean);
    const numericRegistrationNumbers = registrationNumbers.filter(code => /^\d+$/.test(code)).map(Number);
    const existingRecords = registrationNumbers.length
      ? await Student.find({ $or: [
          { regnNo: { $in: [...registrationNumbers, ...numericRegistrationNumbers] } },
          { enrollmentNo: { $in: [...registrationNumbers, ...numericRegistrationNumbers] } }
        ] }).lean()
      : [];
    const existingByCode = new Map();
    for (const student of existingRecords) {
      for (const rawCode of [student.regnNo, student.enrollmentNo]) {
        const key = String(rawCode ?? "").replace(/\.0$/, "");
        if (key && !existingByCode.has(key)) existingByCode.set(key, student);
      }
    }

    const courseCodes = [...new Set(uniqueRows.map(row => row.course).filter(Boolean))];
    const baseCodes = [...new Set(courseCodes.map(code => code.split("-")[0]))];
    const coursePatterns = [...new Set([...courseCodes, ...baseCodes])].map(code => new RegExp("^" + code + "$", "i"));
    const courses = await Course.find({ code: { $in: coursePatterns } }).lean();
    const courseMap = new Map(courses.map(course => [String(course.code).toUpperCase(), course]));
    const operations = [];
    const operationRows = [];
    let imported = 0;
    let updated = 0;

    for (const row of uniqueRows) {
      const existing = row.regnNo ? existingByCode.get(row.regnNo) : null;
      if (existing && duplicateMode !== "update") {
        skipped += 1;
        warnings.push({ row: row.rowNo, Regn_No: row.regnNo, reason: "Registration number already exists; skipped as requested." });
        continue;
      }
      const course = courseMap.get(row.course) || courseMap.get(row.course.split("-")[0]) || null;
      const builtInFeeCourse = row.course === "ROBOTICS" || /^SM-(I|II|III|IV|V|VI)$/.test(row.course);
      if (row.course && !course && !builtInFeeCourse) {
        warnings.push({ row: row.rowNo, Regn_No: row.regnNo, reason: "Course was not found in Course Master; the student is saved with an unconfigured fee plan for review." });
      }
      const courseInfo = { code: row.course, name: course?.name || COURSE_NAMES[row.course] || row.course };
      const payload = asStudentPayload(row, courseInfo, sourceName);
      operations.push({
        updateOne: {
          filter: existing ? { _id: existing._id } : row.regnNo ? { regnNo: row.regnNo } : { sourceRowKey: row.sourceRowKey },
          update: { $set: payload, $setOnInsert: { status: "Registered", photoUrl: "" } },
          upsert: true
        }
      });
      operationRows.push({ row, existing, courseInfo });
    }

    if (operations.length) {
      try {
        const write = await Student.bulkWrite(operations, { ordered: false });
        imported = Number(write.upsertedCount || 0);
        updated = Number(write.modifiedCount || write.matchedCount || 0);
      } catch (writeError) {
        const failedIndexes = new Map((writeError.writeErrors || []).map(item => [item.index, item]));
        const result = writeError.result || writeError;
        imported = Number(result.upsertedCount || 0);
        updated = Number(result.modifiedCount || result.matchedCount || 0);
        for (const [index, item] of operationRows.entries()) {
          const failure = failedIndexes.get(index);
          if (failure) {
            skipped += 1;
            errors.push({ row: item.row.rowNo, Regn_No: item.row.regnNo, reason: failure.errmsg || failure.message || "Database rejected this row." });
          }
        }
      }
    }

    const failedRows = new Set(errors.map(item => Number(item.row)).filter(Number.isFinite));
    const successfulOperations = operationRows.filter(item => !failedRows.has(Number(item.row.rowNo)));
    const importedStudentFilters = successfulOperations.map(item => item.existing
      ? { _id: item.existing._id }
      : item.row.regnNo
        ? { regnNo: item.row.regnNo }
        : { sourceRowKey: item.row.sourceRowKey });
    const importedStudents = importedStudentFilters.length
      ? await Student.find({ $or: importedStudentFilters }).sort({ admissionDate: 1, createdAt: 1 }).lean()
      : [];
    for (const student of importedStudents) {
      try {
        const rawCode = String(student.sourceCourseLabel || student.courseCode || "").trim().toUpperCase();
        const resolved = await resolveCourseFeeConfig(rawCode, Course);
        await StudentFee.updateOne(
          { studentId: student._id },
          { $setOnInsert: {
            totalFee: Number(resolved.feeConfig?.grossFee ?? 0),
            admissionFee: Number(resolved.feeConfig?.admissionFee ?? 0),
            registrationFee: Number(resolved.feeConfig?.registrationFee ?? 0),
            discount: 0, payments: [], updatedBy: "student-bulk-import"
          } },
          { upsert: true }
        );
        try { await linkImportedStudentRecords([student]); }
        catch (linkError) {
          errors.push({ row: student.sourceRowNo, Regn_No: student.regnNo, reason: "Student saved, but academic enrollment linking needs review: " + linkError.message });
        }
      } catch (rowError) {
        errors.push({ row: student.sourceRowNo, Regn_No: student.regnNo, reason: "Student saved, but fee initialization failed: " + rowError.message });
      }
    }

    let paymentImport = null;
    try {
      const paymentPreview = parsePaymentWorksheet(workbook);
      if (paymentPreview.rows?.length) paymentImport = await importPaymentWorksheet(workbook, { sourceName });
    } catch (paymentError) {
      warnings.push({ row: null, Regn_No: "", reason: "Student rows were imported, but payment-sheet import failed: " + paymentError.message });
    }

    return NextResponse.json({
      message: "Student import processing completed.",
      total: parsed.rows.length, imported, updated, skipped,
      warnings: warnings.slice(0, 500), errors: errors.slice(0, 500),
      sheetName: parsed.sheetName, duplicateMode, paymentImport
    });
  } catch (error) {
    console.error("[student-bulk-import]", error);
    return NextResponse.json({ error: "Unable to import students.", detail: error.message }, { status: 500 });
  }
}
