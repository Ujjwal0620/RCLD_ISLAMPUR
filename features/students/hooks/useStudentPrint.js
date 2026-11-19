"use client";

import {
  printStudentICard as printStudentICardAction,
} from "@/features/students/print/printStudentICard";
import { printStudentForm as printStudentFormAction } from "@/features/students/print/printStudentForm";
import { printStudentBill } from "@/features/students/print/printStudentBill";

export default function useStudentPrint({ student, fee, courses, setMessage }) {
  const printStudentICard = (selectedSemester = "", outputMode = "print", selectedTemplate = "") =>
    printStudentICardAction(student, setMessage, selectedSemester, outputMode, selectedTemplate);
  const downloadStudentICardJpg = () =>
    printStudentICardAction(student, setMessage, "", "jpg");
  const printStudentForm = () => printStudentFormAction(student);
  const printBill = (selectedPayment = null) =>
    printStudentBill(student, fee, courses, selectedPayment);

  return { printStudentICard, downloadStudentICardJpg, printStudentForm, printBill };
}
