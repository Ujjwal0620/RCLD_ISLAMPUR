"use client";

import { ArrowRightLeft, UserX } from "lucide-react";

export default function StudentTransitionActions({ student, history, setTransition }) {
  return (
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
  );
}
