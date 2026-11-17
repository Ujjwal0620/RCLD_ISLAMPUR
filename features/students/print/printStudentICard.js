"use client";

import { isIcardEligible } from "@/features/students/utils/studentProfile";
import { getStudentIcardStyles } from "@/features/students/print/studentIcardStyles";
import {
  esc,
  upper,
  toTitleCase,
  formatIcardDate,
  icardIcon as icon,
  icardSignature as scribble,
} from "@/features/students/print/studentIcardHelpers";
import { buildCfkStudentIcardMarkup } from "@/features/students/print/buildCfkStudentIcardMarkup";
import { buildStandardStudentIcardMarkup } from "@/features/students/print/buildStandardStudentIcardMarkup";

export function printStudentICard(student, setMessage, selectedSemester = "") {
  if (!student || !isIcardEligible(student)) {
    setMessage(
      "I-Card is unavailable until all required details are complete and admission is not pending."
    );
    return;
  }

  // ---------- Institute and print settings ----------
  const DEFAULT_SESSION = "2025-2026";
  const AEC_LINE_1 = "AEC: CYBER WORLD, DESHBANDHU PARA, ISLAMPUR";
  const AEC_STD_1 = "AEC: CYBER WORLD, DESHBANDHUPARA, ISLAMPUR,";
  const AEC_STD_2 = "Uttar Dinajpur, West Bengal, PIN-733202";
  const CONTACT_EMAIL = "islampur.cyberworld@gmail.com";
  const CONTACT_PHONE = "9851775891";
  const CONTACT_PHONE_STD = "+91 98517 75891";
  const CONTACT_WEB = "rcldgov.in";
  // -------------------------------------------------

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

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setMessage("Please allow pop-ups to print the I-Card.");
    return;
  }

  const studentName = esc(student.applicantName);
  const admissionDate = student.admissionDate || student.createdAt || "";
  const issueDate = formatIcardDate(admissionDate);
  const sessionLabel = esc(student.session || student.academicSession || DEFAULT_SESSION);

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

  const cardHeight = isCFK ? "85mm" : "88mm";
  let cardMarkup = "";

  if (isCFK) {
    cardMarkup = buildCfkStudentIcardMarkup({
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
    });
  } else {
    cardMarkup = buildStandardStudentIcardMarkup({
      student,
      addrMain,
      idPrefix,
      idNumber,
      issueDate,
      photoImg,
      logoUrl,
      sessionLabel,
      courseText,
      esc,
      upper,
      icon,
      scribble,
      AEC_STD_1,
      AEC_STD_2,
      CONTACT_PHONE_STD,
      CONTACT_EMAIL,
      CONTACT_WEB,
    });
  }

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>RCLD Student I-Card - ${studentName}</title>
  <style>${getStudentIcardStyles(cardHeight)}</style>
</head>
<body>
  ${cardMarkup}
  <script>
    window.addEventListener("load", async () => {
      await Promise.all(
        [...document.images].map((img) =>
          img.decode ? img.decode().catch(() => {}) : Promise.resolve()
        )
      );
      setTimeout(() => window.print(), 300);
    });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
