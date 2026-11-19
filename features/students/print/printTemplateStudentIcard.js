

const escapeHtml = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim());

function getAdmissionSession(student) {
  const source = student.admissionDate || student.dateOfAdmission || student.admissionOn || student.createdAt;
  const date = source ? new Date(source) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `${year}-${year + 1}`;
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

function buildMarkup({ student, templateName, photoUrl, courseName, session, logoUrl }) {
  const diploma = /diploma/i.test(templateName);
  const robotics = /robotics/i.test(templateName);
  const school = /school course/i.test(templateName);
  const semester = templateName.match(/Sem-(\d+)/i)?.[1] || "";
  const name = escapeHtml(String(student.applicantName || "STUDENT").toUpperCase());
  const icardNumber = escapeHtml(firstValue(student.icardNumber, student.iCardNumber, student.cardNumber, student.studentId, student.enrollmentNo, student.admissionNo));
  const registrationNumber = escapeHtml(firstValue(student.registrationNumber, student.registrationNo, student.regNo, student.regnNo, student.formNo));
  const father = escapeHtml(firstValue(student.fatherOrHusbandName, student.fatherName, student.fatherNameAsPerRecords, student.guardianName));
  const mobile = escapeHtml(firstValue(student.mobileNumber, student.mobile, student.phone));
  const address = escapeHtml(firstValue(student.presentAddress, student.address, student.completeAddress, student.permanentAddress));
  const admissionSource = firstValue(student.admissionDate, student.dateOfAdmission, student.admissionOn);
  const admissionDate = admissionSource ? new Date(admissionSource) : null;
  const admission = escapeHtml(admissionDate && !Number.isNaN(admissionDate.getTime()) ? admissionDate.toLocaleDateString("en-GB") : "—");
  const course = escapeHtml(courseName || student.courseName || student.courseCode || "—");
  const sessionText = escapeHtml(session);
  const safePhoto = photoUrl ? escapeHtml(photoUrl) : "";
  const photo = safePhoto
    ? `<img class="student-photo" src="${safePhoto}" alt="Student photo">`
    : '<div class="student-photo photo-empty">PHOTO</div>';
  const centerImage = diploma
    ? `<img class="center-image" src="${safePhoto || escapeHtml(logoUrl)}" alt="Student / institute image">`
    : "";
  const fieldRows = diploma
    ? [["I-CARD NO.", icardNumber], ["REGISTRATION NO.", registrationNumber], ["DATE OF ADMISSION", admission], ["FATHER'S NAME", father], ["ADDRESS", address]]
    : [["I-CARD NO.", icardNumber], ["REGISTRATION NO.", registrationNumber], ["DATE OF ADMISSION", admission], ["FATHER'S NAME", father], ["ADDRESS", address]];
  const fields = fieldRows.map(([label, value]) => `<div class="field"><b>${label}</b><span>${value}</span></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>RCLD I-Card - ${name}</title>
<style>
@page{size:55mm 88mm;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
html,body{margin:0;padding:0;width:55mm;height:88mm;background:#fff}
.card{position:relative;width:55mm;height:88mm;overflow:hidden;background:#fff url("/assets/icardtemplates/${encodeURIComponent(templateName)}") center/100% 100% no-repeat;color:#182238}
.student-photo{position:absolute;left:36%;top:17%;width:28%;height:auto;aspect-ratio:1/1;display:block;border-radius:50%;object-fit:cover;object-position:center;overflow:hidden;clip-path:circle(50% at 50% 50%);z-index:2;border:0}
.photo-empty{display:flex;align-items:center;justify-content:center;background:#f0f2f5;color:#777;font:700 2.2mm Arial,sans-serif}
.student-name{position:absolute;left:5%;right:5%;top:40%;height:6%;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-transform:uppercase;font:700 3.2mm "Times New Roman",serif;color:#101827;z-index:3}
.fields{position:absolute;left:8%;right:6%;top:49%;height:38%;display:flex;flex-direction:column;justify-content:flex-start;gap:1.15mm;z-index:3;font:2.05mm/1.15 "Arial Narrow","Liberation Sans Narrow",Arial,sans-serif;color:#172033}
.field{display:grid;grid-template-columns:38% 62%;align-items:start;min-height:4mm;gap:1mm}
.field b{font-weight:700;white-space:normal}.field span{font-weight:500;overflow-wrap:anywhere}
.session{position:absolute;left:31%;right:31%;top:7%;height:6%;display:flex;align-items:center;justify-content:center;text-align:center;font:700 3mm "Arial Narrow",Arial,sans-serif;color:#172033;z-index:4}
.center-image{position:absolute;left:34%;top:20%;width:32%;height:25%;object-fit:contain;z-index:2}
.diploma .student-photo{display:none}.diploma .student-name{top:47%}.diploma .fields{top:54%;height:31%}
.school .student-photo,.robotics .student-photo{top:16%;width:28%;height:auto;aspect-ratio:1/1;left:36%}
.school .student-name,.robotics .student-name{top:38%}
@media screen{body{display:flex;align-items:flex-start;justify-content:center;background:#e9edf3;padding:8mm 0}.card{box-shadow:0 2px 12px #0003}}
@media print{html,body{width:55mm!important;height:88mm!important;overflow:hidden!important}.card{box-shadow:none!important}}
</style></head><body><main class="card ${diploma?"diploma":robotics?"robotics":school?"school":""}">
${diploma ? centerImage : photo}
<div class="session">${diploma ? sessionText : ""}</div>
<div class="student-name">${name}</div>

<div class="fields">${fields}</div>
</main></body></html>`;
}

export async function printTemplateStudentIcard({ student, templateName, outputMode = "print", setMessage }) {
  if (typeof templateName !== "string" || templateName !== templateName.split(/[\\/]/).pop() || !/\.(jpe?g|png)$/i.test(templateName)) {
    setMessage?.("Please select a valid I-card template.");
    return;
  }
  const session = getAdmissionSession(student);
  const html = buildMarkup({
    student,
    templateName,
    photoUrl: getStudentPhoto(student),
    courseName: student.courseName || student.course?.name || student.courseCode || "",
    session,
    logoUrl: "/assets/logo.png",
  });

  if (outputMode !== "jpg") {
    const win = window.open("", "_blank");
    if (!win) {
      setMessage?.("Please allow pop-ups to print the I-card.");
      return;
    }
    win.document.open();
    win.document.write(html.replace("</body>", '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script></body>'));
    win.document.close();
    return;
  }

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:55mm;height:88mm;border:0";
  document.body.appendChild(frame);
  try {
    await new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = reject;
      frame.srcdoc = html;
    });
    const doc = frame.contentDocument;
    if (!doc) throw new Error("Unable to prepare the selected template.");
    await Promise.all([...doc.images].map((img) => img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
    const { toJpeg } = await import("html-to-image");
    const card = doc.querySelector(".card");
    const dataUrl = await toJpeg(card, { quality: 1, pixelRatio: 4, backgroundColor: "#fff", cacheBust: true });
    const link = document.createElement("a");
    const base = String(student.applicantName || "Student").trim().replace(/[^a-z0-9]+/gi, "-");
    link.href = dataUrl;
    link.download = `RCLD-I-Card-${base}-${templateName.replace(/[^a-z0-9]+/gi,"-")}.jpg`;
    link.click();
    setMessage?.("Student I-card JPG downloaded successfully.");
  } catch (error) {
    console.error("I-card export failed", error);
    setMessage?.(error.message || "Unable to download the I-card.");
  } finally {
    frame.remove();
  }
}

