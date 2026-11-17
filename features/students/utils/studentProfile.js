export function isIcardEligible(student = {}) {
  const hasName = Boolean(String(student.applicantName || "").trim());
  const hasStudentNumber = Boolean(
    String(student.enrollmentNo || student.studentId || student.admissionNo || student.regnNo || student.formNo || "").trim(),
  );
  // The standard and Coding for Kids card templates only require the student's
  // name and an identifier. Optional profile fields are printed as blanks/fallbacks.
  return hasName && hasStudentNumber && student.status !== "Admission Pending" && student.status !== "Cancelled";
}
