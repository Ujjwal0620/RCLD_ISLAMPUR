"use client";

export default function StudentTransitionForm({
  student, batches, setStudent, setEditForm, history, setHistory,
  transition, setTransition, transitioning, setTransitioning, setMessage,
}) {
  return (
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
  );
}
