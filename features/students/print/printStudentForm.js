"use client";

export function printStudentForm(student) {
        if (!student) return;
        const esc = (value) =>
          String(value ?? "").replace(
            /[&<>"']/g,
            (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
          );
        const val = (value) => esc(value || "");
        const field = (label, value) =>
          '<div class="field"><span class="label">' +
          esc(label) +
          '</span><span class="value">' +
          val(value) +
          "</span></div>";
        const date = (value) =>
          value ? new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB") : "";
        const presentAddress = [
          field("Ward / Colony / Village", student.presentAddress || student.address),
          field("Post Office", student.postOffice),
          field("Police Station", student.policeStation),
          field("State", student.state),
          field("District", student.district),
          field("PIN Code", student.pin),
          field("Nearest Landmark", student.nearestLandmark),
        ].join("");
        const permanentSame = !!student.sameAsPresentAddress;
        const permanentAddress = permanentSame
          ? presentAddress
          : [
              field("Ward / Colony / Village", student.permanentAddress),
              field("Post Office", student.permanentPostOffice),
              field("Police Station", student.permanentPoliceStation),
              field("State", student.permanentState),
              field("District", student.permanentDistrict),
              field("PIN Code", student.permanentPin),
              field("Nearest Landmark", student.permanentNearestLandmark),
            ].join("");
        const qualifications = (student.qualifications || []).length
          ? student.qualifications
              .map(
                (q) =>
                  "<tr><td>" +
                  val(q.examCourse) +
                  "</td><td>" +
                  val(q.collegeInstitute) +
                  "</td><td>" +
                  val(q.boardUniversity) +
                  "</td><td>" +
                  val(q.year) +
                  "</td><td>" +
                  val(q.percentage) +
                  "</td></tr>",
              )
              .join("")
          : "<tr><td></td><td></td><td></td><td></td><td></td></tr>";
        const photo = student.photoUrl
          ? '<img class="student-photo" src="' + esc(student.photoUrl) + '" alt="Student photograph"/>'
          : '<div class="student-photo photo-placeholder"></div>';
        const logoUrl = window.location.origin + "/assets/logo.png";
        const w = window.open("", "_blank");
        if (!w) {
          setMessage("Please allow pop-ups to print the student form.");
          return;
        }
        const html =
          '<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Student Registration Form - ' +
          val(student.applicantName) +
          "</title><style>" +
          "@page{size:A4 portrait;margin:5mm}" +
          "*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}" +
          "body{font-size:8pt;line-height:1.2;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
          ".sheet{width:200mm;max-width:100%;min-height:287mm;margin:0 auto;background:#fff;padding:0}" +
          ".header{display:grid;grid-template-columns:23mm minmax(0,1fr);gap:3mm;align-items:center;padding:.5mm 1mm 1.5mm;border-bottom:.8mm solid #111;margin-bottom:1.5mm}" +
          ".logo{display:block;width:20mm;height:18mm;object-fit:contain;object-position:center;background:#fff}" +
          '.heading{text-align:center;min-width:0;color:#159bd5}.heading h1{margin:0;font:700 20pt/1.08 Georgia,"Times New Roman",serif;letter-spacing:.01em}.heading p{margin:2.5mm 0 0;font:700 10pt/1.2 Arial,sans-serif}' +
          '.section{margin:0 0 1.5mm;break-inside:avoid;page-break-inside:avoid}.section-title{margin:0 0 .8mm;padding:1mm 2.5mm;background:#8493bd;color:#fff;font:700 11pt/1.2 Georgia,"Times New Roman",serif}' +
          ".office-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2mm 5mm;padding:0 3mm}.field{display:grid;grid-template-columns:minmax(26mm,auto) minmax(0,1fr);gap:2mm;align-items:end;min-width:0;min-height:5mm}.label{font-weight:700;color:#222}.value{min-width:0;min-height:3.5mm;border-bottom:1px solid #777;padding:0 1mm;overflow-wrap:anywhere;white-space:pre-wrap}" +
          ".applicant{display:grid;grid-template-columns:minmax(0,1fr) 30mm;gap:3mm;padding:.5mm 2mm}.applicant-fields{display:grid;grid-template-columns:1fr 1fr;gap:2mm 5mm;align-content:start}.applicant-fields .field:first-child,.applicant-fields .field:nth-child(2){grid-column:1/-1}.student-photo{width:28mm;height:31mm;display:block;object-fit:cover;border:1px solid #333;background:#fff}.photo-placeholder{background:#fff}" +
          '.address-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm;padding:0 2mm}.address-box{border:1.1mm solid #8493BD;padding:1mm 1.5mm;min-width:0;break-inside:avoid}.address-box h3{margin:0 0 2mm;color:#1700b5;font:bold 10pt Georgia,"Times New Roman",serif}.address-box .field{grid-template-columns:29mm minmax(0,1fr);min-height:4.5mm;font-size:7pt}.address-box .value{min-height:4mm}' +
          ".contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:1mm 4mm;padding:0 2mm}.contact-grid .field{grid-template-columns:34mm minmax(0,1fr)}" +
          "table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt}th,td{border:1px solid #9693aa;padding:1mm 1mm;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#dcecff;color:#111;font-weight:700}tbody td{background:#c5e2fa;min-height:10mm}" +
          ".enclosures{display:flex;flex-wrap:wrap;gap:2mm 5mm;padding:.5mm 2mm}.check{display:inline-flex;align-items:center;gap:2mm}.square{width:4mm;height:4mm;border:1px solid #a8a6b3;display:inline-flex;align-items:center;justify-content:center;font-weight:700}" +
          ".footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7mm;padding:2mm 3mm 0;text-align:center;break-inside:avoid}.signature-area{min-width:0}.signature-area .line{height:7mm;border-bottom:1px solid #9f9ea6;display:flex;align-items:flex-end;justify-content:center}.signature-area img{max-width:90%;max-height:11mm;object-fit:contain}.signature-area b{display:block;margin-top:2mm;font-size:9pt;font-weight:700}" +
          "@media screen{body{padding:8mm;background:#edf1f6}.sheet{padding:6mm;background:#fff;box-shadow:0 2px 12px #0002}}" +
          "@media print{html,body{width:100%;height:auto;min-height:0;margin:0!important;padding:0!important;overflow:visible!important}.sheet{width:100%;height:auto;min-height:0;max-width:none;margin:0;padding:0;display:block;overflow:visible}.header{display:grid;grid-template-columns:34mm minmax(0,1fr);gap:5mm;align-items:center;padding:1mm 2mm 3mm;margin:0 0 3mm;break-inside:avoid;page-break-inside:avoid}.logo{display:block;width:32mm;height:30mm;max-width:100%;max-height:30mm;object-fit:contain;object-position:center;background:#fff;overflow:visible}.heading h1{font-size:21pt;line-height:1.12}.heading p{font-size:10pt;line-height:1.25;margin-top:2mm}.section{display:block;flex:none;height:auto;min-height:0;margin:0 0 3mm;padding:0;break-inside:auto;page-break-inside:auto}.section-title{font-size:10pt;line-height:1.2;padding:1.5mm 3mm;margin:0 0 2mm}.office-grid,.applicant,.address-grid,.contact-grid,.section table,.enclosures{flex:none;min-height:0;height:auto}.office-grid{gap:2.5mm 4mm;align-content:start}.field{min-height:6mm;grid-template-columns:minmax(29mm,auto) minmax(0,1fr);gap:1.5mm;font-size:7.5pt;align-items:end}.value{min-height:4.5mm;line-height:1.15;overflow-wrap:anywhere}.applicant{grid-template-columns:minmax(0,1fr) 34mm;gap:4mm;padding:1mm 2mm;align-items:start}.applicant-fields{gap:2mm 4mm;align-content:start}.student-photo{width:32mm;height:38mm;max-width:100%;object-fit:cover;align-self:start}.address-grid{gap:3mm;align-items:start}.address-box{display:block;height:auto;min-height:0;padding:2mm;break-inside:avoid;page-break-inside:avoid}.address-box h3{font-size:9pt;margin:0 0 1.5mm}.address-box .field{grid-template-columns:29mm minmax(0,1fr);min-height:5.5mm;font-size:7pt}.address-box .value{min-height:4mm}.contact-grid{gap:1.5mm 4mm;align-content:start}.contact-grid .field{grid-template-columns:34mm minmax(0,1fr)}table{font-size:7.5pt;break-inside:auto}th,td{padding:1.8mm 1.5mm;line-height:1.2}tbody td{height:10mm;min-height:0}.section table tr{break-inside:avoid;page-break-inside:avoid}.enclosures{gap:2.5mm 5mm;align-content:start;padding:1mm 2mm;font-size:7.5pt}.square{width:4mm;height:4mm;flex:0 0 4mm}.footer{display:grid;flex:none;grid-template-columns:1fr 1fr 1fr;gap:8mm;padding:3mm 3mm 0;margin:3mm 0 0;break-inside:avoid;page-break-inside:avoid}.signature-area .line{height:10mm}.signature-area b{font-size:8pt;margin-top:1.5mm}.signature-area img{max-width:90%;max-height:8mm;object-fit:contain}}" +
          "@media(max-width:700px){.office-grid{grid-template-columns:1fr 1fr}.address-grid{grid-template-columns:1fr}.applicant{grid-template-columns:minmax(0,1fr) 30mm}.student-photo{width:28mm;height:34mm}.heading h1{font-size:12pt}.heading p{font-size:8pt}}" +
          '</style></head><body><main class="sheet">' +
          '<header class="header"><img class="logo" src="' +
          esc(logoUrl) +
          '" alt="RCLD logo"/><div class="heading"><h1>RASHTRIYA COMPUTER LITERACY DRIVE</h1><p>STUDENT REGISTRATION FORM. RCLD ISLAMPUR</p></div></header>' +
          '<section class="section"><h2 class="section-title">Office / Registration Details</h2><div class="office-grid">' +
          field("AEC Code", student.aecCode || "RCLD/ISL-001") +
          field("Enrollment Number", student.enrollmentNo) +
          field("Registration Number", student.regnNo) +
          field("Registration Date", date(student.admissionDate || student.createdAt)) +
          field("Form Number", student.formNo) +
          field(
            "Course / Course Code",
            [student.courseName, student.courseCode].filter(Boolean).join(" / "),
          ) +
          "</div></section>" +
          '<section class="section"><h2 class="section-title">Applicant Details</h2><div class="applicant"><div class="applicant-fields">' +
          field("Student Name", student.applicantName) +
          field("Father / Mother / Husband Name", student.fatherOrHusbandName) +
          field("Date of Birth", date(student.dateOfBirth)) +
          field(
            "Gender / Sex",
            student.sex === "M" ? "Male" : student.sex === "F" ? "Female" : student.sex,
          ) +
          field("Nationality", student.nationality) +
          "</div>" +
          photo +
          "</div></section>" +
          '<section class="section"><h2 class="section-title">Address Details</h2><div class="address-grid"><div class="address-box"><h3>Present Address</h3>' +
          presentAddress +
          '</div><div class="address-box"><h3>Permanent Address</h3>' +
          permanentAddress +
          "</div></div></section>" +
          '<section class="section"><h2 class="section-title">Contact Details</h2><div class="contact-grid">' +
          field("Student Mobile Number", student.mobileNumber) +
          field("Guardian Mobile Number", student.guardianContactNumber) +
          field("WhatsApp Number", student.whatsappNumber) +
          field("Email Address", student.email) +
          field("Aadhaar Number", "[Aadhaar Redacted]") +
          "</div></section>" +
          '<section class="section"><h2 class="section-title">Qualification Details</h2><table><thead><tr><th>Class / Semester / Course</th><th>Institute / School / College</th><th>Board / Council / University</th><th>Year</th><th>Percentage of Marks</th></tr></thead><tbody>' +
          qualifications +
          "</tbody></table></section>" +
          '<section class="section"><h2 class="section-title">Enclosure</h2><div class="enclosures"><span class="check"><i class="square">' +
          (student.enclosures?.stampPhoto ? "✓" : "") +
          '</i> Passport Size Photograph</span><span class="check"><i class="square">' +
          (student.enclosures?.qualifyingCertificates ? "✓" : "") +
          '</i> Aadhaar / Qualifying Certificates</span><span class="check"><i class="square">' +
          (student.enclosures?.matricAdmitCard ? "✓" : "") +
          "</i> Admit Card / Registration Details</span></div></section>" +
          '<footer class="footer"><div class="signature-area"><div class="line">' +
          (student.declarationDate ? "<span>" + val(date(student.declarationDate)) + "</span>" : "") +
          '</div><b>Date</b></div><div class="signature-area"><div class="line">' +
          val(student.declarationPlace) +
          '</div><b>Place</b></div><div class="signature-area"><div class="line">' +
          (student.signatureUrl
            ? '<img src="' + esc(student.signatureUrl) + '" alt="Student signature"/>'
            : "") +
          "</div><b>Student Signature</b></div></footer>" +
          '</main><script>window.addEventListener("load",()=>{const imgs=[...document.images];Promise.all(imgs.map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>setTimeout(()=>window.print(),250));});</script></body></html>';
        w.document.open();
        w.document.write(html);
        w.document.close();
}
