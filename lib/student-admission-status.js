/**
 * Admission completeness is based only on student-supplied academic and personal data.
 * Office-side fields (AEC code, registration number, kit issue, HO verification, etc.)
 * are intentionally excluded so they never block an otherwise complete admission.
 */
const filled = (value) => String(value ?? "").trim().length > 0;

export function isStudentAdmissionComplete(student = {}) {
  const presentAddress = student.presentAddress || student.address;
  const sameAsPresent = student.sameAsPresentAddress === true;
  const permanentAddressComplete = sameAsPresent || [
    student.permanentAddress,
    student.permanentPostOffice,
    student.permanentDistrict,
    student.permanentState,
    student.permanentPin,
  ].every(filled);

  const qualification = Array.isArray(student.qualifications)
    ? student.qualifications[0]
    : null;

  const requiredStudentFields = [
    student.applicantName,
    student.fatherOrHusbandName,
    student.dateOfBirth,
    student.sex,
    student.nationality,
    student.courseCode || student.courseName,
    presentAddress,
    student.postOffice,
    student.policeStation,
    student.district,
    student.state,
    student.pin,
    student.email,
    student.mobileNumber,
    qualification?.examCourse,
    qualification?.boardUniversity,
    qualification?.collegeInstitute,
    qualification?.year,
    qualification?.percentage,
  ];

  return requiredStudentFields.every(filled) && permanentAddressComplete;
}

export function getStudentAdmissionStatus(student = {}) {
  return isStudentAdmissionComplete(student) ? "Active" : "Admission Pending";
}
