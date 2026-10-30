"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, FileText, RefreshCw, GraduationCap, BriefcaseBusiness, Layers3, WalletCards, ArrowUpRight, UserCheck, UserX, CircleDollarSign, Activity, CalendarDays } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

function Donut({items,total}){
  const colors=["#5865f2","#10b981","#f59e0b","#ef4444","#7c3aed","#06b6d4","#64748b","#ec4899"];
  let cursor=0;
  const stops=items.map((x,i)=>{const start=cursor;cursor+=total?(x.value/total)*360:0;return `${colors[i%colors.length]} ${start}deg ${cursor}deg`;}).join(",");
  return <div className="dash-donut" style={{background:`conic-gradient(${stops||"#e8edf5 0 360deg"})`}}><div><strong>{total}</strong><span>Students</span></div></div>;
}

function MiniBars({items}){
  const max=Math.max(1,...items.map(x=>Number(x.value||0)));
  return <div className="mini-bars">{items.map((x,i)=><div className="mini-bar-col" key={x.name+i}><div className="mini-bar-track"><div className="mini-bar-fill" style={{height:`${Math.max(5,(x.value/max)*100)}%`}}/></div><span title={x.name}>{x.name}</span><b>{x.value}</b></div>)}</div>;
}

function TrendChart({items}){
  if(!items.length)return <div className="chart-empty">No payment data available yet.</div>;
  const max=Math.max(1,...items.map(x=>Number(x.value||0)));
  const points=items.map((x,i)=>({x:24+(i*(352/Math.max(1,items.length-1))),y:146-(Number(x.value||0)/max)*112}));
  const line=points.map(p=>`${p.x},${p.y}`).join(" ");
  const area=`24,146 ${line} ${points[points.length-1].x},146`;
  return <div className="trend-chart"><svg viewBox="0 0 400 170" preserveAspectRatio="none" role="img" aria-label="Monthly fee collection trend"><defs><linearGradient id="dashTrend" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5865f2" stopOpacity=".22"/><stop offset="100%" stopColor="#5865f2" stopOpacity="0"/></linearGradient></defs><line x1="24" y1="146" x2="376" y2="146" stroke="#e8edf5"/><line x1="24" y1="90" x2="376" y2="90" stroke="#eef2f7"/><line x1="24" y1="34" x2="376" y2="34" stroke="#eef2f7"/><polygon points={area} fill="url(#dashTrend)"/><polyline points={line} fill="none" stroke="#5865f2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#5865f2" strokeWidth="2"/>)}</svg><div className="trend-labels">{items.map((x,i)=><span key={i}>{x.month}</span>)}</div></div>;
}

