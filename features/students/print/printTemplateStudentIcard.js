import { exportStudentIcards } from "@/features/students/print/renderStudentIcardCanvas";

export async function printTemplateStudentIcard({ student, templateName, outputMode = "print", setMessage }) {
  try {
    await exportStudentIcards({
      students: [student],
      templateName,
      outputMode,
      onMessage: setMessage,
    });
    if (outputMode === "print") setMessage?.("Student ID card print view is ready.");
  } catch (error) {
    console.error("[student-id-card]", error);
    setMessage?.(error?.message || "Unable to generate the student ID card.");
  }
}
