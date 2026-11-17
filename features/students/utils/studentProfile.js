export function isIcardEligible(student = {}) {
  const present = student.presentAddress || student.address;
  const permanent = student.sameAsPresentAddress
    ? Boolean(String(present || "").trim())
    : [
        "permanentAddress",
        "permanentPostOffice",
        "permanentState",
        "permanentDistrict",
        "permanentPin",
        "permanentNearestLandmark",
      ].every((key) => String(student[key] || "").trim());
  const qualification = Array.isArray(student.qualifications) ? student.qualifications[0] : null;

  return (
    [
      student.applicantName,
      student.fatherOrHusbandName,
      student.dateOfBirth,
      student.sex,
      student.nationality,
      student.photoUrl,
      present,
      student.postOffice,
      student.policeStation,
      student.state,
      student.district,
      student.pin,
      student.nearestLandmark,
      student.mobileNumber,
      student.guardianContactNumber,
      student.whatsappNumber,
      student.email,
      student.aadhaarNumber,
      qualification?.examCourse,
      qualification?.collegeInstitute,
      qualification?.boardUniversity,
      qualification?.year,
      qualification?.percentage,
    ].every((item) => String(item || "").trim()) &&
    permanent &&
    student.status !== "Admission Pending"
  );
}
