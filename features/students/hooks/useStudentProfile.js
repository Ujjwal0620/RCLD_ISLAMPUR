"use client";

import { useEffect, useState } from "react";
import useStudentPrint from "@/features/students/hooks/useStudentPrint";

export default function useStudentProfile(params) {
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
      paymentType: "Installment",
      installmentMonth: "",
    });
    const [paymentItems, setPaymentItems] = useState(() => [
      { id: "payment-line-1", purpose: "Course Fee", amount: "", installmentMonth: "" },
      ...(new Date().getDate() > 10
        ? [{ id: "late-fine-initial", purpose: "Late Fine", amount: "50", installmentMonth: "" }]
        : []),
    ]);
    const [proofUploading, setProofUploading] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
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
    const [icardDialogOpen, setIcardDialogOpen] = useState(false);
    const [semesterBusy, setSemesterBusy] = useState(false);
  
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
  
    async function updateCfkSemester(action) {
      if (!student || semesterBusy) return;
      setSemesterBusy(true);
      setMessage("");
      try {
        const response = await fetch("/api/students/" + student._id + "/semester", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to update the semester.");
        const studentResponse = await fetch("/api/students/" + student._id, { cache: "no-store" });
        const studentData = await studentResponse.json();
        await loadOperational(student._id);
        if (studentResponse.ok) {
          setStudent(studentData.student);
          setEditForm(studentData.student);
        }
        setMessage(data.message || "Coding for Kids semester updated.");
      } catch (error) {
        setMessage(error.message || "Unable to update the semester.");
      } finally {
        setSemesterBusy(false);
      }
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
          lateFine:
            Number(fee?.lateFine || 0) +
            paymentItems
              .filter((item) => item.purpose === "Late Fine")
              .reduce((sum, item) => sum + Number(item.amount || 0), 0),
          admissionDate: student.admissionDate,
        }),
      });
      const fd = await fr.json();
      if (!fr.ok) return setMessage(fd.error || "Student saved, but fee mapping failed.");
      setFee(fd.fee);
      const refreshedProfile = await fetch("/api/students/" + student._id, { cache: "no-store" });
      const refreshedData = refreshedProfile.ok ? await refreshedProfile.json() : null;
      const savedStudent = refreshedData?.student || d.student;
      setStudent(savedStudent);
      setEditForm(savedStudent);
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
                amount: paymentItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
                date: feeForm.date,
                method: feeForm.method,
                reference: feeForm.reference,
                utrNumber: feeForm.utrNumber,
                screenshotUrl: feeForm.screenshotUrl,
                note: [
                  feeForm.note,
                  "Fee sections: " +
                    paymentItems
                      .filter((item) => Number(item.amount) > 0)
                      .map(
                        (item) =>
                          `${item.purpose}: ₹${Number(item.amount).toLocaleString("en-IN")}${
                            item.installmentMonth ? ` (${item.installmentMonth})` : ""
                          }`,
                      )
                      .join("; "),
                ]
                  .filter(Boolean)
                  .join(" | "),
                paymentType:
                  paymentItems.length > 1
                    ? "Multiple Sections"
                    : paymentItems[0]?.purpose || feeForm.paymentType,
                installmentMonth:
                  paymentItems.find((item) => item.installmentMonth)?.installmentMonth ||
                  feeForm.installmentMonth,
                items: paymentItems
                  .filter((item) => Number(item.amount) > 0)
                  .map(({ purpose, amount, installmentMonth }) => ({
                    purpose,
                    amount: Number(amount),
                    installmentMonth,
                  })),
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
      const refreshedProfile = await fetch("/api/students/" + student._id, { cache: "no-store" });
      if (refreshedProfile.ok) {
        const refreshedData = await refreshedProfile.json();
        if (refreshedData.student) {
          setStudent(refreshedData.student);
          setEditForm(current => ({ ...current, ...refreshedData.student }));
        }
      }
      setFeeForm((f) => ({
        ...f,
        amount: "",
        reference: "",
        utrNumber: "",
        screenshotUrl: "",
        note: "",
      }));
      setPaymentItems([
        { id: `payment-line-${Date.now()}`, purpose: "Course Fee", amount: "", installmentMonth: "" },
      ]);
      setMessage("Fee information saved.");
    }
  
    async function compressStudentPhoto(file) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = objectUrl;
        if (image.decode) await image.decode();
        else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
        const scale = Math.min(1, 500 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to prepare the selected image.");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
        if (!blob) throw new Error("Unable to compress the selected image.");
        return new File([blob], (file.name.replace(/\.[^.]+$/, "") || "student-photo") + ".jpg", { type: "image/jpeg" });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    async function uploadStudentPhoto(file) {
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
        setMessage("Choose a JPG, PNG or WebP image smaller than 8 MB.");
        return;
      }
      setPhotoUploading(true);
      setMessage("");
      try {
        const compressed = await compressStudentPhoto(file);
        const form = new FormData();
        form.append("file", compressed);
        form.append("purpose", "photo");
        const response = await fetch("/api/uploads/student-photo", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.error || "Unable to upload student photo.");
        const saveResponse = await fetch("/api/students/" + student._id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: data.url }),
        });
        const saved = await saveResponse.json();
        if (!saveResponse.ok) throw new Error(saved.error || "Photo uploaded, but the student profile could not be updated.");
        const updatedStudent = saved.student || { ...student, photoUrl: data.url };
        setStudent(updatedStudent);
        setEditForm(current => ({ ...current, photoUrl: data.url }));
        setMessage("Student photo saved");
      } catch (uploadError) {
        setMessage(uploadError.message || "Unable to upload student photo.");
      } finally {
        setPhotoUploading(false);
      }
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
  
    const { printStudentICard, downloadStudentICardJpg, printStudentForm, printBill } = useStudentPrint({
      student,
      fee,
      courses,
      setMessage,
    });
  
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

  return {
    student, setStudent, error, loading, fee, courses, batches, referrals, attendance,
    feeForm, setFeeForm, paymentItems, setPaymentItems, proofUploading,
    feeWorkspaceOpen, setFeeWorkspaceOpen, attForm, setAttForm, message, setMessage, photoUploading,
    editing, setEditing, editForm, setEditForm, history, setHistory, contactLogs,
    transition, setTransition, transitioning, setTransitioning, icardDialogOpen,
    setIcardDialogOpen, semesterBusy, updateCfkSemester, saveStudent, deleteStudent,
    saveFees, uploadPaymentProof, uploadStudentPhoto, printStudentICard, downloadStudentICardJpg, printStudentForm, printBill,
    saveAttendance,
  };
}
