import { renderDiplomaIdCard } from "@/features/students/print/renderDiplomaIdCard";
import { isCodingForKidsCourse } from "@/lib/student-icard/courseRouting.mjs";
const FONT_FAMILY = '"Arial Narrow", "Liberation Sans Narrow", "Roboto Condensed", sans-serif';
const TEMPLATE_ROOT = "/api/icard-templates/";
const templateImageCache = new Map();

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== "");
}

function titleCase(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, prefix, letter) => prefix + letter.toLocaleUpperCase());
}

function formatAdmissionDate(student) {
  const raw = firstValue(student.admissionDate, student.dateOfAdmission, student.admissionOn, student.dateOfJoining, student.createdAt, "");
  if (!raw) return "";
  const text = String(raw).trim();
  let year, month, day;
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) [, year, month, day] = match;
  if (!match) {
    match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (match) [, day, month, year] = match;
  }
  if (!match) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    day = date.getDate(); month = date.getMonth() + 1; year = date.getFullYear();
  }
  return [String(day).padStart(2, "0"), String(month).padStart(2, "0"), String(year)].join("-");
}

function getRegistrationNumber(student) {
  return String(firstValue(
    student.regnNo, student.registrationNo, student.registrationNumber,
    student.registrationId, student.regNo, student.stCode,
    student.activeEnrollment?.stCode, student.enrollmentNo, student.formNo, ""
  )).trim();
}

function getPhotoUrl(student) {
  const raw = firstValue(
    student.photoUrl,
    typeof student.photo === "string" ? student.photo : student.photo?.url || student.photo?.secure_url,
    typeof student.studentPhoto === "string" ? student.studentPhoto : student.studentPhoto?.url || student.studentPhoto?.secure_url,
    student.profilePhoto, student.imageUrl, ""
  );
  if (raw && /^https:\/\//i.test(raw) && /(^|\.)res\.cloudinary\.com$/i.test(new URL(raw).hostname)) {
    return "/api/icard-photo?url=" + encodeURIComponent(raw);
  }
  if (raw) return raw;
  const registration = getRegistrationNumber(student);
  return registration ? "/api/students/photo/" + encodeURIComponent(registration) : "";
}

function getAddressLines(student) {
  const address = firstValue(student.presentAddress, student.address, student.completeAddress, student.fullAddress, student.applicantAddress, student.permanentAddress, "");
  const source = address && typeof address === "object" ? address : {};
  const rawParts = typeof address === "string"
    ? address.split(/[,|\n]+/).map(part => part.trim()).filter(Boolean)
    : [];
  const labelled = pattern => rawParts.find(part => pattern.test(part)) || "";
  const valueAfterLabel = part => String(part || "").replace(/^(?:P\.?\s*O\.?|P\.?\s*S\.?|Dist\.?|ward(?:\s*no)?|village|vill|colony)\s*[:.-]?\s*/i, "").trim();

  const ward = firstValue(
    source.ward, source.wardNo, source.colony, source.village, source.vill,
    student.ward, student.wardNo, student.colony, student.village, student.vill,
    valueAfterLabel(labelled(/^(?:ward|ward\s*no|village|vill|colony)\b/i)),
    rawParts.find(part => !/^(?:P\.?\s*O\.?|P\.?\s*S\.?|Dist\.?)\s*/i.test(part))
  );
  const po = firstValue(
    source.po, source.postOffice, source.post_office,
    student.po, student.postOffice, student.post_office,
    valueAfterLabel(labelled(/^P\.?\s*O\.?(?:\s|$)/i))
  );
  const ps = firstValue(
    source.ps, source.policeStation, source.police_station,
    student.ps, student.policeStation, student.police_station,
    valueAfterLabel(labelled(/^P\.?\s*S\.?(?:\s|$)/i))
  );
  const district = firstValue(
    source.district, student.district, student.permanentDistrict,
    valueAfterLabel(labelled(/^Dist\.?(?:\s|$)/i))
  );
  const clean = value => String(value || "").trim().replace(/^(?:P\.?\s*O\.?|P\.?\s*S\.?|Dist\.?)\s*/i, "").trim();
  const wardLine = clean(ward);
  const poPsLine = [
    po ? "P.O. " + clean(po) : "",
    ps ? "P.S. " + clean(ps) : ""
  ].filter(Boolean).join(", ");
  const districtLine = district ? "Dist. " + clean(district) : "";
  return [wardLine, poPsLine, districtLine];
}
function loadImage(src, { crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image: " + src));
    image.src = src;
  });
}

