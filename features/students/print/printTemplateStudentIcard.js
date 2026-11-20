const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim());

const CIRCULAR_COORDINATES = {
  photo: { top: 20.3, left: 50, width: 38.6 },
  name: { top: 48.8, left: 3, width: 94 },
  labelMask: { top: 59.7, left: 2.5, width: 42.5, height: 15.4 },
  labels: { left: 3.2, right: 45.5, width: 42.3 },
  values: { left: 46.8, width: 48.5 },
  rows: { id: 61.2, admission: 64.6, father: 67.8, address: 71.0 },
  addressLineHeight: 1.26,
};
const TEMPLATE_CONFIG = {
  "ID Card Sem-1.jpg": { lastNameColor: "#E61E8C" },
  "ID Card Sem-2.jpg": { lastNameColor: "#009846" },
  "ID Card Sem-3.jpg": { lastNameColor: "#0095DA" },
  "ID Card Sem-4.jpg": { lastNameColor: "#F58220" },
  "ID Card Sem-5.jpg": { lastNameColor: "#9C2B86" },
  "ID Card Sem-6.jpg": { lastNameColor: "#E53935", labelColor: "#E53935", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card School Course.jpg": { lastNameColor: "#E31E24" },
  "ID Card Robotics 1st year.jpg": { lastNameColor: "#D99B00" },
  "ID Card Robotics 2nd year.jpg": { lastNameColor: "#0077B6" },
  "ID Card Robotics 3rd year.jpg": { lastNameColor: "#4E8B22" },
  "ID Card Diploma.jpg": { lastNameColor: "#2E3192" },
};

function getAdmissionDate(student) {
  const source = firstValue(student.admissionDate, student.dateOfAdmission, student.admissionOn);
  if (!source) return "";
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "";
  return [String(date.getDate()).padStart(2, "0"), String(date.getMonth() + 1).padStart(2, "0"), date.getFullYear()].join("-");
}

function getAdmissionSession(student) {
  const source = firstValue(student.admissionDate, student.dateOfAdmission, student.admissionOn, student.createdAt);
  const date = source ? new Date(source) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return year + "-" + (year + 1);
}

function getStudentPhoto(student) {
  return firstValue(
    student.photoUrl,
    typeof student.photo === "string" ? student.photo : student.photo?.url || student.photo?.secure_url,
    typeof student.studentPhoto === "string" ? student.studentPhoto : student.studentPhoto?.url || student.studentPhoto?.secure_url,
    student.profilePhoto,
    student.imageUrl,
    "",
  );
}

function splitNameMarkup(value, lastNameColor, diploma) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const last = parts.length > 1 ? parts.pop() : "";
  const firstColor = diploma ? "#1E242B" : "#3E454C";
  const leading = parts.map((part) => '<span style="color:' + firstColor + '">' + escapeHtml(part) + "</span>").join(" ");
  if (!last) return '<span style="color:' + firstColor + '">' + escapeHtml(parts[0]) + "</span>";
  return leading + ' <span style="color:' + (diploma ? "#2E3192" : lastNameColor) + '">' + escapeHtml(last) + "</span>";
}

function idNumberMarkup(value) {
  const normalized = String(value || "—");
  const prefix = "RCLD/ISL-001/";
  const suffix = normalized.toUpperCase().startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized;
  return '<span class="id-number-prefix">' + prefix + '</span><strong class="id-number-code">' + escapeHtml(suffix) + "</strong>";
}

function titleCase(value) {
  return String(value || "").toLocaleLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());
}

