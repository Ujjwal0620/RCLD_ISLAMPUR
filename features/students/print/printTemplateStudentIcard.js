import { exportStudentIcards } from "@/features/students/print/renderStudentIcardCanvas";

export async function printTemplateStudentIcard({ student, templateName, outputMode = "print", setMessage, onStudentUpdated }) {
  try {
    await exportStudentIcards({
      students: [student],
      templateName,
      outputMode,
      onMessage: setMessage,
      onStudentUpdated,
    });
    if (outputMode === "print") setMessage?.("Student ID card print view is ready.");
    return true;
  } catch (error) {
    console.error("[student-id-card]", error);
    setMessage?.(error?.message || "Unable to generate the student ID card.");
    return false;
  }
}

// Dedicated Diploma JPG export. This deliberately uses the Diploma canvas
// renderer and does not enter the legacy Coding for Kids HTML print function.
export async function downloadDiplomaStudentIcardJpg({ student, setMessage, onStudentUpdated }) {
  try {
    if (!student) throw new Error("A student record is required to download the Diploma ID card.");
    await exportStudentIcards({
      students: [student],
      templateName: "ID Card Diploma.jpg",
      outputMode: "jpg",
      onMessage: setMessage,
      onStudentUpdated,
    });
    return true;
  } catch (error) {
    console.error("[diploma-id-card-download]", error);
    setMessage?.(error?.message || "Unable to download the Diploma ID card.");
    return false;
  }
}