function drawPhoto(ctx, image, width, height) {
  if (!image) return; // Preserve the clean, printed template circle when no photo exists.
  const radius = width * 0.1987;
  const centerX = width * 0.5;
  const centerY = height * 0.3274;
  const diameter = radius * 2;
  const scale = Math.max(diameter / image.naturalWidth, diameter / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = centerX - drawWidth / 2;
  const drawY = centerY - diameter / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function getTemplateAccent(templateName) {
  const semester = Number(String(templateName || "").match(/sem[-_ ]?(\d+)/i)?.[1] || 0);
  return ({
    1: "#E31E7D",
    2: "#009846",
    3: "#00A8E8",
    4: "#E87722",
    5: "#9C2B88",
  })[semester] || "#E87722";
}

function drawName(ctx, student, width, height, templateName) {
  const parts = String(firstValue(student.applicantName, student.fullName, student.name, "")).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return;
  const surname = parts.length > 1 ? parts.pop() : "";
  const firstText = parts.join(" ").toLocaleUpperCase();
  const lastText = surname.toLocaleUpperCase();
  const accent = getTemplateAccent(templateName);
  let fontSize = width * 0.078;
  const maxWidth = width * 0.92;
  const measure = size => {
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
    return ctx.measureText(firstText + (lastText ? " " + lastText : "")).width;
  };
  const measuredWidth = measure(fontSize);
  if (measuredWidth > maxWidth) {
    fontSize = Math.max(width * 0.065, fontSize * (maxWidth / measuredWidth));
  }
  ctx.save();
  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const firstWidth = ctx.measureText(firstText).width;
  const spaceWidth = lastText ? ctx.measureText(" ").width : 0;
  const lastWidth = lastText ? ctx.measureText(lastText).width : 0;
  let x = width * 0.5 - (firstWidth + spaceWidth + lastWidth) / 2;
  const baseline = height * 0.538;
  ctx.fillStyle = "#3B4248";
  ctx.fillText(firstText, x, baseline);
  if (lastText) {
    x += firstWidth + spaceWidth;
    ctx.fillStyle = accent;
    ctx.fillText(lastText, x, baseline);
  }
  ctx.restore();
}

function getSequentialStudentId(student, fallbackIndex = 1) {
  const candidates = [
    student.idCardNumber, student.idCardNo, student.idCardSerial, student.serialNumber,
    student.serialNo, student.sequenceNumber, student.studentSerial,
    student.studentId, student.idNumber,
  ];
  const stored = candidates.find(value => {
    if (typeof value === "number") return Number.isSafeInteger(value) && value > 0;
    const text = String(value || "").trim();
    return /^\d+$/.test(text) || /(?:ID[-_ ]?NO|ID[-_ ]?CARD)[/:_-]+\d+$/i.test(text);
  });
  const match = String(stored || "").match(/(\d+)$/);
  const parsed = match ? Number(match[1]) : 0;
  const serial = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : Math.max(1, Number(fallbackIndex) || 1);
  return String(serial).padStart(4, "0");
}

function drawDetails(ctx, student, width, height, fallbackIndex = 1) {
  const regnNo = getRegistrationNumber(student);
  const date = formatAdmissionDate(student);
  const father = titleCase(firstValue(student.fatherOrHusbandName, student.fatherName, student.fatherNameAsPerRecords, student.guardianName, ""));
  const addressLines = getAddressLines(student);
  const x = width * 0.4664;
  const fontSize = width * 0.035;
  const registrationFontSize = width * 0.039;
  const baselines = [
    height * 0.633,
    height * 0.661,
    height * 0.689,
    height * 0.717,
    height * 0.745,
    height * 0.773,
    height * 0.801,
  ];

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#2B2F33";
  ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
  const permanentIdCardNumber = String(firstValue(student.idCardNumber, student.idCardNo, "Not Issued Yet")).trim();
  ctx.fillText(permanentIdCardNumber, x, baselines[0]);

  const prefix = "RCLD/ISL-001/";
  ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillText(prefix, x, baselines[1]);
  const prefixWidth = ctx.measureText(prefix).width;
  ctx.font = `700 ${registrationFontSize}px ${FONT_FAMILY}`;
  ctx.fillText(regnNo, x + prefixWidth + width * 0.002, baselines[1]);

  ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
  if (date) ctx.fillText(date, x, baselines[2]);
  if (father) ctx.fillText(father, x, baselines[3]);
  addressLines.forEach((line, index) => {
    if (line) ctx.fillText(line, x, baselines[index + 4]);
  });
  ctx.restore();
}
export async function renderStudentIcardCanvas(student, templateName, fallbackIndex = 1) {
  if (!student || !templateName || templateName.includes("/") || templateName.includes(String.fromCharCode(92))) {
    throw new Error("A student and valid ID-card template are required.");
  }
  if (templateName.toLowerCase() === "id card diploma.jpg") {
    return await renderDiplomaIdCard(null, student);
  }
  await document.fonts.ready;
  await document.fonts.load('700 92px "Arial Narrow"').catch(() => []);
  await document.fonts.load('600 42px "Roboto Condensed"').catch(() => []);
  await document.fonts.load('700 48px "Roboto Condensed"').catch(() => []);
  await document.fonts.ready;
  let templatePromise = templateImageCache.get(templateName);
  if (!templatePromise) {
    templatePromise = loadImage(TEMPLATE_ROOT + encodeURIComponent(templateName));
    templateImageCache.set(templateName, templatePromise);
    templatePromise.catch(() => templateImageCache.delete(templateName));
  }
  const template = await templatePromise;
  const width = template.naturalWidth * 2;
  const height = Math.round(width * template.naturalHeight / template.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Your browser could not create an ID-card canvas.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(template, 0, 0, width, height);

  let photo = null;
  const photoUrl = getPhotoUrl(student);
  if (photoUrl) {
    try { photo = await loadImage(photoUrl); }
    catch (error) { console.warn("[icard] Student photo unavailable; using neutral placeholder.", error); }
  }
  drawPhoto(ctx, photo, width, height);
  drawName(ctx, student, width, height, templateName);
  drawDetails(ctx, student, width, height, fallbackIndex);
  return canvas;
}

function safeFilePart(value) {
  return String(value || "").trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "Student";
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error("Unable to create the JPG image."));
      resolve(blob);
    }, "image/jpeg", 0.96);
  });
}

