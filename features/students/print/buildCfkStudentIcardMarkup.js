export function buildCfkStudentIcardMarkup({
  student,
  courseText,
  activeSemester,
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
  const slate = "#465058";
  const magenta = "#9B1B81";
  const semNumber = String(activeSemester).replace(/[^0-9]/g, "") || "1";

  const rawName = String(student.applicantName || "").trim().toUpperCase();
  const nameParts = rawName.split(/\\s+/).filter(Boolean);
  const firstName = esc(nameParts.slice(0, -1).join(" ") || nameParts[0] || "");
  const lastName = esc(nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
  const nameSizePt = Math.min(11.5, 155 / Math.max(rawName.length * 0.56, 1)).toFixed(2);
  const courseLabel = esc(String(student.courseName || student.course?.name || courseText || "CODING FOR KIDS").toUpperCase());
  const fatherName = esc(toTitleCase(
    student.fatherOrHusbandName || student.fatherName || student.guardianName || student.father_name || ""
  ));

  const addrLines = String(addrMain || "")
    .split(/[,|\\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const addrHtml = addrLines.length
    ? addrLines.map((line) => {
        const formatted = toTitleCase(line)
          .replace(/\\bP\\.o\\./gi, "P.O.")
          .replace(/\\bP\\.s\\./gi, "P.S.");
        return `<div>${esc(formatted)}</div>`;
      }).join("")
    : "<div>—</div>";

  return `
    <div class="icard-page cfk-card">
      <svg class="cfk-bg-svg" viewBox="0 0 550 850" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="550" height="850" fill="#FFFFFF"/>
        <!-- Dark slate header and layered magenta V geometry -->
        <path d="M0 0H550V50L275 200L0 50Z" fill="${slate}"/>
        <path d="M0 50L275 200L550 50V170L275 320L0 170Z" fill="${magenta}"/>
        <path d="M0 170L275 320L550 170L550 182L275 332L0 182Z" fill="#FFFFFF"/>
        <path d="M0 185L275 385L550 185L550 203L275 403L0 203Z" fill="${magenta}"/>
        <!-- Bottom thin angled line, white separator, main footer and corner triangles -->
        <path d="M0 765L55 798H495L550 765V777L495 810H55L0 777Z" fill="${magenta}"/>
        <path d="M0 777L55 810H495L550 777V785L495 818H55L0 785Z" fill="#FFFFFF"/>
        <path d="M0 785L55 812H495L550 785V850H0Z" fill="${magenta}"/>
        <path d="M0 815L55 842V850H0Z" fill="${slate}"/>
        <path d="M550 815L495 842V850H550Z" fill="${slate}"/>
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
        <div class="cfk-student-name" style="font-size:${nameSizePt}pt">
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
        <svg viewBox="0 0 106 110" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 2 C27 -1 76 0 94 24 C111 48 103 82 80 99 C58 115 25 109 0 108 Z" fill="${magenta}" stroke="${slate}" stroke-width="2"/>
        </svg>
        <div class="cfk-sem-word">SEM</div>
        <div class="cfk-sem-num">${semNumber}</div>
      </div>

      <div class="cfk-sign-block">
        <div class="cfk-sign-svg">${scribble ? scribble("#243B63") : ""}</div>
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
