"use client";

import { useEffect, useRef, useState } from "react";
import useStudentPrint from "@/features/students/hooks/useStudentPrint";
import { useErpCache } from "@/components/providers/ERPUIProvider";

export default function useStudentProfile(params) {
    const { fetchCached } = useErpCache();
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
      date: "",
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
    ]);
    const [proofUploading, setProofUploading] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [feeWorkspaceOpen, setFeeWorkspaceOpen] = useState(false);
    const [attForm, setAttForm] = useState({
      date: "",
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
    const initialLoadStarted = useRef(false);

  
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
      if (initialLoadStarted.current) return;
      initialLoadStarted.current = true;
      (async () => {
        try {
          const { id } = await params;
          const [
            courseData, batchData, referralData, studentResponse,
            historyResponse, contactResponse, feeResponse, attendanceResponse
          ] = await Promise.all([
            fetchCached("lookup:courses", async () => {
              const response = await fetch("/api/courses", { cache: "no-store" });
              if (!response.ok) throw new Error("Unable to load courses.");
              return response.json();
            }),
            fetchCached("lookup:batches", async () => {
              const response = await fetch("/api/batches", { cache: "no-store" });
              if (!response.ok) throw new Error("Unable to load batches.");
              return response.json();
            }),
            fetchCached("lookup:referrals", async () => {
              const response = await fetch("/api/referrals", { cache: "no-store" });
              if (!response.ok) throw new Error("Unable to load referrals.");
              return response.json();
            }),
            fetch("/api/students/" + id, { cache: "no-store" }),
            fetch("/api/students/" + id + "/batch-history", { cache: "no-store" }),
            fetch("/api/students/" + id + "/contact-log", { cache: "no-store" }),
            fetch("/api/students/" + id + "/fees", { cache: "no-store" }),
            fetch("/api/students/" + id + "/attendance", { cache: "no-store" }),
          ]);
          const [studentData, historyData, contactData, feeData, attendanceData] = await Promise.all([
            studentResponse.json(), historyResponse.json(), contactResponse.json(), feeResponse.json(), attendanceResponse.json(),
          ]);
          if (!studentResponse.ok) throw new Error(studentData.error || "Unable to load student.");
          setCourses(courseData.courses || []);
          setBatches(batchData.batches || []);
          setReferrals((referralData.referrals || []).filter(item => item.status === "Active"));
          setStudent(studentData.student);
          setEditForm(studentData.student);
          if (historyResponse.ok) setHistory(historyData.history || []);
          if (contactResponse.ok) setContactLogs(contactData.logs || []);
          if (feeResponse.ok) {
            setFee(feeData.fee);
            setFeeForm(current => ({
              ...current,
              totalFee: current.totalFee || feeData.fee.totalFee || "",
              discount: current.discount || feeData.fee.discount || "",
              admissionFee: current.admissionFee || feeData.fee.admissionFee || "",
              registrationFee: current.registrationFee || feeData.fee.registrationFee || "",
            }));
          }
          if (attendanceResponse.ok) setAttendance(attendanceData);
          if (new URLSearchParams(window.location.search).get("edit") === "1") setEditing(true);
        } catch (error) {
          setError(error.message || "Unable to load student profile.");
        } finally {
          setLoading(false);
        }
      })();
    }, [params, fetchCached]);
  
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
      setStudent(d.student);
      setEditForm(d.student);
      const hasFeeSettings = [feeForm.totalFee, feeForm.discount, feeForm.admissionFee, feeForm.registrationFee]
        .some(value => String(value ?? "").trim() !== "");
      if (!hasFeeSettings) {
        setEditing(false);
        setMessage("Student profile updated successfully.");
        return;
      }
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
                amount: paymentItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
                date: feeForm.date || new Date().toISOString().slice(0, 10),
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
  
    async function uploadStudentPhoto(file) {
      if (!file || !student?._id) return;
      if (!String(file.type || "").startsWith("image/") || file.size > 5 * 1024 * 1024) {
        setMessage("Choose a JPG, PNG or WebP image smaller than 5 MB.");
        return;
      }
      const previousUrl = editForm.photoUrl || student.photoUrl || "";
      const previewUrl = URL.createObjectURL(file);
      setPhotoUploading(true);
      setMessage("");
      setEditForm(current => ({ ...current, photoUrl: previewUrl }));
      setStudent(current => current ? ({ ...current, photoUrl: previewUrl }) : current);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("purpose", "photo");
        const uploadResponse = await fetch("/api/uploads/student-photo", { method: "POST", body: form });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadData.url) {
          throw new Error(uploadData.error || "Unable to upload student photograph.");
        }
        const saveResponse = await fetch("/api/students/" + student._id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: uploadData.url }),
        });
        const saveData = await saveResponse.json();
        if (!saveResponse.ok) throw new Error(saveData.error || "Photo uploaded but could not be linked to the student.");
        const savedStudent = { ...student, ...saveData.student, photoUrl: uploadData.url };
        setStudent(savedStudent);
        setEditForm(current => ({ ...current, ...savedStudent, photoUrl: uploadData.url }));
        setMessage("Student photograph uploaded and saved.");
      } catch (uploadError) {
        setEditForm(current => ({ ...current, photoUrl: previousUrl }));
        setStudent(current => current ? ({ ...current, photoUrl: previousUrl }) : current);
        setMessage(uploadError.message || "Unable to save student photograph.");
      } finally {
        URL.revokeObjectURL(previewUrl);
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
        body: JSON.stringify({ ...attForm, date: attForm.date || new Date().toISOString().slice(0, 10) }),
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
    feeForm, setFeeForm, paymentItems, setPaymentItems, proofUploading, photoUploading, uploadStudentPhoto,
    feeWorkspaceOpen, setFeeWorkspaceOpen, attForm, setAttForm, message, setMessage,
    editing, setEditing, editForm, setEditForm, history, setHistory, contactLogs,
    transition, setTransition, transitioning, setTransitioning, icardDialogOpen,
    setIcardDialogOpen, semesterBusy, updateCfkSemester, saveStudent, deleteStudent,
    saveFees, uploadPaymentProof, printStudentICard, downloadStudentICardJpg, printStudentForm, printBill,
    saveAttendance,
  };
}
