"use client";

import { isIcardEligible } from "@/features/students/utils/studentProfile";
import { toJpeg } from "html-to-image";
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
import { printTemplateStudentIcard } from "@/features/students/print/printTemplateStudentIcard";

export async function printStudentICard(student, setMessage, selectedSemester = "", outputMode = "print", selectedTemplate = "") {
  if (!student || !isIcardEligible(student)) {
    setMessage(
      "I-Card is unavailable until all required details are complete and admission is not pending."
    );
    return;
  }

  if (selectedTemplate) {
    await printTemplateStudentIcard({ student, templateName: selectedTemplate, outputMode, setMessage });
    return;
  }

  if (outputMode === "jpg") {
    try {
      if (!student._id) throw new Error("Student ID is missing; unable to assign an ID-card number.");
      const response = await fetch(`/api/students/${encodeURIComponent(student._id)}/icard-number`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to assign an ID-card number.");
      student = { ...student, idCardNo: String(data.idCardNo) };
    } catch (error) {
      setMessage(error?.message || "Unable to assign an ID-card number.");
      return;
    }
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

  const firstNonEmpty = (...values) => values.find((value) => value !== null && value !== undefined && String(value).trim() !== "");
  const courseText = String(firstNonEmpty(student.courseName, student.course?.name, student.courseCode, "")).trim();
  const isCFK = /coding\s*for\s*kids|\bCFK\b|\bKIDS\b/i.test(courseText);
  const semesterRaw = firstNonEmpty(student.currentSemester, student.semester, student.activeSemester, 1);
  const semesterNumber = Number(String(semesterRaw).match(/\d+/)?.[0] || 1);
  const activeSemester = isCFK
    ? `SEM ${Math.min(6, Math.max(1, semesterNumber))}`
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

  const studentName = esc(student.applicantName);
  const admissionDate = firstNonEmpty(student.admissionDate, student.dateOfAdmission, student.admissionOn, student.dateOfJoining, student.createdAt, "");
  const issueDate = formatIcardDate(admissionDate);
  const sessionLabel = esc(student.session || student.academicSession || DEFAULT_SESSION);

  const enrollRaw =
    String(firstNonEmpty(student.idCardNo, student.enrollmentNo, student.studentId, student.admissionNo, student.regnNo, student.formNo, "—")).trim();
  const idMatch = enrollRaw.match(/^(.*?)(\d+)$/);
  const idPrefix = idMatch ? esc(idMatch[1]) : esc(enrollRaw);
  const idNumber = idMatch ? esc(idMatch[2]) : "";

  const rawPhoto = firstNonEmpty(
    student.photoUrl,
    typeof student.photo === "string" ? student.photo : student.photo?.url || student.photo?.secure_url,
    typeof student.studentPhoto === "string" ? student.studentPhoto : student.studentPhoto?.url || student.studentPhoto?.secure_url,
    student.profilePhoto,
    student.imageUrl,
  );
  const photoUrl = rawPhoto ? esc(rawPhoto) : "";
  const photoImg = photoUrl
    ? `<img class="photo-img" src="${photoUrl}" alt="Student photo"/>`
    : '<div class="photo-ph">PHOTO</div>';
  const logoUrl = new URL("/assets/logo.png", window.location.origin).href;
  // Use the actual Student model fields from the registration API.
  // Prefer the present/complete address; use permanent address only as a fallback.
  const primaryAddress = firstNonEmpty(
    student.presentAddress,
    student.address,
    student.completeAddress,
    student.fullAddress,
    student.applicantAddress,
    student.permanentAddress,
    "",
  );
  const usePermanentAddress = !firstNonEmpty(
    student.presentAddress, student.address, student.completeAddress, student.fullAddress, student.applicantAddress,
  ) && Boolean(student.permanentAddress);
  const addressParts = [];
  const addAddressPart = (value, prefix = "") => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (!text) return;
    const normalized = text.toLowerCase().replace(/[.,\s]+/g, " ").trim();
    if (addressParts.some((part) => part.normalized === normalized || part.normalized.includes(normalized) || normalized.includes(part.normalized))) return;
    addressParts.push({ value: prefix ? `${prefix} ${text}` : text, normalized });
  };
  if (typeof primaryAddress === "string") {
    primaryAddress.split(/[,|\n]+/).forEach((part) => addAddressPart(part));
  }
  addAddressPart(
    usePermanentAddress ? student.permanentNearestLandmark : student.nearestLandmark,
  );
  addAddressPart(
    usePermanentAddress ? student.permanentPostOffice : student.postOffice,
    "P.O.",
  );
  if (!usePermanentAddress) addAddressPart(student.policeStation, "P.S.");
  addAddressPart(
    usePermanentAddress ? student.permanentDistrict : student.district,
    "Dist.",
  );
  addAddressPart(usePermanentAddress ? student.permanentState : student.state);
  addAddressPart(usePermanentAddress ? student.permanentPin : student.pin);
  const addrMain = addressParts.map((part) => part.value).join(", ");
  const addressLines = addressParts.map((part) => part.value);

  // CFK uses the requested 55 x 85mm stock; all other course cards retain 55 x 88mm.
  const cardHeight = isCFK ? "86.1mm" : "88mm";
  let cardMarkup = "";

  if (isCFK) {
    const templateUrl = new URL("/assets/template I card.png", window.location.origin).href;
    cardMarkup = buildCfkStudentIcardMarkup({
      student,
      photoUrl: rawPhoto || "",
      idNumber: `${idPrefix}${idNumber}`,
      issueDate,
      address: addressLines.join(", "),
      semester: activeSemester,
      courseText,
      templateUrl,
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

  const autoPrintScript = outputMode === "jpg" ? "" : `
  <script>
    window.addEventListener("load", async () => {
      await Promise.all(
        [...document.images].map((img) =>
          img.decode ? img.decode().catch(() => {}) : Promise.resolve()
        )
      );
      setTimeout(() => window.print(), 300);
    });
  </script>`;
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
  ${autoPrintScript}
</body>
</html>`;

  if (outputMode === "jpg") {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:55mm;height:${cardHeight};border:0;opacity:0;pointer-events:none;`;
    document.body.appendChild(iframe);

    try {
      await new Promise((resolve, reject) => {
        iframe.onload = resolve;
        iframe.onerror = reject;
        iframe.srcdoc = html;
      });

      const frameDocument = iframe.contentDocument;
      if (!frameDocument) throw new Error("Unable to prepare the I-Card image.");

      if (frameDocument.fonts?.ready) await frameDocument.fonts.ready;
      await Promise.all(
        [...frameDocument.images].map((img) =>
          img.decode ? img.decode().catch(() => {}) : Promise.resolve()
        )
      );

      const cardElement = frameDocument.querySelector(".cfk-template-card, .id-card, .card.std, .icard-page.cfk-card");
      if (!cardElement) throw new Error("The I-Card layout could not be found.");

      // Lock the export node to the exact physical stock dimensions.
      // 96 CSS px = 1 inch and 25.4 mm = 1 inch.
      const exportWidthPx = (55 / 25.4) * 96;
      const exportHeightPx = (Number.parseFloat(cardHeight) / 25.4) * 96;
      cardElement.style.setProperty("width", "55mm", "important");
      cardElement.style.setProperty("height", cardHeight, "important");
      cardElement.style.setProperty("min-width", "55mm", "important");
      cardElement.style.setProperty("max-width", "55mm", "important");
      cardElement.style.setProperty("min-height", cardHeight, "important");
      cardElement.style.setProperty("max-height", cardHeight, "important");
      cardElement.style.setProperty("margin", "0", "important");
      cardElement.style.setProperty("transform", "none", "important");
      cardElement.style.setProperty("overflow", "hidden", "important");
      await new Promise((resolve) => iframe.contentWindow.requestAnimationFrame(() => iframe.contentWindow.requestAnimationFrame(resolve)));

      const jpgDataUrl = await toJpeg(cardElement, {
        quality: 1,
        width: Math.ceil(exportWidthPx),
        height: Math.ceil(exportHeightPx),
        canvasWidth: Math.round(exportWidthPx * 4),
        canvasHeight: Math.round(exportHeightPx * 4),
        pixelRatio: 4,
        backgroundColor: "#FFFFFF",
        cacheBust: true,
      });
      const safeName = String(student.applicantName || "Student")
        .trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "");
      const enrollment = String(
        student.enrollmentNo || student.studentId || student.admissionNo || student.regnNo || student.formNo || ""
      ).replace(/[^a-z0-9-]+/gi, "");
      const link = document.createElement("a");
      link.href = jpgDataUrl;
      link.download = `RCLD-I-Card-${safeName || "Student"}${enrollment ? `-${enrollment}` : ""}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage("Student I-Card JPG downloaded successfully.");
    } catch (error) {
      console.error("I-Card JPG export failed:", error);
      setMessage(error?.message || "Unable to download the I-Card as JPG. Please try again.");
    } finally {
      iframe.remove();
    }
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setMessage("Please allow pop-ups to print the I-Card.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
