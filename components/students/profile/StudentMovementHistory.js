"use client";

export default function StudentMovementHistory({ history }) {
  return (
    <div className="movement-history">
                  <div className="movement-history-title">Movement Footprint</div>
                  {history.length === 0 ? (
                    <div className="empty">No batch movement history yet.</div>
                  ) : (
                    history.map((h) => (
                      <div className="movement-card" key={h._id}>
                        <div className="movement-card-head">
                          <strong>
                            {h.action === "SHIFTED"
                              ? "Batch Shifted"
                              : h.action === "DROPPED_OUT"
                                ? "Dropped Out"
                                : "Rejoined Batch"}
                          </strong>
                          <span>{h.occurredAt ? new Date(h.occurredAt).toLocaleString() : ""}</span>
                        </div>
                        <div className="movement-grid">
                          <div>
                            <small>From</small>
                            <b>{h.fromBatch?.batchCode || "—"}</b>
                          </div>
                          <div>
                            <small>To</small>
                            <b>{h.toBatch?.batchCode || "Dropout / —"}</b>
                          </div>
                          <div>
                            <small>From Faculty</small>
                            <b>
                              {(h.fromBatch?.faculty || [])
                                .map((x) => x.name)
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </b>
                          </div>
                          <div>
                            <small>To Faculty</small>
                            <b>
                              {(h.toBatch?.faculty || [])
                                .map((x) => x.name)
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </b>
                          </div>
                        </div>
                        <div className="movement-remark">
                          <strong>Remark:</strong> {h.remark}
                        </div>
                        <div className="movement-grid">
                          <div>
                            <small>From Series</small>
                            <b>{(h.fromBatch?.series || []).join(", ") || "—"}</b>
                          </div>
                          <div>
                            <small>To Series</small>
                            <b>{(h.toBatch?.series || []).join(", ") || "—"}</b>
                          </div>
                          <div>
                            <small>From Schedule</small>
                            <b>
                              {(h.fromBatch?.schedules || [])
                                .map((x) => `${x.day} ${x.time} ${x.series || ""}`)
                                .join(" · ") || "—"}
                            </b>
                          </div>
                          <div>
                            <small>To Schedule</small>
                            <b>
                              {(h.toBatch?.schedules || [])
                                .map((x) => `${x.day} ${x.time} ${x.series || ""}`)
                                .join(" · ") || "—"}
                            </b>
                          </div>
                        </div>
                        {h.attendanceSnapshot?.from && (
                          <div className="movement-footprint">
                            Attendance footprint: {h.attendanceSnapshot.from.total || 0} records ·{" "}
                            {h.attendanceSnapshot.from.percentage || 0}% present
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
  );
}
