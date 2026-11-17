"use client";

import { History } from "lucide-react";
import StudentMovementHistory from "@/components/students/profile/StudentMovementHistory";
import StudentTransitionActions from "@/components/students/profile/StudentTransitionActions";
import StudentTransitionForm from "@/components/students/profile/StudentTransitionForm";

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
            <StudentTransitionActions student={student} history={history} setTransition={setTransition} />
            <StudentTransitionForm
              student={student}
              batches={batches}
              setStudent={setStudent}
              setEditForm={setEditForm}
              setHistory={setHistory}
              transition={transition}
              setTransition={setTransition}
              transitioning={transitioning}
              setTransitioning={setTransitioning}
              setMessage={setMessage}
            />
            <StudentMovementHistory history={history} />
          </section>
  );
}
