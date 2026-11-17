"use client";

import { ArrowRightLeft, History, UserX } from "lucide-react";
import StudentMovementHistory from "@/components/students/profile/StudentMovementHistory";

export default function StudentTransitionPanel({
  student, batches, history, setHistory, editForm, setEditForm, setStudent,
  transition, setTransition, transitioning, setTransitioning, setMessage,
}) {
  return (
    <section className="detail-section student-transition-panel">
            <div className="detail-section-title">
              <History size={17} />
              <div>
                <h3>Batch Movement & Student Status</h3>
                <span>
                  Every shift, dropout and rejoin is permanently recorded with batch, series,
                  faculty, schedule, attendance footprint and remark.
                </span>
              </div>
            </div>
            <div className="transition-actions">
              {student.batchId && student.status !== "Dropped Out" && (
                <button
                  className="ghost-btn"
                  onClick={() => setTransition({ action: "SHIFTED", batchId: "", remark: "" })}
                >
                  <ArrowRightLeft size={16} /> Shift Batch
                </button>
              )}
              {student.batchId && student.status !== "Dropped Out" && (
                <button
                  className="danger-btn"
                  onClick={() => setTransition({ action: "DROPPED_OUT", batchId: "", remark: "" })}
                >
                  <UserX size={16} /> Mark Dropout
                </button>
              )}
              {student.status === "Dropped Out" && (
                <button
                  className="primary-btn"
                  onClick={() =>
                    setTransition({
                      action: "REJOINED",
                      batchId: String(
                        history.find((h) => h.action === "DROPPED_OUT")?.fromBatch?.batchId || "",
                      ),
                      remark: "",
                    })
                  }
                >
                  <ArrowRightLeft size={16} /> Drop Back to Batch
                </button>
              )}
            </div>
            {transition.action && (
              <div className="transition-form">
                <div className="transition-form-head">
                  <strong>
                    {transition.action === "SHIFTED"
                      ? "Shift Student"
                      : transition.action === "DROPPED_OUT"
                        ? "Mark Student as Dropout"
                        : "Drop Student Back to Batch"}
                  </strong>
                  <button
                    className="ghost-btn"
                    onClick={() => setTransition({ action: "", batchId: "", remark: "" })}
                  >
                    Cancel
                  </button>
                </div>
                {(transition.action === "SHIFTED" || transition.action === "REJOINED") && (
                  <label className="form-field">
                    <span>
                      {transition.action === "REJOINED" ? "Restore / Select Batch" : "Target Batch"}
                    </span>
                    <select
                      value={transition.batchId}
                      onChange={(e) => setTransition((t) => ({ ...t, batchId: e.target.value }))}
                    >
                      <option value="">Select batch</option>
                      {batches
                        .filter(
                          (b) =>
                            ["Draft", "Active"].includes(b.status) &&
                            String(b.courseCode || "").toUpperCase() ===
                              String(student.courseCode || "").toUpperCase(),
                        )
                        .map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.batchCode} — {b.name} · {b.courseCode}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label className="form-field">
                  <span>
                    Remark <b>*</b>
                  </span>
                  <textarea
                    rows="3"
                    value={transition.remark}
                    onChange={(e) => setTransition((t) => ({ ...t, remark: e.target.value }))}
                    placeholder={
                      transition.action === "SHIFTED"
                        ? "Why is the student being shifted?"
                        : transition.action === "DROPPED_OUT"
                          ? "Reason for dropout"
                          : "Reason for rejoining / dropping back to batch"
                    }
                  />
                </label>
                <button
                  className="primary-btn"
                  disabled={
                    transitioning ||
                    transition.remark.trim().length < 3 ||
                    (transition.action !== "DROPPED_OUT" && !transition.batchId)
                  }
                  onClick={async () => {
                    setTransitioning(true);
                    setMessage("");
                    try {
                      const r = await fetch("/api/students/" + student._id + "/batch-history", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: transition.action,
                          toBatchId: transition.batchId,
                          remark: transition.remark,
                          actor: "superadmin",
                          actorRole: "superadmin",
                        }),
                      });
                      const d = await r.json();
                      if (!r.ok) {
                        setMessage(d.error || "Unable to update student movement.");
                        return;
                      }
                      const sr = await fetch("/api/students/" + student._id, { cache: "no-store" });
                      const sd = await sr.json();
                      if (sr.ok) {
                        setStudent(sd.student);
                        setEditForm(sd.student);
                      }
                      const hr = await fetch("/api/students/" + student._id + "/batch-history", {
                        cache: "no-store",
                      });
                      const hd = await hr.json();
                      if (hr.ok) setHistory(hd.history || []);
                      setTransition({ action: "", batchId: "", remark: "" });
                      setMessage(d.message || "Student movement updated.");
                    } finally {
                      setTransitioning(false);
                    }
                  }}
                >
                  {transitioning ? "Saving…" : "Confirm Movement"}
                </button>
              </div>
            )}
            <StudentMovementHistory history={history} />
          </section>
  );
}
