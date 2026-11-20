import { NextResponse } from "next/server";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import Course from "@/models/Course";
import { importPaymentWorksheet, linkImportedStudentRecords, parsePaymentWorksheet } from "@/lib/student-import/import-payment-sheet";

const StudentSchema = new mongoose.Schema({
  formNo: String, enrollmentNo: String, regnNo: String, applicantName: String,
  sourceStudentName: String, courseCode: String, courseName: String, sourceCourseLabel: String,
  admissionDate: String, dateOfBirth: String, sex: String, sourceSex: String,
  fatherOrHusbandName: String, address: String, presentAddress: String, permanentAddress: String,
  sameAsPresentAddress: Boolean, postOffice: String, policeStation: String, district: String,
  state: String, pin: String, sourceAddressRaw: String, mobileNumber: String, whatsappNumber: String,
  guardianContactNumber: String, sourceQualification: String, photoUrl: String, status: String,
  importSource: String, sourceRowNo: Number, sourceRowKey: String, batchId: mongoose.Schema.Types.ObjectId, batchCode: String
}, { timestamps: true, strict: false });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
let formNoIndexMigration;
async function removeLegacyFormNoUniqueIndex() {
  if (!formNoIndexMigration) {
    formNoIndexMigration = (async () => {
      let indexes = [];
      try {
        indexes = await Student.collection.indexes();
      } catch (error) {
        if (error.code !== 26 && error.codeName !== "NamespaceNotFound") throw error;
      }
      const legacyIndex = indexes.find(index => index.name === "formNo_1" && index.unique);
      if (legacyIndex) await Student.collection.dropIndex(legacyIndex.name);
    })();
  }
  await formNoIndexMigration;
}

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
  CCA: "Certificate in Computer Applications",
  ADCA: "Advanced Diploma in Computer Applications",
  CCC: "Course on Computer Concepts",
  CAO: "Certificate in Advanced Office",
  DWPD: "Diploma in Web Page Designing",
  DCAP: "Diploma in Computer Applications & Programming",
  DHNT: "Diploma in Hardware & Networking Technology"
};
const clean = value => String(value ?? "").trim();
const normalizeHeader = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
const digits = value => clean(value).replace(/\D/g, "");

function dateValue(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? [parsed.y, String(parsed.m).padStart(2, "0"), String(parsed.d).padStart(2, "0")].join("-") : "";
  }
  const raw = clean(value);
  let match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return match[3] + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0");
  match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0");
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return [parsed.getFullYear(), String(parsed.getMonth() + 1).padStart(2, "0"), String(parsed.getDate()).padStart(2, "0")].join("-");
  }
  return raw;
}

function normalizePhone(value) {
  const valueDigits = digits(value);
  return valueDigits.length > 10 ? valueDigits.slice(-10) : valueDigits;
}

function normalizeCourse(value, courseMap) {
  const raw = clean(value).toUpperCase();
  const normalized = raw.replace(/_/g, "-").replace(/\s+/g, " ").trim();
  const prefix = normalized.match(/^([A-Z0-9]+)(?:-|$)/);
  let code = prefix ? prefix[1] : normalized;
  if (code === "SM") code = "KIDS";
  const course = courseMap.get(code);
  return { raw, code, name: course?.name || COURSE_NAMES[code] || raw };
}