function getAddressMarkup(student) {
  const addressSource = firstValue(student.presentAddress, student.address, student.completeAddress, student.permanentAddress);
  const addressObject = addressSource && typeof addressSource === "object" ? addressSource : {};
  const values = { ward: [], po: [], ps: [], district: [] };
  const add = (key, value) => {
    const text = String(value ?? "").trim();
    if (text && !values[key].some((item) => item.toLowerCase() === text.toLowerCase())) values[key].push(text);
  };
  const pick = (...items) => firstValue(...items);

  add("ward", pick(addressObject.ward, addressObject.wardNo, addressObject.colony, addressObject.village, addressObject.vill,
    student.ward, student.wardNo, student.colony, student.village, student.vill));
  add("po", pick(addressObject.po, addressObject.postOffice, addressObject.post_office, student.po, student.postOffice, student.post_office));
  add("ps", pick(addressObject.ps, addressObject.policeStation, addressObject.police_station, student.ps, student.policeStation, student.police_station));
  add("district", pick(addressObject.district, student.district));

  if (typeof addressSource === "string") {
    const parts = addressSource.split(/[,\n]+/).map((part) => part.trim()).filter(Boolean);
    parts.forEach((part, index) => {
      const match = part.match(/^(ward(?:\s*no)?|colony|village|vill|po|post\s*office|ps|police\s*station|district)\s*[-:]\s*(.*)$/i);
      if (match) {
        const label = match[1].toLowerCase().replace(/\s+/g, "");
        const key = ["ward", "wardno", "colony", "village", "vill"].includes(label) ? "ward"
          : ["po", "postoffice"].includes(label) ? "po"
          : ["ps", "policestation"].includes(label) ? "ps" : "district";
        add(key, match[2]);
      } else if (!values.ward.length && index === 0) add("ward", part);
      else if (!values.po.length && index === 1) add("po", part);
      else if (parts.length >= 4 && !values.ps.length && index === 2) add("ps", part);
      else if (!values.district.length && index >= (parts.length >= 4 ? 3 : 2)) add("district", part);
    });
  }

  const lines = [
    values.ward.join(", "),
    [values.po.join(", "), values.ps.join(", ")].filter(Boolean).join(", "),
    values.district.join(", "),
  ].filter(Boolean);
  if (!lines.length && addressSource && typeof addressSource !== "object") lines.push(String(addressSource).trim());
  return lines.map((line) => '<div class="address-line">' + escapeHtml(line) + "</div>").join("");
}

