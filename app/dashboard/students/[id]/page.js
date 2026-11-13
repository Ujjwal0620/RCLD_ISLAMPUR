"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  UserRound,
  MapPin,
  BookOpen,
  FileText,
  CreditCard,
  CalendarDays,
  ClipboardCheck,
  WalletCards,
  Save,
  Pencil,
  Trash2,
  Printer,
  ArrowRightLeft,
  UserX,
  History,
  Phone as PhoneIcon,
  IdCard,
} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import RCLDLogo from "@/components/RCLDLogo";
import indiaLocations from "@/lib/indiaStatesDistricts.json";

const value = (v) => (v === undefined || v === null || v === "" ? "—" : v);
function Detail({ label, children }) {
  return (
    <div className="student-detail-field">
      <span>{label}</span>
      <strong>{value(children)}</strong>
    </div>
  );
}

function isIcardEligible(s = {}) {
  const present = s.presentAddress || s.address;
  const permanent = s.sameAsPresentAddress
    ? Boolean(String(present || "").trim())
    : [
        "permanentAddress",
        "permanentPostOffice",
        "permanentState",
        "permanentDistrict",
        "permanentPin",
        "permanentNearestLandmark",
      ].every((k) => String(s[k] || "").trim());
  const q = Array.isArray(s.qualifications) ? s.qualifications[0] : null;
  return (
    [
      s.applicantName,
      s.fatherOrHusbandName,
      s.dateOfBirth,
      s.sex,
      s.nationality,
      s.photoUrl,
      s.photoUrl,
      present,
      s.postOffice,
      s.policeStation,
      s.state,
      s.district,
      s.pin,
      s.nearestLandmark,
      s.mobileNumber,
      s.guardianContactNumber,
      s.whatsappNumber,
      s.email,
      s.aadhaarNumber,
      q?.examCourse,
      q?.collegeInstitute,
      q?.boardUniversity,
      q?.year,
      q?.percentage,
    ].every((v) => String(v || "").trim()) &&
    permanent &&
    s.status !== "Admission Pending"
  );
}

function numberToIndianWords(input) {
  const n = Math.round(Number(input) || 0);
  if (!n) return "Zero Rupees Only";
  const one = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const ten = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const two = (x) =>
    x < 20 ? one[x] : ten[Math.floor(x / 10)] + (x % 10 ? " " + one[x % 10] : "");
  const part = (x) =>
    x > 99 ? one[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x);
  let x = n,
    out = [];
  for (const [v, label] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ])
    if (x >= v) {
      const q = Math.floor(x / v);
      out.push(part(q) + " " + label);
      x %= v;
    }
  if (x) out.push(part(x));
  return out.join(" ") + " Rupees Only";
}

function DigitBoxes({ label, value = "", onChange, length = 10 }) {
  const digits = String(value || "")
    .padEnd(length, " ")
    .slice(0, length)
    .split("");
  function updateAt(start, raw) {
    const incoming = String(raw || "")
      .replace(/\D/g, "")
      .slice(0, length - start);
    const next = digits.slice();
    if (!String(raw || "")) next[start] = " ";
    incoming.split("").forEach((d, i) => (next[start + i] = d));
    onChange(next.join("").replace(/\s+$/, ""));
  }
  return (
    <label className="form-field digit-box-field">
      <span>{label}</span>
      <div className="rcld-digit-boxes">
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            aria-label={label + " digit " + (i + 1)}
            inputMode="numeric"
            maxLength={1}
            value={digits[i] === " " ? "" : digits[i]}
            onChange={(e) => {
              updateAt(i, e.target.value.slice(-1));
              if (e.target.value && i < length - 1)
                e.currentTarget.parentElement.children[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0)
                e.currentTarget.parentElement.children[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0)
                e.currentTarget.parentElement.children[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < length - 1)
                e.currentTarget.parentElement.children[i + 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              updateAt(i, e.clipboardData.getData("text"));
              const n = e.clipboardData.getData("text").replace(/\D/g, "").length;
              e.currentTarget.parentElement.children[Math.min(length - 1, i + n)]?.focus();
            }}
          />
        ))}
      </div>
    </label>
  );
}

