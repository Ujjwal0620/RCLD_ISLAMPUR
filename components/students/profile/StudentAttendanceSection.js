"use client";

import { ClipboardCheck, Save } from "lucide-react";

export default function StudentAttendanceSection({ attendance, attForm, setAttForm, saveAttendance }) {
  return (
    <section className="detail-section">
                <div className="detail-section-title">
                  <ClipboardCheck size={17} />
                  <h3>Attendance</h3>
                </div>
                <div className="student-summary-grid compact">
                  <div className="summary-card">
                    <span>Present</span>
                    <strong>{attendance.summary?.present || 0}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Absent</span>
                    <strong>{attendance.summary?.absent || 0}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Leave</span>
                    <strong>{attendance.summary?.leave || 0}</strong>
                  </div>
                  <div className="summary-card">
                    <span>Percentage</span>
                    <strong>{attendance.summary?.percentage || 0}%</strong>
                  </div>
                </div>
                <form className="inline-operation-form" onSubmit={saveAttendance}>
                  <h4>Mark / Update Attendance</h4>
                  <div className="form-grid four">
                    <label className="form-field">
                      <span>Date</span>
                      <input
                        type="date"
                        value={attForm.date}
                        onChange={(e) => setAttForm((f) => ({ ...f, date: e.target.value }))}
                      />
                    </label>
                    <label className="form-field">
                      <span>Status</span>
                      <select
                        value={attForm.status}
                        onChange={(e) => setAttForm((f) => ({ ...f, status: e.target.value }))}
                      >
                        <option>Present</option>
                        <option>Absent</option>
                        <option>Leave</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Subject</span>
                      <input
                        value={attForm.subject}
                        onChange={(e) => setAttForm((f) => ({ ...f, subject: e.target.value }))}
                        placeholder="Subject"
                      />
                    </label>
                    <label className="form-field">
                      <span>Batch</span>
                      <input
                        value={attForm.batch}
                        onChange={(e) => setAttForm((f) => ({ ...f, batch: e.target.value }))}
                        placeholder="Batch / Series"
                      />
                    </label>
                    <button className="primary-btn operation-btn">
                      <Save size={16} /> Save Attendance
                    </button>
                  </div>
                </form>
                {(attendance.records || []).length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Subject</th>
                          <th>Batch</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.records.map((r) => (
                          <tr key={r._id}>
                            <td>{r.date}</td>
                            <td>{r.subject || "—"}</td>
                            <td>{r.batch || "—"}</td>
                            <td>
                              <span className="badge">{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
  );
}
