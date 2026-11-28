const DIPLOMA_TEMPLATE_URL = "/assets/icardtemplates/ID%20Card%20Diploma.jpg";
const DIPLOMA_WIDTH_300_DPI = Math.round((54 / 25.4) * 300);
const DIPLOMA_HEIGHT_300_DPI = Math.round((85.6 / 25.4) * 300);

export const DIPLOMA_ID_LAYOUT = {
  registration: {
    x: 0.203, line1Y: 0.077, line2Y: 0.117,
    line1Font: 0.0265, line2Font: 0.037,
    color: "#111111",
  },
  session: { x: 0.824, y: 0.079, font: 0.0335, color: "#D32F2F" },
  idCard: { x: 0.824, y: 0.145, font: 0.0265, color: "#111111" },
  photo: { x: 0.326, y: 0.331, width: 0.348, height: 0.266, radius: 0.022, border: "#3C3378", borderWidth: 0.0075 },
  details: {
    x: 0.309, maxWidth: 0.65,
    nameY: 0.638, nameFont: 0.031, nameMinFont: 0.022,
    fatherY: 0.673, fatherFont: 0.024, fatherMinFont: 0.019,
    addressY: 0.702, addressFont: 0.0235, addressMinFont: 0.0185, addressLineHeight: 0.028,
    courseY: 0.794, courseFont: 0.0255,
    dateY: 0.836, dateFont: 0.0255,
  },
};

export const COURSE_FULL_NAME_MAP = {
  CCA: "Certificate in Computer Application",
  DCA: "Diploma in Computer Application",
  ADCA: "Advanced Diploma in Computer Application",
  CCC: "Course on Computer Concepts",
  CAO: "Computer Accounting Operator",
  DWPD: "Diploma in Web Page Designing",
  DOM: "Diploma in Office Management",
  DCST: "Diploma in Computer Science & Technology",
  DCAP: "Diploma in Computer Accounts Professional",
  DHNT: "Diploma in Hardware Networking Technology",
  DCPP: "Diploma in Computer Programming Professional",
};

const imageCache = new Map();

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== "");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load ID-card image: " + src));
    image.src = src;
  });
}

function cachedImage(src) {
  let promise = imageCache.get(src);
  if (!promise) {
    promise = loadImage(src);
    imageCache.set(src, promise);
    promise.catch(() => imageCache.delete(src));
  }
  return promise;
}

