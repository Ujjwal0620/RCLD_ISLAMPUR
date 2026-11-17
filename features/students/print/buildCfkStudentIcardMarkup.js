export function buildCfkStudentIcardMarkup({
  student, activeSemester, semesterColors, semesterLabelColors, addrMain,
  idPrefix, idNumber, issueDate, photoImg, logoUrl, esc, toTitleCase, icon, scribble,
  AEC_LINE_1, CONTACT_EMAIL, CONTACT_PHONE,
}) {
            // ===== CODING FOR KIDS : 5.5 cm x 8.8 cm (55mm x 88mm) Strictly Bounded =====
            const sem = semesterColors[activeSemester] || "#EC008C";
            const labelColor = semesterLabelColors[activeSemester] || "#C81B78";
            const charcoal = "#4A525A";
            const iconRed = "#D32F2F";
      
            const fullName = String(student.applicantName || "").trim().toUpperCase();
            const words = fullName.split(/\s+/).filter(Boolean);
            const lastWord = words.length > 1 ? words.pop() : "";
            const firstPart = words.join(" ");
            const nameHtml = lastWord
              ? `<span class="fname">${esc(firstPart)}</span> <span class="lname">${esc(lastWord)}</span>`
              : `<span class="lname">${esc(firstPart)}</span>`;
      
            // Strictly scales down so name never overflows the 51mm inner width
            const nameSizeMm = Math.min(3.85, 49.5 / Math.max(fullName.length * 0.62, 1)).toFixed(2);
      
            const semMatch = String(activeSemester).match(/^SEM\s*(\d+)$/i);
            const badgeHtml = semMatch
              ? `<span class="sem-label">SEM</span><strong class="sem-num">${semMatch[1]}</strong>`
              : '<span class="robo">ROBO<br/>TICS</span>';
      
            const cfkAddressLines = [
              addrMain ? toTitleCase(addrMain) : "",
              student.postOffice ? `P.o. ${toTitleCase(student.postOffice)}` : "",
              student.district ? `Dist. ${toTitleCase(student.district)}` : "",
            ].filter((x) => String(x).trim());
      
            const fatherFormatted = student.fatherOrHusbandName
              ? esc(toTitleCase(student.fatherOrHusbandName))
              : "—";
  const cardMarkup = `
              <article class="card cfk" style="--sem:${sem};--lbl:${labelColor};--charcoal:${charcoal}">
                <svg class="bg" viewBox="0 0 55 88" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="55" height="88" fill="#FFFFFF"/>
                  <!-- 1. Top Charcoal V-Shield -->
                  <polygon points="0,0 55,0 55,5.3 27.5,21.8 0,5.3" fill="${charcoal}"/>
                  <!-- 2. Main Semester V-Band -->
                  <polygon points="0,5.3 27.5,21.8 55,5.3 55,21.2 27.5,37.7 0,21.2" fill="${sem}"/>
                  <!-- 3. Lower Thin Semester V-Stripe -->
                  <polygon points="0,23.0 27.5,39.5 55,23.0 55,24.4 27.5,40.9 0,24.4" fill="${sem}"/>
      
                  <!-- 4. Left SEM Badge 3D Charcoal Lip & Main Droplet -->
                  <path d="M 0,66.6 C 6.5,65.2 10.8,66.8 10.6,70.2 C 10.4,73.5 5.8,76.5 0,77.3 Z" fill="${charcoal}"/>
                  <path d="M 0,66.0 C 6.2,64.6 10.3,66.2 10.1,69.5 C 9.9,72.8 5.3,75.8 0,76.6 Z" fill="${sem}"/>
      
                  <!-- 5. Footer Inverted Chevron Bar & Corner Stripes -->
                  <polygon points="0,79.8 6.2,83.4 48.8,83.4 55,79.8 55,83.0 46.5,88.0 8.5,88.0 0,83.0" fill="${sem}"/>
                  <polygon points="0,84.5 5.8,88.0 3.6,88.0 0,85.8" fill="${sem}"/>
                  <polygon points="55,84.5 55,85.8 51.4,88.0 49.2,88.0" fill="${sem}"/>
                </svg>
      
                <!-- Header -->
                <div class="cfk-header">
                  <div class="cfk-brand-row">
                    <img class="cfk-logo" src="${logoUrl}" alt="RCLD"/>
                    <span class="cfk-rcld">RCLD</span>
                  </div>
                  <div class="cfk-sub1">Rashtriya Computer Literacy Drive</div>
                  <div class="cfk-sub2">A mission encouraged by</div>
                  <div class="cfk-sub3">Govt. of India</div>
                </div>
      
                <!-- Circular Student Photo -->
                <div class="cfk-photo">${photoImg}</div>
      
                <!-- Student Name & Course -->
                <div class="cfk-name" style="font-size:${nameSizeMm}mm">${nameHtml}</div>
                <div class="cfk-course">CODING FOR KIDS</div>
      
                <!-- Student Details Grid (Strictly Bounded Inside 55mm) -->
                <div class="cfk-info">
                  <div class="r">
                    <b>ID No :</b>
                    <span class="one-line">${idPrefix}${idNumber ? `<em>${idNumber}</em>` : ""}</span>
                  </div>
                  <div class="r">
                    <b>Date of Admn. :</b>
                    <span class="one-line">${issueDate}</span>
                  </div>
                  <div class="r">
                    <b>Father's Name :</b>
                    <span class="one-line">${fatherFormatted}</span>
                  </div>
                  <div class="r">
                    <b>Address :</b>
                    <span class="addr-lines">${cfkAddressLines.map((l) => esc(l)).join("<br/>")}</span>
                  </div>
                </div>
      
                <!-- Left SEM Badge -->
                <div class="cfk-badge">${badgeHtml}</div>
      
                <!-- Issuing Authority Signature -->
                <div class="cfk-sign">
                  ${scribble("#0B1136")}
                  <small>Issuing Authority</small>
                </div>
      
                <!-- Footer Contact Info -->
                <div class="cfk-foot1">${esc(AEC_LINE_1)}</div>
                <div class="cfk-foot2">
                  ${icon("mail", iconRed)}
                  <span>${esc(CONTACT_EMAIL)}</span>
                  <i></i>
                  ${icon("phone-circle", iconRed)}
                  <span class="cfk-phone">${esc(CONTACT_PHONE)}</span>
                </div>
      
                <!-- Bottom Bar Text -->
                <div class="cfk-band">STUDENT ID CARD</div>
              </article>`;
  return cardMarkup;
}
