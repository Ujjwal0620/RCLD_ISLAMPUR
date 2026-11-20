const FONT_FAMILY = '"Arial Narrow", "Liberation Sans Narrow", "Roboto Condensed", sans-serif';
const TEMPLATE_ROOT = "/assets/icardtemplates/";

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
  const ward = firstValue(
    source.ward, source.wardNo, source.colony, source.village, source.vill,
    student.ward, student.wardNo, student.colony, student.village, student.vill,
    typeof address === "string" ? address.split(/[,|\n]+/).map(part => part.trim()).filter(Boolean)[0] : ""
  );
  const po = firstValue(source.po, source.postOffice, source.post_office, student.po, student.postOffice, student.post_office, "");
  const ps = firstValue(source.ps, source.policeStation, source.police_station, student.ps, student.policeStation, student.police_station, "");
  const district = firstValue(source.district, student.district, student.permanentDistrict, "");
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

function drawPlaceholder(ctx, x, y, diameter) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, diameter / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#F1F3F5";
  ctx.fill();
  ctx.fillStyle = "#C7CDD2";
  ctx.beginPath();
  ctx.arc(x, y - diameter * 0.11, diameter * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + diameter * 0.24, diameter * 0.25, diameter * 0.19, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

function drawPhoto(ctx, image, width, height) {
  const diameter = width * 0.365;
  const centerX = width * 0.5;
  const centerY = height * 0.336;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, diameter / 2, 0, Math.PI * 2);
  ctx.clip();
  if (!image) {
    drawPlaceholder(ctx, centerX, centerY, diameter);
  } else {
    const scale = Math.max(diameter / image.naturalWidth, diameter / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = centerX - drawWidth / 2;
    const drawY = centerY - diameter / 2;
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }
  ctx.restore();
}

function drawName(ctx, student, width, height) {
  const parts = String(firstValue(student.applicantName, student.fullName, student.name, "STUDENT")).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return;
  const surname = parts.length > 1 ? parts.pop() : "";
  const firstNames = parts;
  const maxWidth = width * 0.82;
  let fontSize = width * 0.056;
  const measure = size => {
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
    const firstText = firstNames.join(" ");
    return ctx.measureText(firstText).width + (surname ? ctx.measureText(" " + surname).width : 0);
  };
  while (fontSize > width * 0.032 && measure(fontSize) > maxWidth) fontSize -= width * 0.001;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  const firstText = firstNames.join(" ").toLocaleUpperCase();
  const lastText = surname.toLocaleUpperCase();
  const firstWidth = ctx.measureText(firstText).width;
  const spaceWidth = surname ? ctx.measureText(" ").width : 0;
  const lastWidth = surname ? ctx.measureText(lastText).width : 0;
  let x = width * 0.5 - (firstWidth + spaceWidth + lastWidth) / 2;
  ctx.fillStyle = "#3B4248";
  ctx.fillText(firstText, x, height * 0.515);
  x += firstWidth;
  if (surname) {
    x += spaceWidth;
    ctx.fillStyle = "#E87722";
    ctx.fillText(lastText, x, height * 0.515);
  }
  ctx.restore();
}

function drawDetails(ctx, student, width, height) {
  const regnNo = getRegistrationNumber(student);
  const date = formatAdmissionDate(student);
  const father = titleCase(firstValue(student.fatherOrHusbandName, student.fatherName, student.fatherNameAsPerRecords, student.guardianName, ""));
  const addressLines = getAddressLines(student);
  const fontSize = width * 0.03;
  const lineStep = height * 0.027;
  const startY = height * 0.606;
  const labelX = width * 0.462;
  const valueX = width * 0.482;

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = "#D97724";
  ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;

  const labels = ["ID No :", "Date of Admn. :", "Father's Name :", "Address :", "", ""];
  labels.forEach((label, index) => {
    if (label) ctx.fillText(label, labelX, startY + index * lineStep);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#2B2F33";
  ctx.font = `500 ${fontSize}px ${FONT_FAMILY}`;
  const prefix = "RCLD/ISL-001/";
  ctx.fillText(prefix, valueX, startY);
  const prefixWidth = ctx.measureText(prefix).width;
  ctx.font = `700 ${width * 0.033}px ${FONT_FAMILY}`;
  ctx.fillText(regnNo || "—", valueX + prefixWidth + width * 0.002, startY);

  ctx.font = `600 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillText(date || "—", valueX, startY + lineStep);
  ctx.fillText(father || "—", valueX, startY + lineStep * 2);

  addressLines.forEach((line, index) => {
    if (line) ctx.fillText(line, valueX, startY + lineStep * (index + 3));
  });
  ctx.restore();
}

export async function renderStudentIcardCanvas(student, templateName) {
  if (!student || !templateName || /[\/]/.test(templateName)) {
    throw new Error("A student and valid ID-card template are required.");
  }
  await document.fonts.ready;
  await document.fonts.load(`700 24px ${FONT_FAMILY}`).catch(() => []);
  const template = await loadImage(TEMPLATE_ROOT + encodeURIComponent(templateName));
  const width = Math.max(template.naturalWidth, 1200);
  const height = Math.round(width * template.naturalHeight / template.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Your browser could not create an ID-card canvas.");
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
  drawName(ctx, student, width, height);
  drawDetails(ctx, student, width, height);
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

export async function exportStudentIcards({ students, templateName, outputMode = "jpg", onMessage }) {
  const list = Array.isArray(students) ? students.filter(Boolean) : [];
  if (!list.length) throw new Error("Select at least one student.");
  const cards = [];
  for (const student of list) {
    const canvas = await renderStudentIcardCanvas(student, templateName);
    cards.push({ student, canvas });
  }

  if (outputMode === "print") {
    const printWindow = window.open("", "_blank");
    if (!printWindow) throw new Error("Please allow pop-ups to print the ID card.");
    const pages = await Promise.all(cards.map(async ({ canvas, student }) => {
      const blob = await canvasToJpeg(canvas);
      const url = URL.createObjectURL(blob);
      return { url, name: student.applicantName || "Student" };
    }));
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

  for (let index = 0; index < cards.length; index += 1) {
    const { student, canvas } = cards[index];
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
    if (index < cards.length - 1) await new Promise(resolve => window.setTimeout(resolve, 180));
  }
  onMessage?.(list.length === 1 ? "Student ID Card JPG downloaded." : `${list.length} student ID cards downloaded.`);
}

export function getRecommendedIcardTemplate(student, templates) {
  if (!Array.isArray(templates) || !templates.length) return "";
  const course = String(firstValue(student?.courseName, student?.courseCode, student?.sourceCourseLabel, "")).toLowerCase();
  const semesterRaw = firstValue(student?.currentSemester, student?.semester, student?.activeSemester, student?.semesterLabel, "");
  const semesterMatch = String(semesterRaw).match(/([1-6]|i{1,3}|iv|v|vi)/i);
  const romanMap = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
  const semester = semesterMatch
    ? (romanMap[String(semesterMatch[1]).toLowerCase()] || Number(semesterMatch[1]))
    : Number(String(course).match(/sm[-_ ]?([1-6])/i)?.[1] || 0);
  let expected = "";
  if (/robotics/.test(course)) {
    const year = Number(firstValue(student?.roboticsYear, student?.courseYear, student?.yearOfCourse, semester, 1));
    expected = `ID Card Robotics ${Math.min(3, Math.max(1, year))}${year === 1 ? "st" : year === 2 ? "nd" : "rd"} year.jpg`;
  } else if (/coding\s*for\s*kids|\bkids\b|\bsm[-_ ]/.test(course) || semester) {
    expected = semester ? `ID Card Sem-${Math.min(6, Math.max(1, semester))}.jpg` : "ID Card Sem-1.jpg";
  } else if (/school/.test(course)) {
    expected = "ID Card School Course.jpg";
  } else {
    expected = "ID Card Diploma.jpg";
  }
  return templates.includes(expected) ? expected : templates[0];
}
