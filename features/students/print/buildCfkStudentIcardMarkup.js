export function buildCfkStudentIcardMarkup({
  student,
  activeSemester,
  semesterColors,
  semesterLabelColors,
  addrMain,
  idPrefix,
  idNumber,
  issueDate,
  photoImg,
  logoUrl,
  esc,
  toTitleCase,
  icon,
  scribble,
  AEC_LINE_1,
  CONTACT_EMAIL,
  CONTACT_PHONE,
}) {
  const themeColor = semesterColors[activeSemester] || "#EC008C";
  const labelColor = semesterLabelColors[activeSemester] || "#C81B78";
  const semNumber = String(activeSemester).replace(/[^0-9]/g, "") || "1";

  // First name remains charcoal; the remaining name is highlighted by semester colour.
  const rawName = String(student.applicantName || "").trim().toUpperCase();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const firstName = esc(nameParts[0] || "");
  const lastName = esc(nameParts.slice(1).join(" "));
  const fatherName = esc(toTitleCase(student.fatherName || student.guardianName || ""));

  const addrLines = addrMain
    .split(/[,|\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const addrHtml = addrLines.length
    ? addrLines.map((line) => `<div>${esc(toTitleCase(line))}</div>`).join("")
    : "<div>—</div>";

  return `
    <div class="icard-page cfk-card" style="--theme-color:${themeColor};--label-color:${labelColor};">
      <svg class="cfk-bg-svg" viewBox="0 0 550 850" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="0,0 550,0 550,36 275,248 0,36" fill="#464E56"/>
        <polygon points="0,36 275,248 550,36 550,192 275,392 0,192" fill="${themeColor}"/>
        <polygon points="0,206 275,406 550,206 550,221 275,421 0,221" fill="${themeColor}"/>
        <polygon points="0,765 52,803 498,803 550,765 550,775 502,810 48,810 0,775" fill="${themeColor}"/>
        <polygon points="0,783 45,816 505,816 550,783 550,813 500,850 50,850 0,813" fill="${themeColor}"/>
        <polygon points="0,821 40,850 0,850" fill="#464E56"/>
        <polygon points="550,821 550,850 510,850" fill="#464E56"/>
      </svg>

      <div class="cfk-header">
        <div class="cfk-brand-row">
          <img class="cfk-logo" src="${logoUrl}" alt="RCLD Logo"/>
          <span class="cfk-title">RCLD</span>
        </div>
        <div class="cfk-subtitle">Rashtriya Computer Literacy Drive</div>
        <div class="cfk-encouraged">A mission encouraged by</div>
        <div class="cfk-govt">Govt. of India</div>
      </div>

      <div class="cfk-photo-wrap">
        <div class="cfk-photo-inner">${photoImg}</div>
      </div>

      <div class="cfk-name-block">
        <div class="cfk-student-name">
          <span class="cfk-fname">${firstName}</span>${lastName ? `<span class="cfk-lname"> ${lastName}</span>` : ""}
        </div>
        <div class="cfk-course-name">CODING FOR KIDS</div>
      </div>

      <div class="cfk-details">
        <div class="cfk-row">
          <div class="cfk-lbl">ID No :</div>
          <div class="cfk-val cfk-id-val">${idPrefix}<span class="cfk-id-num">${idNumber}</span></div>
        </div>
        <div class="cfk-row">
          <div class="cfk-lbl">Date of Admn. :</div>
          <div class="cfk-val">${issueDate}</div>
        </div>
        <div class="cfk-row">
          <div class="cfk-lbl">Father's Name :</div>
          <div class="cfk-val">${fatherName || "—"}</div>
        </div>
        <div class="cfk-row cfk-addr-row">
          <div class="cfk-lbl">Address :</div>
          <div class="cfk-val cfk-addr-lines">${addrHtml}</div>
        </div>
      </div>

      <div class="cfk-sem-badge">
        <div class="cfk-sem-word">SEM</div>
        <div class="cfk-sem-num">${semNumber}</div>
      </div>

      <div class="cfk-sign-block">
        <div class="cfk-sign-svg">${scribble ? scribble("#464E56") : ""}</div>
        <div class="cfk-sign-text">Issuing Authority</div>
      </div>

      <div class="cfk-contact-block">
        <div class="cfk-aec-line">${esc(AEC_LINE_1)}</div>
        <div class="cfk-contact-line">
          <span class="cfk-c-item">
            <span class="cfk-c-icon">${icon ? icon("mail", "#D32F2F") : "✉"}</span>
            <span>${esc(CONTACT_EMAIL)}</span>
          </span>
          <span class="cfk-c-item">
            <span class="cfk-c-icon">${icon ? icon("phone-circle", "#D32F2F") : "✆"}</span>
            <span class="cfk-phone-txt">${esc(CONTACT_PHONE)}</span>
          </span>
        </div>
      </div>

      <div class="cfk-footer-banner">
        <span class="cfk-footer-title">STUDENT ID CARD</span>
      </div>
    </div>
  `;
}
