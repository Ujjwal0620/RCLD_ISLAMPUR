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
  const currentCourse = [
    enrollment.courseName,
    enrollment.course,
    student.courseName,
    student.course,
    student.courseCode,
    enrollment.courseCode,
    student.sourceCourseLabel,
  ].map(courseValue).find(Boolean) || "";
  if (!currentCourse) return false;

  const normalized = currentCourse.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  const compact = normalized.replace(/\s+/g, "");
  const tokens = normalized.split(/\\s+/);
  return compact.includes("CODINGFORKIDS") || tokens.includes("KIDS") || tokens.includes("CFK");
}
