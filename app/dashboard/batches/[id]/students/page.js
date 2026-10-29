"use client";
import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,CalendarDays,CheckCircle2,Save,WalletCards,Users} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function BatchStudentsPage({params}){
  const [batchId,setBatchId]=useState(""),[batch,setBatch]=useState(null),[students,setStudents]=useState([]),[date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [subject,setSubject]=useState(""),[markedBy,setMarkedBy]=useState("faculty"),[loading,setLoading]=useState(true),[savingAttendance,setSavingAttendance]=useState(false),[message,setMessage]=useState("");
  const [attendance,setAttendance]=useState({}),[payments,setPayments]=useState({}),[savingFee,setSavingFee]=useState({});

  async function load(id,d=date){
    setLoading(true);setMessage("");
    try{
      const r=await fetch("/api/batches/"+id+"/roster?date="+encodeURIComponent(d),{cache:"no-store"}),data=await r.json();
      if(!r.ok)throw new Error(data.error||"Unable to load batch students.");
      setBatch(data.batch);setStudents(data.students||[]);
      const next={};(data.students||[]).forEach(s=>{next[s._id]=s.attendance?.status||""});setAttendance(next);
    }catch(e){setMessage(e.message)}finally{setLoading(false)}
  }
  useEffect(()=>{(async()=>{const {id}=await params;setBatchId(id);await load(id)})()},[params]);
  useEffect(()=>{if(batchId)load(batchId,date)},[date]);

  const stats=useMemo(()=>{const values=students.map(s=>attendance[s._id]||"");return {present:values.filter(x=>x==="Present").length,absent:values.filter(x=>x==="Absent").length,leave:values.filter(x=>x==="Leave").length}},[students,attendance]);

  function setAll(status){const n={};students.forEach(s=>{n[s._id]=status});setAttendance(n)}
  async function saveAttendance(){
    setSavingAttendance(true);setMessage("");
    try{
      const records=students.filter(s=>attendance[s._id]).map(s=>({studentId:s._id,status:attendance[s._id],subject,note:""}));
      const r=await fetch("/api/batches/"+batchId+"/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date,subject,markedBy,records})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save attendance.");
      setMessage(d.message||"Attendance saved.");await load(batchId,date);
    }catch(e){setMessage(e.message)}finally{setSavingAttendance(false)}
  }
  async function savePayment(student){
    const p=payments[student._id]||{};const amount=Number(p.amount||0);if(amount<=0)return alert("Enter a payment amount.");
    if(amount>Number(student.fee?.due||0))return alert("Payment cannot be greater than the current due amount.");
    setSavingFee(v=>({...v,[student._id]:true}));
    try{
      const r=await fetch("/api/students/"+student._id+"/fees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        totalFee:student.fee.totalFee,discount:student.fee.discount,admissionFee:student.fee.admissionFee,
        payment:{amount,date,method:p.method||"Cash",reference:p.reference||""},updatedBy:markedBy
      })});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to update fee.");
      setStudents(v=>v.map(s=>s._id===student._id?{...s,fee:{...student.fee,paid:d.fee.paid,due:d.fee.due}}:s));
      setPayments(v=>({...v,[student._id]:{amount:"",method:p.method||"Cash",reference:""}}));
      setMessage(student.applicantName+" fee payment recorded.");
    }catch(e){setMessage(e.message)}finally{setSavingFee(v=>({...v,[student._id]:false}))}
  }

  return <ERPLayout active="/dashboard/batches">
    <header className="topbar"><div><div className="crumb">Batches / {batch?.batchCode||"Students"}</div><h1>{batch?.batchCode||"Batch Students"}</h1></div><div className="top-actions"><a className="ghost-btn" href={"/dashboard/batches/"+batchId}><ArrowLeft size={16}/> Back to Batch</a></div></header>
    {loading?<section className="panel"><div className="empty">Loading batch students…</div></section>:<main>
      <section className="welcome"><div><span className="eyebrow">{batch?.batchCode}</span><h2>{batch?.courseCode} — {batch?.courseName}</h2><p>Batch roster · {students.length} students · Attendance, fees and due amounts are managed from this table.</p></div><div className="top-actions"><span className="badge">{students.length}/{batch?.capacity||50} students</span></div></section>
      <section className="panel">
        <div className="panel-head"><div><h3>Batch Students</h3><p>Attendance can be marked by Faculty, Super Admin or Office Admin. Fee payments can be recorded for an individual student without leaving this roster.</p></div><div className="top-actions"><label className="form-field" style={{margin:0}}><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><select value={markedBy} onChange={e=>setMarkedBy(e.target.value)}><option value="faculty">Faculty</option><option value="superadmin">Super Admin</option><option value="office-admin">Office Admin</option></select></div></div>
        <div className="attendance-toolbar"><div><strong>{stats.present} Present</strong><span>{stats.absent} Absent · {stats.leave} Leave</span></div><div className="top-actions"><button className="ghost-btn" onClick={()=>setAll("Present")}>Mark All Present</button><button className="ghost-btn" onClick={()=>setAll("Absent")}>Mark All Absent</button><button className="primary-btn" disabled={savingAttendance} onClick={saveAttendance}><CheckCircle2 size={16}/>{savingAttendance?"Saving…":"Save Attendance"}</button></div></div>
        {message&&<div className="success-msg" style={{margin:"0 20px 16px"}}>{message}</div>}
        {students.length===0?<div className="empty">No students have been assigned to this batch yet.</div>:<div className="table-wrap"><table className="batch-roster-table"><thead><tr><th>#</th><th>Student</th><th>Course</th><th>Mobile</th><th>Attendance</th><th>Total Fee</th><th>Paid</th><th>Due Amount</th><th>Record Fee Payment</th></tr></thead><tbody>{students.map((s,i)=>{const p=payments[s._id]||{amount:"",method:"Cash",reference:""};return <tr key={s._id}><td>{i+1}</td><td><strong>{s.applicantName}</strong><small>{s.formNo}</small></td><td>{s.courseCode||s.courseName||"—"}</td><td>{s.mobileNumber||"—"}</td><td><select value={attendance[s._id]||""} onChange={e=>setAttendance(v=>({...v,[s._id]:e.target.value}))}><option value="">Not marked</option><option>Present</option><option>Absent</option><option>Leave</option></select></td><td>₹{Number(s.fee?.totalFee||0)+Number(s.fee?.admissionFee||0)-Number(s.fee?.discount||0).toLocaleString?.("en-IN")}</td><td>₹{Number(s.fee?.paid||0).toLocaleString("en-IN")}</td><td><strong className={Number(s.fee?.due||0)>0?"fee-due":"fee-paid"}>₹{Number(s.fee?.due||0).toLocaleString("en-IN")}</strong></td><td><div className="fee-inline"><input type="number" min="0" max={s.fee?.due||0} value={p.amount} onChange={e=>setPayments(v=>({...v,[s._id]:{...p,amount:e.target.value}}))} placeholder="Amount"/><select value={p.method} onChange={e=>setPayments(v=>({...v,[s._id]:{...p,method:e.target.value}}))}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>PhonePe</option></select><button className="ghost-btn" disabled={savingFee[s._id]} onClick={()=>savePayment(s)}><Save size={14}/>{savingFee[s._id]?"…":"Save"}</button></div></td></tr>})}</tbody></table></div>}
      </section>
    </main>}
  </ERPLayout>
}