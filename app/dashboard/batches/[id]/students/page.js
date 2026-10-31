"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,CalendarDays,CheckCircle2,Save,WalletCards,Users,Phone,MoreVertical,ArrowRightLeft,UserMinus,History,ExternalLink} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function BatchStudentsPage({params}){
  const [batchId,setBatchId]=useState(""),[batch,setBatch]=useState(null),[students,setStudents]=useState([]),[allBatches,setAllBatches]=useState([]);
  const [date,setDate]=useState(new Date().toISOString().slice(0,10)),[subject,setSubject]=useState(""),[markedBy,setMarkedBy]=useState(""),[viewer,setViewer]=useState(null),[stats,setStats]=useState({});
  const [loading,setLoading]=useState(true),[savingAttendance,setSavingAttendance]=useState(false),[message,setMessage]=useState(""),[attendance,setAttendance]=useState({}),[payments,setPayments]=useState({}),[savingFee,setSavingFee]=useState({});
  const [contact,setContact]=useState({}),[savingContact,setSavingContact]=useState({});
  const [openMenu,setOpenMenu]=useState(""),[movement,setMovement]=useState(null),[movementRemark,setMovementRemark]=useState(""),[moving,setMoving]=useState(false);

  async function load(id,d=date){
    setLoading(true);setMessage("");
    try{
      const r=await fetch("/api/batches/"+id+"/roster?date="+encodeURIComponent(d),{cache:"no-store"}),data=await r.json();
      if(!r.ok)throw new Error(data.error||"Unable to load batch students.");
      setBatch(data.batch);setStudents(data.students||[]);setStats(data.stats||{});
      const next={};(data.students||[]).forEach(s=>{next[s._id]=s.attendance?.status||""});setAttendance(next);
    }catch(e){setMessage(e.message)}finally{setLoading(false)}
  }
  useEffect(()=>{(async()=>{const {id}=await params;setBatchId(id);const mr=await fetch("/api/auth/me",{cache:"no-store"});const md=await mr.json();if(mr.ok){setViewer(md.user);setMarkedBy(md.user.role);}const br=await fetch("/api/batches",{cache:"no-store"});const bd=await br.json();if(br.ok)setAllBatches(bd.batches||[]);await load(id)})()},[params]);
  useEffect(()=>{if(batchId)load(batchId,date)},[date]);
  useEffect(()=>{const close=()=>setOpenMenu("");window.addEventListener("click",close);return()=>window.removeEventListener("click",close)},[]);

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
      const r=await fetch("/api/students/"+student._id+"/fees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({totalFee:student.fee.totalFee,discount:student.fee.discount,admissionFee:student.fee.admissionFee,payment:{amount,date,method:p.method||"Cash",reference:p.reference||"",paymentType:"Monthly Installment",installmentMonth:date.slice(0,7),note:"Monthly Installment "+date.slice(0,7)},updatedBy:markedBy})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to update fee.");
      await load(batchId,date);setPayments(v=>({...v,[student._id]:{amount:"",method:p.method||"Cash",reference:""}}));setMessage(student.applicantName+" fee payment recorded.");
    }catch(e){setMessage(e.message)}finally{setSavingFee(v=>({...v,[student._id]:false}))}
  }
  function contactValue(id,key){return contact[id]?.[key]||""}
  async function saveContact(student){
    const c=contact[student._id]||{};
    if(!c.callingRemark?.trim()&&!c.remarks?.trim())return alert("Enter a calling remark or remarks.");
    setSavingContact(v=>({...v,[student._id]:true}));
    try{
      const r=await fetch("/api/students/"+student._id+"/contact-log",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phoneNumber:student.mobileNumber,callingRemark:c.callingRemark,remarks:c.remarks})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save contact remarks.");
      setContact(v=>({...v,[student._id]:{callingRemark:"",remarks:""}}));setMessage("Contact remarks saved for "+student.applicantName+".");
    }catch(e){setMessage(e.message)}finally{setSavingContact(v=>({...v,[student._id]:false}))}
  }
  async function moveStudent(){
    if(!movement)return;
    if(!movementRemark.trim())return alert("Enter a movement remark.");
    if(movement.action==="SHIFTED"&&!movement.toBatchId)return alert("Select the destination batch.");
    setMoving(true);
    try{
      const r=await fetch("/api/students/"+movement.student._id+"/batch-history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:movement.action,toBatchId:movement.toBatchId,remark:movementRemark})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to complete movement.");
      setMovement(null);setMovementRemark("");setOpenMenu("");setMessage(d.message||"Student movement saved.");await load(batchId,date);
    }catch(e){alert(e.message)}finally{setMoving(false)}
  }
  const canManage=["superadmin","office-admin"].includes(viewer?.role);
  const shiftBatches=allBatches.filter(b=>String(b._id)!==String(batchId)&&["Draft","Active"].includes(b.status)&&((String(b.courseCode||"").toUpperCase()===String(batch?.courseCode||"").toUpperCase())||(String(b.courseName||"").trim()===String(batch?.courseName||"").trim())));
  const statCards=[
    {label:"Classes Today",value:stats.classesToday||0,help:"Scheduled for today",icon:<CalendarDays size={19}/>},
    {label:"Attendance Days",value:stats.attendanceDaysMarked||0,help:"Days attendance marked",icon:<CheckCircle2 size={19}/>},
    {label:"Total Classes",value:stats.totalClasses||0,help:"Scheduled classes to date",icon:<WalletCards size={19}/>},
    {label:"Total Present",value:stats.presentTotal||0,help:"Present records",icon:<Users size={19}/>}
  ];

  return <ERPLayout active="/dashboard/batches">
    <header className="topbar"><div><div className="crumb">Batches / {batch?.batchCode||"Students"}</div><h1>{batch?.batchCode||"Batch Students"}</h1></div><div className="top-actions"><a className="ghost-btn" href={"/dashboard/batches/"+batchId}><ArrowLeft size={16}/> Back to Batch</a></div></header>
    {loading?<section className="panel"><div className="empty">Loading batch students…</div></section>:<main>
      <section className="welcome"><div><span className="eyebrow">{batch?.batchCode}</span><h2>{batch?.courseCode} — {batch?.courseName}</h2><p>Batch Register · Attendance, student profile, contact follow-up, fees and controlled batch movement.</p><p><strong>Faculty today:</strong> {batch?.activeFaculty?.name||batch?.facultyName||"Unassigned"}{batch?.primaryFacultyOffDay?" · backup faculty shown because primary faculty has an off day":""}</p></div><div className="top-actions"><span className="badge">{students.length}/{batch?.capacity||50} students</span></div></section>

      <section className="metric-grid" style={{marginBottom:18}}>{statCards.map((x,i)=><div className="metric" key={x.label}><div className={"metric-icon "+["blue","green","purple","orange"][i]}>{x.icon}</div><span>{x.label}</span><strong>{x.value}</strong><small>{x.help}</small></div>)}</section>

      <section className="panel">
        <div className="panel-head"><div><h3>Batch Attendance Sheet</h3><p>Mark attendance for the selected date. Click a mobile number to start a call; call remark and general remarks are saved separately for follow-up history.</p></div><div className="top-actions"><label className="form-field" style={{margin:0}}><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="badge">{viewer?.designation||"Employee"} · {viewer?.name||""}</div></div></div>
        <div className="attendance-toolbar"><div><strong>{students.filter(s=>attendance[s._id]==="Present").length} Present</strong><span>{students.filter(s=>attendance[s._id]==="Absent").length} Absent · {students.filter(s=>attendance[s._id]==="Leave").length} Leave</span></div><div className="top-actions"><button className="ghost-btn" onClick={()=>setAll("Present")}>Mark All Present</button><button className="ghost-btn" onClick={()=>setAll("Absent")}>Mark All Absent</button><button className="primary-btn" disabled={savingAttendance} onClick={saveAttendance}><CheckCircle2 size={16}/>{savingAttendance?"Saving…":"Save Attendance"}</button></div></div>
        {message&&<div className="success-msg" style={{margin:"0 20px 16px"}}>{message}</div>}
        {students.length===0?<div className="empty">No students have been assigned to this batch yet.</div>:<div className="table-wrap"><table className="batch-roster-table"><thead><tr><th>#</th><th>Student / Profile</th><th>Mobile / Call</th><th>Attendance</th><th>Call Remark</th><th>Remarks</th><th>Batch Movement</th><th>Total Fee</th><th>Paid</th><th>Due</th><th>Monthly Installment</th><th>Monthly Due</th><th>Fee Update</th></tr></thead><tbody>{students.map((s,i)=>{const p=payments[s._id]||{amount:"",method:"Cash",reference:""};const c=contact[s._id]||{callingRemark:"",remarks:""};return <tr key={s._id}>
          <td>{i+1}</td>
          <td><strong>{s.applicantName}</strong><small>{s.formNo}</small><div style={{display:"flex",gap:6,marginTop:5}}><a className="ghost-btn" style={{padding:"5px 8px",fontSize:11}} href={"/dashboard/students/"+s._id}>Profile <ExternalLink size={12}/></a>{s.latestMovement&&<span className="badge" title={s.latestMovement.remark}>{s.latestMovement.action==="SHIFTED"?"Shifted":s.latestMovement.action==="DROPPED_OUT"?"Dropped Out":"Rejoined"}</span>}</div></td>
          <td><a href={s.mobileNumber?"tel:"+String(s.mobileNumber).replace(/\s+/g,""):"#"} className="phone-link" title="Start phone call"><Phone size={15}/>{s.mobileNumber||"—"}</a></td>
          <td><select value={attendance[s._id]||""} onChange={e=>setAttendance(v=>({...v,[s._id]:e.target.value}))}><option value="">Not marked</option><option>Present</option><option>Absent</option><option>Leave</option></select></td>
          <td><input value={c.callingRemark} onChange={e=>setContact(v=>({...v,[s._id]:{...c,callingRemark:e.target.value}}))} placeholder="Calling remark"/></td>
          <td><input value={c.remarks} onChange={e=>setContact(v=>({...v,[s._id]:{...c,remarks:e.target.value}}))} placeholder="Remarks"/><button className="ghost-btn" style={{marginTop:5,padding:"5px 8px",fontSize:11}} disabled={savingContact[s._id]} onClick={()=>saveContact(s)}>{savingContact[s._id]?"Saving…":"Save remark"}</button></td>
          <td>{s.latestMovement?<div style={{fontSize:11,lineHeight:1.45}}><strong>{s.latestMovement.action==="SHIFTED"?"Shifted":"Dropped Out"}</strong><br/>{s.latestMovement.fromBatch?.batchCode||"—"} {s.latestMovement.fromBatch?.faculty?.map(f=>f.name).filter(Boolean).join(", ")&&" · "+s.latestMovement.fromBatch.faculty.map(f=>f.name).filter(Boolean).join(", ")}{s.latestMovement.toBatch&&<><br/><ArrowRightLeft size={11}/> {s.latestMovement.toBatch.batchCode} · {s.latestMovement.toBatch.faculty?.map(f=>f.name).filter(Boolean).join(", ")||"No faculty"}</>}</div>:<span className="badge">Current batch</span>}{canManage&&<div style={{position:"relative",display:"inline-block",marginLeft:6}}><button className="icon-btn" title="Student actions" onClick={e=>{e.stopPropagation();setOpenMenu(openMenu===s._id?"":s._id)}}><MoreVertical size={16}/></button>{openMenu===s._id&&<div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:0,top:36,zIndex:20,minWidth:190,background:"white",border:"1px solid #e5e7eb",borderRadius:10,boxShadow:"0 12px 30px rgba(0,0,0,.14)",padding:6}}><button className="ghost-btn" style={{width:"100%",justifyContent:"flex-start",border:0}} onClick={()=>{setMovement({student:s,action:"SHIFTED",toBatchId:""});setMovementRemark("");setOpenMenu("")}}><ArrowRightLeft size={15}/> Shift Batch</button><button className="ghost-btn" style={{width:"100%",justifyContent:"flex-start",border:0,color:"#b42318"}} onClick={()=>{setMovement({student:s,action:"DROPPED_OUT"});setMovementRemark("");setOpenMenu("")}}><UserMinus size={15}/> Drop Out</button><a className="ghost-btn" style={{width:"100%",justifyContent:"flex-start",border:0}} href={"/dashboard/students/"+s._id}><History size={15}/> Student History</a></div>}</div>}</td>
          <td>₹{(Number(s.fee?.totalFee||0)+Number(s.fee?.admissionFee||0)-Number(s.fee?.discount||0)).toLocaleString("en-IN")}</td>
          <td>₹{Number(s.fee?.paid||0).toLocaleString("en-IN")}</td>
          <td><strong className={Number(s.fee?.due||0)>0?"fee-due":"fee-paid"}>₹{Number(s.fee?.due||0).toLocaleString("en-IN")}</strong></td>
          <td><strong>₹{Number(s.monthlyFee?.installment||600).toLocaleString("en-IN")}</strong><small>per month</small></td>
          <td><div className="monthly-due-cell"><span>Previous <b>₹{Number(s.monthlyFee?.outstandingPreviousDue||0).toLocaleString("en-IN")}</b></span><span>Current <b>₹{Number(s.monthlyFee?.currentMonthlyDue||0).toLocaleString("en-IN")}</b></span><strong>Total ₹{Number(s.monthlyFee?.totalPayableDueTillDate||0).toLocaleString("en-IN")}</strong></div></td>
          <td>{canManage?<div className="fee-inline"><input type="number" min="0" max={s.monthlyFee?.totalPayableDueTillDate||s.fee?.due||0} value={p.amount} onChange={e=>setPayments(v=>({...v,[s._id]:{...p,amount:e.target.value}}))} placeholder="Amount"/><select value={p.method} onChange={e=>setPayments(v=>({...v,[s._id]:{...p,method:e.target.value}}))}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>PhonePe</option></select><button className="ghost-btn" disabled={savingFee[s._id]} onClick={()=>savePayment(s)}><Save size={14}/>{savingFee[s._id]?"…":"Save"}</button></div>:<span className="badge">View only</span>}</td>
        </tr>})}</tbody></table></div>}
      </section>
    </main>}

    {movement&&<div onClick={()=>!moving&&setMovement(null)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(15,23,42,.45)",display:"grid",placeItems:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} className="panel" style={{width:"min(620px,100%)",margin:0}}>
        <div className="panel-head"><div><h3>{movement.action==="SHIFTED"?"Shift Student to Another Batch":"Drop Out Student"}</h3><p><strong>{movement.student.applicantName}</strong> · {movement.student.formNo}</p></div><button className="icon-btn" onClick={()=>setMovement(null)}>×</button></div>
        <div style={{padding:20}}>
          {movement.action==="SHIFTED"?<label className="form-field"><span>Shift to Batch</span><select value={movement.toBatchId||""} onChange={e=>setMovement(v=>({...v,toBatchId:e.target.value}))}><option value="">Select destination batch</option>{shiftBatches.map(b=><option key={b._id} value={b._id}>{b.batchCode} — {b.name} · {b.facultyName||b.facultyNames?.filter(Boolean).join(", ")||"No faculty"}</option>)}</select><small>Only Draft/Active batches for the same course are shown. Previous batch, series and faculty remain in the movement history.</small></label>:<div className="badge" style={{display:"inline-flex"}}>Student will be removed from the current batch and status will become Dropped Out.</div>}
          <label className="form-field" style={{marginTop:16}}><span>Movement Remark</span><textarea rows="4" value={movementRemark} onChange={e=>setMovementRemark(e.target.value)} placeholder="Reason / request / approval remark"/></label>
          <div className="form-actions"><button className="ghost-btn" onClick={()=>setMovement(null)} disabled={moving}>Cancel</button><button className="primary-btn" onClick={moveStudent} disabled={moving}>{moving?"Saving…":movement.action==="SHIFTED"?"Confirm Batch Shift":"Confirm Drop Out"}</button></div>
        </div>
      </div>
    </div>}
  </ERPLayout>
}