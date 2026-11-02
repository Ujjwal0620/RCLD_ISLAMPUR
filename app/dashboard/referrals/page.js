"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, RefreshCw, Search, Users, UserRound, UserCheck } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function ReferralsPage() {
  const [data, setData] = useState({ referrals: [], marketingEmployees: [] });
  const [form, setForm] = useState({ name: "", marketingEmployeeId: "", notes: "" });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try { const r = await fetch("/api/referrals", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to load referrals."); setData({ referrals: d.referrals || [], marketingEmployees: d.marketingEmployees || [] }); }
    catch (e) { setMessage(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function submit(e) {
    e.preventDefault(); if (saving) return; setSaving(true); setMessage("");
    try {
      const r = await fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to create referral.");
      setForm({ name: "", marketingEmployeeId: "", notes: "" }); setMessage("Referral created and assigned to the marketing employee."); await load();
    } catch (e) { setMessage(e.message); } finally { setSaving(false); }
  }
  const visible = data.referrals.filter((r) => (r.name + " " + r.marketingEmployeeName).toLowerCase().includes(search.toLowerCase()));
  return <ERPLayout active="/dashboard/referrals">
    <header className="topbar"><div><div className="crumb">Marketing / Referrals</div><h1>Referral Directory</h1></div><div className="top-actions"><a className="ghost-btn" href="/dashboard/marketing"><ArrowLeft size={16}/> Marketing CRM</a><button className="ghost-btn" onClick={load}><RefreshCw size={16}/> Refresh</button></div></header>
    <section className="marketing-hero referral-hero"><div><span>REFERRAL SOURCE MANAGEMENT</span><h2>Build your referral network</h2><p>Create referral names such as Ram or Shyam and assign each one to the marketing employee who manages that relationship.</p></div><div className="marketing-hero-icon"><Users size={36}/></div></section>
    <div className="referral-layout">
      <section className="panel referral-create-panel"><div className="panel-head"><div><h3>Add a referral</h3><p>Every referral must belong to a marketing employee.</p></div><Plus size={19}/></div>
        <form onSubmit={submit} className="referral-form">
          <label className="form-field"><span>Referral name *</span><input value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Ram, Shyam" required/></label>
          <label className="form-field"><span>Marketing employee *</span><select value={form.marketingEmployeeId} onChange={(e)=>setForm(f=>({...f,marketingEmployeeId:e.target.value}))} required><option value="">Select marketing employee</option>{data.marketingEmployees.map((e)=><option key={e.employeeId} value={e.employeeId}>{e.name} · {e.employeeId}</option>)}</select></label>
          <label className="form-field"><span>Notes (optional)</span><textarea rows="3" value={form.notes} onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Relationship or source details"/></label>
          {message&&<div className={message.includes("created")?"success-msg":"error-msg"}>{message}</div>}
          <button className="primary-btn" disabled={saving||!data.marketingEmployees.length}><Plus size={16}/>{saving?"Saving…":"Create referral"}</button>
          {!data.marketingEmployees.length&&<p className="referral-hint">No active Marketing employees found. Set an employee's department or designation to Marketing first.</p>}
        </form>
      </section>
      <section className="panel referral-list-panel"><div className="panel-head"><div><h3>All referrals</h3><p>{data.referrals.length} referral records</p></div><div className="marketing-search"><Search size={15}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search referrals"/></div></div>
        {loading?<div className="empty">Loading referrals…</div>:visible.length?<div className="referral-table-wrap"><table><thead><tr><th>Referral</th><th>Marketing employee</th><th>Students</th><th>Status</th></tr></thead><tbody>{visible.map((r)=><tr key={r._id}><td><strong>{r.name}</strong></td><td>{r.marketingEmployeeName}</td><td><span className="referral-student-count">{r.studentCount||0}</span></td><td><span className={"marketing-status "+String(r.status).toLowerCase()}>{r.status}</span></td></tr>)}</tbody></table></div>:<div className="empty">No referrals found. Create the first referral above.</div>}
      </section>
    </div>
  </ERPLayout>;
}