export default function StudentDetailsPage({ params }) {
  const [student, setStudent] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [fee, setFee] = useState(null),
    [courses, setCourses] = useState([]),
    [batches, setBatches] = useState([]),
    [referrals, setReferrals] = useState([]),
    [attendance, setAttendance] = useState({
      records: [],
      summary: { total: 0, present: 0, absent: 0, leave: 0, percentage: 0 },
    });
  const [feeForm, setFeeForm] = useState({
    totalFee: "",
    discount: "",
    admissionFee: "",
    registrationFee: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "Cash",
    reference: "",
    utrNumber: "",
    screenshotUrl: "",
    note: "",
    authorisedBy: "",
    paymentType: "Installment",
    installmentMonth: "",
  });
  const [proofUploading, setProofUploading] = useState(false);
  const [paymentItems, setPaymentItems] = useState([
    { id: "payment-item-1", type: "Admission Fee", amount: "" },
  ]);
  const paymentItemTypes = [
    "Admission Fee", "Registration Fee", "Course Fee", "Installment",
    "Late Fine", "Lab Charge", "Examination Fee", "Certificate Fee", "Other",
  ];
  function defaultPaymentItemAmount(type) {
    const paid = Number(fee?.paid || 0);
    const payable = Number(fee?.payable || 0);
    const remaining = Math.max(0, payable - paid);
    if (type === "Admission Fee") return String(Number(feeForm.admissionFee || 0));
    if (type === "Registration Fee") return String(Number(feeForm.registrationFee || 0));
    if (type === "Late Fine") return String(Number(fee?.lateFine || 0));
    if (type === "Course Fee" || type === "Installment") return String(remaining);
    return "";
  }
  function updatePaymentItem(id, patch) {
    setPaymentItems((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  function addPaymentItem() {
    setPaymentItems((items) => [...items, {
      id: "payment-item-" + Date.now() + "-" + items.length,
      type: "Lab Charge",
      amount: "",
    }]);
  }
  const paymentItemsTotal = paymentItems.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
  const [feeWorkspaceOpen, setFeeWorkspaceOpen] = useState(false);
  const [attForm, setAttForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    status: "Present",
    subject: "",
    batch: "",
    note: "",
  });
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [history, setHistory] = useState([]),
    [contactLogs, setContactLogs] = useState([]);
  const [transition, setTransition] = useState({ action: "", batchId: "", remark: "" });
  const [transitioning, setTransitioning] = useState(false);

  async function loadOperational(id) {
    const [fr, ar] = await Promise.all([
      fetch("/api/students/" + id + "/fees", { cache: "no-store" }),
      fetch("/api/students/" + id + "/attendance", { cache: "no-store" }),
    ]);
    const [fj, aj] = await Promise.all([fr.json(), ar.json()]);
    if (fr.ok) {
      setFee(fj.fee);
      setFeeForm((f) => ({
        ...f,
        totalFee: f.totalFee || fj.fee.totalFee || "",
        discount: f.discount || fj.fee.discount || "",
        admissionFee: f.admissionFee || fj.fee.admissionFee || "",
        registrationFee: f.registrationFee || fj.fee.registrationFee || "",
      }));
    }
    if (ar.ok) setAttendance(aj);
  }

  useEffect(() => {
    (async () => {
      try {
        const [courseResponse, batchResponse, referralResponse] = await Promise.all([
          fetch("/api/courses", { cache: "no-store" }),
          fetch("/api/batches", { cache: "no-store" }),
          fetch("/api/referrals", { cache: "no-store" }),
        ]);
        const [courseData, batchData, referralData] = await Promise.all([
          courseResponse.json(),
          batchResponse.json(),
          referralResponse.json(),
        ]);
        setCourses(courseData.courses || []);
        setBatches(batchData.batches || []);
        setReferrals((referralData.referrals || []).filter((x) => x.status === "Active"));
        const { id } = await params;
        const r = await fetch("/api/students/" + id, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Unable to load student.");
        setStudent(d.student);
        setEditForm(d.student);
        const hr = await fetch("/api/students/" + id + "/batch-history", { cache: "no-store" });
        const hd = await hr.json();
        if (hr.ok) setHistory(hd.history || []);
        const cr = await fetch("/api/students/" + id + "/contact-log", { cache: "no-store" });
        const cd = await cr.json();
        if (cr.ok) setContactLogs(cd.logs || []);
        if (new URLSearchParams(window.location.search).get("edit") === "1") setEditing(true);
        await loadOperational(id);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  async function saveStudent(e) {
    e.preventDefault();
    setMessage("");
    const r = await fetch("/api/students/" + student._id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        permanentAddress: editForm.sameAsPresentAddress
          ? editForm.presentAddress || editForm.address || ""
          : editForm.permanentAddress,
      }),
    });
    const d = await r.json();
    if (!r.ok) return setMessage(d.error || "Unable to update student.");
    const fr = await fetch("/api/students/" + student._id + "/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalFee: feeForm.totalFee,
        discount: feeForm.discount || 0,
        admissionFee: feeForm.admissionFee,
        registrationFee: feeForm.registrationFee,
        admissionDate: student.admissionDate,
      }),
    });
    const fd = await fr.json();
    if (!fr.ok) return setMessage(fd.error || "Student saved, but fee mapping failed.");
    setFee(fd.fee);
    setStudent(d.student);
    setEditForm(d.student);
    setEditing(false);
    setMessage("Student profile and course fee mapping updated successfully.");
  }
  async function deleteStudent() {
    if (!confirm("Permanently delete this student from the database? This cannot be undone."))
      return;
    const r = await fetch("/api/students/" + student._id, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return setMessage(d.error || "Unable to archive student.");
    window.location.href = "/dashboard/students";
  }
  async function saveFees(e) {
    e.preventDefault();
    setMessage("");
    if (!student) return;
    const r = await fetch("/api/students/" + student._id + "/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalFee: feeForm.totalFee,
        discount: feeForm.discount,
        admissionFee: feeForm.admissionFee,
        registrationFee: feeForm.registrationFee,
        admissionDate: student.admissionDate,
        payment: paymentItems.some((item) => Number(item.amount) > 0)
          ? {
              amount: paymentItemsTotal,
              items: paymentItems.filter((item) => Number(item.amount) > 0).map(({ type, amount }) => ({
                type, amount: Number(amount),
              })),
              date: feeForm.date,
              method: feeForm.method,
              reference: feeForm.reference,
              utrNumber: feeForm.utrNumber,
              screenshotUrl: feeForm.screenshotUrl,
              note: feeForm.note,
              paymentType: paymentItems.map((item) => item.type).filter(Boolean).join(", "),
              installmentMonth: feeForm.installmentMonth,
              authorisedBy: feeForm.authorisedBy,
            }
          : undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error || "Unable to save fees.");
      return;
    }
    setFee(d.fee);
    setFeeForm((f) => ({
      ...f,
      amount: "",
      reference: "",
      utrNumber: "",
      screenshotUrl: "",
      note: "",
    }));
    setPaymentItems([{ id: "payment-item-" + Date.now(), type: "Admission Fee", amount: "" }]);
    setMessage("Fee information saved.");
  }
  async function uploadPaymentProof(file) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "payment-proof");
      const r = await fetch("/api/uploads/student-photo", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to upload screenshot.");
      setFeeForm((f) => ({ ...f, screenshotUrl: d.url }));
    } catch (e) {
      setMessage(e.message);
    } finally {
      setProofUploading(false);
    }
  }

  function printStudentICard() {
    if (!student || !isIcardEligible(student)) {
      setMessage(
        "I-Card is unavailable until all required details are complete and admission is not pending.",
      );
      return;
    }
    const esc = (v) =>
      String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const w = window.open("", "_blank");
    if (!w) {
      setMessage("Please allow pop-ups to print the I-Card.");
      return;
    }
    const photo = student.photoUrl
      ? '<img class="photo" src="' + esc(student.photoUrl) + '" alt="Student photo"/>'
      : '<div class="photo"></div>';
    w.document.write(
      '<!doctype html><html><head><title>RCLD Student I-Card</title><style>@page{size:85.6mm 54mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.card{width:85.6mm;height:54mm;padding:3mm;border:1px solid #173c73;color:#173c73;position:relative;overflow:hidden}.head{display:flex;align-items:center;gap:2mm;border-bottom:1px solid #173c73;padding-bottom:1.5mm}.logo{width:11mm;height:11mm;object-fit:contain}.brand{text-align:center;flex:1}.brand b{display:block;font-size:10pt}.brand small{font-size:6pt}.body{display:flex;gap:3mm;padding-top:2mm}.photo{width:20mm;height:25mm;object-fit:cover;border:1px solid #173c73}.details{font-size:6.5pt;line-height:1.55;flex:1}.details b{display:block;font-size:8pt;margin-bottom:1mm}.footer{position:absolute;bottom:2mm;left:3mm;right:3mm;border-top:1px solid #aaa;padding-top:1mm;font-size:5.5pt;display:flex;justify-content:space-between}</style></head><body><article class="card"><header class="head"><img class="logo" src="/assets/logo.png"/><div class="brand"><b>RCLD – ISLAMPUR</b><small>RASHTRIYA COMPUTER LITERACY DRIVE</small></div></header><div class="body">' +
        photo +
        '<div class="details"><b>' +
        esc(student.applicantName) +
        "</b>Enrollment: " +
        esc(student.enrollmentNo || "—") +
        "<br/>Course: " +
        esc(student.courseName || student.courseCode || "—") +
        "<br/>Batch: " +
        esc(student.batchCode || "Not assigned") +
        "<br/>Mobile: " +
        esc(student.mobileNumber) +
        "<br/>DOB: " +
        esc(student.dateOfBirth) +
        '</div></div><footer class="footer"><span>Authorized Signatory</span><span>Student Identity Card</span></footer></article><script>window.onload=()=>Promise.all([...document.images].map(i=>i.decode?.().catch(()=>{})||Promise.resolve())).then(()=>window.print())</script></body></html>',
    );
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
      field("Aadhaar Number", student.aadhaarNumber) +
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
    const esc = (v) => String(v ?? "—").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
    const num = (v) => Number(v || 0);
    const money = (v) => "₹" + num(v).toLocaleString("en-IN");
    const payments = (fee.payments || []).slice().sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || "")));
    const payment = selectedPayment || payments[payments.length - 1] || null;
    const courseFee = num(fee.totalFee);
    const discount = num(fee.discount);
    const admissionFee = num(fee.admissionFee);
    const registrationFee = num(fee.registrationFee);
    const lateFine = num(fee.lateFine);
    const payable = Math.max(0, num(fee.payable ?? (courseFee - discount + admissionFee + registrationFee + lateFine)));
    const paid = num(fee.paid ?? payments.reduce((sum, p) => sum + num(p.amount), 0));
    const due = Math.max(0, num(fee.due ?? payable - paid));
    const formatDate = (v) => v ? new Date(String(v).slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB") : "—";
    const course = courses.find((x) => String(x.code || "").toUpperCase() === String(student.courseCode || "").toUpperCase());
    const duration = student.courseDuration || course?.duration || course?.durationText || "—";
    const dateKey = String(payment?.date || new Date().toISOString().slice(0, 10)).replace(/\D/g, "");
    const idKey = String(payment?._id || student.enrollmentNo || student._id || "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
    const receiptNo = payment?.receiptNo || `RCLD/${dateKey}/${idKey || "PENDING"}`;
    const amount = num(payment?.amount);
    const items = Array.isArray(payment?.items) && payment.items.length
      ? payment.items
      : [{ type: payment?.paymentType || "Fee Payment", amount }];
    const type = String(payment?.paymentType || "Payment").trim();
    const purpose = String(payment?.purpose || payment?.paymentPurpose || payment?.note || "—").trim();
    const reference = payment?.utrNumber || payment?.reference || "—";
    const itemRows = items.map((item, index) =>
      `<tr><td>${index + 1}</td><td>${esc(item.type || "Fee Payment")}</td><td class="right">${esc(money(item.amount))}</td></tr>`
    ).join("");
    const paymentMeta = [
      ["Payment Date", formatDate(payment?.date)],
      ["Payment Method", payment?.method || "—"],
      ["UTR Number", payment?.utrNumber || "—"],
      ["Other Reference", payment?.reference || "—"],
      ["Installment Month", payment?.installmentMonth || "—"],
      ["Recorded By", payment?.recordedBy || "—"],
      ["Authorised By", payment?.authorisedBy || "—"],
      ["Receipt Number", receiptNo],
    ];
    const logoUrl = window.location.origin + "/assets/logo.png";
    const w = window.open("", "_blank");
    if (!w) { setMessage("Please allow pop-ups to print the fee receipt."); return; }
    const studentFields = [
      ["Student Name", student.applicantName], ["Father's / Guardian's Name", student.fatherName || student.guardianName],
      ["Enrolment No.", student.enrollmentNo || student.regnNo], ["Enrolment Date", formatDate(student.admissionDate || student.createdAt)],
      ["Course Name", student.courseName || student.courseCode], ["Course Code", student.courseCode],
      ["Course Duration", duration], ["Mobile No.", student.mobile || student.mobileNumber || student.phone],
      ["Email", student.email], ["Date of Birth", formatDate(student.dob || student.dateOfBirth)],
      ["Gender", student.gender], ["Address", student.address || student.presentAddress],
    ];
    const fieldHtml = studentFields.map(([label, value]) =>
      `<div class="field"><b>${esc(label)}</b><span>${esc(value || "")}</span></div>`).join("");
    const feeRows = [
      ["Course Fee", courseFee], ["Discount", discount], ["Admission Fee", admissionFee],
      ["Registration Fee", registrationFee], ["Late Fine (if applicable)", lateFine],
      ["Total Fee Payable", payable],
    ];
    const feeHtml = feeRows.map(([label, value], i) =>
      `<div class="fee-row ${i === feeRows.length - 1 ? "grand" : ""}"><span>${esc(label)}</span><strong>${esc(money(value))}</strong></div>`).join("");
    const css = `
      @page{size:A5 portrait;margin:4mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#17345e;font-family:Arial,Helvetica,sans-serif}
      body{font-size:6.4pt;line-height:1.16;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .receipt{width:140mm;min-height:202mm;margin:auto;padding:3mm;border:1px solid #173b78;display:flex;flex-direction:column;gap:1.5mm}
      .header{display:grid;grid-template-columns:16mm 1fr 30mm;align-items:center;border-bottom:1.4px solid #173b78;padding-bottom:1.5mm}
      .logo{width:14mm;height:13mm;object-fit:contain}.heading{text-align:center}.heading h1{font-size:10pt;margin:0;font-weight:900;letter-spacing:.01em}.heading h2{font-size:8pt;letter-spacing:.1em;margin:1mm 0 0}
      .receipt-meta{text-align:right;font-size:5.8pt;line-height:1.45}.org{display:flex;justify-content:space-between;gap:1mm;background:#eaf2fc;border:1px solid #c6d8ed;padding:1mm 1.5mm;font-weight:700;font-size:5.6pt}
      .top-grid{display:grid;grid-template-columns:1.35fr .9fr;gap:1.5mm}.panel{border:1px solid #9eb4d1;padding:1.5mm;min-width:0}.panel-title{font-weight:800;background:#173b78;color:#fff;margin:-1.5mm -1.5mm 1.3mm;padding:1mm 1.5mm;font-size:6.2pt;letter-spacing:.025em}
      .student-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1mm 2mm}.field{min-width:0;display:flex;flex-direction:column;gap:.3mm}.field b{font-size:5.2pt;color:#526987}.field span{min-height:3.5mm;border-bottom:.5px solid #b7c6d9;padding:.3mm 0;overflow-wrap:anywhere}
      .fee-list{display:grid;gap:0}.fee-row{display:flex;justify-content:space-between;gap:2mm;padding:.7mm .5mm;border-bottom:.5px solid #e0e8f1}.fee-row strong{white-space:nowrap}.fee-row.grand{background:#eaf2fc;font-weight:900;border:0;margin-top:.5mm;padding:1mm}
      .payment-items{width:100%;border-collapse:collapse;font-size:5.8pt}.payment-items th,.payment-items td{border:.5px solid #c8d5e5;padding:.7mm 1mm;text-align:left}.payment-items th{background:#f0f5fb}.payment-items .right{text-align:right}.payment-items tfoot td{font-weight:900;background:#eaf2fc}
      .payment-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1mm;margin-top:1mm}.payment-field{border:.5px solid #d2deeb;padding:1mm;min-width:0;overflow-wrap:anywhere}.payment-field b{display:block;font-size:5pt;color:#526987;margin-bottom:.4mm}.payment-field strong{font-size:5.7pt;font-weight:700}.payment-field.received{background:#eaf2fc;border-color:#9eb4d1}
      .purpose{margin-top:1mm;border:.5px solid #d2deeb;padding:1mm;overflow-wrap:anywhere}.purpose b{margin-right:1mm}
      .terms{border:1px solid #9eb4d1;padding:1.3mm}.terms h3{margin:0 0 .7mm;font-size:6pt}.terms ol{margin:0;padding-left:3.5mm;display:grid;grid-template-columns:1fr 1fr;gap:.5mm 3mm;font-size:5.1pt}
      .bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2mm;align-items:end;margin-top:auto}.bottom-note{font-size:5.4pt;line-height:1.35;overflow-wrap:anywhere}.sign{text-align:center;padding-top:6mm}.sign strong{display:block;border-top:1px solid #173b78;padding-top:1mm}.auth{font-size:5pt;font-weight:700;margin-top:.5mm}
      .footer{display:flex;justify-content:space-between;gap:2mm;border-top:1px solid #9eb4d1;padding-top:1mm;font-size:5.2pt}.proof{color:#173b78}
      @media screen{body{background:#e9eef5;padding:5mm}.receipt{box-shadow:0 3px 14px #102b5920}}
      @media print{html,body{width:148mm;height:210mm;margin:0!important;padding:0!important}.receipt{width:140mm;min-height:202mm;height:202mm;margin:0;box-shadow:none;break-after:avoid;page-break-after:avoid}}
    `;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Fee Receipt - ${esc(receiptNo)}</title><style>${css}</style></head><body>
      <main class="receipt">
        <header class="header"><img class="logo" src="${esc(logoUrl)}" alt="RCLD logo"/><div class="heading"><h1>RASHTRIYA COMPUTER LITERACY DRIVE</h1><h2>STUDENT FEE RECEIPT</h2></div><div class="receipt-meta"><b>Receipt No.:</b> ${esc(receiptNo)}<br/><b>Payment Date:</b> ${esc(formatDate(payment?.date))}</div></header>
        <div class="org"><span>RCLD – ISLAMPUR</span><span>AEC Code: RCLD/ISL/001</span><span>9/15, A/9, Accheletalla, Islampur</span></div>
        <div class="top-grid">
          <section class="panel"><div class="panel-title">STUDENT DETAILS</div><div class="student-grid">${fieldHtml}</div></section>
          <section class="panel"><div class="panel-title">COMPLETE FEE BREAKUP</div><div class="fee-list">${feeHtml}</div></section>
        </div>
        <section class="panel"><div class="panel-title">PAYMENT RECEIVED — ITEMISED DETAILS</div>
          <table class="payment-items"><thead><tr><th style="width:8%">#</th><th>Fee Head / Particulars</th><th class="right">Amount</th></tr></thead>
            <tbody>${itemRows}</tbody><tfoot><tr><td colspan="2">TOTAL AMOUNT RECEIVED</td><td class="right">${esc(money(amount))}</td></tr></tfoot>
          </table>
          <div class="payment-meta">
            ${paymentMeta.map(([label, value], index) => `<div class="payment-field ${index === 0 ? "received" : ""}"><b>${esc(label)}</b><strong>${esc(value)}</strong></div>`).join("")}
          </div>
          <div class="purpose"><b>Payment Purpose / Note:</b>${esc(purpose)}</div>
          <div class="purpose"><b>Payment Proof:</b>${payment?.screenshotUrl ? `<a class="proof" href="${esc(payment.screenshotUrl)}">View attached proof</a>` : "Not attached"}</div>
        </section>
        <section class="panel"><div class="panel-title">PAYMENT SUMMARY</div><div class="payment-meta">
          <div class="payment-field"><b>Total Course Fee Payable</b><strong>${esc(money(payable))}</strong></div>
          <div class="payment-field"><b>Total Amount Paid</b><strong>${esc(money(paid))}</strong></div>
          <div class="payment-field"><b>Amount Due</b><strong>${esc(money(due))}</strong></div>
          <div class="payment-field"><b>Transaction / UTR Reference</b><strong>${esc(reference)}</strong></div>
        </div></section>
        <section class="terms"><h3>TERMS &amp; CONDITIONS</h3><ol>
          <li>If any fee payment or installment is made after the 10th of the month, a late fine of ₹50 will be added.</li>
          <li>This receipt is valid only after verification by the Authorised AEC.</li>
          <li>Fee once paid is non-refundable.</li>
          <li>Admission fee includes nominal charges for registration, ID card, course module and certificates.</li>
        </ol></section>
        <div class="bottom"><div class="bottom-note"><b>Transaction / Reference:</b> ${esc(reference)}<br/>${payment?.screenshotUrl ? `<a class="proof" href="${esc(payment.screenshotUrl)}">Payment proof attached</a>` : " "}</div><div class="sign"><strong>Authorised Signature</strong><div class="auth">AUTHORISED AEC • RCLD – ISLAMPUR</div></div><div class="bottom-note" style="text-align:right"><b>Amount Received:</b> ${esc(money(amount))}<br/><b>For RCLD – ISLAMPUR</b></div></div>
      </main><script>window.addEventListener("load",()=>{const imgs=[...document.images];Promise.all(imgs.map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>setTimeout(()=>window.print(),250));});</script>
    </body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  }
  async function saveAttendance(e) {
    e.preventDefault();
    setMessage("");
    if (!student) return;
    const r = await fetch("/api/students/" + student._id + "/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attForm),
    });
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.error || "Unable to save attendance.");
      return;
    }
    const ar = await fetch("/api/students/" + student._id + "/attendance", { cache: "no-store" });
    setAttendance(await ar.json());
    setMessage("Attendance saved.");
  }

  return (
    <ERPLayout active="/dashboard/students">
      <header className="topbar">
        <div>
          <div className="crumb">Students / Student Details</div>
          <h1>{student?.applicantName || "Student Details"}</h1>
        </div>
        <div className="top-actions">
          {student && (
            <>
              <button className="ghost-btn" onClick={printStudentForm}>
                <Printer size={16} /> Print Registration Form
              </button>
              <button
                className="ghost-btn"
                onClick={printStudentICard}
                disabled={!isIcardEligible(student)}
                title={
                  !isIcardEligible(student)
                    ? "Complete all required details and clear Admission Pending status first"
                    : "Print student I-Card"
                }
              >
                <IdCard size={16} /> Print I-Card
              </button>
              <button className="ghost-btn" onClick={printBill}>
                <Printer size={16} /> Print Fee Receipt
              </button>
              <button className="ghost-btn" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Edit
              </button>
              <button className="ghost-btn" onClick={deleteStudent}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
          <a className="ghost-btn" href="/dashboard/students">
            <ArrowLeft size={17} /> Back
          </a>
        </div>
      </header>
      {loading && (
        <section className="panel">
          <div className="empty">Loading student details…</div>
        </section>
      )}
      {error && (
        <section className="panel">
          <div className="empty error-text">{error}</div>
        </section>
      )}
      {student && (
        <main className="student-details student-profile-page">
          {editing && (
            <section className="detail-section student-edit-panel">
              <div className="detail-section-title">
                <Pencil size={17} />
                <div>
                  <h3>Edit Student Profile</h3>
                  <span>
                    Complete student master data. Imported Excel values are preserved; synthetic
                    values are marked as demo data in the source import.
                  </span>
                </div>
              </div>
              <form onSubmit={saveStudent}>
                <div className="student-edit-grid">
                  <div className="edit-card">
                    <h4>Identity & Registration</h4>
                    <div className="form-grid two">
                      {[
                        ["formNo", "Form No."],
                        ["enrollmentNo", "Enrollment No."],
                        ["applicantName", "Applicant Name"],
                        ["aecCode", "AEC Code"],
                        ["regnNo", "Registration No."],
                        ["admissionDate", "Admission Date"],
                      ].map(([k, l]) => (
                        <label className="form-field" key={k}>
                          <span>{l}</span>
                          <input
                            type={k === "admissionDate" ? "date" : "text"}
                            value={editForm[k] || ""}
                            readOnly={["formNo", "enrollmentNo", "aecCode"].includes(k)}
                            onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="edit-card">
                    <h4>Course & Fee</h4>
                    <div className="form-grid two">
                      <label className="form-field">
                        <span>Course</span>
                        <select
                          value={editForm.courseCode || ""}
                          onChange={(e) => {
                            const selected = courses.find((x) => x.code === e.target.value);
                            setEditForm((f) => ({
                              ...f,
                              courseCode: selected?.code || "",
                              courseName: selected?.name || "",
                              sourceCourseLabel: selected?.code || "",
                            }));
                            if (selected)
                              setFeeForm((f) => ({
                                ...f,
                                totalFee: selected.fee || 0,
                                admissionFee: selected.admissionFee || 0,
                                registrationFee: selected.registrationFee || f.registrationFee || 0,
                              }));
                          }}
                          required
                        >
                          <option value="">Select course</option>
                          {courses.map((x) => (
                            <option key={x._id} value={x.code}>
                              {x.code} — {x.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span>Course Code</span>
                        <input value={editForm.courseCode ?? ""} readOnly />
                      </label>
                      <label className="form-field">
                        <span>Course Fee (₹)</span>
                        <input value={feeForm.totalFee ?? 0} readOnly />
                      </label>
                      <label className="form-field">
                        <span>Admission Fee (₹)</span>
                        <input value={feeForm.admissionFee ?? 0} readOnly />
                      </label>
                      <label className="form-field">
                        <span>Due Amount</span>
                        <input
                          value={editForm.dueAmount ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, dueAmount: e.target.value }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Payment Status</span>
                        <input
                          value={editForm.paymentStatus ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, paymentStatus: e.target.value }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Batch Assignment</span>
                        <select
                          value={editForm.batchId || ""}
                          onChange={(e) => {
                            const b = batches.find((x) => String(x._id) === e.target.value);
                            setEditForm((f) => ({
                              ...f,
                              batchId: e.target.value || null,
                              batchCode: b?.batchCode || "",
                            }));
                          }}
                        >
                          <option value="">Not assigned</option>
                          {batches
                            .filter(
                              (b) =>
                                String(b.courseCode || "").toUpperCase() ===
                                  String(editForm.courseCode || "").toUpperCase() &&
                                !["Cancelled", "Completed"].includes(b.status),
                            )
                            .map((b) => (
                              <option key={b._id} value={b._id}>
                                {b.batchCode} — {b.name} ({b.courseCode})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span>Original Course / Series</span>
                        <input
                          value={editForm.sourceCourseLabel ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, sourceCourseLabel: e.target.value }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Payment Purpose / Note</span>
                        <input
                          value={editForm.paymentNote ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, paymentNote: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="edit-card">
                    <h4>Personal Information</h4>
                    <div className="form-grid two">
                      {[
                        ["nationality", "Nationality"],
                        ["dateOfBirth", "Date of Birth"],
                        ["fatherOrHusbandName", "Father / Husband Name"],
                        ["pin", "PIN"],
                      ].map(([k, l]) => (
                        <label className="form-field" key={k}>
                          <span>{l}</span>
                          <input
                            type={k === "dateOfBirth" ? "date" : "text"}
                            value={editForm[k] || ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))}
                          />
                        </label>
                      ))}
                      <DigitBoxes
                        label="Mobile No. (10 digits)"
                        value={editForm.mobileNumber || ""}
                        onChange={(v) => setEditForm((f) => ({ ...f, mobileNumber: v }))}
                      />
                      <DigitBoxes
                        label="Mob. of Guardian (10 digits)"
                        value={editForm.guardianContactNumber || ""}
                        onChange={(v) => setEditForm((f) => ({ ...f, guardianContactNumber: v }))}
                      />
                      <DigitBoxes
                        label="WhatsApp No. (10 digits)"
                        value={editForm.whatsappNumber || ""}
                        onChange={(v) => setEditForm((f) => ({ ...f, whatsappNumber: v }))}
                      />
                      <label className="form-field">
                        <span>Email Address *</span>
                        <input
                          type="email"
                          required
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        />
                      </label>
                      <label className="form-field">
                        <span>Aadhaar Card Number *</span>
                        <input
                          inputMode="numeric"
                          pattern="[0-9]{12}"
                          maxLength="12"
                          required
                          value={editForm.aadhaarNumber || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              aadhaarNumber: e.target.value.replace(/\D/g, "").slice(0, 12),
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Referral</span>
                        <select
                          value={editForm.referralId || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, referralId: e.target.value }))
                          }
                        >
                          <option value="">Direct / No referral</option>
                          {referrals.map((r) => (
                            <option key={r._id} value={r._id}>
                              {r.name} — {r.marketingEmployeeName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span>Sex</span>
                        <select
                          value={editForm.sex || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, sex: e.target.value }))}
                        >
                          <option value="">Select</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                        </select>
                      </label>
                    </div>
                    <div className="student-address-edit-grid">
                      <label className="form-field">
                        <span>Present Address / Ward / Village / Town</span>
                        <textarea
                          rows="3"
                          value={editForm.presentAddress || editForm.address || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              presentAddress: e.target.value,
                              address: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Permanent Address / Ward / Village / Town</span>
                        <textarea
                          rows="3"
                          value={editForm.permanentAddress || ""}
                          disabled={!!editForm.sameAsPresentAddress}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              permanentAddress: e.target.value,
                              sameAsPresentAddress: false,
                            }))
                          }
                        />
                      </label>
                      <label className="registration-same-address">
                        <input
                          type="checkbox"
                          checked={!!editForm.sameAsPresentAddress}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              sameAsPresentAddress: e.target.checked,
                              permanentAddress: e.target.checked
                                ? f.presentAddress || f.address || ""
                                : f.permanentAddress,
                            }))
                          }
                        />{" "}
                        Same as present address
                      </label>
                      <div className="form-grid two">
                        <label className="form-field">
                          <span>Present P.O.</span>
                          <input
                            value={editForm.postOffice || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, postOffice: e.target.value }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Present P.S.</span>
                          <input
                            value={editForm.policeStation || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, policeStation: e.target.value }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Present State</span>
                          <select
                            value={editForm.state || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, state: e.target.value, district: "" }))
                            }
                          >
                            <option value="">Select state</option>
                            {indiaLocations.map((st) => (
                              <option key={st.code} value={st.name}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Present District</span>
                          <select
                            value={editForm.district || ""}
                            disabled={!editForm.state}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, district: e.target.value }))
                            }
                          >
                            <option value="">Select district</option>
                            {(
                              indiaLocations.find((st) => st.name === editForm.state)?.districts ||
                              []
                            ).map((d) => (
                              <option key={d.code} value={d.name}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Present PIN</span>
                          <input
                            value={editForm.pin || ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, pin: e.target.value }))}
                          />
                        </label>
                        <label className="form-field">
                          <span>Present Nearest Landmark</span>
                          <input
                            value={editForm.nearestLandmark || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, nearestLandmark: e.target.value }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Permanent P.O.</span>
                          <input
                            value={editForm.permanentPostOffice || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, permanentPostOffice: e.target.value }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Permanent State</span>
                          <select
                            value={editForm.permanentState || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                permanentState: e.target.value,
                                permanentDistrict: "",
                              }))
                            }
                          >
                            <option value="">Select state</option>
                            {indiaLocations.map((st) => (
                              <option key={st.code} value={st.name}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Permanent District</span>
                          <select
                            value={editForm.permanentDistrict || ""}
                            disabled={!editForm.permanentState}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, permanentDistrict: e.target.value }))
                            }
                          >
                            <option value="">Select district</option>
                            {(
                              indiaLocations.find((st) => st.name === editForm.permanentState)
                                ?.districts || []
                            ).map((d) => (
                              <option key={d.code} value={d.name}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Permanent PIN</span>
                          <input
                            value={editForm.permanentPin || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, permanentPin: e.target.value }))
                            }
                          />
                        </label>
                        <label className="form-field">
                          <span>Permanent Nearest Landmark</span>
                          <input
                            value={editForm.permanentNearestLandmark || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                permanentNearestLandmark: e.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="edit-card">
                    <h4>Academic & Documents</h4>
                    <div className="form-grid two">
                      <label className="form-field">
                        <span>Qualification</span>
                        <input
                          value={editForm.qualifications?.[0]?.examCourse || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              qualifications: [
                                { ...(f.qualifications?.[0] || {}), examCourse: e.target.value },
                              ],
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Board / University</span>
                        <input
                          value={editForm.qualifications?.[0]?.boardUniversity || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              qualifications: [
                                {
                                  ...(f.qualifications?.[0] || {}),
                                  boardUniversity: e.target.value,
                                },
                              ],
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Qualification Year</span>
                        <input
                          value={editForm.qualifications?.[0]?.year || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              qualifications: [
                                { ...(f.qualifications?.[0] || {}), year: e.target.value },
                              ],
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Percentage</span>
                        <input
                          value={editForm.qualifications?.[0]?.percentage || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              qualifications: [
                                { ...(f.qualifications?.[0] || {}), percentage: e.target.value },
                              ],
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Declaration Date</span>
                        <input
                          type="date"
                          value={editForm.declarationDate || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, declarationDate: e.target.value }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Declaration Place</span>
                        <input
                          value={editForm.declarationPlace || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, declarationPlace: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="edit-card">
                    <h4>Status & Enclosures</h4>
                    <div className="form-grid two">
                      <label className="form-field">
                        <span>Status</span>
                        <select
                          value={editForm.status || "Registered"}
                          onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                        >
                          {[
                            "Registered",
                            "Admission Pending",
                            "Active",
                            "Course Completed",
                            "Dropped Out",
                            "Cancelled",
                            "Suspended",
                            "Alumni",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span>Student Signature Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 3 * 1024 * 1024) {
                              setMessage("Signature image must be smaller than 3 MB.");
                              return;
                            }
                            const fd = new FormData();
                            fd.append("file", file);
                            fd.append("purpose", "signature");
                            const r = await fetch("/api/uploads/student-photo", {
                              method: "POST",
                              body: fd,
                            });
                            const d = await r.json();
                            if (!r.ok) {
                              setMessage(d.error || "Unable to upload signature.");
                              return;
                            }
                            setEditForm((f) => ({ ...f, signatureUrl: d.url }));
                          }}
                        />
                        {editForm.signatureUrl && (
                          <img
                            src={editForm.signatureUrl}
                            alt="Student signature"
                            style={{
                              display: "block",
                              maxWidth: 220,
                              maxHeight: 80,
                              objectFit: "contain",
                              marginTop: 8,
                            }}
                          />
                        )}
                      </label>
                    </div>
                    <div className="checks edit-checks">
                      {[
                        ["stampPhoto", "Photo"],
                        ["qualifyingCertificates", "Qualification Certificates"],
                        ["matricAdmitCard", "Matric Admit Card"],
                      ].map(([k, l]) => (
                        <label key={k}>
                          <input
                            type="checkbox"
                            checked={!!editForm.enclosures?.[k]}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                enclosures: { ...(f.enclosures || {}), [k]: e.target.checked },
                              }))
                            }
                          />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="form-actions sticky-edit-actions">
                  <button type="button" className="ghost-btn" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="primary-btn">
                    <Save size={16} /> Save Changes
                  </button>
                </div>
              </form>
            </section>
          )}
          <section className="student-profile-card student-profile-hero">
            <div className="student-profile-brand">
              <RCLDLogo className="student-profile-logo" />
              <div>
                <span>RASHTRIYA COMPUTER LITERACY DRIVE</span>
                <strong>STUDENT PROFILE</strong>
                <small>RCLD ISLAMPUR EDUCATION ERP</small>
              </div>
            </div>
            <div className="student-avatar">
              {student.photoUrl ? <img src={student.photoUrl} alt="" /> : <UserRound size={30} />}
            </div>
            <div className="student-profile-identity">
              <div className="eyebrow">STUDENT RECORD / REGISTRATION</div>
              <h2>{student.applicantName}</h2>
              <p>
                Form No. {value(student.formNo)} · {value(student.courseName)} ·{" "}
                {value(student.mobileNumber)}
              </p>
            </div>
            <span className="badge profile-status">{value(student.status)}</span>
          </section>
          <section className="detail-section student-transition-panel">
            <div className="detail-section-title">
              <History size={17} />
              <div>
                <h3>Batch Movement & Student Status</h3>
                <span>
                  Every shift, dropout and rejoin is permanently recorded with batch, series,
                  faculty, schedule, attendance footprint and remark.
                </span>
              </div>
            </div>
            <div className="transition-actions">
              {student.batchId && student.status !== "Dropped Out" && (
                <button
                  className="ghost-btn"
                  onClick={() => setTransition({ action: "SHIFTED", batchId: "", remark: "" })}
                >
                  <ArrowRightLeft size={16} /> Shift Batch
                </button>
              )}
              {student.batchId && student.status !== "Dropped Out" && (
                <button
                  className="danger-btn"
                  onClick={() => setTransition({ action: "DROPPED_OUT", batchId: "", remark: "" })}
                >
                  <UserX size={16} /> Mark Dropout
                </button>
              )}
              {student.status === "Dropped Out" && (
                <button
                  className="primary-btn"
                  onClick={() =>
                    setTransition({
                      action: "REJOINED",
                      batchId: String(
                        history.find((h) => h.action === "DROPPED_OUT")?.fromBatch?.batchId || "",
                      ),
                      remark: "",
                    })
                  }
                >
                  <ArrowRightLeft size={16} /> Drop Back to Batch
                </button>
              )}
            </div>
            {transition.action && (
              <div className="transition-form">
                <div className="transition-form-head">
                  <strong>
                    {transition.action === "SHIFTED"
                      ? "Shift Student"
                      : transition.action === "DROPPED_OUT"
                        ? "Mark Student as Dropout"
                        : "Drop Student Back to Batch"}
                  </strong>
                  <button
                    className="ghost-btn"
                    onClick={() => setTransition({ action: "", batchId: "", remark: "" })}
                  >
                    Cancel
                  </button>
                </div>
                {(transition.action === "SHIFTED" || transition.action === "REJOINED") && (
                  <label className="form-field">
                    <span>
                      {transition.action === "REJOINED" ? "Restore / Select Batch" : "Target Batch"}
                    </span>
                    <select
                      value={transition.batchId}
                      onChange={(e) => setTransition((t) => ({ ...t, batchId: e.target.value }))}
                    >
                      <option value="">Select batch</option>
                      {batches
                        .filter(
                          (b) =>
                            ["Draft", "Active"].includes(b.status) &&
                            String(b.courseCode || "").toUpperCase() ===
                              String(student.courseCode || "").toUpperCase(),
                        )
                        .map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.batchCode} — {b.name} · {b.courseCode}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="form-field">
                  <span>
                    Remark <b>*</b>
                  </span>
                  <textarea
                    rows="3"
                    value={transition.remark}
                    onChange={(e) => setTransition((t) => ({ ...t, remark: e.target.value }))}
                    placeholder={
                      transition.action === "SHIFTED"
                        ? "Why is the student being shifted?"
                        : transition.action === "DROPPED_OUT"
                          ? "Reason for dropout"
                          : "Reason for rejoining / dropping back to batch"
                    }
                  />
                </label>
                <button
                  className="primary-btn"
                  disabled={
                    transitioning ||
                    transition.remark.trim().length < 3 ||
                    (transition.action !== "DROPPED_OUT" && !transition.batchId)
                  }
                  onClick={async () => {
                    setTransitioning(true);
                    setMessage("");
                    try {
                      const r = await fetch("/api/students/" + student._id + "/batch-history", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: transition.action,
                          toBatchId: transition.batchId,
                          remark: transition.remark,
                          actor: "superadmin",
                          actorRole: "superadmin",
                        }),
                      });
                      const d = await r.json();
                      if (!r.ok) {
                        setMessage(d.error || "Unable to update student movement.");
                        return;
                      }
                      const sr = await fetch("/api/students/" + student._id, { cache: "no-store" });
                      const sd = await sr.json();
                      if (sr.ok) {
                        setStudent(sd.student);
                        setEditForm(sd.student);
                      }
                      const hr = await fetch("/api/students/" + student._id + "/batch-history", {
                        cache: "no-store",
                      });
                      const hd = await hr.json();
                      if (hr.ok) setHistory(hd.history || []);
                      setTransition({ action: "", batchId: "", remark: "" });
                      setMessage(d.message || "Student movement updated.");
                    } finally {
                      setTransitioning(false);
                    }
                  }}
                >
                  {transitioning ? "Saving…" : "Confirm Movement"}
                </button>
              </div>
            )}
            <div className="movement-history">
              <div className="movement-history-title">Movement Footprint</div>
              {history.length === 0 ? (
                <div className="empty">No batch movement history yet.</div>
              ) : (
                history.map((h) => (
                  <div className="movement-card" key={h._id}>
                    <div className="movement-card-head">
                      <strong>
                        {h.action === "SHIFTED"
                          ? "Batch Shifted"
                          : h.action === "DROPPED_OUT"
                            ? "Dropped Out"
                            : "Rejoined Batch"}
                      </strong>
                      <span>{h.occurredAt ? new Date(h.occurredAt).toLocaleString() : ""}</span>
                    </div>
                    <div className="movement-grid">
                      <div>
                        <small>From</small>
                        <b>{h.fromBatch?.batchCode || "—"}</b>
                      </div>
                      <div>
                        <small>To</small>
                        <b>{h.toBatch?.batchCode || "Dropout / —"}</b>
                      </div>
                      <div>
                        <small>From Faculty</small>
                        <b>
                          {(h.fromBatch?.faculty || [])
                            .map((x) => x.name)
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </b>
                      </div>
                      <div>
                        <small>To Faculty</small>
                        <b>
                          {(h.toBatch?.faculty || [])
                            .map((x) => x.name)
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </b>
                      </div>
                    </div>
                    <div className="movement-remark">
                      <strong>Remark:</strong> {h.remark}
                    </div>
                    <div className="movement-grid">
                      <div>
                        <small>From Series</small>
                        <b>{(h.fromBatch?.series || []).join(", ") || "—"}</b>
                      </div>
                      <div>
                        <small>To Series</small>
                        <b>{(h.toBatch?.series || []).join(", ") || "—"}</b>
                      </div>
                      <div>
                        <small>From Schedule</small>
                        <b>
                          {(h.fromBatch?.schedules || [])
                            .map((x) => `${x.day} ${x.time} ${x.series || ""}`)
                            .join(" · ") || "—"}
                        </b>
                      </div>
                      <div>
                        <small>To Schedule</small>
                        <b>
                          {(h.toBatch?.schedules || [])
                            .map((x) => `${x.day} ${x.time} ${x.series || ""}`)
                            .join(" · ") || "—"}
                        </b>
                      </div>
                    </div>
                    {h.attendanceSnapshot?.from && (
                      <div className="movement-footprint">
                        Attendance footprint: {h.attendanceSnapshot.from.total || 0} records ·{" "}
                        {h.attendanceSnapshot.from.percentage || 0}% present
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <PhoneIcon size={17} />
              <h3>Calling & Follow-up History</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Phone</th>
                    <th>Calling Remark</th>
                    <th>Remarks</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {contactLogs.length ? (
                    contactLogs.map((x) => (
                      <tr key={x._id}>
                        <td>{x.createdAt ? new Date(x.createdAt).toLocaleString() : "—"}</td>
                        <td>
                          <a
                            href={
                              x.phoneNumber
                                ? "tel:" + String(x.phoneNumber).replace(/\s+/g, "")
                                : "#"
                            }
                          >
                            {x.phoneNumber || "—"}
                          </a>
                        </td>
                        <td>{x.callingRemark || "—"}</td>
                        <td>{x.remarks || "—"}</td>
                        <td>{x.actorName || x.actorId || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        <div className="empty">No calling or follow-up remarks recorded yet.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="student-summary-grid">
            <div className="summary-card">
              <WalletCards size={18} />
              <span>Fees Due</span>
              <strong>₹{Number(fee?.due || 0).toLocaleString("en-IN")}</strong>
            </div>
            <div className="summary-card">
              <ClipboardCheck size={18} />
              <span>Attendance</span>
              <strong>{attendance.summary?.percentage || 0}%</strong>
            </div>
            <div className="summary-card">
              <BookOpen size={18} />
              <span>Course</span>
              <strong>{value(student.courseName)}</strong>
            </div>
            <div className="summary-card">
              <CalendarDays size={18} />
              <span>Attendance Records</span>
              <strong>{attendance.summary?.total || 0}</strong>
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <UserRound size={17} />
              <h3>Personal Details</h3>
            </div>
            <div className="student-detail-grid">
              <Detail label="Form No.">{student.formNo}</Detail>
              <Detail label="Enrollment No.">{student.enrollmentNo}</Detail>
              <Detail label="Registration No.">{student.regnNo}</Detail>
              <Detail label="Applicant Name">{student.applicantName}</Detail>
              <Detail label="Father / Husband Name">{student.fatherOrHusbandName}</Detail>
              <Detail label="Nationality">{student.nationality}</Detail>
              <Detail label="Sex">
                {student.sex === "M" ? "Male" : student.sex === "F" ? "Female" : student.sex}
              </Detail>
              <Detail label="Date of Birth">{student.dateOfBirth}</Detail>
              <Detail label="Mobile Number">{student.mobileNumber}</Detail>
              <Detail label="Guardian Contact">{student.guardianContactNumber}</Detail>
              <Detail label="Email Address">{student.email}</Detail>
              <Detail label="Aadhaar Number">
                {student.aadhaarNumber
                  ? "XXXX XXXX " + String(student.aadhaarNumber).slice(-4)
                  : "—"}
              </Detail>
              <Detail label="Referral">{student.referralName}</Detail>
              <Detail label="Marketing Employee">{student.marketingEmployeeName}</Detail>
              <Detail label="WhatsApp Number">{student.whatsappNumber}</Detail>
              <Detail label="Guardian Contact">{student.guardianContactNumber}</Detail>
              <Detail label="PIN">{student.pin}</Detail>
              <Detail label="Status">{student.status}</Detail>
            </div>
            <div className="student-address">
              <MapPin size={16} />
              <div>
                <span>Present Address</span>
                <strong>{value(student.presentAddress || student.address)}</strong>
                <small>
                  {[
                    student.postOffice && "P.O. " + student.postOffice,
                    student.policeStation && "P.S. " + student.policeStation,
                    student.district,
                    student.state,
                    student.pin && "PIN " + student.pin,
                    student.nearestLandmark && "Landmark " + student.nearestLandmark,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <span style={{ marginTop: 8 }}>Permanent Address</span>
                <strong>
                  {value(
                    student.sameAsPresentAddress
                      ? "Same as present address"
                      : student.permanentAddress || "Not separately recorded",
                  )}
                </strong>
                <small>
                  {[
                    student.permanentPostOffice && "P.O. " + student.permanentPostOffice,
                    student.permanentDistrict,
                    student.permanentState,
                    student.permanentPin && "PIN " + student.permanentPin,
                    student.permanentNearestLandmark &&
                      "Landmark " + student.permanentNearestLandmark,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <BookOpen size={17} />
              <h3>Course, Batch & Academic Tracking</h3>
            </div>
            <div className="student-detail-grid">
              <Detail label="Course Name">{student.courseName}</Detail>
              <Detail label="Course Code">{student.courseCode}</Detail>
              <Detail label="Original Course / Series">{student.sourceCourseLabel}</Detail>
              <Detail label="Batch">{student.batchCode || "Not assigned"}</Detail>
              <Detail label="Admission Date">{student.admissionDate}</Detail>
              <Detail label="Imported Due Amount">{student.dueAmount}</Detail>
              <Detail label="Imported Payment Status">{student.paymentStatus}</Detail>
              <Detail label="AEC Code">RCLD/ISL-001</Detail>
              <Detail label="Registered On">
                {student.createdAt ? new Date(student.createdAt).toLocaleString() : ""}
              </Detail>
              <Detail label="Last Updated">
                {student.updatedAt ? new Date(student.updatedAt).toLocaleString() : ""}
              </Detail>
            </div>
            <div className="operational-placeholder">
              <strong>Course Content Progress</strong>
              <span>
                Course content and batch-wise topic completion will be shown here after this student
                is assigned to a batch.
              </span>
            </div>
          </section>

          <section className="detail-section student-fees-section">
            <div className="detail-section-title">
              <CreditCard size={17} />
              <div>
                <h3>Fees & Payments</h3>
                <span>Live fee position · lifetime payment ledger · receipt workspace</span>
              </div>
            </div>
            <div className="student-fee-overview">
              <div className="fee-overview-card fee-total">
                <span>Total Payable</span>
                <strong>₹{Number(fee?.payable || 0).toLocaleString("en-IN")}</strong>
                <small>Course + admission + registration − discount</small>
              </div>
              <div className="fee-overview-card fee-paid">
                <span>Total Collected</span>
                <strong>₹{Number(fee?.paid || 0).toLocaleString("en-IN")}</strong>
                <small>{(fee?.payments || []).length} payment entries recorded</small>
              </div>
              <div className="fee-overview-card fee-due">
                <span>Outstanding Due</span>
                <strong>₹{Number(fee?.due || 0).toLocaleString("en-IN")}</strong>
                <small>Including applicable late fine</small>
              </div>
            </div>
            <div className="fee-overview-meta">
              <span>
                <b>Course</b>
                {value(student.courseName)}
              </span>
              <span>
                <b>Enrollment</b>
                {value(student.enrollmentNo)}
              </span>
              <span>
                <b>Fee status</b>
                <em className={Number(fee?.due || 0) <= 0 ? "fee-status-paid" : "fee-status-due"}>
                  {Number(fee?.due || 0) <= 0 ? "Paid" : "Payment Due"}
                </em>
              </span>
            </div>
            <button
              type="button"
              className="fee-workspace-launch"
              onClick={() => setFeeWorkspaceOpen(true)}
            >
              <span className="fee-workspace-icon">
                <WalletCards size={22} />
              </span>
              <span>
                <strong>Open Fee & Receipt Workspace</strong>
                <small>
                  Manage fee plan, record payments and review the complete payment history
                </small>
              </span>
              <span className="fee-workspace-action">
                Open workspace <ArrowLeft size={15} />
              </span>
            </button>
            {feeWorkspaceOpen && (
              <div
                className="fee-modal-backdrop"
                role="presentation"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setFeeWorkspaceOpen(false);
                }}
              >
                <section
                  className="fee-workspace-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="fee-workspace-title"
                >
                  <header className="fee-modal-header">
                    <div>
                      <div className="eyebrow">STUDENT FINANCE</div>
                      <h2 id="fee-workspace-title">Fee & Receipt Workspace</h2>
                      <p>
                        {student.applicantName} · {student.enrollmentNo || student.formNo}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="fee-modal-close"
                      onClick={() => setFeeWorkspaceOpen(false)}
                      aria-label="Close fee workspace"
                    >
                      ×
                    </button>
                  </header>
                  <div className="fee-modal-body">
                    <div className="fee-modal-stats">
                      <div>
                        <small>Total payable</small>
                        <strong>₹{Number(fee?.payable || 0).toLocaleString("en-IN")}</strong>
                      </div>
                      <div>
                        <small>Paid till date</small>
                        <strong className="fee-green">
                          ₹{Number(fee?.paid || 0).toLocaleString("en-IN")}
                        </strong>
                      </div>
                      <div>
                        <small>Balance due</small>
                        <strong className="fee-red">
                          ₹{Number(fee?.due || 0).toLocaleString("en-IN")}
                        </strong>
                      </div>
                    </div>
                    <section className="fee-modal-section">
                      <div className="fee-modal-section-heading">
                        <div>
                          <h3>Fee Plan & Breakdown</h3>
                          <p>Update the approved student fee structure</p>
                        </div>
                        <span className="fee-section-tag">FEE SETUP</span>
                      </div>
                      <form className="inline-operation-form fee-modal-form" onSubmit={saveFees}>
                        <div className="form-grid four">
                          <label className="form-field">
                            <span>Course Fee (₹)</span>
                            <input
                              type="number"
                              min="0"
                              value={feeForm.totalFee}
                              onChange={(e) =>
                                setFeeForm((f) => ({ ...f, totalFee: e.target.value }))
                              }
                            />
                          </label>
                          <label className="form-field">
                            <span>Discount (₹)</span>
                            <input
                              type="number"
                              min="0"
                              value={feeForm.discount}
                              onChange={(e) =>
                                setFeeForm((f) => ({ ...f, discount: e.target.value }))
                              }
                            />
                          </label>
                          <label className="form-field">
                            <span>Admission Fee (₹)</span>
                            <input
                              type="number"
                              min="0"
                              value={feeForm.admissionFee}
                              onChange={(e) =>
                                setFeeForm((f) => ({ ...f, admissionFee: e.target.value }))
                              }
                            />
                          </label>
                          <label className="form-field">
                            <span>Registration Fee (₹)</span>
                            <input
                              type="number"
                              min="0"
                              value={feeForm.registrationFee}
                              onChange={(e) =>
                                setFeeForm((f) => ({ ...f, registrationFee: e.target.value }))
                              }
                            />
                          </label>
                        </div>
                        <div className="fee-plan-total">
                          <span>Current payable amount</span>
                          <strong>₹{Number(fee?.payable || 0).toLocaleString("en-IN")}</strong>
                          <span>
                            Late fine: ₹{Number(fee?.lateFine || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="fee-modal-actions">
                          <button className="primary-btn operation-btn">
                            <Save size={16} /> Save Fee Plan
                          </button>
                        </div>
                      </form>
                    </section>
                    <section className="fee-modal-section">
                      <div className="fee-modal-section-heading">
                        <div>
                          <h3>Record New Payment</h3>
                          <p>Capture every transaction detail for the student ledger</p>
                        </div>
                        <span className="fee-section-tag fee-tag-blue">NEW ENTRY</span>
                      </div>
                      <form className="inline-operation-form fee-modal-form" onSubmit={saveFees}>
                        <div className="fee-payment-items-editor">
                          <div className="fee-payment-items-heading">
                            <strong>Payment Items</strong>
                            <span>Add every fee head included in this receipt</span>
                          </div>
                          {paymentItems.map((item, index) => (
                            <div className="form-grid four fee-payment-item-row" key={item.id}>
                              <label className="form-field">
                                <span>Fee Head / Particulars *</span>
                                <select
                                  value={item.type}
                                  onChange={(e) => {
                                    const type = e.target.value;
                                    updatePaymentItem(item.id, { type, amount: defaultPaymentItemAmount(type) });
                                  }}
                                >
                                  {paymentItemTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                </select>
                              </label>
                              <label className="form-field">
                                <span>Amount (₹) *</span>
                                <input type="number" min="0.01" step="0.01" required
                                  value={item.amount}
                                  onChange={(e) => updatePaymentItem(item.id, { amount: e.target.value })}
                                  placeholder="Enter amount" />
                              </label>
                              <div className="form-field fee-item-auto-note">
                                <span>Amount source</span>
                                <small>{["Admission Fee","Registration Fee","Late Fine","Course Fee","Installment"].includes(item.type) ? "Auto-filled from current fee balance; editable" : "Enter applicable charge amount"}</small>
                              </div>
                              <div className="form-field fee-item-remove">
                                <span>Action</span>
                                <button type="button" className="ghost-btn" disabled={paymentItems.length === 1}
                                  onClick={() => setPaymentItems((items) => items.filter((row) => row.id !== item.id))}>
                                  Remove item
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="fee-payment-items-footer">
                            <button type="button" className="ghost-btn" onClick={addPaymentItem}>+ Add Payment Item</button>
                            <strong>Receipt Total: ₹{paymentItemsTotal.toLocaleString("en-IN")}</strong>
                          </div>
                        </div>
                        <div className="form-grid four">
                          <label className="form-field">
                            <span>Payment Date *</span>
                            <input type="date" required value={feeForm.date}
                              onChange={(e) => setFeeForm((f) => ({ ...f, date: e.target.value }))} />
                          </label>
                          <label className="form-field">
                            <span>Payment Method</span>
                            <select value={feeForm.method}
                              onChange={(e) => setFeeForm((f) => ({ ...f, method: e.target.value }))}>
                              <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>PhonePe</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span>UTR / Transaction No.</span>
                            <input value={feeForm.utrNumber}
                              onChange={(e) => setFeeForm((f) => ({ ...f, utrNumber: e.target.value }))} placeholder="Enter UTR number" />
                          </label>
                          <label className="form-field">
                            <span>Other Reference</span>
                            <input value={feeForm.reference}
                              onChange={(e) => setFeeForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Bank / transaction reference" />
                          </label>
                          <label className="form-field">
                            <span>Installment Month (if applicable)</span>
                            <input type="month" value={feeForm.installmentMonth}
                              onChange={(e) => setFeeForm((f) => ({ ...f, installmentMonth: e.target.value }))} />
                          </label>
                          <label className="form-field">
                            <span>Authorised By</span>
                            <input value={feeForm.authorisedBy || ""}
                              onChange={(e) => setFeeForm((f) => ({ ...f, authorisedBy: e.target.value }))} placeholder="Name of authorising person" />
                          </label>
                          <label className="form-field">
                            <span>Payment Purpose / Note</span>
                            <input value={feeForm.note}
                              onChange={(e) => setFeeForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional note for this receipt" />
                          </label>
                          <label className="form-field">
                            <span>Payment Screenshot</span>
                            <input type="file" accept="image/*" disabled={proofUploading}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                if (file.size > 5 * 1024 * 1024) { setMessage("Payment screenshot must be smaller than 5 MB."); return; }
                                setProofUploading(true);
                                try {
                                  const fd = new FormData(); fd.append("file", file); fd.append("purpose", "payment-proof");
                                  const up = await fetch("/api/uploads/student-photo", { method: "POST", body: fd });
                                  const ud = await up.json(); if (!up.ok) throw new Error(ud.error || "Unable to upload screenshot.");
                                  setFeeForm((f) => ({ ...f, screenshotUrl: ud.url })); setMessage("Payment screenshot uploaded.");
                                } catch (err) { setMessage(err.message); } finally { setProofUploading(false); }
                              }} />
                            {feeForm.screenshotUrl && <a href={feeForm.screenshotUrl} target="_blank" rel="noreferrer">View uploaded screenshot</a>}
                          </label>
                        </div>
                        <div className="fee-modal-actions">
                          <button className="primary-btn operation-btn" disabled={proofUploading}>
                            <Save size={16} />
                            {proofUploading ? "Uploading…" : "Save Payment Entry"}
                          </button>
                        </div>
                      </form>
                    </section>
                    <section className="fee-modal-section fee-history-section">
                      <div className="fee-modal-section-heading">
                        <div>
                          <h3>Complete Payment History</h3>
                          <p>All payment records available for this student, newest first</p>
                        </div>
                        <span className="fee-section-tag">
                          {(fee?.payments || []).length} RECORDS
                        </span>
                      </div>
                      {(fee?.payments || []).length === 0 ? (
                        <div className="empty">No payment history recorded yet.</div>
                      ) : (
                        <div className="table-wrap fee-history-table-wrap">
                          <table className="fee-history-table">
                            <thead>
                              <tr>
                                <th>Receipt No.</th>
                                <th>Date</th>
                                <th>Type / Installment</th>
                                <th>Method</th>
                                <th>UTR / Reference</th>
                                <th>Amount</th>
                                <th>Recorded By</th>
                                <th>Receipt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fee.payments
                                .slice()
                                .sort((a, b) =>
                                  String(b.date || "").localeCompare(String(a.date || "")),
                                )
                                .map((p, i) => (
                                  <tr key={p._id || p.receiptNo || i}>
                                    <td>
                                      <strong>{p.receiptNo || "Pending"}</strong>
                                    </td>
                                    <td>{p.date || "—"}</td>
                                    <td>
                                      {p.paymentType || "General"}
                                      <small>{p.installmentMonth || p.dueDate || "—"}</small>
                                    </td>
                                    <td>{p.method || "—"}</td>
                                    <td>{p.utrNumber || p.reference || "—"}</td>
                                    <td className="fee-history-amount">
                                      ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                                    </td>
                                    <td>{p.recordedBy || "—"}</td>
                                    <td>
                                      <button
                                        type="button"
                                        className="fee-print-row"
                                        onClick={() => printBill(p)}
                                      >
                                        <Printer size={14} /> Print
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="fee-history-total fee-history-summary">
                        <span>Total Course Fee: <strong>₹{Number(fee?.payable ?? (Number(fee?.totalFee || 0) - Number(fee?.discount || 0) + Number(fee?.admissionFee || 0) + Number(fee?.registrationFee || 0) + Number(fee?.lateFine || 0))).toLocaleString("en-IN")}</strong></span>
                        <span>Amount Paid: <strong>₹{Number(fee?.paid ?? (fee?.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)).toLocaleString("en-IN")}</strong></span>
                        <span>Amount Due: <strong>₹{Number(fee?.due ?? Math.max(0, Number(fee?.payable ?? (Number(fee?.totalFee || 0) - Number(fee?.discount || 0) + Number(fee?.admissionFee || 0) + Number(fee?.registrationFee || 0) + Number(fee?.lateFine || 0))) - Number(fee?.paid ?? (fee?.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)))).toLocaleString("en-IN")}</strong></span>
                      </div>
                    </section>
                  </div>
                  <footer className="fee-modal-footer">
                    <span>Print format remains a compact half-page receipt.</span>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setFeeWorkspaceOpen(false)}
                    >
                      Close workspace
                    </button>
                  </footer>
                </section>
              </div>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <ClipboardCheck size={17} />
              <h3>Attendance</h3>
            </div>
            <div className="student-summary-grid compact">
              <div className="summary-card">
                <span>Present</span>
                <strong>{attendance.summary?.present || 0}</strong>
              </div>
              <div className="summary-card">
                <span>Absent</span>
                <strong>{attendance.summary?.absent || 0}</strong>
              </div>
              <div className="summary-card">
                <span>Leave</span>
                <strong>{attendance.summary?.leave || 0}</strong>
              </div>
              <div className="summary-card">
                <span>Percentage</span>
                <strong>{attendance.summary?.percentage || 0}%</strong>
              </div>
            </div>
            <form className="inline-operation-form" onSubmit={saveAttendance}>
              <h4>Mark / Update Attendance</h4>
              <div className="form-grid four">
                <label className="form-field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={attForm.date}
                    onChange={(e) => setAttForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  <span>Status</span>
                  <select
                    value={attForm.status}
                    onChange={(e) => setAttForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option>Present</option>
                    <option>Absent</option>
                    <option>Leave</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Subject</span>
                  <input
                    value={attForm.subject}
                    onChange={(e) => setAttForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="Subject"
                  />
                </label>
                <label className="form-field">
                  <span>Batch</span>
                  <input
                    value={attForm.batch}
                    onChange={(e) => setAttForm((f) => ({ ...f, batch: e.target.value }))}
                    placeholder="Batch / Series"
                  />
                </label>
                <button className="primary-btn operation-btn">
                  <Save size={16} /> Save Attendance
                </button>
              </div>
            </form>
            {(attendance.records || []).length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Batch</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.records.map((r) => (
                      <tr key={r._id}>
                        <td>{r.date}</td>
                        <td>{r.subject || "—"}</td>
                        <td>{r.batch || "—"}</td>
                        <td>
                          <span className="badge">{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-title">
              <FileText size={17} />
              <h3>Qualification, Documents & Declaration</h3>
            </div>
            {(student.qualifications || []).length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Exam / Course</th>
                      <th>Board / University</th>
                      <th>College / Institute</th>
                      <th>Year</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.qualifications.map((q, i) => (
                      <tr key={i}>
                        <td>{value(q.examCourse)}</td>
                        <td>{value(q.boardUniversity)}</td>
                        <td>{value(q.collegeInstitute)}</td>
                        <td>{value(q.year)}</td>
                        <td>{value(q.percentage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">No qualification information available.</div>
            )}
            <div className="student-detail-grid">
              <Detail label="Declaration Date">{student.declarationDate}</Detail>
              <Detail label="Declaration Place">{student.declarationPlace}</Detail>
              <Detail label="Applicant Signature">
                {student.signatureUrl ? (
                  <img
                    src={student.signatureUrl}
                    alt="Student signature"
                    style={{ maxWidth: 180, maxHeight: 64, objectFit: "contain" }}
                  />
                ) : (
                  student.signatureApplicant
                )}
              </Detail>
              <Detail label="Photo">
                {student.enclosures?.stampPhoto ? "Attached" : "Not attached"}
              </Detail>
              <Detail label="Certificates">
                {student.enclosures?.qualifyingCertificates ? "Attached" : "Not attached"}
              </Detail>
              <Detail label="Matric Admit Card">
                {student.enclosures?.matricAdmitCard ? "Attached" : "Not attached"}
              </Detail>
            </div>
          </section>
          {message && <div className="success-msg">{message}</div>}
        </main>
      )}
    </ERPLayout>
  );
}
