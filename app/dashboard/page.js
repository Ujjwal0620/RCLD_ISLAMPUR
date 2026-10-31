"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, FileText, RefreshCw, BriefcaseBusiness, Layers3, WalletCards, ArrowUpRight, UserCheck, UserX, CircleDollarSign, Activity, CalendarDays, Clock3, IndianRupee, GraduationCap, CheckCircle2, XCircle, Coffee, BarChart3 } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const money=n=>"₹"+Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:0});

function Donut({items,total}){
 const colors=["#5865f2","#10b981","#f59e0b","#ef4444","#7c3aed","#06b6d4","#64748b","#ec4899"];
 let cursor=0;
 const stops=items.map((x,i)=>{const start=cursor;cursor+=total?(x.value/total)*360:0;return colors[i%colors.length]+" "+start+"deg "+cursor+"deg";}).join(",");
 return <div className="dash-donut" style={{background:"conic-gradient("+ (stops||"#e8edf5 0 360deg") +")"}}><div><strong>{total}</strong><span>Students</span></div></div>;
}
function TrendChart({items,valueKey="value",labelKey="month",compact=false}){
 if(!items.length)return <div className="chart-empty">No data available for this period.</div>;
 const max=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));
 const points=items.map((x,i)=>({x:24+(i*(352/Math.max(1,items.length-1))),y:146-(Number(x[valueKey]||0)/max)*112}));
 const line=points.map(p=>p.x+","+p.y).join(" ");
 const area="24,146 "+line+" "+points[points.length-1].x+",146";
 return <div className={"trend-chart "+(compact?"compact-chart":"")}><svg viewBox="0 0 400 170" preserveAspectRatio="none"><defs><linearGradient id={"trend"+valueKey} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5865f2" stopOpacity=".22"/><stop offset="100%" stopColor="#5865f2" stopOpacity="0"/></linearGradient></defs><line x1="24" y1="146" x2="376" y2="146" stroke="#e8edf5"/><line x1="24" y1="90" x2="376" y2="90" stroke="#eef2f7"/><line x1="24" y1="34" x2="376" y2="34" stroke="#eef2f7"/><polygon points={area} fill={"url(#trend"+valueKey+")"}/><polyline points={line} fill="none" stroke="#5865f2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#5865f2" strokeWidth="2"/>)}</svg><div className="trend-labels">{items.map((x,i)=><span key={i}>{String(x[labelKey]).slice(5)||String(x[labelKey]).slice(0,10)}</span>)}</div></div>;
}
function Bars({items,valueKey,labelKey}){
 const max=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));
 return <div className="mini-bars">{items.map((x,i)=><div className="mini-bar-col" key={i}><div className="mini-bar-track"><div className="mini-bar-fill" style={{height:Math.max(5,(Number(x[valueKey]||0)/max)*100)+"%"}}/></div><span title={x[labelKey]}>{x[labelKey]}</span><b>{x[valueKey]}</b></div>)}</div>;
}

