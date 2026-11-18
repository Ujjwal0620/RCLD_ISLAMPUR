"use client";

import { Phone as PhoneIcon } from "lucide-react";

export default function StudentContactHistory({ contactLogs }) {
  return (
    <section className="detail-section">
            <div className="detail-section-title">
              <PhoneIcon size={17} />
              <h3>Calling & Follow-up History</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Phone</th>
                    <th>Calling Remark</th>
                    <th>Remarks</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {contactLogs.length ? (
                    contactLogs.map((x) => (
                      <tr key={x._id}>
                        <td>{x.createdAt ? new Date(x.createdAt).toLocaleString() : "—"}</td>
                        <td>
                          <a
                            href={
                              x.phoneNumber
                                ? "tel:" + String(x.phoneNumber).replace(/\s+/g, "")
                                : "#"
                            }
                          >
                            {x.phoneNumber || "—"}
                          </a>
                        </td>
                        <td>{x.callingRemark || "—"}</td>
                        <td>{x.remarks || "—"}</td>
                        <td>{x.actorName || x.actorId || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5">
                        <div className="empty">No calling or follow-up remarks recorded yet.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
  );
}