function cleanStudentName(value) {
  return clean(value).replace(/_\d+\s*$/, "").replace(/[',.]+$/, "").replace(/\s+/g, " ").trim();
}

function cleanAddressPart(value, labels) {
  return clean(value).replace(labels, "").replace(/^[\s.:;+_-]+|[\s.:;+_-]+$/g, "").trim();
}

function parsePoPs(line) {
  const source = clean(line);
  const marker = /(P\.?\s*O\.?|POST\s*OFFICE|P\.?\s*S\.?|POLICE\s*STATION)\s*[:.]*/gi;
  const matches = [...source.matchAll(marker)];
  let postOffice = "";
  let policeStation = "";
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const start = current.index + current[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const value = source.slice(start, end).replace(/^[\s.+;:_-]+|[\s.+;:_-]+$/g, "").trim();
    const label = current[0].toUpperCase().replace(/[^A-Z]/g, "");
    if (label === "PO" || label === "POSTOFFICE") postOffice = value;
    if (label === "PS" || label === "POLICESTATION") policeStation = value;
  }
  if (!postOffice && policeStation) postOffice = policeStation;
  if (!policeStation && postOffice && matches.length > 1) policeStation = postOffice;
  return { postOffice, policeStation };
}

function parseAddress(value) {
  const raw = clean(value);
  const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);
  const firstLine = lines[0] || "";
  const address = cleanAddressPart(firstLine, /^(?:VILL(?:AGE)?|WARD(?:\s*NO\.?)?|COLONY|TOWN)\s*\.?\s*[:\-]?\s*/i);
  const poPsLine = lines.find(line => /P\.?\s*O\.?|POST\s*OFFICE|P\.?\s*S\.?|POLICE\s*STATION/i.test(line)) || "";
  const { postOffice, policeStation } = parsePoPs(poPsLine);
  const districtLine = lines.find(line => /^DIST(?:RICT)?\b/i.test(line)) || "";
  const district = cleanAddressPart(districtLine, /^DIST(?:RICT)?\s*\.?\s*[:\-]?\s*/i);
  const pinMatch = raw.match(/\b(\d{6})\b/);
  return {
    address, postOffice, policeStation, district,
    pin: pinMatch ? pinMatch[1] : "",
    sourceAddressRaw: raw
  };
}

function normalizeSex(value) {
  const raw = clean(value);
  const normalized = raw.toUpperCase().replace(/[.,\s']/g, "");
  if (normalized === "M" || normalized === "MALE") return "M";
  if (normalized === "F" || normalized === "FEMALE") return "F";
  return "";
}

function readSourceRows(workbook) {
  let selectedSheet = workbook.Sheets["Student Data"];
  if (!selectedSheet) {
    const requiredStudentHeaders = ["stcode", "stname", "sex", "address", "qualification", "course"];
    for (const sheetName of workbook.SheetNames) {
      const candidate = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true });
      const hasStudentHeader = candidate.some(row => {
        const names = row.map(normalizeHeader);
        return requiredStudentHeaders.every(header => names.includes(header))
          && names.some(header => ["dob", "dateofbirth"].includes(header))
          && names.some(header => ["stfather", "father", "fathername"].includes(header))
          && names.some(header => ["phno", "phoneno", "phone"].includes(header))
          && names.some(header => ["doa", "dateofadmission", "admissiondate"].includes(header));
      });
      if (hasStudentHeader) { selectedSheet = workbook.Sheets[sheetName]; break; }
    }
  }
  if (!selectedSheet) throw new Error('Could not find the "Student Data" worksheet or St_Code/St_Name headers.');
  const grid = XLSX.utils.sheet_to_json(selectedSheet, { header: 1, defval: "", raw: true });
  const headerIndex = grid.findIndex(row => {
    const headers = row.map(normalizeHeader);
    return ["stcode", "stname", "sex", "address", "qualification", "course"].every(header => headers.includes(header))
      && headers.some(header => ["dob", "dateofbirth"].includes(header))
      && headers.some(header => ["stfather", "father", "fathername"].includes(header))
      && headers.some(header => ["phno", "phoneno", "phone"].includes(header))
      && headers.some(header => ["doa", "dateofadmission", "admissiondate"].includes(header));
  });
  if (headerIndex < 0) throw new Error("Student Data worksheet does not contain St_Code and St_Name columns.");

  const headers = grid[headerIndex].map(normalizeHeader);
  const indexes = {
    regnNo: headers.indexOf("stcode"),
    name: headers.indexOf("stname"),
    dob: headers.findIndex(value => ["dob", "dateofbirth"].includes(value)),
    sex: headers.indexOf("sex"),
    father: headers.findIndex(value => ["stfather", "father", "fathername"].includes(value)),
    address: headers.indexOf("address"),
    phone: headers.findIndex(value => ["phno", "phoneno", "phone"].includes(value)),
    qualification: headers.indexOf("qualification"),
    formNo: headers.indexOf("formno"),
    admissionDate: headers.findIndex(value => ["doa", "dateofadmission", "admissiondate"].includes(value)),
    course: headers.indexOf("course")
  };

  const rows = [];
  for (let index = headerIndex + 1; index < grid.length; index += 1) {
    const values = grid[index];
    if (!values.some(value => clean(value))) continue;
    const get = key => indexes[key] >= 0 ? values[indexes[key]] : "";
    const registrationCode = clean(get("regnNo")).replace(/\.0$/, "").trim();
    const sourceName = clean(get("name"));
    const name = cleanStudentName(sourceName);
    const address = parseAddress(get("address"));
    const phones = clean(get("phone")).split(/[;,]/).map(normalizePhone).filter(Boolean);
    const rawSex = clean(get("sex"));
    const row = {
      regnNo: registrationCode,
      applicantName: name,
      sourceStudentName: sourceName,
      dateOfBirth: dateValue(get("dob")),
      sex: normalizeSex(rawSex),
      sourceSex: rawSex,
      fatherOrHusbandName: clean(get("father")),
      ...address,
      mobileNumber: phones[0] || "",
      whatsappNumber: phones[0] || "",
      guardianContactNumber: phones[1] || "",
      sourceQualification: clean(get("qualification")),
      sourcePhone: clean(get("phone")),
      formNo: clean(get("formNo")),
      admissionDate: dateValue(get("admissionDate")),
      course: clean(get("course")),
      sourceRowNo: index + 1
    };
    row.sourceRowKey = [row.regnNo, row.formNo, row.applicantName.toLowerCase(), row.admissionDate, row.course.toUpperCase()].join("|");
    const errors = [];
    if (!row.regnNo) errors.push("St_Code is blank.");
    if (!row.applicantName) errors.push("St_Name is blank.");
    if (!row.admissionDate) errors.push("D.O.A is blank or invalid.");
    if (!row.course) errors.push("Course is blank.");
    rows.push({ row, errors });
  }
  return rows;
}

function previewSummary(parsedRows) {
  const valid = parsedRows.filter(item => item.errors.length === 0);
  const registrationCounts = new Map();
  const formCounts = new Map();
  for (const item of valid) {
    registrationCounts.set(item.row.regnNo, (registrationCounts.get(item.row.regnNo) || 0) + 1);
    if (item.row.formNo) formCounts.set(item.row.formNo, (formCounts.get(item.row.formNo) || 0) + 1);
  }
  const missing = {
    dateOfBirth: parsedRows.filter(item => !item.row.dateOfBirth).length,
    sex: parsedRows.filter(item => !item.row.sex).length,
    fatherName: parsedRows.filter(item => !item.row.fatherOrHusbandName).length,
    address: parsedRows.filter(item => !item.row.address).length,
    phone: parsedRows.filter(item => !item.row.mobileNumber && !item.row.guardianContactNumber).length,
    formNo: parsedRows.filter(item => !item.row.formNo).length,
    qualification: parsedRows.filter(item => !item.row.sourceQualification).length,
    dobOutsideExpectedRange: parsedRows.filter(item => { const year = Number(String(item.row.dateOfBirth || "").slice(0, 4)); return year && (year < 1900 || year > new Date().getFullYear()); }).length,
    dobAfterAdmission: parsedRows.filter(item => item.row.dateOfBirth && item.row.admissionDate && item.row.dateOfBirth > item.row.admissionDate).length,
    phoneWithInvalidDigits: parsedRows.filter(item => item.row.sourcePhone.split(/[;,]/).some(part => { const value = digits(part); return value && value.length !== 10; })).length
  };
  return {
    totalRows: parsedRows.length,
    validRows: valid.length,
    invalidRows: parsedRows.length - valid.length,
    duplicateRegistrationCodes: [...registrationCounts.values()].filter(count => count > 1).length,
    duplicateFormNumbers: [...formCounts.values()].filter(count => count > 1).length,
    missing,
    sampleRows: valid.slice(0, 8).map(item => ({
      registrationNo: item.row.regnNo, name: item.row.applicantName, dob: item.row.dateOfBirth,
      gender: item.row.sex || item.row.sourceSex || "—", fatherName: item.row.fatherOrHusbandName,
      village: item.row.address, postOffice: item.row.postOffice, policeStation: item.row.policeStation,
      pin: item.row.pin, mobile: item.row.mobileNumber, guardian: item.row.guardianContactNumber,
      formNo: item.row.formNo, admissionDate: item.row.admissionDate, course: item.row.course,
      qualification: item.row.sourceQualification
    })),
    errors: parsedRows.filter(item => item.errors.length).slice(0, 30).map(item => ({
      row: item.row.sourceRowNo, errors: item.errors
    }))
  };
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to import students." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to bulk import students." }, { status: 403 });
    }

    await connectMongoDB();
    const form = await request.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") || "preview");
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose an Excel file to continue." }, { status: 400 });
    if (!/\.(xlsx|xls)$/i.test(String(file.name || ""))) return NextResponse.json({ error: "Only .xlsx and .xls files are supported." }, { status: 400 });
    if (Number(file.size || 0) > 15 * 1024 * 1024) return NextResponse.json({ error: "The Excel file must be smaller than 15 MB." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const parsedRows = readSourceRows(workbook);
    const summary = previewSummary(parsedRows);
    const paymentPreview = parsePaymentWorksheet(workbook);
    const paymentSheetSummary = {
      sheetName: paymentPreview.sheetName,
      totalRows: paymentPreview.rows.length,
      validRows: paymentPreview.rows.filter(row => row.valid).length,
      invalidRows: paymentPreview.rows.filter(row => !row.valid).length,
    };
    if (mode !== "import") return NextResponse.json({
      ...summary, paymentSheet: paymentSheetSummary,
      message: "Spreadsheet preview is ready. Review both student and receipt worksheets before importing."
    });
    if (!summary.validRows) return NextResponse.json({ error: "No valid student rows were found.", ...summary }, { status: 400 });

    await removeLegacyFormNoUniqueIndex();
    const sourceName = String(file.name || "RCLD Student Import.xlsx").slice(0, 180);
    const validRows = parsedRows.filter(item => item.errors.length === 0);
    const courseCodes = [...new Set(validRows.map(item => {
      const normalized = item.row.course.toUpperCase().replace(/_/g, "-").trim();
      const match = normalized.match(/^([A-Z0-9]+)(?:-|$)/);
      const code = match ? match[1] : normalized;
      return code === "SM" ? "KIDS" : code;
    }))];
    const courses = await Course.find({ code: { $in: courseCodes } }).lean();
    const courseMap = new Map(courses.map(course => [String(course.code).toUpperCase(), course]));
    const operations = validRows.map(item => {
      const row = item.row;
      const course = normalizeCourse(row.course, courseMap);
      const payload = {
        regnNo: row.regnNo, formNo: row.formNo, applicantName: row.applicantName,
        sourceStudentName: row.sourceStudentName, dateOfBirth: row.dateOfBirth,
        sex: row.sex, sourceSex: row.sourceSex, fatherOrHusbandName: row.fatherOrHusbandName,
        address: row.address, presentAddress: row.address, permanentAddress: row.address,
        sameAsPresentAddress: Boolean(row.address), postOffice: row.postOffice,
        policeStation: row.policeStation, district: row.district, pin: row.pin,
        sourceAddressRaw: row.sourceAddressRaw, mobileNumber: row.mobileNumber,
        whatsappNumber: row.whatsappNumber, guardianContactNumber: row.guardianContactNumber,
        sourceQualification: row.sourceQualification, sourcePhone: row.sourcePhone, courseCode: course.code,
        courseName: course.name, sourceCourseLabel: row.course, admissionDate: row.admissionDate,
        importSource: sourceName, sourceRowNo: row.sourceRowNo, sourceRowKey: row.sourceRowKey
      };
      const identityFilters = [{ importSource: sourceName, sourceRowKey: row.sourceRowKey }];
      if (row.formNo) identityFilters.push({
        regnNo: row.regnNo, formNo: row.formNo, applicantName: row.applicantName,
        admissionDate: row.admissionDate, courseCode: course.code
      });
      return {
        updateOne: {
          filter: { $or: identityFilters },
          update: { $set: payload, $setOnInsert: { status: "Registered", photoUrl: "" } },
          upsert: true
        }
      };
    });

    const writeResult = await Student.bulkWrite(operations, { ordered: false });
    const importedStudents = await Student.find({ importSource: sourceName }).select("_id courseCode").lean();
    const feeOperations = [];
    for (const student of importedStudents) {
      const course = courseMap.get(String(student.courseCode || "").toUpperCase());
      if (!course) continue;
      feeOperations.push({
        updateOne: {
          filter: { studentId: student._id },
          update: { $setOnInsert: {
            totalFee: Number(course.fee || 0), admissionFee: Number(course.admissionFee || 0),
            registrationFee: Number(course.registrationFee || 0), discount: 0,
            payments: [], updatedBy: "student-bulk-import"
          } },
          upsert: true
        }
      });
    }
    if (feeOperations.length) await StudentFee.bulkWrite(feeOperations, { ordered: false });

    // Create/link one durable identity record and one enrollment for each registration code.
    const linkedStudents = await Student.find({ importSource: sourceName }).sort({ admissionDate: 1, createdAt: 1 }).lean();
    const masterLinkSummary = await linkImportedStudentRecords(linkedStudents);
    // Import the dynamically detected fee worksheet; missing/invalid rows are reported, never silently discarded.
    const paymentImport = await importPaymentWorksheet(workbook, { sourceName });

    return NextResponse.json({
      message: "Student import completed. Imported data is ready for profile review.",
      totalRows: summary.totalRows, imported: validRows.length,
      created: writeResult.upsertedCount || 0, matched: writeResult.matchedCount || 0,
      skipped: summary.invalidRows, errors: summary.errors,
      duplicateRegistrationCodes: summary.duplicateRegistrationCodes,
      duplicateFormNumbers: summary.duplicateFormNumbers, missing: summary.missing,
      masterProfilesLinked: masterLinkSummary.linked,
      paymentImport
    });
  } catch (error) {
    console.error("[student-bulk-import]", error);
    return NextResponse.json({ error: "Unable to import students.", detail: error.message }, { status: 500 });
  }
}