export default function DashboardPage(){
 const today=new Date().toISOString().slice(0,10);
 const [data,setData]=useState({students:0,recent:[],studentStatus:[],courses:[],batchPerformance:[],finance:{payable:0,collected:0,due:0,collectionPercentage:0}});
 const [activity,setActivity]=useState({attendance:{day:{Present:0,Absent:0,Leave:0,total:0},statusTotals:{Present:0,Absent:0,Leave:0},monthly:[]},faculty:[],batchAttendance:[],plannedClasses:[],fees:{collected:0,daily:[]}});
 const [period,setPeriod]=useState("day"),[date,setDate]=useState(today),[month,setMonth]=useState(today.slice(0,7)),[loading,setLoading]=useState(true),[activityLoading,setActivityLoading]=useState(false);

 async function load(){
  setLoading(true);
  try{const r=await fetch("/api/dashboard",{cache:"no-store"});setData(await r.json())}finally{setLoading(false)}
 }
 async function loadActivity(){
  setActivityLoading(true);
  try{const q=new URLSearchParams({mode:period,date,month});const r=await fetch("/api/dashboard/activity?"+q.toString(),{cache:"no-store"});setActivity(await r.json())}finally{setActivityLoading(false)}
 }
 useEffect(()=>{load()},[]);\n useEffect(()=>{\n  let active=true;\n  fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.authenticated)setUser(d.user)}).catch(()=>{});\n  const timer=setInterval(()=>setNow(new Date()),60000);\n  return ()=>{active=false;clearInterval(timer)};\n },[]);
 useEffect(()=>{loadActivity()},[period,date,month]);

 const statusTotal=data.studentStatus.reduce((n,x)=>n+x.value,0)||data.students;
 const topCourses=data.courses.slice(0,8);
 const capacity=data.batchUtilization||0;
 const attendance=activity.attendance.day;
 const attendanceTotal=period==="day"?attendance.total:activity.attendance.monthly.reduce((n,x)=>n+x.total,0);
 const present=period==="day"?attendance.Present:activity.attendance.monthly.reduce((n,x)=>n+x.Present,0);
 const absent=period==="day"?attendance.Absent:activity.attendance.monthly.reduce((n,x)=>n+x.Absent,0);
 const leave=period==="day"?attendance.Leave:activity.attendance.monthly.reduce((n,x)=>n+x.Leave,0);
 const feeChart=period==="day"?activity.fees.daily:activity.fees.daily;
 const feeTotal=activity.fees.collected;

 return <ERPLayout active="/dashboard" hideAssistant={false}>
  <header className="topbar"><div><div className="crumb">RCLD Islampur / ERP</div><h1>Dashboard</h1></div><div className="top-actions"><span className="dashboard-user-chip"><span className="dashboard-user-avatar">{loggedInName.charAt(0).toUpperCase()}</span><span><strong>{loggedInName}</strong><small>{user?.designation||"RCLD User"}</small></span></span><span className="dashboard-live"><span/> Live data</span><button className="icon-btn" onClick={()=>{load();loadActivity()}} title="Refresh"><RefreshCw size={18}/></button><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></div></header>

  <section className="dashboard-hero"><div><span className="eyebrow">ERP CONTROL CENTER</span><h2>{greeting}, {loggedInName} 👋</h2><p>Students, batches, faculty, attendance, classes and fee collection — all in one operational view.</p><div className="hero-actions"><a className="hero-light-btn" href="/dashboard/students">Open Student Registry <ArrowUpRight size={15}/></a><a className="hero-ghost-btn" href="/dashboard/reports">View Reports <ArrowUpRight size={15}/></a></div></div><div className="hero-orbit"><div className="orbit-ring"/><div className="hero-orbit-core"><Activity size={24}/><strong>ERP</strong><span>LIVE</span></div></div></section>

  <section className="dashboard-kpis">
   <div className="dash-kpi"><div className="dash-kpi-icon blue"><Users size={20}/></div><div><span>Total Students</span><strong>{loading?"—":data.students}</strong><small>{data.assigned} assigned to batches</small></div></div>
   <div className="dash-kpi"><div className="dash-kpi-icon green"><UserCheck size={20}/></div><div><span>Active Students</span><strong>{loading?"—":data.activeStudents}</strong><small>{data.unassigned} unassigned</small></div></div>
   <div className="dash-kpi"><div className="dash-kpi-icon purple"><Layers3 size={20}/></div><div><span>Active Batches</span><strong>{loading?"—":data.batches}</strong><small>{capacity}% capacity use</small></div></div>
   <div className="dash-kpi"><div className="dash-kpi-icon orange"><BriefcaseBusiness size={20}/></div><div><span>Employees</span><strong>{loading?"—":data.employees}</strong><small>Faculty & operations</small></div></div>
   <div className="dash-kpi"><div className="dash-kpi-icon red"><UserX size={20}/></div><div><span>Dropouts</span><strong>{loading?"—":data.dropout}</strong><small>Movement history tracked</small></div></div>
   <div className="dash-kpi"><div className="dash-kpi-icon teal"><WalletCards size={20}/></div><div><span>Outstanding Fees</span><strong>{loading?"—":money(data.finance.due)}</strong><small>{data.finance.collectionPercentage}% collection rate</small></div></div>
  </section>

  <section className="panel dashboard-activity-panel">
   <div className="activity-header"><div><div className="eyebrow dark">OPERATIONS MONITOR</div><h3>Daily Attendance, Classes & Collections</h3><p>Default view is today. Switch to monthly to inspect the full period.</p></div><div className="activity-controls"><div className="segmented"><button className={period==="day"?"active":""} onClick={()=>setPeriod("day")}>Day</button><button className={period==="month"?"active":""} onClick={()=>setPeriod("month")}>Month</button></div>{period==="day"?<input type="date" value={date} onChange={e=>setDate(e.target.value)}/>:<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/>}</div></div>

   <div className="ops-kpis">
    <div><CheckCircle2/><span>Present</span><strong>{present}</strong></div>
    <div><XCircle/><span>Absent</span><strong>{absent}</strong></div>
    <div><Coffee/><span>Leave</span><strong>{leave}</strong></div>
    <div><GraduationCap/><span>Class records</span><strong>{attendanceTotal}</strong></div>
    <div><IndianRupee/><span>Fees collected</span><strong>{money(feeTotal)}</strong></div>
   </div>

   <div className="operations-grid">
    <div className="panel inner-panel"><div className="panel-head"><div><h3>Attendance Trend</h3><p>{period==="day"?activity.dayName+" attendance":month+" daily attendance"}</p></div><span className="chart-total">{attendanceTotal?Math.round(present/attendanceTotal*100):0}% present</span></div>{period==="month"?<TrendChart items={activity.attendance.monthly} valueKey="Present" labelKey="day"/>:<div className="attendance-ring-row"><Donut items={[{value:present},{value:absent},{value:leave}]} total={attendanceTotal}/><div className="attendance-stat-list"><div><i className="dot present"/>Present <b>{present}</b></div><div><i className="dot absent"/>Absent <b>{absent}</b></div><div><i className="dot leave"/>Leave <b>{leave}</b></div></div></div>}</div>
    <div className="panel inner-panel"><div className="panel-head"><div><h3>Fee Collection</h3><p>{period==="day"?date:"Daily collection for "+month}</p></div><span className="chart-total"><CircleDollarSign size={15}/>{money(feeTotal)}</span></div>{period==="month"?<TrendChart items={feeChart.map(x=>({day:x.day,value:x.amount}))} valueKey="value" labelKey="day"/>:<div className="daily-collection-card"><CircleDollarSign size={28}/><strong>{money(feeTotal)}</strong><span>{activity.fees.daily[0]?.count||0} payment transaction(s) today</span></div>}</div>
   </div>

   <div className="operations-grid">
    <div className="panel inner-panel"><div className="panel-head"><div><h3>Faculty Who Took Classes</h3><p>Actual attendance records grouped by faculty/marker</p></div><span className="chart-total"><BriefcaseBusiness size={15}/>{activity.faculty.length} faculty</span></div><div className="faculty-dashboard-table">{activity.faculty.length?activity.faculty.map((f,i)=><div className="faculty-row" key={f.name+i}><div className="faculty-avatar">{String(f.name||"?").charAt(0)}</div><div><strong>{f.name}</strong><span>{f.batches.join(", ")||"No batch recorded"}</span></div><b>{f.sessions} sessions</b><small>{f.present} present · {f.absent} absent · {f.leave} leave</small></div>):<div className="empty">No attendance records for this period.</div>}</div></div>
    <div className="panel inner-panel"><div className="panel-head"><div><h3>{period==="day"?"Today's Classes":"Classes in Selected Month"}</h3><p>Scheduled classes from batch timetables</p></div><span className="chart-total"><CalendarDays size={15}/>{activity.plannedClasses.length} slots</span></div><div className="class-list">{activity.plannedClasses.slice(0,18).map((x,i)=><div className="class-row" key={i}><div className="class-time"><Clock3 size={14}/><strong>{x.time}</strong><span>{x.day}</span></div><div><strong>{x.batch} · {x.course}</strong><span>{x.series} · {x.slot} · {x.room||"Room TBA"}</span></div><b>{x.faculty}</b></div>)}{!activity.plannedClasses.length&&<div className="empty">No scheduled classes found for this period.</div>}</div></div>
   </div>

   {period==="month"&&<div className="panel inner-panel monthly-detail"><div className="panel-head"><div><h3>Day-wise Collection Details</h3><p>Every collection date in {month}</p></div><BarChart3 size={18}/></div><div className="daily-detail-grid">{activity.fees.daily.map(x=><div key={x.day}><span>{x.day}</span><strong>{money(x.amount)}</strong><small>{x.count} payment(s)</small></div>)}{!activity.fees.daily.length&&<div className="empty">No fee collection recorded this month.</div>}</div></div>}
  </section>

  <section className="dashboard-grid-main">
   <div className="panel dashboard-chart-panel"><div className="panel-head"><div><h3>Students by Course</h3><p>Course-wise student distribution</p></div><a href="/dashboard/courses">Manage courses →</a></div><Bars items={topCourses} valueKey="value" labelKey="name"/></div>
   <div className="panel dashboard-chart-panel"><div className="panel-head"><div><h3>Batch Capacity</h3><p>Top batches by current student count</p></div><span className="capacity-pill">{capacity}% utilised</span></div><div className="batch-bars">{data.batchPerformance.map((b,i)=><div className="batch-bar-row" key={b.label+i}><div><span>{b.label}</span><b>{b.students}/{b.capacity||"—"}</b></div><div className="batch-track"><i style={{width:(b.capacity?Math.min(100,b.students/b.capacity*100):0)+"%"}}/></div></div>)}</div></div>
  </section>

  <section className="dashboard-bottom-grid">
   <div className="panel"><div className="panel-head"><div><h3>Financial Snapshot</h3><p>Course fees and collection position</p></div><a href="/dashboard/reports">Full report →</a></div><div className="finance-cards"><div><span>Total Payable</span><strong>{money(data.finance.payable)}</strong></div><div><span>Collected</span><strong className="positive">{money(data.finance.collected)}</strong></div><div><span>Outstanding</span><strong className="negative">{money(data.finance.due)}</strong></div></div><div className="finance-progress"><div><span>Collection progress</span><b>{data.finance.collectionPercentage}%</b></div><div className="progress-track"><i style={{width:Math.min(100,data.finance.collectionPercentage)+"%"}}/></div></div></div>
   <div className="panel"><div className="panel-head"><div><h3>Recent Registrations</h3><p>Latest student records</p></div><a href="/dashboard/students">View all →</a></div>{data.recent.length?<div className="recent-list">{data.recent.map(s=><a href={"/dashboard/students/"+s._id} key={s._id}><div className="recent-avatar">{String(s.applicantName||"?").charAt(0).toUpperCase()}</div><div><strong>{s.applicantName}</strong><span>{s.courseCode||s.courseName||"—"} · {s.batchCode||"Unassigned"}</span></div><span className="badge">{s.status}</span></a>)}</div>:<div className="empty">No student registrations found yet.</div>}</div>
  </section>

  <section className="dashboard-quick-grid"><a href="/dashboard/students" className="quick-card"><Users size={19}/><div><strong>Student Registry</strong><span>Search, bulk manage and assign students</span></div><ArrowUpRight size={16}/></a><a href="/dashboard/batches" className="quick-card"><CalendarDays size={19}/><div><strong>Batch & Timetable</strong><span>Manage batches, series and faculty</span></div><ArrowUpRight size={16}/></a><a href="/dashboard/employees" className="quick-card"><BriefcaseBusiness size={19}/><div><strong>Employees</strong><span>Faculty, staff and permissions</span></div><ArrowUpRight size={16}/></a><a href="/dashboard/reports" className="quick-card"><FileText size={19}/><div><strong>Report Center</strong><span>Fees, students, batches and exports</span></div><ArrowUpRight size={16}/></a></section>
 </ERPLayout>;
}