function buildMarkup({ student, templateName, photoUrl, courseName, session }) {
  const diploma = templateName === "ID Card Diploma.jpg";
  const config = TEMPLATE_CONFIG[templateName] || { lastNameColor: "#3E454C" };
  const fullName = firstValue(student.applicantName, student.fullName, student.name, "STUDENT");
  const nameMarkup = splitNameMarkup(fullName, config.lastNameColor, diploma);
  const rawRegistrationCode = String(firstValue(
    student.stCode, student.activeEnrollment?.stCode, student.regnNo, student.registrationNumber, student.registrationNo, student.registrationId,
    student.regNo, student.icardNumber, student.iCardNumber, student.idCardNumber, student.cardNumber,
    student.enrollmentNo, student.admissionNo, student.formNo, "—"
  )).trim();
  const studentCode = String(firstValue(
    student.stCode, student.activeEnrollment?.stCode, student.studentCode,
    student.student_code, rawRegistrationCode
  )).trim();
  const idCode = studentCode.includes("/")
    ? studentCode.slice(studentCode.lastIndexOf("/") + 1)
    : studentCode;
  const idValueMarkup = '<span class="id-number-prefix">RCLD/ISL-001/</span><strong class="id-number-code">' + escapeHtml(idCode || "-") + '</strong>';
  const fatherName = titleCase(firstValue(student.fatherOrHusbandName, student.fatherName, student.fatherNameAsPerRecords, student.guardianName, "—"));
  const addressMarkup = getAddressMarkup(student) || '<div class="address-line">—</div>';
  const admission = getAdmissionDate(student) || "—";
  const photo = photoUrl
    ? '<img class="student-photo" crossorigin="anonymous" src="' + escapeHtml(photoUrl) + '" alt="Student photograph">'
    : '<div class="student-photo photo-empty" aria-label="Student photograph unavailable"></div>';
  const circularValues =
    '<div class="overlay circular-value circular-id">' + idValueMarkup + '</div>' +
    '<div class="overlay circular-value circular-admission">' + escapeHtml(admission) + '</div>' +
    '<div class="overlay circular-value circular-father">' + escapeHtml(fatherName) + '</div>' +
    '<div class="overlay circular-value circular-address">' + addressMarkup + '</div>';
  const circularLabelPatchTemplates = new Set([
    "ID Card Sem-1.jpg", "ID Card Sem-2.jpg", "ID Card Sem-3.jpg",
    "ID Card Sem-4.jpg", "ID Card Sem-5.jpg", "ID Card School Course.jpg",
    "ID Card Robotics 1st year.jpg", "ID Card Robotics 2nd year.jpg",
    "ID Card Robotics 3rd year.jpg",
  ]);
  const hasCircularLabelPatch = !diploma && circularLabelPatchTemplates.has(templateName);
  const usesSampledRoboticsPatch = hasCircularLabelPatch && templateName.startsWith("ID Card Robotics ");
  const circularLabelPatch = hasCircularLabelPatch
    ? '<div class="circular-label-patch' + (usesSampledRoboticsPatch ? ' robotics-label-patch' : '') + '"></div>' +
      '<div class="overlay circular-label circular-label-admission" style="color:' + config.lastNameColor + '">Date of Admn. :</div>' +
      '<div class="overlay circular-label circular-label-father" style="color:' + config.lastNameColor + '">Father\'s Name :</div>' +
      '<div class="overlay circular-label circular-label-address" style="color:' + config.lastNameColor + '">Address :</div>'
    : "";
  const diplomaValues = diploma
    ? '<div class="overlay diploma-session">' + escapeHtml(session || "—") + '</div>' +
      '<div class="overlay diploma-id">' + idValueMarkup + '</div>' +
      '<div class="overlay diploma-name">' + nameMarkup + '</div>' +
      '<div class="overlay diploma-father">' + escapeHtml(fatherName) + '</div>' +
      '<div class="overlay diploma-address">' + addressMarkup + '</div>' +
      '<div class="overlay diploma-course">' + escapeHtml(courseName || student.courseName || student.courseCode || "—") + '</div>' +
      '<div class="overlay diploma-admission">' + escapeHtml(admission) + '</div>'
    : '<div class="overlay circular-name">' + nameMarkup + '</div>' + circularValues;

  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>RCLD I-Card - ' + escapeHtml(fullName) + '</title><style>' +
    '@page{size:54mm 85.6mm;margin:0}' +
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
    'html,body{width:100%;height:100%;margin:0;padding:0;background:transparent;font-family:Arial,"Helvetica Neue","Liberation Sans",sans-serif}' +
    'body{display:flex;justify-content:center;align-items:flex-start}' +
    '.card{position:relative;width:100%;max-width:640px;aspect-ratio:640/1016;overflow:hidden;border:none;outline:none;padding:0;margin:0;background:transparent;container-type:inline-size;color:#3E454C}' +
    '.template-background{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;display:block;border:none;margin:0;padding:0;z-index:0}' +
    '.student-photo{position:absolute;z-index:2;top:19.3%;left:50%;transform:translateX(-50%);width:40.6%;aspect-ratio:1/1;height:auto;border-radius:50%;object-fit:cover;display:block}' +
    '.photo-empty{background:transparent}' +
    '.overlay{position:absolute;z-index:2;overflow:hidden;font-family:Arial,"Helvetica Neue","Liberation Sans",sans-serif}' +
    '.circular-name{top:48.6%;left:3%;width:94%;text-align:center;font-weight:800;font-size:clamp(20px,6cqw,76px);text-transform:uppercase;letter-spacing:.3px;line-height:1.05;white-space:nowrap}' +
    '.circular-value{left:46.8%;width:48.5%;text-align:left;font-family:"Roboto Condensed","Arial Narrow",Arial,sans-serif;font-weight:700;font-size:clamp(14px,3.35cqw,46px);color:#3E454C;transform:scaleY(1.10);transform-origin:left center;white-space:nowrap}' +
    '.circular-id{top:60.9%}.circular-id .id-number-prefix{font-size:3.35cqw;font-weight:700}.circular-id .id-number-code{font-size:3.95cqw;font-weight:800}.circular-admission{top:63.8%}.circular-father{top:66.6%}' +
    '.circular-address{top:69.4%;transform-origin:top left;line-height:1.28;word-break:break-word;white-space:normal;max-height:10.8%;overflow:hidden}' +
    '.circular-label-patch{position:absolute;z-index:3;top:63.3%;left:15%;width:30.5%;height:14.5%;background:#fff;pointer-events:none}' +
    '.circular-label-patch.robotics-label-patch{background:#fff}' +
    '.circular-label{z-index:4;left:15%;width:29.8%;text-align:right;font-family:"Roboto Condensed","Arial Narrow",Arial,sans-serif;font-weight:700;font-size:clamp(14px,3.35cqw,46px);transform:scaleY(1.10);transform-origin:right center;white-space:nowrap;overflow:visible}' +
    '.circular-label-admission{top:63.8%}.circular-label-father{top:66.6%}.circular-label-address{top:69.4%}' +
    '.circular-address .address-line{display:block;min-height:0}' +
    '.diploma .student-photo{top:34.2%;left:32.1%;transform:none;width:35.8%;height:25%;aspect-ratio:auto;border-radius:10px;object-fit:cover}' +
    '.diploma .overlay{font-family:Arial,"Helvetica Neue","Liberation Sans",sans-serif;font-size:clamp(13px,3.2cqw,44px);color:#1E242B;font-weight:700;line-height:1.1;transform:none;transform-origin:left top;white-space:nowrap}' +
    '.diploma-session{top:2.5%;left:87.5%;width:12%}' +
    '.diploma-id{top:13%;left:72%;width:26%}.diploma-id .id-number-prefix{font-size:2.7cqw;font-weight:700}.diploma-id .id-number-code{font-size:3.2cqw;font-weight:800}' +
    '.diploma-name{top:62.5%;left:16.5%;width:82%;font-size:clamp(15px,3.6cqw,48px)!important;font-weight:800!important;text-transform:uppercase;white-space:nowrap}' +
    '.diploma-father{top:66.2%;left:31%;width:68%}' +
    '.diploma-address{top:69.2%;left:20.5%;width:75%;line-height:1.28;white-space:normal;word-break:break-word;max-height:7.8%;overflow:hidden}' +
    '.diploma-address .address-line{display:block}' +
    '.diploma-course{top:77.6%;left:19%;width:78%}.diploma-admission{top:81.8%;left:29.5%;width:68%}' +
    '@media print{html,body{width:54mm!important;height:85.6mm!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important}body{display:block!important}.card{width:54mm!important;height:85.6mm!important;max-width:none!important;aspect-ratio:640/1016!important;margin:0!important;box-shadow:none!important}}' +
    '</style></head><body><main class="card ' + (diploma ? "diploma" : "circular") + '">' +
    '<img class="template-background" src="/assets/icardtemplates/' + encodeURIComponent(templateName) + '" alt="" crossorigin="anonymous">' +
    (hasCircularLabelPatch ? circularLabelPatch : "") +
    photo + diplomaValues + '</main>' +
    '<script>' +
    'const patch=document.querySelector(".robotics-label-patch");' +
    'window.__rcldPatchReady=patch?(async()=>{const image=document.querySelector(".template-background");try{if(image.decode)await image.decode();else if(!image.complete)await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext("2d",{willReadFrequently:true});context.drawImage(image,0,0);const pixel=context.getImageData(Math.round(image.naturalWidth*.2),Math.round(image.naturalHeight*.65),1,1).data;patch.style.backgroundColor="rgb("+pixel[0]+","+pixel[1]+","+pixel[2]+")";}catch(error){console.error("Unable to sample Robotics template patch color",error);}})():Promise.resolve();' +
    '</script></body></html>';
}

