function courseValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    return [value.name, value.courseName, value.code, value.courseCode, value.title]
      .filter(Boolean).map(item => String(item).trim()).join(" ");
  }
  return "";
}

export function isCodingForKidsCourse(student = {}) {
  if (!student || typeof student !== "object") return false;
  const enrollment = student.activeEnrollment || student.currentEnrollment || {};
  const values = [
    student.courseName,
    student.courseCode,
    student.sourceCourseLabel,
    student.course,
    enrollment.courseName,
    enrollment.courseCode,
    enrollment.course,
  ].map(courseValue).filter(Boolean);

  return values.some(value => {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
    const compact = normalized.replace(/\s+/g, "");
    return compact.includes("CODINGFORKIDS") || compact === "KIDS" || compact === "CFK";
  });
}
