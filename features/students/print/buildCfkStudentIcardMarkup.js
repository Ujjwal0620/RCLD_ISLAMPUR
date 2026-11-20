export function buildCfkStudentIcardMarkup({
  student = {},
  photoUrl = "",
  idNumber = "",
  issueDate = "",
  address = "",
  semester = "1",
  courseText = "CODING FOR KIDS",
  templateUrl = "/assets/template I card.png",
}) {
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
  const name = safe(student.applicantName || "Student");
  const father = safe(student.fatherOrHusbandName || student.fatherName || student.guardianName || "—");
  const course = safe(courseText);
  const id = safe(idNumber || student.enrollmentNo || student.studentId || student.admissionNo || "—");
  const date = safe(issueDate || "—");
  const addr = safe(address || "—");
  const photo = photoUrl
    ? '<img class="cfk-photo" crossorigin="anonymous" src="' + safe(photoUrl) + '" alt="Student photo"/>'
    : '<div class="cfk-photo cfk-photo-empty">PHOTO</div>';
  const sem = safe(String(semester).replace(/[^0-9]/g, "") || "1");

  return `
    <style>
      @page { size: 55mm 86.1mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; }
      .cfk-template-card {
        position:relative; width:55mm; height:86.1mm; overflow:hidden;
        background:#fff url("${templateUrl}") center / 100% 100% no-repeat;
        color:#384252; font-family:"Arial Narrow","Liberation Sans Narrow",Arial,sans-serif;
        -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important;
      }
      .cfk-photo {
        position:absolute; left:27.8%; top:19%; width:46.8%; height:30%;
        border-radius:50%; object-fit:cover; display:block;
      }
      .cfk-photo-empty { display:flex; align-items:center; justify-content:center; background:#fff; color:#777; font-size:11px; }
      .cfk-name {
        position:absolute; top:50.8%; left:8%; width:84%; text-align:center;
        color:#343b49; font-size:4.4mm; font-weight:700; line-height:1.05;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .cfk-course {
        position:absolute; top:55.2%; left:9%; width:82%; text-align:center;
        color:#96308f; font-size:2.1mm; font-weight:700; letter-spacing:.15px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .cfk-fields {
        position:absolute; left:47.5%; right:4.5%; top:61.5%;
        display:grid; grid-template-rows:repeat(6, 1fr); height:15.2%;
        gap:0; font-size:1.85mm; line-height:1.02; font-weight:600;
      }
      .cfk-field { display:flex; align-items:center; min-width:0; }
      .cfk-field span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .cfk-address { white-space:normal!important; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; line-height:1.05; }
      .cfk-semester {
        position:absolute; left:3.2%; top:74.5%; width:14%; height:13%;
        display:flex; align-items:center; justify-content:center;
        color:#fff; font-family:Arial,sans-serif; font-weight:800; font-size:5mm;
      }
    </style>
    <div class="cfk-template-card">
      ${photo}
      <div class="cfk-name">${name}</div>
      <div class="cfk-course">${course}</div>
      <div class="cfk-fields">
        <div class="cfk-field"><span>${id}</span></div>
        <div class="cfk-field"><span>${safe(student.dateOfBirth || student.dob || "—")}</span></div>
        <div class="cfk-field"><span>${father}</span></div>
        <div class="cfk-field"><span>${safe(student.mobileNumber || student.phoneNumber || "—")}</span></div>
        <div class="cfk-field"><span class="cfk-address">${addr}</span></div>
        <div class="cfk-field"><span>${date}</span></div>
      </div>
      <div class="cfk-semester">${sem}</div>
    </div>`;
}
