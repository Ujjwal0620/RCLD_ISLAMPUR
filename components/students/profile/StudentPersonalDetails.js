"use client";

import { MapPin, UserRound } from "lucide-react";
import { DetailField as Detail } from "@/components/students/DetailField";
import { formatDisplayValue as value } from "@/lib/formatters";

export default function StudentPersonalDetails({ student }) {
  return (
    <section className="detail-section">
            <div className="detail-section-title">
              <UserRound size={17} />
              <h3>Personal Details</h3>
            </div>
            <div className="student-detail-grid">
              <Detail label="Form No.">{student.formNo}</Detail>
              <Detail label="Enrollment No.">{student.enrollmentNo}</Detail>
              <Detail label="Registration No.">{student.regnNo}</Detail>
              <Detail label="Applicant Name">{student.applicantName}</Detail>
              <Detail label="Father / Husband Name">{student.fatherOrHusbandName}</Detail>
              <Detail label="Nationality">{student.nationality}</Detail>
              <Detail label="Sex">
                {student.sex === "M" ? "Male" : student.sex === "F" ? "Female" : student.sex}
              </Detail>
              <Detail label="Date of Birth">{student.dateOfBirth}</Detail>
              <Detail label="Mobile Number">{student.mobileNumber}</Detail>
              <Detail label="Guardian Contact">{student.guardianContactNumber}</Detail>
              <Detail label="Email Address">{student.email}</Detail>
              <Detail label="Aadhaar Number">
                {student.aadhaarNumber ? "[Aadhaar Redacted]" : "—"}
              </Detail>
              <Detail label="Referral">{student.referralName}</Detail>
              <Detail label="Marketing Employee">{student.marketingEmployeeName}</Detail>
              <Detail label="WhatsApp Number">{student.whatsappNumber}</Detail>
              <Detail label="Guardian Contact">{student.guardianContactNumber}</Detail>
              <Detail label="PIN">{student.pin}</Detail>
              <Detail label="Status">{student.status}</Detail>
            </div>
            <div className="student-address">
              <MapPin size={16} />
              <div>
                <span>Present Address</span>
                <strong>{value(student.presentAddress || student.address)}</strong>
                <small>
                  {[
                    student.postOffice && "P.O. " + student.postOffice,
                    student.policeStation && "P.S. " + student.policeStation,
                    student.district,
                    student.state,
                    student.pin && "PIN " + student.pin,
                    student.nearestLandmark && "Landmark " + student.nearestLandmark,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <span style={{ marginTop: 8 }}>Permanent Address</span>
                <strong>
                  {value(
                    student.sameAsPresentAddress
                      ? "Same as present address"
                      : student.permanentAddress || "Not separately recorded",
                  )}
                </strong>
                <small>
                  {[
                    student.permanentPostOffice && "P.O. " + student.permanentPostOffice,
                    student.permanentDistrict,
                    student.permanentState,
                    student.permanentPin && "PIN " + student.permanentPin,
                    student.permanentNearestLandmark &&
                      "Landmark " + student.permanentNearestLandmark,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
            </div>
          </section>
  );
}
