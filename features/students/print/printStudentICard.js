"use client";

import { isIcardEligible } from "@/features/students/utils/studentProfile";
import { getStudentIcardStyles } from "@/features/students/print/studentIcardStyles";
import { esc, upper, toTitleCase, formatIcardDate, icardIcon as icon, icardSignature as scribble } from "@/features/students/print/studentIcardHelpers";

export function printStudentICard(student, setMessage, selectedSemester = "") {
        if (!student || !isIcardEligible(student)) {
          setMessage(
            "I-Card is unavailable until all required details are complete and admission is not pending.",
          );
          return;
        }
    
        // ---------- Settings you may want to edit ----------
        const DEFAULT_SESSION = "2025-2026"; // used when the student record has no session
        const AEC_LINE_1 = "AEC: CYBER WORLD, DESHBANDHU PARA, ISLAMPUR"; // Coding For Kids card
        const AEC_STD_1 = "AEC: CYBER WORLD, DESHBANDHUPARA, ISLAMPUR,";
        const AEC_STD_2 = "Uttar Dinajpur, West Bengal, PIN-733202";
        const CONTACT_EMAIL = "islampur.cyberworld@gmail.com";
        const CONTACT_PHONE = "9851775891";
        const CONTACT_PHONE_STD = "+91 98517 75891";
        const CONTACT_WEB = "rcldgov.in";
        // ---------------------------------------------------
    
        const upper = (v) => esc(String(v ?? "").trim().toUpperCase());
    
        const courseText = String(student.courseName || student.courseCode || "").trim();
        const isCFK = /coding\s*for\s*kids|\bCFK\b|\bKIDS\b/i.test(courseText);
        const activeSemester = isCFK
          ? `SEM ${Math.min(6, Math.max(1, Number(student.currentSemester || 1)))}`
          : selectedSemester;
        const semesterOptions = ["SEM 1", "SEM 2", "SEM 3", "SEM 4", "SEM 5", "SEM 6"];
        const semesterColors = {
          "SEM 1": "#EC008C",
          "SEM 2": "#269B52",
          "SEM 3": "#F1C40F",
          "SEM 4": "#858585",
          "SEM 5": "#1688D4",
          "SEM 6": "#E53935",
        };
        const semesterLabelColors = {
          "SEM 1": "#C81B78",
          "SEM 2": "#1E7E41",
          "SEM 3": "#B7950B",
          "SEM 4": "#666666",
          "SEM 5": "#116AA8",
          "SEM 6": "#C62828",
        };
    
        if (isCFK && !semesterOptions.includes(activeSemester)) {
          setMessage("Please select a valid Coding For Kids semester/module.");
          return;
        }
    
        const w = window.open("", "_blank");
        if (!w) {
          setMessage("Please allow pop-ups to print the I-Card.");
          return;
        }
    
        const studentName = esc(student.applicantName);
        const admissionDate = student.admissionDate || student.createdAt || "";
        const issueDate = formatIcardDate(admissionDate);
        const sessionLabel = esc(student.session || student.academicSession || DEFAULT_SESSION);
    
        // ID number: prefix + running number (e.g. RCLD/ISL-001/ + 21363)
        const enrollRaw =
          String(student.enrollmentNo || student.studentId || student.admissionNo || "").trim() || "—";
        const idMatch = enrollRaw.match(/^(.*?)(\d+)$/);
        const idPrefix = idMatch ? esc(idMatch[1]) : esc(enrollRaw);
        const idNumber = idMatch ? esc(idMatch[2]) : "";
    
        const photoUrl = student.photoUrl ? esc(student.photoUrl) : "";
        const photoImg = photoUrl
          ? `<img class="photo-img" src="${photoUrl}" alt="Student photo"/>`
          : '<div class="photo-ph">PHOTO</div>';
        const logoUrl = new URL("/assets/logo.png", window.location.origin).href;
    
        const addrMain = String(student.presentAddress || student.address || "").trim();
    
        // Icons helper for CFK and Standard cards
    
        // Both cards use the 55mm x 88mm (5.5cm x 8.8cm) canvas size
        const cardHeight = "88mm";
        let cardMarkup = "";
    
        if (isCFK) {
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
    
          cardMarkup = `
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
        } else {
          // ===== STANDARD (ALL OTHER COURSES) : Exact Match to Sample 2 =====
          const fullName = String(student.applicantName || "").trim().toUpperCase();
          const stdNameSizeMm = Math.min(2.65, 34.5 / Math.max(fullName.length * 0.58, 1)).toFixed(2);
    
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
    
          cardMarkup = `
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
                <div class="l">ID NO.</div>
                <div class="p">${idPrefix}</div>
                ${idNumber ? `<div class="n">${idNumber}</div>` : ""}
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
                  <b>Course:</b>
                  <span class="crs">${esc(courseText || "—")}</span>
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
        }
    
        const html = `<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Student I-Card - ${studentName}</title>
          <style>${getStudentIcardStyles(cardHeight)}</style></head><body>${cardMarkup}<script>
            window.addEventListener('load',async()=>{
              await Promise.all([...document.images].map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve()));
              setTimeout(()=>window.print(),300);
            });
          </script></body></html>`;
        w.document.open();
        w.document.write(html);
        w.document.close();
}