export default function DashboardPage(){
  const [data,setData]=useState({students:0,registered:0,recent:[],studentStatus:[],courses:[],monthlyCollections:[],batchPerformance:[],finance:{payable:0,collected:0,due:0,collectionPercentage:0}});
  const [loading,setLoading]=useState(true);
  async function load(){setLoading(true);try{const response=await fetch("/api/dashboard",{cache:"no-store"});setData(await response.json())}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  const money=n=>`₹${Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:0})}`;
  const statusTotal=data.studentStatus.reduce((n,x)=>n+x.value,0)||data.students;
  const topCourses=data.courses.slice(0,8);
  const capacity=data.batchUtilization||0;

  return <ERPLayout active="/dashboard" hideAssistant={false}>
    <header className="topbar"><div><div className="crumb">RCLD Islampur / ERP</div><h1>Dashboard</h1></div><div className="top-actions"><span className="dashboard-live"><span/> Live data</span><button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={18}/></button><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></div></header>

    <section className="dashboard-hero">
      <div><span className="eyebrow">ERP CONTROL CENTER</span><h2>Good morning, RCLD Islampur 👋</h2><p>A complete operational snapshot of students, batches, employees and fee collection.</p><div className="hero-actions"><a className="hero-light-btn" href="/dashboard/students">Open Student Registry <ArrowUpRight size={15}/></a><a className="hero-ghost-btn" href="/dashboard/reports">View Reports <ArrowUpRight size={15}/></a></div></div>
      <div className="hero-orbit"><div className="orbit-ring"/><div className="hero-orbit-core"><Activity size={24}/><strong>ERP</strong><span>LIVE</span></div></div>
    </section>

    <section className="dashboard-kpis">
      <div className="dash-kpi"><div className="dash-kpi-icon blue"><Users size={20}/></div><div><span>Total Students</span><strong>{loading?"—":data.students}</strong><small>{data.assigned} assigned to batches</small></div></div>
      <div className="dash-kpi"><div className="dash-kpi-icon green"><UserCheck size={20}/></div><div><span>Active Students</span><strong>{loading?"—":data.activeStudents}</strong><small>{data.unassigned} currently unassigned</small></div></div>
      <div className="dash-kpi"><div className="dash-kpi-icon purple"><Layers3 size={20}/></div><div><span>Active Batches</span><strong>{loading?"—":data.batches}</strong><small>{capacity}% capacity utilisation</small></div></div>
      <div className="dash-kpi"><div className="dash-kpi-icon orange"><BriefcaseBusiness size={20}/></div><div><span>Employees</span><strong>{loading?"—":data.employees}</strong><small>Faculty & operations</small></div></div>
      <div className="dash-kpi"><div className="dash-kpi-icon red"><UserX size={20}/></div><div><span>Dropouts</span><strong>{loading?"—":data.dropout}</strong><small>Movement workflow tracked</small></div></div>
      <div className="dash-kpi"><div className="dash-kpi-icon teal"><WalletCards size={20}/></div><div><span>Outstanding Fees</span><strong>{loading?"—":money(data.finance.due)}</strong><small>{data.finance.collectionPercentage}% collection rate</small></div></div>
    </section>

    <section className="dashboard-grid-main">
      <div className="panel dashboard-chart-panel revenue-panel"><div className="panel-head"><div><h3>Fee Collection Trend</h3><p>Monthly payments recorded in the ERP</p></div><span className="chart-total"><CircleDollarSign size={16}/> {money(data.finance.collected)} collected</span></div><TrendChart items={data.monthlyCollections}/></div>
      <div className="panel dashboard-chart-panel status-panel"><div className="panel-head"><div><h3>Student Status</h3><p>Current student lifecycle distribution</p></div></div><div className="donut-wrap"><Donut items={data.studentStatus} total={statusTotal}/><div className="legend-list">{data.studentStatus.slice(0,6).map((x,i)=><div key={x.name}><i className={`legend-dot c${i}`}/><span>{x.name}</span><b>{x.value}</b></div>)}</div></div></div>
    </section>

    <section className="dashboard-grid-main">
      <div className="panel dashboard-chart-panel"><div className="panel-head"><div><h3>Students by Course</h3><p>Course-wise student distribution</p></div><a href="/dashboard/courses">Manage courses →</a></div><MiniBars items={topCourses}/></div>
      <div className="panel dashboard-chart-panel"><div className="panel-head"><div><h3>Batch Capacity</h3><p>Top batches by current student count</p></div><span className="capacity-pill">{capacity}% utilised</span></div><div className="batch-bars">{data.batchPerformance.map((b,i)=><div className="batch-bar-row" key={b.label+i}><div><span>{b.label}</span><b>{b.students}/{b.capacity||"—"}</b></div><div className="batch-track"><i style={{width:`${b.capacity?Math.min(100,b.students/b.capacity*100):0}%`}}/></div></div>)}</div></div>
    </section>

    <section className="dashboard-bottom-grid">
      <div className="panel"><div className="panel-head"><div><h3>Financial Snapshot</h3><p>Course fees and collection position</p></div><a href="/dashboard/reports">Full report →</a></div><div className="finance-cards"><div><span>Total Payable</span><strong>{money(data.finance.payable)}</strong></div><div><span>Collected</span><strong className="positive">{money(data.finance.collected)}</strong></div><div><span>Outstanding</span><strong className="negative">{money(data.finance.due)}</strong></div></div><div className="finance-progress"><div><span>Collection progress</span><b>{data.finance.collectionPercentage}%</b></div><div className="progress-track"><i style={{width:`${Math.min(100,data.finance.collectionPercentage)}%`}}/></div></div></div>
      <div className="panel"><div className="panel-head"><div><h3>Recent Registrations</h3><p>Latest student records</p></div><a href="/dashboard/students">View all →</a></div>{data.recent.length?<div className="recent-list">{data.recent.map(s=><a href={`/dashboard/students/${s._id}`} key={s._id}><div className="recent-avatar">{String(s.applicantName||"?").charAt(0).toUpperCase()}</div><div><strong>{s.applicantName}</strong><span>{s.courseCode||s.courseName||"—"} · {s.batchCode||"Unassigned"}</span></div><span className="badge">{s.status}</span></a>)}</div>:<div className="empty">No student registrations found yet.</div>}</div>
    </section>

    <section className="dashboard-quick-grid">
      <a href="/dashboard/students" className="quick-card"><Users size={19}/><div><strong>Student Registry</strong><span>Search, bulk manage and assign students</span></div><ArrowUpRight size={16}/></a>
      <a href="/dashboard/batches" className="quick-card"><CalendarDays size={19}/><div><strong>Batch & Timetable</strong><span>Manage batches, series and faculty</span></div><ArrowUpRight size={16}/></a>
      <a href="/dashboard/employees" className="quick-card"><BriefcaseBusiness size={19}/><div><strong>Employees</strong><span>Faculty, staff and permissions</span></div><ArrowUpRight size={16}/></a>
      <a href="/dashboard/reports" className="quick-card"><FileText size={19}/><div><strong>Report Center</strong><span>Fees, students, batches and exports</span></div><ArrowUpRight size={16}/></a>
    </section>
  </ERPLayout>
}