export async function printTemplateStudentIcard({ student, templateName, outputMode = "print", setMessage }) {
  if (typeof templateName !== "string" || templateName !== templateName.split(/[\\/]/).pop() || !/\.(jpe?g|png)$/i.test(templateName)) {
    setMessage?.("Please select a valid I-card template.");
    return;
  }

  const html = buildMarkup({
    student,
    templateName,
    photoUrl: getStudentPhoto(student),
    courseName: student.courseName || student.course?.name || student.courseCode || "",
    session: getAdmissionSession(student),
  });

  if (outputMode !== "jpg") {
    const win = window.open("", "_blank");
    if (!win) {
      setMessage?.("Please allow pop-ups to print the I-card.");
      return;
    }
    win.document.open();
    win.document.write(html.replace("</body>", '<script>window.addEventListener("load",async()=>{try{await window.__rcldPatchReady;const imgs=[...document.images];await Promise.all(imgs.map(async img=>{if(img.decode)await img.decode();else if(!img.complete||!img.naturalWidth)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});}));setTimeout(()=>window.print(),150);}catch(error){console.error(error);alert("Unable to prepare this ID card template.");}});</script></body>'));
    win.document.close();
    return;
  }

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:640px;height:1016px;border:0";
  document.body.appendChild(frame);
  try {
    await new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = reject;
      frame.srcdoc = html;
    });
    const doc = frame.contentDocument;
    if (!doc) throw new Error("Unable to prepare the selected template.");
    await doc.defaultView.__rcldPatchReady;
    
    await Promise.all([...doc.images].map(async img => {
      try {
        if (img.decode) await img.decode();
        else if (!img.complete || !img.naturalWidth) await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
        if (!img.naturalWidth) throw new Error("Image unavailable");
      } catch (error) {
        if (img.classList.contains("student-photo")) {
          const placeholder = doc.createElement("div");
          placeholder.className = "student-photo photo-empty";
          img.replaceWith(placeholder);
        } else {
          throw new Error("I-card template image could not be loaded.");
        }
      }
    }));
    const { toJpeg } = await import("html-to-image");
    const card = doc.querySelector(".card");
    const dataUrl = await toJpeg(card, { quality: 1, width: 640, height: 1016, canvasWidth: 640, canvasHeight: 1016, pixelRatio: 1, backgroundColor: "#fff", cacheBust: true });
    const link = document.createElement("a");
    const base = String(student.applicantName || student.fullName || "Student").trim().replace(/[^a-z0-9]+/gi, "-");
    link.href = dataUrl;
    link.download = "RCLD-I-Card-" + base + "-" + templateName.replace(/[^a-z0-9]+/gi, "-") + ".jpg";
    link.click();
    setMessage?.("Student I-card JPG downloaded successfully.");
  } catch (error) {
    console.error("I-card export failed", error);
    setMessage?.(error.message || "Unable to download the I-card.");
  } finally {
    frame.remove();
  }
}
