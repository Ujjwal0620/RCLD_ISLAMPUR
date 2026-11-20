export function buildStandardStudentIcardMarkup({
  student, addrMain, idPrefix, idNumber, issueDate, photoImg, logoUrl, sessionLabel,
  courseText, esc, upper, icon, scribble, AEC_STD_1, AEC_STD_2,
  CONTACT_PHONE_STD, CONTACT_EMAIL, CONTACT_WEB,
}) {
            // ===== STANDARD (ALL OTHER COURSES) : Exact Match to Sample 2 =====
            const fullName = String(student.applicantName || "").trim().toUpperCase();
            const stdNameSizeMm = Math.min(2.65, 34.5 / Math.max(fullName.length * 0.58, 1)).toFixed(2);
            const rawIdNumber = String(idNumber || "—");
            const idPrefix = "RCLD/ISL-001/";
            const idCode = rawIdNumber.toUpperCase().startsWith(idPrefix)
              ? rawIdNumber.slice(idPrefix.length)
              : rawIdNumber;
            const idMarkup = '<span class="id-number-prefix">' + idPrefix + '</span><strong class="id-number-code">' + idCode + '</strong>';
      
            // Format 3-line uppercase address exactly like Sample 2:
            // Line 1: VILL. MALIN GAON,
            // Line 2: P.O. LAKHIPUR, P.S. CHOPRA,
            // Line 3: DIST. UTTAR DINAJPUR, W.B.
            const line1 = addrMain ? `${addrMain.toUpperCase().replace(/,+$/, "")},` : "";
            const line2Parts = [
              student.postOffice ? `P.O. ${student.postOffice.toUpperCase().trim()}` : "",
              student.policeStation ? `P.S. ${student.policeStation.toUpperCase().trim()}` : "",
            ].filter(Boolean);
            const line2 = line2Parts.length ? `${line2Parts.join(", ")},` : "";
      
            const stateRaw = String(student.state || "").trim().toUpperCase();
            const stateShort =
              stateRaw === "WEST BENGAL"
                ? "W.B."
                : stateRaw === "BIHAR"
                  ? "BIHAR"
                  : stateRaw;
            const line3Parts = [
              student.district ? `DIST. ${student.district.toUpperCase().trim()}` : "",
              stateShort,
            ].filter(Boolean);
            const line3 = line3Parts.join(", ");
            const stdAddrLines = [line1, line2, line3].filter(Boolean);
  const cardMarkup = `
              <article class="card std">
                <!-- Soft Diagonal Ice-Blue Gradient Background -->
                <svg class="bg" viewBox="0 0 55 88" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="stdBg" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#EAF4FC"/>
                      <stop offset="28%" stop-color="#FFFFFF"/>
                      <stop offset="62%" stop-color="#EAF4FC"/>
                      <stop offset="85%" stop-color="#FFFFFF"/>
                      <stop offset="100%" stop-color="#E3F0FA"/>
                    </linearGradient>
                  </defs>
                  <rect width="55" height="88" fill="url(#stdBg)"/>
                </svg>
      
                <!-- Top Row: Left ID Block, Center Crest Logo, Right Session Block -->
                <div class="std-id">
                  <div class="l">ID No.</div>
                  <div class="n">${idMarkup}</div>
                </div>
      
                <img class="std-logo" src="${logoUrl}" alt="RCLD logo"/>
      
                <div class="std-session">
                  <div class="l">Session:</div>
                  <div class="v">${sessionLabel}</div>
                </div>
      
                <!-- Main RCLD Headings -->
                <div class="std-rcld">RCLD</div>
                <div class="std-title">Rashtriya Computer Literacy Drive</div>
                <div class="std-mission">(A mission encouraged by National IT Task Force, GOVT. OF INDIA)</div>
      
                <!-- Rounded Rectangular Student Photo with Solid Navy Border -->
                <div class="std-photo">${photoImg}</div>
      
                <!-- Two-Column Student Details Grid -->
                <div class="std-details">
                  <div class="r">
                    <b>Name:</b>
                    <span class="nm one-line" style="font-size:${stdNameSizeMm}mm">${esc(fullName)}</span>
                  </div>
                  <div class="r">
                    <b>Father's Name:</b>
                    <span class="one-line">${upper(student.fatherOrHusbandName)}</span>
                  </div>
                  <div class="r">
                    <b>Address:</b>
                    <span class="ad">${stdAddrLines.map((l) => esc(l)).join("<br/>")}</span>
                  </div>
                  <div class="r">
                    <b>Date of Issue:</b>
                    <span class="one-line">${issueDate}</span>
                  </div>
                </div>
      
                <!-- Right Auth. Signatory -->
                <div class="std-sign">
                  ${scribble("#1B1F6B")}
                  <small>Auth. Signatory</small>
                </div>
      
                <!-- Footer Contact Section Above Navy Band -->
                <div class="std-foot">
                  <div class="f-line1">${esc(AEC_STD_1)}</div>
                  <div class="f-line2">
                    <span>${esc(AEC_STD_2)}</span>
                    ${icon("std-phone")}
                    <span>${esc(CONTACT_PHONE_STD)}</span>
                  </div>
                  <div class="f-line3">
                    ${icon("std-mail")}
                    <span>${esc(CONTACT_EMAIL)}</span>
                    <i class="sp"></i>
                    ${icon("std-web")}
                    <span>${esc(CONTACT_WEB)}</span>
                  </div>
                </div>
      
                <!-- Bottom Royal Navy Bar -->
                <div class="std-band">IDENTITY CARD</div>
              </article>`;
  return cardMarkup;
}