function admissionDateParts(student) {
  const raw = firstValue(student.admissionDate, student.dateOfAdmission, student.admissionOn, student.dateOfJoining, student.createdAt, "");
  if (!raw) return null;
  const text = String(raw).trim();
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) return { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function formatAdmissionDate(student) {
  const parts = admissionDateParts(student);
  if (!parts) return "";
  return [String(parts.day).padStart(2, "0"), String(parts.month).padStart(2, "0"), String(parts.year)].join("-");
}

function getSession(student) {
  const saved = String(firstValue(student.session, student.academicSession, student.sessionLabel, "")).trim();
  if (/^\d{4}\s*[-–/]\s*\d{4}$/.test(saved)) return saved.replace(/[–/]/g, "-").replace(/\s/g, "");
  const parts = admissionDateParts(student);
  return parts ? parts.year + "-" + (parts.year + 1) : "";
}

function getRegistrationNumber(student) {
  const enrollment = student.activeEnrollment || student.currentEnrollment || {};
  return String(firstValue(
    student.regnNo, student.registrationNo, student.registrationNumber,
    student.registrationId, student.regNo, student.stCode,
    enrollment.stCode, enrollment.registrationId, enrollment.regnNo,
    student.enrollmentNo, student.formNo, ""
  )).trim();
}

function formatIdCardNumber(student) {
  const stored = String(firstValue(student.idCardNumber, student.idCardNo, student.idCardSerial, "")).trim();
  const digits = stored.match(/(\d+)$/)?.[1] || "";
  return digits ? "ISL-001/" + digits.padStart(4, "0") : "";
}

function getPhotoUrl(student) {
  const raw = firstValue(
    student.photoUrl,
    typeof student.photo === "string" ? student.photo : student.photo?.url || student.photo?.secure_url,
    typeof student.studentPhoto === "string" ? student.studentPhoto : student.studentPhoto?.url || student.studentPhoto?.secure_url,
    student.profilePhoto, student.imageUrl, ""
  );
  if (raw && /^https:\/\//i.test(raw)) {
    try {
      if (/(^|\.)res\.cloudinary\.com$/i.test(new URL(raw).hostname)) {
        return "/api/icard-photo?url=" + encodeURIComponent(raw);
      }
    } catch {}
  }
  if (raw) return raw;
  const registration = getRegistrationNumber(student);
  return registration ? "/api/students/photo/" + encodeURIComponent(registration) : "";
}

function getAddress(student) {
  const raw = firstValue(student.presentAddress, student.address, student.completeAddress, student.fullAddress, student.applicantAddress, student.permanentAddress, "");
  const parts = [];
  const normalize = value => String(value || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const add = value => {
    const text = String(value ?? "").trim();
    if (!text) return;
    const normalized = normalize(text);
    if (parts.some(item => {
      const existing = normalize(item);
      return existing === normalized || existing.includes(normalized) || normalized.includes(existing);
    })) return;
    parts.push(text);
  };

  if (typeof raw === "string") add(raw);
  else if (raw && typeof raw === "object") {
    ["village", "vill", "ward", "po", "postOffice", "ps", "policeStation", "nearestLandmark", "district", "state", "pin", "pincode"]
      .forEach(key => add(raw[key]));
  }

  add(student.village || student.vill || student.ward);
  const po = firstValue(student.po, student.postOffice);
  const ps = firstValue(student.ps, student.policeStation);
  if (po) add("P.O. " + po);
  if (ps) add("P.S. " + ps);
  add(student.nearestLandmark);
  const district = firstValue(student.district, student.permanentDistrict);
  if (district) add("DIST. " + district);
  add(firstValue(student.state, student.permanentState));
  add(firstValue(student.pin, student.pincode, student.permanentPin));
  return parts.join(", ").replace(/\s+/g, " ").trim().toLocaleUpperCase();
}
function getCourseName(student) {
  const courseObject = student.course && typeof student.course === "object" ? student.course : {};
  const enrollment = student.activeEnrollment || student.currentEnrollment || {};
  const raw = String(firstValue(
    student.courseName, student.course?.name, student.courseCode, student.sourceCourseLabel,
    typeof student.course === "string" ? student.course : "",
    enrollment.courseName, enrollment.courseCode, enrollment.course, ""
  )).trim();
  const code = String(firstValue(student.courseCode, courseObject.code, enrollment.courseCode, "")).trim().toUpperCase();
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const mapped = COURSE_FULL_NAME_MAP[code] || COURSE_FULL_NAME_MAP[key];
  return titleCase(mapped || raw);
}

function titleCase(value) {
  const smallWords = new Set(["in", "of", "for", "and", "on", "to"]);
  return String(value || "").trim().toLocaleLowerCase().split(/\s+/).map((word, index) => {
    if (index > 0 && smallWords.has(word)) return word;
    return word ? word[0].toLocaleUpperCase() + word.slice(1) : word;
  }).join(" ");
}
function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function setSerif(ctx, weight, size) {
  ctx.font = weight + " " + size + 'px "Times New Roman", Georgia, serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#111111";
}

function fitText(ctx, text, baseSize, minSize, maxWidth, weight = "bold") {
  let size = baseSize;
  setSerif(ctx, weight, size);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size = Math.max(minSize, size - 0.5);
    setSerif(ctx, weight, size);
  }
  return size;
}

function wrapWords(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function drawPhoto(ctx, photo, W, H) {
  const p = DIPLOMA_ID_LAYOUT.photo;
  const x = p.x * W, y = p.y * H, width = p.width * W, height = p.height * H;
  const radius = p.radius * W;
  ctx.save();
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y, width, height);
  if (photo) {
    const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight);
    const drawWidth = photo.naturalWidth * scale;
    const drawHeight = photo.naturalHeight * scale;
    const drawX = x + (width - drawWidth) / 2;
    const drawY = y - Math.max(0, drawHeight - height) * 0.15;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, drawX, drawY, drawWidth, drawHeight);
  }
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.strokeStyle = p.border;
  ctx.lineWidth = p.borderWidth * W;
  ctx.stroke();
  ctx.restore();
}

