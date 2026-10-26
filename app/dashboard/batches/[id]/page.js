"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Users, BookOpen, Clock3, Save, Ban } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function BatchDetailPage({ params }) {
  const [batch, setBatch] = useState(null);
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load(id) {
    setLoading(true);
    try {
      const r = await fetch("/api/batches/" + id, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) setBatch(d.batch);
      else alert(d.error || "Unable to load batch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { id } = await params;
      setBatchId(id);
      await load(id);
    })();
  }, [params]);

  async function update(values) {
    setSaving(true);
    try {
      const r = await fetch("/api/batches/" + batchId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await r.json();
      if (!r.ok) return alert(d.error || "Unable to update batch");
      setBatch(d.batch);
    } finally {
      setSaving(false);
    }
  }

  async function cancelBatch() {
    if (!confirm("Cancel this batch? It will remain in the register for audit/history.")) return;
    await update({ status: "Cancelled" });
  }

  if (loading) return <ERPLayout active="/dashboard/batches"><div className="empty">Loading batch…</div></ERPLayout>;
  if (!batch) return <ERPLayout active="/dashboard/batches"><div className="empty">Batch not found.</div></ERPLayout>;

  return (
    <ERPLayout active="/dashboard/batches">
      <header className="topbar">
        <div>
          <div className="crumb">RCLD Islampur / Batches / {batch.batchCode}</div>
          <h1>{batch.name}</h1>
        </div>
        <a className="ghost-btn" href="/dashboard/batches"><ArrowLeft size={16}/> Back to Batches</a>
      </header>

      <div className="welcome">
        <div>
          <span className="eyebrow">{batch.batchCode}</span>
          <h2>{batch.courseCode} — {batch.courseName}</h2>
          <p>Course → Batch → Series → Schedule. This page is the operational record for the batch.</p>
        </div>
        <div className="form-actions" style={{padding:0,background:"transparent"}}>
          <button className="primary-btn" disabled={saving} onClick={() => update({ status: batch.status === "Active" ? "Draft" : "Active" })}>
            <Save size={16}/> {batch.status === "Active" ? "Move to Draft" : "Activate Batch"}
          </button>
          {batch.status !== "Cancelled" && <button className="ghost-btn" onClick={cancelBatch}><Ban size={16}/> Cancel</button>}
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric"><div className="metric-icon blue"><BookOpen size={20}/></div><span>Course</span><strong>{batch.courseCode}</strong><small>{batch.courseName}</small></div>
        <div className="metric"><div className="metric-icon green"><CalendarDays size={20}/></div><span>Series</span><strong>{batch.series?.length || 0}</strong><small>{(batch.series || []).join(", ")}</small></div>
        <div className="metric"><div className="metric-icon purple"><Clock3 size={20}/></div><span>Frequency</span><strong>{batch.classFrequency} / week</strong><small>{batch.schedules?.length || 0} generated schedule records</small></div>
        <div className="metric"><div className="metric-icon orange"><Users size={20}/></div><span>Faculty</span><strong>{batch.facultyName || "Unassigned"}</strong><small>Capacity {batch.capacity}</small></div>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h3>Batch Configuration</h3><p>Status, dates, capacity and notes remain editable without rebuilding the series.</p></div><span className="badge">{batch.status}</span></div>
        <div className="form-grid four" style={{padding:"18px 20px"}}>
          <label className="form-field"><span>Batch Name</span><input value={batch.name || ""} onChange={e => setBatch({...batch,name:e.target.value})}/></label>
          <label className="form-field"><span>Capacity</span><input type="number" min="1" value={batch.capacity || 50} onChange={e => setBatch({...batch,capacity:e.target.value})}/></label>
          <label className="form-field"><span>Start Date</span><input type="date" value={batch.startDate ? new Date(batch.startDate).toISOString().slice(0,10) : ""} onChange={e => setBatch({...batch,startDate:e.target.value})}/></label>
          <label className="form-field"><span>End Date</span><input type="date" value={batch.endDate ? new Date(batch.endDate).toISOString().slice(0,10) : ""} onChange={e => setBatch({...batch,endDate:e.target.value})}/></label>
        </div>
        <div className="form-actions"><button className="primary-btn" disabled={saving} onClick={() => update({name:batch.name,capacity:batch.capacity,startDate:batch.startDate,endDate:batch.endDate})}>Save Configuration</button></div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Series & Weekly Schedule</h3><p>The schedule below is generated from the supplied weekly series master.</p></div><span>{batch.schedules?.length || 0} records</span></div>
        <div className="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Series</th><th>Slot</th><th>Faculty</th></tr></thead><tbody>{(batch.schedules || []).map((s,i)=><tr key={i}><td><strong>{s.day}</strong></td><td>{s.time}</td><td>{s.series}</td><td>{s.slot}</td><td>{s.facultyName || "Unassigned"}</td></tr>)}</tbody></table></div>
      </section>
    </ERPLayout>
  );
}
