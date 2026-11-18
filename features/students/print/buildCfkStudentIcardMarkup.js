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
    String(s ?? "").replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
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

  const rawName = String(student.applicantName || "")
    .trim()
    .toUpperCase();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const firstName = esc(nameParts.slice(0, -1).join(" ") || nameParts[0] || "");
  const lastName = esc(nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");

  const courseLabel = esc(
    String(
      student.courseName || student.course?.name || courseText || "CODING FOR KIDS",
    ).toUpperCase(),
  );

  const fatherName = esc(
    toTitleCase(
      student.fatherOrHusbandName ||
        student.fatherName ||
        student.guardianName ||
        student.father_name ||
        "",
    ),
  );

  const lines = (Array.isArray(addressLines) && addressLines.length ? addressLines : [addrMain])
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  const addrHtml = lines.length
    ? lines
        .slice(0, 3)
        .map((line) => `<div>${esc(toTitleCase(line))}</div>`)
        .join("")
    : "<div>—</div>";

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
        font-family: "Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif;
        color: #3B4248;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .id-card .bg-vectors {
        position: absolute; inset: 0; width: 5.5cm; height: 8.5cm;
        z-index: 1; pointer-events: none;
      }
      .id-card .header {
        position: absolute; top: 1.8mm; left: 1mm; right: 1mm;
        width: auto; text-align: center; z-index: 3; color: #FFFFFF;
        display: flex; flex-direction: column; align-items: center;
        line-height: 1; overflow: hidden;
      }
      .id-card .brand-row {
        display: flex; align-items: center; justify-content: center;
        gap: 1.2mm; height: 5mm; line-height: 1; flex: 0 0 5mm;
      }
      .id-card .brand-logo {
        width: 4.6mm; height: 4.6mm; flex: 0 0 4.6mm; object-fit: contain;
        border-radius: 0; background: transparent; padding: 0;
      }
      .id-card .brand-title {
        font-size: 18pt; font-weight: 900; letter-spacing: 0.45mm;
        color: #FFFFFF; line-height: 1; white-space: nowrap;
      }
      .id-card .sub-1 {
        margin-top: 0.55mm; font-size: 5.1pt; font-weight: 700;
        letter-spacing: 0.04mm; line-height: 1.15; white-space: nowrap;
      }
      .id-card .sub-2 {
        margin-top: 0.35mm; font-size: 4.5pt; font-weight: 400; line-height: 1.1;
      }
      .id-card .sub-3 {
        margin-top: 0.3mm; font-size: 5.1pt; font-weight: 700; line-height: 1.1;
      }
      .id-card .photo-wrap {
        position: absolute; top: 13.5mm; left: 15.25mm;
        width: 24.5mm; height: 24.5mm; border-radius: 50%;
        overflow: hidden; z-index: 4; background: #F2E2CE;
      }
      .id-card .photo-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .id-card .student-name {
        position: absolute; top: 43.4mm; left: 1mm; right: 1mm;
        text-align: center; font-size: 10.2pt; font-weight: 800;
        letter-spacing: 0.08mm; line-height: 1.05; z-index: 3;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .id-card .student-name .fname { color: #4A525A; }
      .id-card .student-name .lname { color: #9B1B81; }
      .id-card .course-title {
        position: absolute; top: 48.7mm; left: 2mm; right: 2mm;
        text-align: center; font-size: 6.0pt; font-weight: 700;
        color: #66717A; letter-spacing: 0.12mm; line-height: 1.1;
        z-index: 3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
.id-card .details-grid {
    position: absolute;
    top: 52.7mm;
    left: 9.5mm;
    right: 2mm;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 0.55mm;
}

.id-card .detail-row {
    display: flex;
    align-items: baseline;
    font-size: 5.8pt;
    line-height: 1.18;
}

.id-card .detail-label {
    width: 16.5mm;
    flex-shrink: 0;
    text-align: right;
    padding-right: 1.3mm;
    font-weight: 800;
    color: #9B1B81;
}
      .id-card .detail-val {
        display: inline-block; flex: 1 1 0; min-width: 0;
        max-width: none; text-align: left; margin: 0; padding: 0;
        font-weight: 600; color: #3B4248; line-height: 1.02;
        overflow-wrap: anywhere; word-break: normal;
      }
      .id-card .detail-val.address-lines {
        max-height: 7.0mm; max-width: none; overflow: hidden;
        font-size: 5.5pt; line-height: 1.16; text-align: left;
      }
      .id-card .detail-val.address-lines div {
        max-width: 100%; text-align: left; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      .id-card .id-highlight { font-size: 5.1pt; font-weight: 800; color: #3B4248; }
      .id-card .sem-badge-text {
        position: absolute; top: 65.3mm; left: 0; right: auto; width: 9.2mm;
        text-align: center; color: #FFFFFF; z-index: 4; line-height: 1;
      }
      .id-card .sem-label { font-size: 5.6pt; font-weight: 800; letter-spacing: 0.1mm; }
      .id-card .sem-num {
        margin-top: 0.45mm; font-family: Georgia, "Times New Roman", serif;
        font-size: 11pt; font-weight: 700;
      }
      .id-card .sig-block {
        position: absolute; top: 68.1mm; right: 3.2mm;
        text-align: center; z-index: 4; width: 13mm;
      }
      .id-card .sig-block svg { width: 9mm; height: 3mm; display: block; margin: 0 auto; }
      .id-card .sig-text {
        margin-top: 0.1mm; font-family: Georgia, "Times New Roman", serif;
        font-style: italic; font-size: 4.6pt; color: #3B4248; white-space: nowrap;
      }
      .id-card .contact-block {
        position: absolute; top: 75.4mm; left: 1.5mm; right: 1.5mm;
        text-align: center; z-index: 4; line-height: 1.12;
      }
      .id-card .aec-line {
        font-size: 5pt; font-weight: 800; color: #3B4248;
        letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .id-card .contact-row {
        margin-top: 0.35mm; display: flex; flex-direction: row;
        align-items: center; justify-content: center; gap: 1.2mm;
        font-size: 4.35pt; font-weight: 700; color: #3B4248; line-height: 1.1;
      }
      .id-card .contact-item { display: inline-flex; align-items: center; gap: 0.6mm; }
      .id-card .icon-red { color: #D32F2F; font-size: 4.6pt; line-height: 1; }
      .id-card .footer-title {
        position: absolute; bottom: 0.8mm; left: 0; width: 100%;
        text-align: center; font-size: 9.3pt; font-weight: 800;
        letter-spacing: 0.25mm; color: #FFFFFF; z-index: 4; line-height: 1;
      }
    </style>

    <div class="id-card">
      <svg class="bg-vectors" viewBox="0 0 55 85" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0,0 H 55 V 4.0 C 46.5,10.0 37.0,15.8 27.5,18.0 C 18.0,15.8 8.5,10.0 0,4.0 Z" fill="#4A525A"/>
        <polygon points="0,4.0 27.5,17.8 55,4.0 55,18.5 27.5,29.0 0,18.5" fill="#9B1B81"/>
        <polygon points="0,18.5 27.5,29.0 55,18.5 55,19.6 27.5,30.1 0,19.6" fill="#FFFFFF"/>
        <polygon points="0,19.6 27.5,30.1 55,19.6 55,20.7 27.5,31.2 0,20.7" fill="#9B1B81"/>
        <path d="M 0,63.4 C 6.5,62.0 10.8,63.6 10.6,67.0 C 10.4,70.3 5.8,73.3 0,74.1 Z" fill="#4A525A"/>
        <path d="M 0,62.8 C 6.2,61.4 10.3,63.0 10.1,66.3 C 9.9,69.6 5.3,72.6 0,73.4 Z" fill="#9B1B81"/>
        <polygon points="0,76.8 6.2,80.4 48.8,80.4 55,76.8 55,80.0 46.5,85.0 8.5,85.0 0,80.0" fill="#9B1B81"/>
        <polygon points="0,80.0 8.5,85.0 5.8,85.0 0,81.5" fill="#FFFFFF"/>
        <polygon points="55,80.0 55,81.5 49.2,85.0 46.5,85.0" fill="#FFFFFF"/>
        <polygon points="0,81.5 0,80.9 7,85.0 -0.2,85.0" fill="#9B1B81"/>
        <polygon points="55,81.5 55,80.9 48,85.0 55.2,85.0" fill="#9B1B81"/>
        
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
        <div class="detail-row"><div class="detail-label">Address :</div><div class="detail-val address-lines">${addrHtml}</div></div>
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
          <span class="contact-item"><span class="icon-red">&#9993;</span><span>${esc(CONTACT_EMAIL)}</span></span>
          <span class="contact-item"><span class="icon-red">&#9742;</span><span>${esc(CONTACT_PHONE)}</span></span>
        </div>
      </div>
      <div class="footer-title">STUDENT ID CARD</div>
    </div>
  `;
}
