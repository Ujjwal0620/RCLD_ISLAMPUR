export function buildCfkStudentIcardMarkup({
  student = {},
  courseText = "CODING FOR KIDS",
  activeSemester = "5",
  addrMain = "",
  addressLines = [],
  idPrefix = "",
  idNumber = "",
  issueDate = "",
  photoImg = "",
  logoUrl = "",
  esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
  toTitleCase = (s) =>
    String(s ?? "").replace(
      /\w\S*/g,
      (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    ),
  icon,
  scribble = (color = "#0B1136") => `
    <svg viewBox="0 0 90 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12,24 C18,8 28,6 30,22 C31,27 20,25 18,17 C16,10 29,8 37,19 C41,25 46,13 50,15 C54,17 53,24 58,22 C63,20 67,14 72,18 C75,21 79,22 83,19"
            fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22,28 L44,6" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `,
  AEC_LINE_1 = "AEC: CYBER WORLD, DESHBANDHU PARA, ISLAMPUR",
  CONTACT_EMAIL = "islampur.cyberworld@gmail.com",
  CONTACT_PHONE = "9851775891",
}) {
  const semNumber = String(activeSemester).replace(/[^0-9]/g, "") || "1";

  const rawName = String(student.applicantName || "").trim().toUpperCase();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const firstName = esc(nameParts.slice(0, -1).join(" ") || nameParts[0] || "");
  const lastName = esc(nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");

  const courseLabel = esc(
    String(
      student.courseName || student.course?.name || courseText || "CODING FOR KIDS"
    ).toUpperCase()
  );

  const fatherName = esc(
    toTitleCase(
      student.fatherOrHusbandName ||
        student.fatherName ||
        student.guardianName ||
        student.father_name ||
        ""
    )
  );

  const lines = (
    Array.isArray(addressLines) && addressLines.length ? addressLines : [addrMain]
  )
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  const addrHtml = lines.length
    ? lines.map((line) => esc(toTitleCase(line))).join("<br>")
    : "—";

  return `
    <style>
      @page { size: 5.5cm 8.5cm; margin: 0; }
      .id-card, .id-card * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .id-card {
        position: relative;
        width: 5.5cm;
        height: 8.5cm;
        background: #FFFFFF;
        overflow: hidden;
        font-family: Arial, Helvetica, sans-serif;
        color: #3B4248;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .id-card .bg-vectors {
        position: absolute; inset: 0; width: 5.5cm; height: 8.5cm;
        z-index: 1; pointer-events: none;
      }
      .id-card .header {
        position: absolute; top: 2.5mm; left: 0; width: 100%;
        text-align: center; z-index: 3; color: #FFFFFF;
      }
      .id-card .brand-row {
        display: flex; align-items: center; justify-content: center;
        gap: 1.5mm; line-height: 1;
      }
      .id-card .brand-logo {
        width: 5.6mm; height: 5.6mm; object-fit: contain;
        border-radius: 0.6mm; background: #FFFFFF; padding: 0.2mm;
      }
      .id-card .brand-title {
        font-size: 16pt; font-weight: 900; letter-spacing: 0.6mm;
        color: #FFFFFF; line-height: 1;
      }
      .id-card .sub-1 { margin-top: 0.7mm; font-size: 5.8pt; font-weight: 700; letter-spacing: 0.08mm; }
      .id-card .sub-2 { margin-top: 0.3mm; font-size: 4.8pt; font-weight: 400; }
      .id-card .sub-3 { margin-top: 0.3mm; font-size: 5.8pt; font-weight: 700; }
      .id-card .photo-wrap {
        position: absolute; top: 16.5mm; left: 14.75mm;
        width: 25.5mm; height: 25.5mm; border-radius: 50%;
        overflow: hidden; z-index: 4; background: #F2E2CE;
      }
      .id-card .photo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .id-card .student-name {
        position: absolute; top: 43.4mm; left: 2mm; right: 2mm;
        text-align: center; font-size: 10.2pt; font-weight: 800;
        letter-spacing: 0.12mm; line-height: 1.1; z-index: 3; white-space: nowrap;
      }
      .id-card .student-name .fname { color: #4A525A; }
      .id-card .student-name .lname { color: #9B1B81; }
      .id-card .course-title {
        position: absolute; top: 47.8mm; left: 2mm; right: 2mm;
        text-align: center; font-size: 6.8pt; font-weight: 800;
        color: #4A525A; letter-spacing: 0.15mm; z-index: 3;
      }
      .id-card .details-grid {
        position: absolute; top: 52mm; left: 9.5mm; right: 2mm;
        z-index: 3; display: flex; flex-direction: column; gap: 0.55mm;
      }
      .id-card .detail-row { display: flex; align-items: baseline; font-size: 6pt; line-height: 1.22; }
      .id-card .detail-label {
        width: 16.5mm; flex-shrink: 0; text-align: right;
        padding-right: 1.3mm; font-weight: 800; color: #9B1B81;
      }
      .id-card .detail-val { flex: 1; font-weight: 700; color: #3B4248; word-break: break-word; }
      .id-card .id-highlight { font-size: 7.4pt; font-weight: 800; color: #3B4248; }
      .id-card .sem-badge-text {
        position: absolute; top: 64.2mm; left: 0; width: 9.2mm;
        text-align: center; color: #FFFFFF; z-index: 4; line-height: 1;
      }
      .id-card .sem-label { font-size: 6.2pt; font-weight: 800; letter-spacing: 0.15mm; }
      .id-card .sem-num {
        margin-top: 0.6mm; font-family: Georgia, "Times New Roman", serif;
        font-size: 13pt; font-weight: 700;
      }
      .id-card .sig-block {
        position: absolute; top: 67.8mm; right: 3.8mm;
        text-align: center; z-index: 4;
      }
      .id-card .sig-block svg { width: 11mm; height: 3.8mm; display: block; margin: 0 auto; }
      .id-card .sig-text {
        margin-top: 0.2mm; font-family: Georgia, "Times New Roman", serif;
        font-style: italic; font-size: 5pt; color: #3B4248;
      }
      .id-card .contact-block {
        position: absolute; top: 74.2mm; left: 1.5mm; right: 1.5mm;
        text-align: center; z-index: 4; line-height: 1.2;
      }
      .id-card .aec-line { font-size: 5.7pt; font-weight: 800; color: #3B4248; letter-spacing: 0.05mm; }
      .id-card .contact-row {
        margin-top: 0.2mm; display: flex; align-items: center;
        justify-content: center; gap: 1mm; font-size: 5.7pt;
        font-weight: 700; color: #3B4248;
      }
      .id-card .icon-red { color: #D32F2F; font-size: 6.2pt; line-height: 1; }
      .id-card .footer-title {
        position: absolute; bottom: 0.8mm; left: 0; width: 100%;
        text-align: center; font-size: 8.8pt; font-weight: 800;
        letter-spacing: 0.25mm; color: #FFFFFF; z-index: 4; line-height: 1;
      }
    </style>

    <div class="id-card">
      <svg class="bg-vectors" viewBox="0 0 55 85" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="0,0 55,0 55,5.1 27.5,21.0 0,5.1" fill="#4A525A"/>
        <polygon points="0,5.1 27.5,21.0 55,5.1 55,20.5 27.5,36.4 0,20.5" fill="#9B1B81"/>
        <polygon points="0,20.5 27.5,36.4 55,20.5 55,22.2 27.5,38.1 0,22.2" fill="#FFFFFF"/>
        <polygon points="0,22.2 27.5,38.1 55,22.2 55,23.6 27.5,39.5 0,23.6" fill="#9B1B81"/>
        <path d="M 0,63.4 C 6.5,62.0 10.8,63.6 10.6,67.0 C 10.4,70.3 5.8,73.3 0,74.1 Z" fill="#4A525A"/>
        <path d="M 0,62.8 C 6.2,61.4 10.3,63.0 10.1,66.3 C 9.9,69.6 5.3,72.6 0,73.4 Z" fill="#9B1B81"/>
        <polygon points="0,76.8 6.2,80.4 48.8,80.4 55,76.8 55,80.0 46.5,85.0 8.5,85.0 0,80.0" fill="#9B1B81"/>
        <polygon points="0,80.0 8.5,85.0 5.8,85.0 0,81.5" fill="#FFFFFF"/>
        <polygon points="55,80.0 55,81.5 49.2,85.0 46.5,85.0" fill="#FFFFFF"/>
        <polygon points="0,81.5 5.8,85.0 3.5,85.0 0,82.9" fill="#9B1B81"/>
        <polygon points="55,81.5 55,82.9 51.5,85.0 49.2,85.0" fill="#9B1B81"/>
      </svg>

      <div class="header">
        <div class="brand-row">
          <img src="${logoUrl}" class="brand-logo" alt="Logo"/>
          <span class="brand-title">RCLD</span>
        </div>
        <div class="sub-1">Rashtriya Computer Literacy Drive</div>
        <div class="sub-2">A mission encouraged by</div>
        <div class="sub-3">Govt. of India</div>
      </div>

      <div class="photo-wrap">${photoImg}</div>
      <div class="student-name">
        <span class="fname">${firstName}</span> <span class="lname">${lastName}</span>
      </div>
      <div class="course-title">${courseLabel}</div>

      <div class="details-grid">
        <div class="detail-row"><div class="detail-label">ID No :</div><div class="detail-val">${idPrefix}${idNumber ? `<span class="id-highlight">${idNumber}</span>` : ""}</div></div>
        <div class="detail-row"><div class="detail-label">Date of Admn. :</div><div class="detail-val">${issueDate}</div></div>
        <div class="detail-row"><div class="detail-label">Father's Name :</div><div class="detail-val">${fatherName || "—"}</div></div>
        <div class="detail-row"><div class="detail-label">Address :</div><div class="detail-val">${addrHtml}</div></div>
      </div>

      <div class="sem-badge-text">
        <div class="sem-label">SEM</div><div class="sem-num">${semNumber}</div>
      </div>
      <div class="sig-block">
        ${scribble ? scribble("#0B1136") : ""}
        <div class="sig-text">Issuing Authority</div>
      </div>
      <div class="contact-block">
        <div class="aec-line">${esc(AEC_LINE_1)}</div>
        <div class="contact-row">
          <span class="icon-red">&#9993;</span><span>${esc(CONTACT_EMAIL)}</span>
          <span class="icon-red">&#9742;</span><span>${esc(CONTACT_PHONE)}</span>
        </div>
      </div>
      <div class="footer-title">STUDENT ID CARD</div>
    </div>
  `;
}
