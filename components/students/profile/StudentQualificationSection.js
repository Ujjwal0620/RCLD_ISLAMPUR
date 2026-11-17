"use client";

import { FileText } from "lucide-react";
import { DetailField as Detail } from "@/components/students/DetailField";
import { formatDisplayValue as value } from "@/lib/formatters";

export default function StudentQualificationSection({ student }) {
  return (
    <section className="detail-section">
                <div className="detail-section-title">
                  <FileText size={17} />
                  <h3>Qualification, Documents & Declaration</h3>
                </div>
                {(student.qualifications || []).length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Exam / Course</th>
                          <th>Board / University</th>
                          <th>College / Institute</th>
                          <th>Year</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {student.qualifications.map((q, i) => (
                          <tr key={i}>
                            <td>{value(q.examCourse)}</td>
                            <td>{value(q.boardUniversity)}</td>
                            <td>{value(q.collegeInstitute)}</td>
                            <td>{value(q.year)}</td>
                            <td>{value(q.percentage)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty">No qualification information available.</div>
                )}
                <div className="student-detail-grid">
                  <Detail label="Declaration Date">{student.declarationDate}</Detail>
                  <Detail label="Declaration Place">{student.declarationPlace}</Detail>
                  <Detail label="Applicant Signature">
                    {student.signatureUrl ? (
                      <img
                        src={student.signatureUrl}
                        alt="Student signature"
                        style={{ maxWidth: 180, maxHeight: 64, objectFit: "contain" }}
                      />
                    ) : (
                      student.signatureApplicant
                    )}
                  </Detail>
                  <Detail label="Photo">
                    {student.enclosures?.stampPhoto ? "Attached" : "Not attached"}
                  </Detail>
                  <Detail label="Certificates">
                    {student.enclosures?.qualifyingCertificates ? "Attached" : "Not attached"}
                  </Detail>
                  <Detail label="Matric Admit Card">
                    {student.enclosures?.matricAdmitCard ? "Attached" : "Not attached"}
                  </Detail>
                </div>
              </section>
  );
}
