"use client";

import { isIcardEligible } from "@/features/students/utils/studentProfile";

export default function useStudentPrint({ student, fee, courses, setMessage }) {
    function printStudentICard(selectedSemester = "") {
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
  
      const esc = (v) =>
        String(v ?? "—").replace(
          /[&<>"']/g,
          (ch) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[ch],
        );
      const upper = (v) => esc(String(v ?? "").trim().toUpperCase());
      const toTitleCase = (str) =>
        String(str ?? "")
          .trim()
          .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
  
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
      const formatDate = (date) => {
        if (!date) return "—";
        const m = String(date)
          .slice(0, 10)
          .match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(date);
      };
      const issueDate = formatDate(admissionDate);
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
      const icon = (type, color) => {
        const c = esc(color);
        if (type === "mail")
          return `<svg class="ic" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M3 7l9 7 9-7" fill="none" stroke="${c}" stroke-width="2.4"/></svg>`;
        if (type === "phone-circle")
          return `<svg class="ic-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M8.2 10.9a9.5 9.5 0 004.9 4.9l1.6-1.6c.2-.2.5-.3.8-.1.8.3 1.7.4 2.6.4.4 0 .7.3.7.7v2.5c0 .4-.3.7-.7.7A12.4 12.4 0 015.6 5.9c0-.4.3-.7.7-.7h2.5c.4 0 .7.3.7.7 0 .9.1 1.8.4 2.6.1.3 0 .6-.2.8l-1.5 1.6z" fill="${c}"/></svg>`;
        if (type === "std-phone")
          return `<svg class="std-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0288D1"/><path d="M8.2 10.9a9.5 9.5 0 004.9 4.9l1.6-1.6c.2-.2.5-.3.8-.1.8.3 1.7.4 2.6.4.4 0 .7.3.7.7v2.5c0 .4-.3.7-.7.7A12.4 12.4 0 015.6 5.9c0-.4.3-.7.7-.7h2.5c.4 0 .7.3.7.7 0 .9.1 1.8.4 2.6.1.3 0 .6-.2.8l-1.5 1.6z" fill="#FFFFFF"/></svg>`;
        if (type === "std-mail")
          return `<svg class="std-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0288D1"/><rect x="5" y="7.5" width="14" height="9" rx="1.2" fill="none" stroke="#FFFFFF" stroke-width="1.8"/><path d="M5.5 8l6.5 5 6.5-5" fill="none" stroke="#FFFFFF" stroke-width="1.8"/></svg>`;
        if (type === "std-web")
          return `<svg class="std-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0288D1"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#FFFFFF" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="3" ry="6.5" fill="none" stroke="#FFFFFF" stroke-width="1.3"/><path d="M5.5 12h13" stroke="#FFFFFF" stroke-width="1.3"/></svg>`;
        return "";
      };
  
      const scribble = (color) =>
        `<svg class="scribble" viewBox="0 0 85 32"><path d="M8 22 C14 5 26 4 22 18 C19 28 32 6 38 11 C44 16 33 26 46 18 C54 12 60 8 65 17 C70 25 75 11 82 15 M4 16 L48 14" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  
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
        <style>
          /* Exact Card Dimensions: 5.5 cm wide x 8.8 cm tall (55mm x 88mm) */
          @page{size:55mm ${cardHeight};margin:0}
          *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
          html,body{width:55mm;height:${cardHeight};background:#fff;font-family:Arial,Helvetica,sans-serif}
          body{overflow:hidden}
          .card{position:relative;width:55mm;height:${cardHeight};overflow:hidden;background:#fff;break-after:avoid;page-break-after:avoid;break-inside:avoid}
          .card>*{position:absolute}
          .card .bg{left:0;top:0;width:55mm;height:${cardHeight};z-index:1}
          .photo-img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top}
          .photo-ph{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;font-size:2mm;background:#fff}
          .ic{display:inline-block;width:1.6mm;height:1.6mm;vertical-align:middle;margin-right:.35mm;flex:none}
          .ic-circle{display:inline-block;width:1.7mm;height:1.7mm;vertical-align:middle;margin-right:.35mm;flex:none}
          .std-ic{display:inline-block;width:2.0mm;height:2.0mm;vertical-align:middle;margin:0 .3mm;flex:none}
          .scribble{display:block;width:9.2mm;height:3.6mm;margin:0 auto}
          .one-line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  
          /* ===================== CODING FOR KIDS (55mm x 88mm) ===================== */
          .cfk-header{top:2.0mm;left:1mm;right:1mm;text-align:center;color:#FFFFFF;z-index:2;overflow:hidden}
          .cfk-brand-row{display:flex;justify-content:center;align-items:center;gap:1.1mm}
          .cfk-logo{width:5.0mm;height:6.2mm;object-fit:contain;background:transparent;flex:none}
          .cfk-rcld{font-family:"Arial Black",Impact,Arial,sans-serif;font-weight:900;font-size:6.8mm;line-height:.88;letter-spacing:.3mm;color:#FFFFFF}
          .cfk-sub1{font-size:1.85mm;font-weight:700;letter-spacing:.06mm;margin-top:.5mm;line-height:1.15;white-space:nowrap}
          .cfk-sub2{font-size:1.55mm;font-weight:400;color:#E8ECEF;margin-top:.2mm;line-height:1.15;white-space:nowrap}
          .cfk-sub3{font-size:1.95mm;font-weight:700;margin-top:.15mm;line-height:1.15;white-space:nowrap}
  
          .cfk-photo{left:14.7mm;top:16.0mm;width:25.6mm;height:25.6mm;border-radius:50%;border:.65mm solid #FFFFFF;overflow:hidden;background:#FFFFFF;z-index:3}
  
          .cfk-name{left:1.5mm;right:1.5mm;top:42.5mm;text-align:center;font-weight:800;line-height:1.1;text-transform:uppercase;letter-spacing:-.05mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:3}
          .cfk-name .fname{color:var(--charcoal)}
          .cfk-name .lname{color:var(--sem)}
  
          .cfk-course{left:1.5mm;right:1.5mm;top:48.2mm;text-align:center;font-size:2.65mm;line-height:1;font-weight:800;letter-spacing:.06mm;color:var(--charcoal);text-transform:uppercase;white-space:nowrap;overflow:hidden;z-index:3}
  
          .cfk-info{left:1.2mm;right:1.5mm;top:52.8mm;font-size:2.15mm;line-height:3.05mm;z-index:3;overflow:hidden}
          .cfk-info .r{display:grid;grid-template-columns:22.2mm minmax(0,1fr);column-gap:1.2mm;align-items:baseline}
          .cfk-info b{text-align:right;white-space:nowrap;font-weight:700;color:var(--lbl);letter-spacing:-.03mm}
          .cfk-info span{font-weight:700;color:var(--charcoal);min-width:0;letter-spacing:-.03mm}
          .cfk-info .addr-lines{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:2.85mm;word-break:break-word}
          .cfk-info em{font-style:normal;font-size:2.7mm;font-weight:800;color:var(--charcoal);margin-left:.1mm}
  
          .cfk-badge{left:0;top:66.6mm;width:9.2mm;height:9.6mm;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#FFFFFF;z-index:3}
          .cfk-badge .sem-label{font-family:"Times New Roman",Georgia,serif;font-size:2.45mm;font-weight:700;line-height:1}
          .cfk-badge .sem-num{font-family:"Arial Black",Impact,sans-serif;font-size:4.3mm;font-weight:900;line-height:1.05;margin-top:.15mm}
          .cfk-badge .robo{font-size:2.2mm;line-height:2.4mm;font-weight:800;text-align:center}
  
          .cfk-sign{right:2.5mm;top:71.2mm;width:14mm;text-align:center;z-index:3}
          .cfk-sign small{display:block;font-size:1.65mm;font-style:italic;color:var(--charcoal);line-height:1.15;margin-top:.1mm;white-space:nowrap}
  
          .cfk-foot1{left:1mm;right:1mm;top:77.4mm;text-align:center;font-size:1.92mm;line-height:1.15;font-weight:700;color:var(--charcoal);letter-spacing:-.04mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:3}
          .cfk-foot2{left:1mm;right:1mm;top:79.8mm;display:flex;justify-content:center;align-items:center;font-size:1.85mm;line-height:1.15;font-weight:700;color:var(--charcoal);white-space:nowrap;overflow:hidden;z-index:3}
          .cfk-foot2 i{display:inline-block;width:1.2mm;flex:none}
          .cfk-foot2 .cfk-phone{font-size:1.95mm;font-weight:800}
  
          .cfk-band{left:0;right:0;bottom:0;height:4.6mm;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-family:"Arial Black",Arial,sans-serif;font-size:2.85mm;font-weight:900;letter-spacing:.18mm;z-index:3}
  
          /* ===================== STANDARD (OTHER COURSES - 55mm x 88mm) ===================== */
          .std{font-family:"Times New Roman",Times,Georgia,serif;color:#111;z-index:2}
  
          .std-id{left:1.8mm;top:3.8mm;width:18.5mm;text-align:center;z-index:3}
          .std-id .l{font-size:2.15mm;line-height:1.15;font-weight:700;color:#111}
          .std-id .p{font-size:2.05mm;line-height:1.2;font-weight:700;color:#111;word-break:break-all}
          .std-id .n{font-size:3.1mm;line-height:1.15;font-weight:800;color:#111;margin-top:.1mm}
  
          .std-logo{left:21.25mm;top:1.5mm;width:12.5mm;height:14.2mm;object-fit:contain;z-index:3}
  
          .std-session{right:1.8mm;top:3.8mm;width:18.5mm;text-align:center;z-index:3}
          .std-session .l{font-size:2.25mm;line-height:1.15;font-weight:700;color:#1B1F6B}
          .std-session .v{font-size:2.85mm;line-height:1.2;font-weight:800;color:#D32F2F;margin-top:.15mm}
  
          .std-rcld{left:0;right:0;top:15.5mm;text-align:center;font-family:"Arial Black",Impact,Arial,sans-serif;font-weight:900;font-size:8.6mm;line-height:1;letter-spacing:.35mm;color:#E31E24;transform:scaleX(1.06);z-index:3}
          .std-title{left:1mm;right:1mm;top:24.2mm;text-align:center;font-size:2.85mm;line-height:1.1;font-weight:700;color:#1B1F6B;white-space:nowrap;overflow:hidden;z-index:3}
          .std-mission{left:1mm;right:1mm;top:27.3mm;text-align:center;font-size:1.68mm;line-height:1.15;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;z-index:3}
  
          .std-photo{left:17.5mm;top:29.8mm;width:20.0mm;height:23.8mm;border:.55mm solid #1B1F6B;border-radius:1.6mm;overflow:hidden;background:#FFFFFF;z-index:3}
  
          .std-details{left:1.8mm;right:1.5mm;top:54.8mm;z-index:3;overflow:hidden}
          .std-details .r{display:grid;grid-template-columns:14.8mm minmax(0,1fr);column-gap:.8mm;align-items:baseline;margin-bottom:.55mm;line-height:2.45mm}
          .std-details b{font-size:2.05mm;font-weight:700;color:#1B1F6B;white-space:nowrap}
          .std-details span{font-size:2.1mm;font-weight:700;color:#111;min-width:0}
          .std-details .nm{font-weight:800;letter-spacing:.02mm}
          .std-details .ad{font-size:1.88mm;font-weight:700;line-height:2.35mm;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
          .std-details .crs{font-size:2.05mm;font-weight:700;line-height:2.3mm;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  
          .std-sign{right:1.8mm;top:70.2mm;width:13.5mm;text-align:center;z-index:3}
          .std-sign small{display:block;font-family:Arial,sans-serif;font-size:1.55mm;font-weight:700;color:#111;line-height:1.15;margin-top:.1mm;white-space:nowrap}
  
          .std-foot{left:0;right:0;top:75.5mm;height:7.3mm;border-top:.3mm solid #1B1F6B;padding:.45mm 1mm 0;text-align:center;font-family:"Times New Roman",Times,serif;font-weight:700;color:#111;z-index:3;overflow:hidden}
          .std-foot .f-line1{font-size:1.82mm;line-height:2.15mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .std-foot .f-line2{font-size:1.85mm;line-height:2.25mm;display:flex;justify-content:center;align-items:center;white-space:nowrap}
          .std-foot .f-line3{font-size:1.85mm;line-height:2.25mm;display:flex;justify-content:center;align-items:center;white-space:nowrap}
          .std-foot .sp{display:inline-block;width:1.4mm}
  
          .std-band{left:0;right:0;bottom:0;height:5.2mm;background:#1B2A78;color:#FFFFFF;font-family:"Times New Roman",Georgia,serif;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:3.8mm;letter-spacing:.25mm;z-index:3}
  
          @media screen{
            html,body{width:auto;height:auto;background:#e5e9f0}
            body{display:flex;justify-content:center;padding:8mm 0;overflow:auto}
            .card{flex:none;box-shadow:0 1px 10px rgba(0,0,0,.3)}
          }
          @media print{
            html,body{width:55mm;height:${cardHeight};margin:0!important;padding:0!important;overflow:hidden}
            body{display:block}
            .card{box-shadow:none}
          }
        </style></head><body>${cardMarkup}<script>
          window.addEventListener('load',async()=>{
            await Promise.all([...document.images].map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve()));
            setTimeout(()=>window.print(),300);
          });
        </script></body></html>`;
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  
    function printStudentForm() {
      if (!student) return;
      const esc = (value) =>
        String(value ?? "").replace(
          /[&<>"']/g,
          (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
        );
      const val = (value) => esc(value || "");
      const field = (label, value) =>
        '<div class="field"><span class="label">' +
        esc(label) +
        '</span><span class="value">' +
        val(value) +
        "</span></div>";
      const date = (value) =>
        value ? new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB") : "";
      const presentAddress = [
        field("Ward / Colony / Village", student.presentAddress || student.address),
        field("Post Office", student.postOffice),
        field("Police Station", student.policeStation),
        field("State", student.state),
        field("District", student.district),
        field("PIN Code", student.pin),
        field("Nearest Landmark", student.nearestLandmark),
      ].join("");
      const permanentSame = !!student.sameAsPresentAddress;
      const permanentAddress = permanentSame
        ? presentAddress
        : [
            field("Ward / Colony / Village", student.permanentAddress),
            field("Post Office", student.permanentPostOffice),
            field("Police Station", student.permanentPoliceStation),
            field("State", student.permanentState),
            field("District", student.permanentDistrict),
            field("PIN Code", student.permanentPin),
            field("Nearest Landmark", student.permanentNearestLandmark),
          ].join("");
      const qualifications = (student.qualifications || []).length
        ? student.qualifications
            .map(
              (q) =>
                "<tr><td>" +
                val(q.examCourse) +
                "</td><td>" +
                val(q.collegeInstitute) +
                "</td><td>" +
                val(q.boardUniversity) +
                "</td><td>" +
                val(q.year) +
                "</td><td>" +
                val(q.percentage) +
                "</td></tr>",
            )
            .join("")
        : "<tr><td></td><td></td><td></td><td></td><td></td></tr>";
      const photo = student.photoUrl
        ? '<img class="student-photo" src="' + esc(student.photoUrl) + '" alt="Student photograph"/>'
        : '<div class="student-photo photo-placeholder"></div>';
      const logoUrl = window.location.origin + "/assets/logo.png";
      const w = window.open("", "_blank");
      if (!w) {
        setMessage("Please allow pop-ups to print the student form.");
        return;
      }
      const html =
        '<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Student Registration Form - ' +
        val(student.applicantName) +
        "</title><style>" +
        "@page{size:A4 portrait;margin:5mm}" +
        "*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}" +
        "body{font-size:8pt;line-height:1.2;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
        ".sheet{width:200mm;max-width:100%;min-height:287mm;margin:0 auto;background:#fff;padding:0}" +
        ".header{display:grid;grid-template-columns:23mm minmax(0,1fr);gap:3mm;align-items:center;padding:.5mm 1mm 1.5mm;border-bottom:.8mm solid #111;margin-bottom:1.5mm}" +
        ".logo{display:block;width:20mm;height:18mm;object-fit:contain;object-position:center;background:#fff}" +
        '.heading{text-align:center;min-width:0;color:#159bd5}.heading h1{margin:0;font:700 20pt/1.08 Georgia,"Times New Roman",serif;letter-spacing:.01em}.heading p{margin:2.5mm 0 0;font:700 10pt/1.2 Arial,sans-serif}' +
        '.section{margin:0 0 1.5mm;break-inside:avoid;page-break-inside:avoid}.section-title{margin:0 0 .8mm;padding:1mm 2.5mm;background:#8493bd;color:#fff;font:700 11pt/1.2 Georgia,"Times New Roman",serif}' +
        ".office-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm 5mm;padding:0 3mm}.field{display:grid;grid-template-columns:minmax(26mm,auto) minmax(0,1fr);gap:2mm;align-items:end;min-width:0;min-height:5mm}.label{font-weight:700;color:#222}.value{min-width:0;min-height:3.5mm;border-bottom:1px solid #777;padding:0 1mm;overflow-wrap:anywhere;white-space:pre-wrap}" +
        ".applicant{display:grid;grid-template-columns:minmax(0,1fr) 30mm;gap:3mm;padding:.5mm 2mm}.applicant-fields{display:grid;grid-template-columns:1fr 1fr;gap:2mm 5mm;align-content:start}.applicant-fields .field:first-child,.applicant-fields .field:nth-child(2){grid-column:1/-1}.student-photo{width:28mm;height:31mm;display:block;object-fit:cover;border:1px solid #333;background:#fff}.photo-placeholder{background:#fff}" +
        '.address-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm;padding:0 2mm}.address-box{border:1.1mm solid #8493BD;padding:1mm 1.5mm;min-width:0;break-inside:avoid}.address-box h3{margin:0 0 2mm;color:#1700b5;font:bold 10pt Georgia,"Times New Roman",serif}.address-box .field{grid-template-columns:29mm minmax(0,1fr);min-height:4.5mm;font-size:7pt}.address-box .value{min-height:4mm}' +
        ".contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:1mm 4mm;padding:0 2mm}.contact-grid .field{grid-template-columns:34mm minmax(0,1fr)}" +
        "table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt}th,td{border:1px solid #9693aa;padding:1mm 1mm;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#dcecff;color:#111;font-weight:700}tbody td{background:#c5e2fa;min-height:10mm}" +
        ".enclosures{display:flex;flex-wrap:wrap;gap:2mm 5mm;padding:.5mm 2mm}.check{display:inline-flex;align-items:center;gap:2mm}.square{width:4mm;height:4mm;border:1px solid #a8a6b3;display:inline-flex;align-items:center;justify-content:center;font-weight:700}" +
        ".footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7mm;padding:2mm 3mm 0;text-align:center;break-inside:avoid}.signature-area{min-width:0}.signature-area .line{height:7mm;border-bottom:1px solid #9f9ea6;display:flex;align-items:flex-end;justify-content:center}.signature-area img{max-width:90%;max-height:11mm;object-fit:contain}.signature-area b{display:block;margin-top:2mm;font-size:9pt;font-weight:700}" +
        "@media screen{body{padding:8mm;background:#edf1f6}.sheet{padding:6mm;background:#fff;box-shadow:0 2px 12px #0002}}" +
        "@media print{html,body{width:100%;height:auto;min-height:0;margin:0!important;padding:0!important;overflow:visible!important}.sheet{width:100%;height:auto;min-height:0;max-width:none;margin:0;padding:0;display:block;overflow:visible}.header{display:grid;grid-template-columns:34mm minmax(0,1fr);gap:5mm;align-items:center;padding:1mm 2mm 3mm;margin:0 0 3mm;break-inside:avoid;page-break-inside:avoid}.logo{display:block;width:32mm;height:30mm;max-width:100%;max-height:30mm;object-fit:contain;object-position:center;background:#fff;overflow:visible}.heading h1{font-size:21pt;line-height:1.12}.heading p{font-size:10pt;line-height:1.25;margin-top:2mm}.section{display:block;flex:none;height:auto;min-height:0;margin:0 0 3mm;padding:0;break-inside:auto;page-break-inside:auto}.section-title{font-size:10pt;line-height:1.2;padding:1.5mm 3mm;margin:0 0 2mm}.office-grid,.applicant,.address-grid,.contact-grid,.section table,.enclosures{flex:none;min-height:0;height:auto}.office-grid{gap:2.5mm 4mm;align-content:start}.field{min-height:6mm;grid-template-columns:minmax(29mm,auto) minmax(0,1fr);gap:1.5mm;font-size:7.5pt;align-items:end}.value{min-height:4.5mm;line-height:1.15;overflow-wrap:anywhere}.applicant{grid-template-columns:minmax(0,1fr) 34mm;gap:4mm;padding:1mm 2mm;align-items:start}.applicant-fields{gap:2mm 4mm;align-content:start}.student-photo{width:32mm;height:38mm;max-width:100%;object-fit:cover;align-self:start}.address-grid{gap:3mm;align-items:start}.address-box{display:block;height:auto;min-height:0;padding:2mm;break-inside:avoid;page-break-inside:avoid}.address-box h3{font-size:9pt;margin:0 0 1.5mm}.address-box .field{grid-template-columns:29mm minmax(0,1fr);min-height:5.5mm;font-size:7pt}.address-box .value{min-height:4mm}.contact-grid{gap:1.5mm 4mm;align-content:start}.contact-grid .field{grid-template-columns:34mm minmax(0,1fr)}table{font-size:7.5pt;break-inside:auto}th,td{padding:1.8mm 1.5mm;line-height:1.2}tbody td{height:10mm;min-height:0}.section table tr{break-inside:avoid;page-break-inside:avoid}.enclosures{gap:2.5mm 5mm;align-content:start;padding:1mm 2mm;font-size:7.5pt}.square{width:4mm;height:4mm;flex:0 0 4mm}.footer{display:grid;flex:none;grid-template-columns:1fr 1fr 1fr;gap:8mm;padding:3mm 3mm 0;margin:3mm 0 0;break-inside:avoid;page-break-inside:avoid}.signature-area .line{height:10mm}.signature-area b{font-size:8pt;margin-top:1.5mm}.signature-area img{max-width:90%;max-height:8mm;object-fit:contain}}" +
        "@media(max-width:700px){.office-grid{grid-template-columns:1fr 1fr}.address-grid{grid-template-columns:1fr}.applicant{grid-template-columns:minmax(0,1fr) 30mm}.student-photo{width:28mm;height:34mm}.heading h1{font-size:12pt}.heading p{font-size:8pt}}" +
        '</style></head><body><main class="sheet">' +
        '<header class="header"><img class="logo" src="' +
        esc(logoUrl) +
        '" alt="RCLD logo"/><div class="heading"><h1>RASHTRIYA COMPUTER LITERACY DRIVE</h1><p>STUDENT REGISTRATION FORM. RCLD ISLAMPUR</p></div></header>' +
        '<section class="section"><h2 class="section-title">Office / Registration Details</h2><div class="office-grid">' +
        field("AEC Code", student.aecCode || "RCLD/ISL-001") +
        field("Enrollment Number", student.enrollmentNo) +
        field("Registration Number", student.regnNo) +
        field("Registration Date", date(student.admissionDate || student.createdAt)) +
        field("Form Number", student.formNo) +
        field(
          "Course / Course Code",
          [student.courseName, student.courseCode].filter(Boolean).join(" / "),
        ) +
        "</div></section>" +
        '<section class="section"><h2 class="section-title">Applicant Details</h2><div class="applicant"><div class="applicant-fields">' +
        field("Student Name", student.applicantName) +
        field("Father / Mother / Husband Name", student.fatherOrHusbandName) +
        field("Date of Birth", date(student.dateOfBirth)) +
        field(
          "Gender / Sex",
          student.sex === "M" ? "Male" : student.sex === "F" ? "Female" : student.sex,
        ) +
        field("Nationality", student.nationality) +
        "</div>" +
        photo +
        "</div></section>" +
        '<section class="section"><h2 class="section-title">Address Details</h2><div class="address-grid"><div class="address-box"><h3>Present Address</h3>' +
        presentAddress +
        '</div><div class="address-box"><h3>Permanent Address</h3>' +
        permanentAddress +
        "</div></div></section>" +
        '<section class="section"><h2 class="section-title">Contact Details</h2><div class="contact-grid">' +
        field("Student Mobile Number", student.mobileNumber) +
        field("Guardian Mobile Number", student.guardianContactNumber) +
        field("WhatsApp Number", student.whatsappNumber) +
        field("Email Address", student.email) +
        field("Aadhaar Number", "[Aadhaar Redacted]") +
        "</div></section>" +
        '<section class="section"><h2 class="section-title">Qualification Details</h2><table><thead><tr><th>Class / Semester / Course</th><th>Institute / School / College</th><th>Board / Council / University</th><th>Year</th><th>Percentage of Marks</th></tr></thead><tbody>' +
        qualifications +
        "</tbody></table></section>" +
        '<section class="section"><h2 class="section-title">Enclosure</h2><div class="enclosures"><span class="check"><i class="square">' +
        (student.enclosures?.stampPhoto ? "✓" : "") +
        '</i> Passport Size Photograph</span><span class="check"><i class="square">' +
        (student.enclosures?.qualifyingCertificates ? "✓" : "") +
        '</i> Aadhaar / Qualifying Certificates</span><span class="check"><i class="square">' +
        (student.enclosures?.matricAdmitCard ? "✓" : "") +
        "</i> Admit Card / Registration Details</span></div></section>" +
        '<footer class="footer"><div class="signature-area"><div class="line">' +
        (student.declarationDate ? "<span>" + val(date(student.declarationDate)) + "</span>" : "") +
        '</div><b>Date</b></div><div class="signature-area"><div class="line">' +
        val(student.declarationPlace) +
        '</div><b>Place</b></div><div class="signature-area"><div class="line">' +
        (student.signatureUrl
          ? '<img src="' + esc(student.signatureUrl) + '" alt="Student signature"/>'
          : "") +
        "</div><b>Student Signature</b></div></footer>" +
        '</main><script>window.addEventListener("load",()=>{const imgs=[...document.images];Promise.all(imgs.map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>setTimeout(()=>window.print(),250));});</script></body></html>';
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  
    function printBill(selectedPayment = null) {
      if (!student || !fee) return;
      const esc = (v) =>
        String(v ?? "").replace(
          /[&<>"']/g,
          (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
        );
      const num = (v) => Number(v || 0);
      const money = (v) => "₹" + num(v).toLocaleString("en-IN");
      const payments = (fee.payments || [])
        .slice()
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
      const payment = selectedPayment || payments[payments.length - 1] || null;
      const courseFee = num(fee.totalFee),
        discount = num(fee.discount),
        admissionFee = num(fee.admissionFee),
        registrationFee = num(fee.registrationFee),
        lateFine = num(fee.lateFine);
      const payable = Math.max(
        0,
        num(fee.payable ?? courseFee - discount + admissionFee + registrationFee + lateFine),
      );
      const paid = num(fee.paid ?? payments.reduce((sum, p) => sum + num(p.amount), 0));
      const due = Math.max(0, num(fee.due ?? payable - paid));
      const formatDate = (v) =>
        v ? new Date(String(v).slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB") : "—";
      const course = courses.find(
        (x) => String(x.code || "").toUpperCase() === String(student.courseCode || "").toUpperCase(),
      );
      const duration = student.courseDuration || course?.duration || course?.durationText || "";
      const dateKey = String(payment?.date || new Date().toISOString().slice(0, 10)).replace(
        /\D/g,
        "",
      );
      const idKey = String(payment?._id || student.enrollmentNo || student._id || "")
        .replace(/[^a-z0-9]/gi, "")
        .slice(-6)
        .toUpperCase();
      const receiptNo = payment?.receiptNo || `RCLD/${dateKey}/${idKey || "PENDING"}`;
      const noteItems = String(payment?.note || "").match(/Fee sections: (.*)$/)?.[1];
      const parsedNoteItems = noteItems
        ? noteItems
            .split(/;\s*/)
            .map((part) => {
              const match = part.match(/^(.*?):\s*₹([\d,.]+)(?:\s*\((.*?)\))?$/);
              return match
                ? {
                    purpose: match[1],
                    amount: Number(match[2].replace(/,/g, "")),
                    installmentMonth: match[3] || "",
                  }
                : null;
            })
            .filter(Boolean)
        : [];
      const items =
        Array.isArray(payment?.items) && payment.items.length
          ? payment.items
          : parsedNoteItems.length
            ? parsedNoteItems
            : [
                {
                  purpose: payment?.paymentType || "Payment",
                  amount: payment?.amount,
                  installmentMonth: payment?.installmentMonth || "",
                },
              ];
      const itemRows = items
        .map(
          (item) =>
            `<tr><td>${esc(item.purpose || "")}</td><td>${esc(item.installmentMonth || "—")}</td><td class="right">${esc(money(item.amount))}</td></tr>`,
        )
        .join("");
      const type = String(
        payment?.paymentType || (items.length > 1 ? "Multiple Sections" : items[0]?.purpose) || "Payment",
      );
      const reference = payment?.utrNumber || payment?.reference || "—";
      const logoUrl = window.location.origin + "/assets/logo.png";
      const w = window.open("", "_blank");
      if (!w) {
        setMessage("Please allow pop-ups to print the fee receipt.");
        return;
      }
      const studentFields = [
        ["Student Name", student.applicantName],
        ["Father's / Guardian's Name", student.fatherName || student.guardianName],
        ["Enrolment No.", student.enrollmentNo || student.regnNo],
        ["Enrolment Date", formatDate(student.admissionDate || student.createdAt)],
        ["Course Name", student.courseName || student.courseCode],
        ["Course Code", student.courseCode],
        ["Course Duration", duration],
        ["Mobile No.", student.mobile || student.mobileNumber || student.phone],
        ["Email", student.email],
        ["Date of Birth", formatDate(student.dob || student.dateOfBirth)],
        ["Gender", student.gender],
        ["Address", student.address || student.presentAddress],
      ];
      const fieldHtml = studentFields
        .map(([label, value]) => `<div class="field"><b>${esc(label)}</b><span>${esc(value || "")}</span></div>`)
        .join("");
      const feeRows = [
        ["Course Fee", courseFee],
        ["Discount", discount],
        ["Admission Fee", admissionFee],
        ["Registration Fee", registrationFee],
        ["Late Fine", lateFine],
        ["Total Fee Payable", payable],
      ];
      const feeHtml = feeRows
        .map(
          ([label, value], i) =>
            `<div class="fee-row ${i === feeRows.length - 1 ? "grand" : ""}"><span>${esc(label)}</span><strong>${esc(money(value))}</strong></div>`,
        )
        .join("");
      const css = `
        @page{size:A5 landscape;margin:3.5mm}
        *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#17345e;font-family:Arial,Helvetica,sans-serif}
        body{font-size:7pt;line-height:1.12;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .receipt{width:203mm;height:140mm;margin:auto;padding:2.2mm;border:1px solid #173b78;display:flex;flex-direction:column;gap:1.4mm;overflow:hidden}
        .header{display:grid;grid-template-columns:17mm 1fr 39mm;align-items:center;border-bottom:1.4px solid #173b78;padding-bottom:1.2mm}.logo{width:15mm;height:13mm;object-fit:contain}.heading{text-align:center}.heading h1{font-size:13pt;margin:0;font-weight:900;letter-spacing:.02em}.heading h2{font-size:8pt;letter-spacing:.12em;margin:1mm 0 0}.receipt-meta{text-align:right;font-size:6.5pt;line-height:1.5}
        .org{display:flex;justify-content:space-between;background:#eaf2fc;border:1px solid #c6d8ed;padding:1mm 2mm;font-weight:700;font-size:6.5pt}
        .top-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:1.5mm}.panel{border:1px solid #9eb4d1;padding:1.3mm;min-width:0}.panel-title{font-weight:800;background:#173b78;color:#fff;margin:-1.3mm -1.3mm 1.2mm;padding:1mm 1.5mm;font-size:7pt;letter-spacing:.03em}
        .student-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1mm 2mm}.field{min-width:0;display:flex;flex-direction:column;gap:.3mm}.field b{font-size:5.8pt;color:#526987}.field span{min-height:3.8mm;border-bottom:.5px solid #b7c6d9;padding:.4mm 0;overflow-wrap:anywhere;white-space:normal}
        .fee-list{display:grid;grid-template-columns:1fr 1fr;column-gap:2mm}.fee-row{display:flex;justify-content:space-between;gap:1mm;padding:.7mm .5mm;border-bottom:.5px solid #e0e8f1;font-size:6.4pt}.fee-row strong{white-space:nowrap}.fee-row.grand{grid-column:1/-1;background:#eaf2fc;font-weight:900;border:0;margin-top:.5mm;padding:1mm}
        .payment-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:1mm}.payment-field{border:.5px solid #d2deeb;padding:1mm;min-width:0;min-height:7mm}.payment-field b{display:block;font-size:5.7pt;color:#526987;margin-bottom:.5mm}.payment-field strong{font-size:6.7pt;overflow-wrap:anywhere}.payment-field.received{background:#eaf2fc;border-color:#9eb4d1}
        .items-table{width:100%;border-collapse:collapse;margin-top:1mm;font-size:6.3pt}.items-table th,.items-table td{border:.5px solid #cbd8e7;padding:.7mm 1mm;text-align:left}.items-table th{background:#f0f5fb}.right{text-align:right!important}.purpose-note{margin-top:.7mm;font-size:6pt}
        .terms{border:1px solid #9eb4d1;padding:1.2mm}.terms h3{margin:0 0 .7mm;font-size:6.8pt}.terms ol{margin:0;padding-left:4mm;display:grid;grid-template-columns:1fr 1fr;gap:.6mm 4mm;font-size:5.9pt}
        .bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2mm;align-items:end;margin-top:auto}.bottom-note{font-size:5.8pt;line-height:1.3}.sign{text-align:center;padding-top:4mm}.sign strong{display:block;border-top:.7px solid #173b78;padding-top:.7mm}.auth{font-size:5.5pt;font-weight:700;margin-top:.5mm}
        @media screen{body{background:#e9eef5;padding:5mm}.receipt{box-shadow:0 4px 22px #102b5920}}
        @media print{html,body{width:203mm;height:140mm;margin:0!important;padding:0!important}.receipt{width:203mm;height:140mm;margin:0;box-shadow:none;break-after:avoid}}
      `;
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Fee Receipt - ${esc(receiptNo)}</title><style>${css}</style></head><body>
        <main class="receipt">
          <header class="header"><img class="logo" src="${esc(logoUrl)}" alt="RCLD logo"/><div class="heading"><h1>RASHTRIYA COMPUTER LITERACY DRIVE</h1><h2>STUDENT FEE RECEIPT</h2></div><div class="receipt-meta"><b>Receipt No.:</b> ${esc(receiptNo)}<br/><b>Payment Date:</b> ${esc(formatDate(payment?.date))}</div></header>
          <div class="org"><span>RCLD – ISLAMPUR</span><span>AEC Code: RCLD/ISL/001</span><span>9/15, A/9, Accheletalla, Islampur</span></div>
          <div class="top-grid"><section class="panel"><div class="panel-title">STUDENT DETAILS</div><div class="student-grid">${fieldHtml}</div></section><section class="panel"><div class="panel-title">COMPLETE FEE BREAKUP</div><div class="fee-list">${feeHtml}</div></section></div>
          <section class="panel"><div class="panel-title">PAYMENT RECEIVED — COMPLETE TRANSACTION DETAILS</div>
            <div class="payment-grid">
              <div class="payment-field received"><b>Total Amount Received</b><strong>${esc(money(payment?.amount))}</strong></div>
              <div class="payment-field"><b>Payment Section / Type</b><strong>${esc(type)}</strong></div>
              <div class="payment-field"><b>Payment Date</b><strong>${esc(formatDate(payment?.date))}</strong></div>
              <div class="payment-field"><b>Payment Method</b><strong>${esc(payment?.method || "—")}</strong></div>
              <div class="payment-field"><b>Installment Month</b><strong>${esc(payment?.installmentMonth || items.find((x) => x.installmentMonth)?.installmentMonth || "—")}</strong></div>
            </div>
            <table class="items-table"><thead><tr><th>Fee Section / Purpose</th><th>Installment Month</th><th class="right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
            <div class="purpose-note"><b>UTR / Transaction No.:</b> ${esc(payment?.utrNumber || "—")} &nbsp; | &nbsp; <b>Other Reference:</b> ${esc(payment?.reference || "—")} &nbsp; | &nbsp; <b>Purpose / Note:</b> ${esc(payment?.note || "—")} &nbsp; | &nbsp; <b>Payment Screenshot:</b> ${payment?.screenshotUrl ? "Attached" : "Not attached"}</div>
          </section>
          <section class="panel"><div class="panel-title">PAYMENT SUMMARY</div><div class="payment-grid"><div class="payment-field"><b>Total Course Fee Payable</b><strong>${esc(money(payable))}</strong></div><div class="payment-field"><b>Total Amount Paid</b><strong>${esc(money(paid))}</strong></div><div class="payment-field"><b>Amount Due</b><strong>${esc(money(due))}</strong></div><div class="payment-field"><b>Receipt Amount</b><strong>${esc(money(payment?.amount))}</strong></div><div class="payment-field"><b>Receipt No.</b><strong>${esc(receiptNo)}</strong></div></div></section>
          <section class="terms"><h3>TERMS &amp; CONDITIONS</h3><ol><li>If any fee payment or installment is made after the 10th of the month, a late fine of ₹50 will be added.</li><li>This receipt is valid only after verification by the Authorised AEC.</li><li>Fee once paid is non-refundable.</li><li>Admission fee includes nominal charges for registration, ID card, course module and certificates.</li></ol></section>
          <div class="bottom"><div class="bottom-note"><b>Payment Proof:</b> ${payment?.screenshotUrl ? `<a href="${esc(payment.screenshotUrl)}">View uploaded proof</a>` : "Not attached"}<br/><b>Reference:</b> ${esc(reference)}</div><div class="sign"><strong>Authorised Signature</strong><div class="auth">AUTHORISED AEC • RCLD – ISLAMPUR</div></div><div class="bottom-note" style="text-align:right"><b>Received:</b> ${esc(money(payment?.amount))}<br/><b>For RCLD – ISLAMPUR</b></div></div>
        </main><script>window.addEventListener("load",()=>{const imgs=[...document.images];Promise.all(imgs.map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>setTimeout(()=>window.print(),250));});</script>
      </body></html>`;
      w.document.open();
      w.document.write(html);
      w.document.close();
    }

  return { printStudentICard, printStudentForm, printBill };
}
