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
  "ID Card Sem-1.jpg": { lastNameColor: "#E61E8C", labelColor: "#E61E8C", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card Sem-2.jpg": { lastNameColor: "#009846", labelColor: "#009846", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card Sem-3.jpg": { lastNameColor: "#0095DA", labelColor: "#0095DA", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card Sem-4.jpg": { lastNameColor: "#F37021", labelColor: "#F37021", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card Sem-5.jpg": { lastNameColor: "#9C2B86", labelColor: "#9C2B86", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card Sem-6.jpg": { lastNameColor: "#E53935", labelColor: "#E53935", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card School Course.jpg": { lastNameColor: "#E31E24", labelColor: "#E31E24", maskMode: "white", coordinates: CIRCULAR_COORDINATES },
  "ID Card Robotics 1st year.jpg": { lastNameColor: "#D99B00", labelColor: "#D99B00", maskMode: "sample-strip", coordinates: CIRCULAR_COORDINATES },
  "ID Card Robotics 2nd year.jpg": { lastNameColor: "#0077B6", labelColor: "#0077B6", maskMode: "sample-strip", coordinates: CIRCULAR_COORDINATES },
  "ID Card Robotics 3rd year.jpg": { lastNameColor: "#4E8B22", labelColor: "#4E8B22", maskMode: "sample-strip", coordinates: CIRCULAR_COORDINATES },
  "ID Card Diploma.jpg": { lastNameColor: "#2E3192", labelColor: "#2E3192", maskMode: "none" },
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
  const firstColor = diploma ? "#1E242B" : "#374151";
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
  const config = TEMPLATE_CONFIG[templateName] || { lastNameColor: "#3E454C", labelColor: "#3E454C", maskMode: "white", coordinates: CIRCULAR_COORDINATES };
  const fullName = firstValue(student.applicantName, student.fullName, student.name, "STUDENT");
  const nameMarkup = splitNameMarkup(fullName, config.lastNameColor, diploma);
  const rawRegistrationCode = String(firstValue(
    student.stCode, student.activeEnrollment?.stCode, student.regnNo, student.registrationNumber, student.registrationNo, student.registrationId,
    student.regNo, student.icardNumber, student.iCardNumber, student.idCardNumber, student.cardNumber,
    student.enrollmentNo, student.admissionNo, student.formNo, "—"
  )).trim();
  const formRegistrationCode = String(firstValue(
    student.formNo, student.formNumber, student.registrationNumber, student.registrationNo,
    student.registrationId, student.regNo, student.regnNo, "—"
  )).trim();
  const icardNumber = /^RCLD\/ISL-001\//i.test(rawRegistrationCode)
    ? rawRegistrationCode
    : "RCLD/ISL-001/" + rawRegistrationCode;
  const fatherName = titleCase(firstValue(student.fatherOrHusbandName, student.fatherName, student.fatherNameAsPerRecords, student.guardianName, "—"));
  const addressMarkup = getAddressMarkup(student);
  const admission = getAdmissionDate(student) || "—";
  const photo = photoUrl
    ? '<img class="student-photo" crossorigin="anonymous" src="' + escapeHtml(photoUrl) + '" alt="Student photograph">'
    : '<div class="student-photo photo-empty" aria-label="Student photograph unavailable"></div>';

  const circularRows = [
    ["ID No :", idNumberMarkup(icardNumber), "id"],
    ["Date of Admn. :", escapeHtml(admission), "admission"],
    ["Father's Name :", escapeHtml(fatherName), "father"],
    ["Address :", addressMarkup, "address"],
  ].map(([label, value, key]) =>
    '<div class="template-row template-row-' + key + '">' +
      '<div class="template-label">' + label + '</div>' +
      '<div class="template-value">' + value + '</div>' +
    '</div>'
  ).join("");
  const overlays = diploma
    ? '<div class="overlay diploma-registration">' + escapeHtml(formRegistrationCode) + '</div>' +
      '<div class="overlay diploma-session">' + escapeHtml(session) + '</div>' +
      '<div class="overlay diploma-id">' + idNumberMarkup(icardNumber) + '</div>' +
      '<div class="overlay diploma-name">' + nameMarkup + '</div>' +
      '<div class="overlay diploma-father">' + escapeHtml(fatherName) + '</div>' +
      '<div class="overlay diploma-address">' + addressMarkup + '</div>' +
      '<div class="overlay diploma-course">' + escapeHtml(courseName || student.courseName || student.courseCode || "") + '</div>' +
      '<div class="overlay diploma-admission">' + escapeHtml(admission) + '</div>'
    : '<div class="overlay circular-name">' + nameMarkup + '</div>' +
      '<div class="template-label-mask" aria-hidden="true"></div>' +
      '<div class="template-fields">' + circularRows + '</div>';

  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>RCLD I-Card - ' + escapeHtml(fullName) + '</title><style>' +
    '@page{size:54mm 85.6mm;margin:0}' +
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
    'html,body{margin:0;padding:0;background:#fff;font-family:Arial,"Helvetica Neue","Liberation Sans",sans-serif}' +
    'body{width:100%;min-height:100vh;display:flex;justify-content:center;align-items:flex-start}' +
    '.card{position:relative;width:min(100vw,640px);aspect-ratio:640/1016;overflow:hidden;container-type:inline-size;background:#fff;isolation:isolate;color:#3E454C}' +
    '.template-background{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:0}' +
    '.student-photo{position:absolute;z-index:2;top:var(--photo-top,20.3%);left:var(--photo-left,50%);transform:translateX(-50%);width:var(--photo-width,38.6%);aspect-ratio:1/1;height:auto;border-radius:50%;object-fit:cover;object-position:center;display:block}' +
    '.circular-name{top:var(--name-top,48.8%);left:var(--name-left,3%);width:var(--name-width,94%);text-align:center;font-weight:800;font-size:clamp(20px,6.3cqw,80px);text-transform:uppercase;letter-spacing:.3px;line-height:1.05;white-space:nowrap}' +
    '.photo-empty{background:transparent}' +
    '.overlay{position:absolute;z-index:2;font-family:Arial,"Helvetica Neue","Liberation Sans",sans-serif;color:#3E454C;overflow:hidden}' +
    '.template-background-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block}' +
    '.template-label-mask{position:absolute;z-index:1;top:var(--mask-top,59.7%);left:var(--mask-left,2.5%);width:var(--mask-width,42.5%);height:var(--mask-height,15.4%);pointer-events:none}' +
    '.template-fields{position:absolute;z-index:3;top:0;left:0;width:100%;height:100%;font-family:Arial,"Helvetica Neue","Liberation Sans",sans-serif;color:#222}' +
    '.template-row{position:absolute;left:0;width:100%;font-size:clamp(15px,3.6cqw,48px);line-height:1.12;font-weight:400}' +
    '.template-label{position:absolute;top:0;left:var(--label-left,3.2%);width:var(--label-width,42.3%);text-align:right;white-space:nowrap;color:var(--template-label-color);font-weight:400}' +
    '.template-value{position:absolute;top:0;left:var(--value-left,46.8%);width:var(--value-width,48.5%);text-align:left;min-width:0;overflow:hidden;color:#222;font-weight:400;white-space:nowrap}' +
    '.template-row-id{top:var(--row-id-top,61.2%)}.template-row-admission{top:var(--row-admission-top,66.9%)}.template-row-father{top:var(--row-father-top,69.7%)}.template-row-address{top:var(--row-address-top,72.5%);align-items:start}' +
    '.template-row-id .id-number-prefix{font-size:3.6cqw;font-weight:400;color:#222;white-space:nowrap}' +
    '.template-row-id .id-number-code{font-size:3.6cqw;font-weight:700;color:#222;white-space:nowrap}' +
    '.template-row-address .template-value{white-space:normal;line-height:var(--address-line-height,1.26);word-break:normal;overflow-wrap:anywhere;font-size:clamp(13px,3.05cqw,40px);max-height:3.78em;overflow:hidden}' +
    '.address-line{display:block;min-height:0;font-weight:400}' +
    '.diploma .student-photo{top:34.2%;left:32.1%;transform:none;width:35.8%;height:25%;aspect-ratio:auto;border-radius:10px;object-fit:cover}' +
    '.diploma .overlay:not(.diploma-name){font-family:Arial,"Helvetica Neue","Liberation Sans",sans-serif;font-size:clamp(10px,2.25cqw,30px);line-height:1.1;color:#1E242B;font-weight:400;transform:none;transform-origin:left top}' +
    '.diploma-registration{top:2.7%;left:4%;width:36%;white-space:nowrap}' +
    '.diploma-session{top:2.7%;left:76%;width:21%;white-space:nowrap}' +
    '.diploma-id{top:12.8%;left:73%;width:25%;white-space:nowrap}' +
    '.diploma-id .id-number-prefix{font-weight:400}.diploma-id .id-number-code{font-weight:700}' +
    '.diploma-name{top:62.4%;left:19%;width:78%;font-size:clamp(12px,2.8cqw,38px);font-weight:400;text-transform:uppercase;letter-spacing:.1px;line-height:1.05;white-space:nowrap;color:#1E242B}' +
    '.diploma-father{top:66.1%;left:31%;width:66%;font-weight:400}' +
    '.diploma-address{top:73.6%;left:20.5%;width:76%;line-height:1.1;font-weight:400;white-space:normal;overflow-wrap:anywhere;font-size:clamp(10px,2.25cqw,30px)}.diploma-address .address-line{display:block}' +
    '.diploma-course{top:85.2%;left:19%;width:78%;font-weight:400}' +
    '.diploma-admission{top:90.3%;left:29.5%;width:68%;font-weight:400}' +
    '@media screen{body{padding:24px 0;background:#e9edf3}.card{box-shadow:0 2px 14px #0002}}' +
    '@media print{html,body{width:54mm!important;height:85.6mm!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}body{display:block!important}.card{width:640px!important;height:1016px!important;aspect-ratio:auto!important;max-width:none!important;margin:0!important;box-shadow:none!important;container-type:inline-size;transform:scale(.3185)!important;transform-origin:top left!important}}' +
    '</style></head><body><main class="card ' + (diploma ? "diploma" : "circular" + (/robotics/i.test(templateName) ? " robotics" : "")) + '">' +
    '<canvas class="template-background-canvas" aria-hidden="true"></canvas>' +
    '<img class="template-background-source" src="/assets/icardtemplates/' + encodeURIComponent(templateName) + '" alt="" crossorigin="anonymous" style="display:none">' +
    photo + overlays + '</main><script>' +
    'window.__prepareRcldTemplate=async function(){const card=document.querySelector(".card");const source=document.querySelector(".template-background-source");if(source.decode)await source.decode();else if(!source.complete)await new Promise((r,j)=>{source.onload=r;source.onerror=j});if(!source.naturalWidth)throw new Error("Template image could not be loaded.");const canvas=document.querySelector(".template-background-canvas");const ctx=canvas.getContext("2d",{willReadFrequently:true});canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;ctx.drawImage(source,0,0);' +
    (diploma ? '' : 'const coords=' + JSON.stringify(config.coordinates) + ';const mode=' + JSON.stringify(config.maskMode) + ';const x=Math.round(canvas.width*coords.labelMask.left/100),y=Math.round(canvas.height*coords.labelMask.top/100),w=Math.round(canvas.width*coords.labelMask.width/100),h=Math.round(canvas.height*coords.labelMask.height/100);if(mode==="white"){ctx.fillStyle="#FFFFFF";ctx.fillRect(x,y,w,h)}else{const strip=ctx.getImageData(Math.min(x+w,canvas.width-1),y,1,h);const pixels=strip.data;for(let row=0;row<h;row++){ctx.fillStyle="rgba("+pixels[row*4]+","+pixels[row*4+1]+","+pixels[row*4+2]+","+pixels[row*4+3]/255+")";ctx.fillRect(x,y+row,w,1)}}') +
    'source.remove();};const card=document.querySelector(".card");card.style.setProperty("--template-label-color",' + JSON.stringify(config.labelColor || "#2E3192") + ');' +
    (!diploma ? 'const c=' + JSON.stringify(config.coordinates) + ';card.style.setProperty("--photo-top",c.photo.top+"%");card.style.setProperty("--photo-left",c.photo.left+"%");card.style.setProperty("--photo-width",c.photo.width+"%");card.style.setProperty("--name-top",c.name.top+"%");card.style.setProperty("--name-left",c.name.left+"%");card.style.setProperty("--name-width",c.name.width+"%");card.style.setProperty("--mask-top",c.labelMask.top+"%");card.style.setProperty("--mask-left",c.labelMask.left+"%");card.style.setProperty("--mask-width",c.labelMask.width+"%");card.style.setProperty("--mask-height",c.labelMask.height+"%");card.style.setProperty("--label-left",c.labels.left+"%");card.style.setProperty("--label-width",c.labels.width+"%");card.style.setProperty("--value-left",c.values.left+"%");card.style.setProperty("--value-width",c.values.width+"%");card.style.setProperty("--address-line-height",c.addressLineHeight);card.style.setProperty("--row-id-top",c.rows.id+"%");card.style.setProperty("--row-admission-top",c.rows.admission+"%");card.style.setProperty("--row-father-top",c.rows.father+"%");card.style.setProperty("--row-address-top",c.rows.address+"%");' : '') +
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
    win.document.write(html.replace("</body>", '<script>window.addEventListener("load",async()=>{try{await window.__prepareRcldTemplate();const imgs=[...document.images];await Promise.all(imgs.map(async img=>{if(img.decode)await img.decode();else if(!img.complete||!img.naturalWidth)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});}));setTimeout(()=>window.print(),150);}catch(error){console.error(error);alert("Unable to prepare this ID card template.");}});</script></body>'));
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
    await frame.contentWindow.__prepareRcldTemplate();
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