function drawDiplomaText(ctx, student, W, H) {
  const registration = getRegistrationNumber(student);
  const slash = registration.lastIndexOf("/");
  const reg = DIPLOMA_ID_LAYOUT.registration;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = reg.color;
  if (slash >= 0) {
    setSerif(ctx, "bold", reg.line1Font * H);
    ctx.textAlign = "center";
    ctx.fillText(registration.slice(0, slash + 1), reg.x * W, reg.line1Y * H);
    setSerif(ctx, "bold", reg.line2Font * H);
    ctx.fillText(registration.slice(slash + 1), reg.x * W, reg.line2Y * H);
  } else if (registration) {
    setSerif(ctx, "bold", reg.line1Font * H);
    ctx.fillText(registration, reg.x * W, 0.097 * H);
  }

  const session = getSession(student);
  const s = DIPLOMA_ID_LAYOUT.session;
  if (session) {
    setSerif(ctx, "bold", s.font * H);
    ctx.fillStyle = s.color;
    ctx.textAlign = "center";
    ctx.fillText(session, s.x * W, s.y * H);
  }

  const id = formatIdCardNumber(student);
  const i = DIPLOMA_ID_LAYOUT.idCard;
  if (id) {
    setSerif(ctx, "bold", i.font * H);
    ctx.fillStyle = i.color;
    ctx.textAlign = "center";
    ctx.fillText(id, i.x * W, i.y * H);
  }

  const d = DIPLOMA_ID_LAYOUT.details;
  const x = d.x * W;
  const maxWidth = d.maxWidth * W;
  ctx.textAlign = "left";
  ctx.fillStyle = "#111111";

  const name = String(firstValue(student.applicantName, student.fullName, student.name, "")).trim().toLocaleUpperCase();
  if (name) {
    const size = fitText(ctx, name, d.nameFont * H, d.nameMinFont * H, maxWidth, "bold");
    setSerif(ctx, "bold", size);
    ctx.fillText(name, x, d.nameY * H, maxWidth);
  }

  const father = String(firstValue(student.fatherOrHusbandName, student.fatherName, student.fatherNameAsPerRecords, student.guardianName, "")).trim().toLocaleUpperCase();
  if (father) {
    const size = fitText(ctx, father, d.fatherFont * H, d.fatherMinFont * H, maxWidth, "500");
    setSerif(ctx, "500", size);
    ctx.fillText(father, x, d.fatherY * H, maxWidth);
  }

  const address = getAddress(student);
  if (address) {
    let size = d.addressFont * H;
    let lines = [];
    while (size >= d.addressMinFont * H) {
      setSerif(ctx, "500", size);
      lines = wrapWords(ctx, address, maxWidth);
      if (lines.length <= 3) break;
      size -= 0.35;
    }
    setSerif(ctx, "500", Math.max(d.addressMinFont * H, size));
    if (lines.length > 3) {
      lines = lines.slice(0, 3);
      let last = lines[2];
      while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
      lines[2] = last.trimEnd() + "…";
    }
    lines.slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, x, d.addressY * H + index * d.addressLineHeight * H, maxWidth);
    });
  }

  const course = getCourseName(student);
  if (course) {
    const courseMaxWidth = Math.min(maxWidth, W * 0.47);
    const size = fitText(ctx, course, d.courseFont * H, d.courseFont * H * 0.78, courseMaxWidth, "bold");
    setSerif(ctx, "bold", size);
    ctx.fillText(course, x, d.courseY * H, courseMaxWidth);
  }

  const date = formatAdmissionDate(student);
  if (date) {
    setSerif(ctx, "bold", d.dateFont * H);
    ctx.fillText(date, x, d.dateY * H, maxWidth);
  }
  ctx.restore();
}

export async function renderDiplomaIdCard(canvas, student, templateImg = null) {
  if (!student) throw new Error("A student record is required to render the Diploma ID card.");
  await document.fonts.ready;
  await document.fonts.load('bold 28px "Times New Roman"').catch(() => []);
  await document.fonts.load('500 24px "Times New Roman"').catch(() => []);
  await document.fonts.ready;

  const template = templateImg || await cachedImage(DIPLOMA_TEMPLATE_URL);
  const target = canvas || document.createElement("canvas");
  target.width = DIPLOMA_WIDTH_300_DPI;
  target.height = DIPLOMA_HEIGHT_300_DPI;
  const ctx = target.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Your browser could not create the Diploma ID-card canvas.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(template, 0, 0, target.width, target.height);

  let photo = null;
  const photoUrl = getPhotoUrl(student);
  if (photoUrl) {
    try {
      photo = await cachedImage(photoUrl);
    } catch (error) {
      console.warn("[diploma-id-card] Student photo unavailable; leaving the photo frame blank.", error);
    }
  }
  drawPhoto(ctx, photo, target.width, target.height);
  drawDiplomaText(ctx, student, target.width, target.height);
  return target;
}
