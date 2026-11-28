function courseValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    const name = value.name || value.courseName || value.title;
    return String(name || value.code || value.courseCode || "").trim();
  }
  return "";
}

function normalizeCourse(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function isCfkLabel(value) {
  const normalized = normalizeCourse(value);
  const compact = normalized.replace(/\s+/g, "");
  if (!normalized) return false;

  if (/^SM\s*(?:I|II|III|IV|V|VI|1|2|3|4|5|6)$/.test(normalized)) return true;
  if (normalized === "ROBOTICS" || normalized.startsWith("ROBOTICS ")) return true;

  return compact.includes("CODINGFORKIDS")
    || normalized.split(/\s+/).includes("KIDS")
    || normalized.split(/\s+/).includes("CFK");
}

export function isCodingForKidsCourse(student = {}) {
  if (!student || typeof student !== "object") return false;

  const enrollment = student.activeEnrollment || student.currentEnrollment || {};
  const currentCourse = [
    enrollment.courseName,
    enrollment.course,
    student.courseName,
    student.course,
    enrollment.courseCode,
    student.courseCode,
    student.sourceCourseLabel,
  ].map(courseValue).find(Boolean) || "";

  if (currentCourse) return isCfkLabel(currentCourse);

  const programmeLabels = [
    enrollment.programName,
    enrollment.courseCategory,
    enrollment.category,
    student.programName,
    student.courseCategory,
    student.courseGroup,
    student.department,
  ].map(courseValue).filter(Boolean);

  return programmeLabels.some(isCfkLabel);
}
