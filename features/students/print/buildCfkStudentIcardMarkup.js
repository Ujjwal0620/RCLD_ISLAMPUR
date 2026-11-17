export function buildCfkStudentIcardMarkup({
  student,
  courseText,
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
  // Fixed reference palette: semester changes the number, not the card colour.
  const themeColor = "#F6801E";
  const labelColor = "#F6801E";
  const semNumber = String(activeSemester).replace(/[^0-9]/g, "") || "1";

  // First name remains charcoal; the remaining name is highlighted by semester colour.
  const rawName = String(student.applicantName || "").trim().toUpperCase();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const firstName = esc(nameParts.slice(0, -1).join(" ") || nameParts[0] || "");
  const lastName = esc(nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
  const nameSizeMm = Math.min(3.55, 43 / Math.max(rawName.length * 0.56, 1)).toFixed(2);
  const courseLabel = esc(String(courseText || student.courseName || student.course?.name || "CODING FOR KIDS").toUpperCase());
  const fatherName = esc(toTitleCase(
    student.fatherOrHusbandName || student.fatherName || student.guardianName || student.father_name || ""
  ));

  const addrLines = addrMain
    .split(/[,|\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const addrHtml = addrLines.length
    ? addrLines.map((line) => {
        const formatted = toTitleCase(line)
          .replace(/\bP\.o\./gi, "P.O.")
          .replace(/\bP\.s\./gi, "P.S.");
        return `<div>${esc(formatted)}</div>`;
      }).join("")
    : "<div>—</div>";

  return `
    <div class="icard-page cfk-card" style="--theme-color:${themeColor};--label-color:${labelColor};">
      <svg class="cfk-bg-svg" viewBox="0 0 550 880" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="550" height="880" fill="#FFFFFF"/>
        <path d="M0 0H550V38L275 246L0 38Z" fill="#44515A"/>
        <path d="M0 38L275 246L145 332L0 190Z" fill="#F6801E"/>
        <path d="M550 38L275 246L405 332L550 190Z" fill="#F6801E"/>
        <path d="M0 174L145 307L153 299L0 164Z" fill="#FFFFFF"/>
        <path d="M0 190L136 315L143 308L0 180Z" fill="#FFFFFF"/>
        <path d="M550 174L405 307L397 299L550 164Z" fill="#FFFFFF"/>
        <path d="M550 190L414 315L407 308L550 180Z" fill="#FFFFFF"/>
        <path d="M0 815L275 835L550 815V880H0Z" fill="#F6801E"/>
        <path d="M0 801L275 821L550 801V811L275 831L0 811Z" fill="#FFFFFF"/>
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
        <div class="cfk-student-name" style="font-size:${nameSizeMm}mm">
          <span class="cfk-fname">${firstName}</span>${lastName ? `<span class="cfk-lname"> ${lastName}</span>` : ""}
        </div>
        <div class="cfk-course-name">${courseLabel}</div>
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
        <svg viewBox="0 0 106 94" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 2 C26 -1 72 0 91 20 C108 38 105 61 86 77 C66 94 27 95 0 92 Z" fill="#F6801E" stroke="#44515A" stroke-width="1.6"/>
        </svg>
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