export async function exportStudentIcards({ students, templateName, outputMode = "jpg", onMessage, onStudentUpdated }) {
  const list = Array.isArray(students) ? students.filter(Boolean) : [];
  if (!list.length) throw new Error("Select at least one student.");
  // Open the print tab synchronously during the user click, before async canvas rendering.
  const printWindow = outputMode === "print" ? window.open("", "_blank") : null;
  if (outputMode === "print" && !printWindow) throw new Error("Please allow pop-ups to print the ID card.");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write("<!doctype html><title>Preparing ID cards</title><body style=\"font:14px Arial;padding:24px\">Preparing student ID cards…</body>");
    printWindow.document.close();
  }

  const exportList = list;

  if (outputMode === "print") {
    const pages = [];
    try {
      for (const student of exportList) {
        const canvas = await renderStudentIcardCanvas(student, templateName, pages.length + 1);
        const blob = await canvasToJpeg(canvas);
        const url = URL.createObjectURL(blob);
        pages.push({ url, name: student.applicantName || "Student" });
      }
    } catch (error) {
      pages.forEach(page => URL.revokeObjectURL(page.url));
      if (!printWindow.closed) printWindow.close();
      throw error;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>RCLD Student ID Cards</title><style>
      @page{size:54mm 85.6mm;margin:0}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      html,body{margin:0;padding:0;background:#fff}
      .card-page{width:54mm;height:85.6mm;margin:0;padding:0;overflow:hidden;page-break-after:always;break-after:page}
      .card-page:last-child{page-break-after:auto;break-after:auto}
      .card-page img{display:block;width:54mm;height:85.6mm;object-fit:fill}
      @media screen{body{display:flex;flex-direction:column;align-items:center;gap:12px;background:#e9edf3;padding:12px}.card-page{box-shadow:0 2px 12px #0002}}
    </style></head><body>${pages.map(page => `<section class="card-page"><img src="${page.url}" alt="${String(page.name).replace(/[&<>"]/g,"")}"></section>`).join("")}
      <script>window.addEventListener("load",async()=>{await Promise.all([...document.images].map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve()));await document.fonts.ready;setTimeout(()=>window.print(),250)});</script>
    </body></html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.addEventListener("afterprint", () => pages.forEach(page => URL.revokeObjectURL(page.url)), { once: true });
    return;
  }

  for (let index = 0; index < exportList.length; index += 1) {
    let student = exportList[index];
    if (!student._id) throw new Error("Student ID is missing; unable to confirm the ID-card download.");
    const response = await fetch(`/api/students/${encodeURIComponent(student._id)}/icard-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "download" }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to confirm the ID-card download.");
    student = {
      ...student,
      ...(data.student || {}),
      idCardNumber: String(data.idCardNumber || data.idCardNo),
      idCardNo: String(data.idCardNumber || data.idCardNo),
      isIdDownloaded: true,
      isDownloaded: true,
      idIssuedAt: data.idIssuedAt,
      lastDownloadedAt: data.lastDownloadedAt,
    };
    const canvas = await renderStudentIcardCanvas(student, templateName, index + 1);
    const blob = await canvasToJpeg(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const registration = safeFilePart(getRegistrationNumber(student));
    const name = safeFilePart(student.applicantName);
    link.href = url;
    link.download = `${registration}_${name}_ID_Card.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    onStudentUpdated?.(student);
    if (index < exportList.length - 1) await new Promise(resolve => window.setTimeout(resolve, 180));
  }
  onMessage?.(exportList.length === 1 ? "Student ID Card JPG downloaded." : `${exportList.length} student ID cards downloaded.`);
}

export function getRecommendedIcardTemplate(student, templates) {
  if (!Array.isArray(templates) || !templates.length) return "";
  if (!isCodingForKidsCourse(student)) {
    return templates.includes("ID Card Diploma.jpg")
      ? "ID Card Diploma.jpg"
      : templates.find(name => /diploma/i.test(name)) || "";
  }

  // Keep the existing semester resolution order for Coding for Kids unchanged.
  const candidates = [
    student?.semesterLabel,
    student?.semester,
    student?.activeSemester,
    student?.currentSemester,
    student?.courseCode,
    student?.sourceCourseLabel,
    student?.courseName,
  ].map(value => String(value ?? "").trim()).filter(Boolean);
  const explicitSemester = candidates.find(value => /(?:SM|SEM(?:ESTER)?)\s*[-_ ]?\s*(?:VI|IV|V|III|II|I|[1-6])\b/i.test(value));
  const numericSemester = candidates.find(value => /^(?:VI|IV|V|III|II|I|[1-6])$/i.test(value));
  const semesterSource = explicitSemester || numericSemester || "";
  const romanMap = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
  const semesterMatch = semesterSource.match(/(?:SM|SEM(?:ESTER)?)\s*[-_ ]?\s*(VI|IV|V|III|II|I|[1-6])\b/i)
    || semesterSource.match(/^(VI|IV|V|III|II|I|[1-6])$/i);
  const token = semesterMatch?.[1] || "";
  const semester = token ? (romanMap[token.toLowerCase()] || Number(token)) : 0;
  const expected = "ID Card Sem-" + Math.min(6, Math.max(1, semester || 1)) + ".jpg";
  return templates.includes(expected) ? expected : templates[0];
}
