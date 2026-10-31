"use client";
import{useEffect,useMemo,useState}from"react";
import{Clock3,LogIn,LogOut,PauseCircle,PlayCircle,RefreshCw,CheckCircle2,TimerReset}from"lucide-react";
import ERPLayout from"@/components/ERPLayout";

const time=x=>x?new Date(x).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";
const duration=n=>{n=Math.max(0,Number(n||0));return Math.floor(n/60)+"h "+String(n%60).padStart(2,"0")+"m"};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());

function liveMinutes(record,now){
 if(!record?.punchIn)return 0;
 const total=record.punchOut?Number(record.totalMinutes||0):Math.max(0,Math.round((now-new Date(record.punchIn))/60000));
 const personal=(record.outTimes||[]).reduce((n,x)=>n+(x.end?Number(x.minutes||0):Math.max(0,Math.round((now-new Date(x.start))/60000))),0);
 return {total,work:Math.max(0,total-personal)};
}

export default function Attendance(){
 const[d,setD]=useState(null),[reason,setReason]=useState(""),[type,setType]=useState("Personal"),[error,setError]=useState(""),[busy,setBusy]=useState(false),[now,setNow]=useState(new Date());
 async function load(){const r=await fetch("/api/employee-attendance",{cache:"no-store"});if(r.status===401){location.href="/dashboard/login";return}setD(await r.json())}
 useEffect(()=>{load();const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t)},[]);
 async function act(action){setBusy(true);setError("");try{const r=await fetch("/api/employee-attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,reason,type})}),x=await r.json();if(!r.ok)setError(x.error||"Unable to complete action");else{setReason("");await load()}}finally{setBusy(false)}}
 const r=d?.record,calc=useMemo(()=>liveMinutes(r,now),[r,now]),activeOut=(r?.outTimes||[]).find(x=>!x.end);
 return <ERPLayout active="/dashboard/attendance">
  <header className="topbar"><div><div className="crumb">Employee / Attendance</div><h1>My Attendance</h1></div><button className="icon-btn" onClick={load}><RefreshCw size={17}/></button></header>
  <section className="attendance-hero"><div><span className="eyebrow">TODAY · {d?.date||today()}</span><h2>{d?.employee?.name||"Employee"}</h2><p>{d?.employee?.employeeId||""} · {r?.status||"Not marked"}</p></div><div className="live-clock"><Clock3 size={18}/><strong>{now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</strong></div></section>
  <section className="attendance-punch-grid">
   <div className="attendance-status-card"><span>Attendance status</span><strong>{r?.punchOut?"Completed":r?.punchIn?(activeOut?"Out / On return":"Working"):"Not punched in"}</strong><small>{r?.punchIn?"In "+time(r.punchIn)+(r.punchOut?" · Out "+time(r.punchOut):""):"Punch in to start your day"}</small></div>
   <div className="attendance-status-card"><span>Effective work time</span><strong>{duration(calc.work)}</strong><small>Total elapsed {duration(calc.total)} · personal out-time deducted live</small></div>
   <div className="attendance-status-card"><span>Current out-time</span><strong>{activeOut?duration(Math.max(0,Math.round((now-new Date(activeOut.start))/60000))):"None"}</strong><small>{activeOut?activeOut.type+" · "+activeOut.reason:"No active out-time"}</small></div>
  </section>
  <section className="attendance-actions">
   <button disabled={busy||!!r?.punchIn} onClick={()=>act("punchIn")} className="punch-btn in"><LogIn/>Punch In</button>
   <button disabled={busy||!r?.punchIn||!!r?.punchOut||!!activeOut} onClick={()=>act("punchOut")} className="punch-btn out"><LogOut/>Punch Out</button>
  </section>
  <section className="panel out-time-panel">
   <div className="panel-head"><div><h3>Out Time / Return</h3><p>Start an official or personal out-time, then press Return when you come back. The timer stops immediately and the return time is saved.</p></div>{activeOut?<span className="badge"><TimerReset size={13}/> Active now</span>:<span className="badge"><CheckCircle2 size={13}/> Ready</span>}</div>
   <div className="out-time-form">
    <select value={type} onChange={x=>setType(x.target.value)} disabled={!!activeOut||!!r?.punchOut}><option>Personal</option><option>Official</option></select>
    <input value={reason} onChange={x=>setReason(x.target.value)} placeholder="Reason for going out" disabled={!!activeOut||!!r?.punchOut}/>
    <button disabled={busy||!r?.punchIn||!!r?.punchOut||!!activeOut||!reason.trim()} onClick={()=>act("startOut")}><PauseCircle size={16}/> Start Out</button>
    <button disabled={busy||!activeOut||!!r?.punchOut} onClick={()=>act("endOut")}><PlayCircle size={16}/> Return</button>
   </div>
   {error&&<div className="error-msg">{error}</div>}
   <div className="out-time-list">{(r?.outTimes||[]).map((x,i)=><div key={i}><strong>{x.type}</strong><span>{x.reason}</span><span>{time(x.start)} — {x.end?time(x.end):"Active now"}</span><b>{x.end?duration(x.minutes):duration(Math.max(0,Math.round((now-new Date(x.start))/60000)))}</b></div>)}{!(r?.outTimes||[]).length&&<div className="empty">No out-time records today.</div>}</div>
  </section>
 </ERPLayout>
}