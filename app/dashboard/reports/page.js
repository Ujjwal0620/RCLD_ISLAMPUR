"use client";

import {useEffect,useMemo,useState} from "react";
import {
  BarChart3,Users,Clock3,Layers3,BookOpen,IndianRupee,BriefcaseBusiness,GraduationCap,
  CalendarDays,ClipboardCheck,Award,ArrowLeftRight,ListChecks,ShieldCheck,Sparkles,
  SlidersHorizontal,Search,ArrowRight,Download,FileText,FileSpreadsheet,Printer,
  TrendingUp,BrainCircuit,ChevronRight
} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const groups=[
 {id:"management",title:"Executive & Management",desc:"Institute-wide operational health and management summaries.",icon:BarChart3,reports:["Executive Summary","Daily Management Report","Monthly Performance","Operational Health","Yearly Institute Review"]},
 {id:"students",title:"Student Reports",desc:"Registration, admission, status and student lifecycle reporting.",icon:Users,reports:["Student Master","Admissions","Registration","Status Analysis","Course-wise Students","Batch-wise Students","Online / Offline","Completion & Alumni","Dropout Analysis"]},
 {id:"attendance",title:"Attendance Reports",desc:"Detailed student and employee attendance intelligence.",icon:Clock3,reports:["Daily Attendance","Monthly Attendance","Student Attendance","Batch Attendance","Course Attendance","Low Attendance","Attendance Trend","Employee Attendance"]},
 {id:"batches",title:"Batch Reports",desc:"Strength, capacity, series, faculty and schedule analytics.",icon:Layers3,reports:["Batch Strength","Capacity Utilization","Batch Series","Batch Attendance","Faculty Mapping","Schedule Performance","Batch Fees","Batch Completion"]},
 {id:"courses",title:"Course Reports",desc:"Enrollment, revenue, completion and course performance.",icon:BookOpen,reports:["Course Enrollment","Course Popularity","Course Revenue","Completion Rate","Dropout by Course","Batch Distribution"]},
 {id:"payments",title:"Payment & Fee Reports",desc:"Collections, dues, installments and complete student ledgers.",icon:IndianRupee,reports:["Collection Report","Outstanding Fees","Installments","Overdue Fees","Discounts","Student Ledger","Course Revenue","Batch Revenue","Daily Collection","Monthly Collection","Payment History"]},
 {id:"employees",title:"Employee Reports",desc:"Attendance, work hours, out-time, tasks and performance.",icon:BriefcaseBusiness,reports:["Employee Attendance","Work Hours","Out-Time","Task Completion","Workload","Employee Performance"]},
 {id:"faculty",title:"Faculty Reports",desc:"Teaching load, assignments, classes and substitutions.",icon:GraduationCap,reports:["Faculty Workload","Classes Assigned","Subject Assignment","Batch Assignment","Substitutions","Faculty Performance"]},
 {id:"timetable",title:"Timetable & Class Reports",desc:"Schedules, utilization, conflicts and replacement classes.",icon:CalendarDays,reports:["Daily Schedule","Weekly Schedule","Faculty Schedule","Room Utilization","Schedule Conflicts","Missed Classes","Replacement Classes"]},
 {id:"exams",title:"Exam & Result Reports",desc:"Exams, marks, results and academic performance.",icon:ClipboardCheck,reports:["Exam Summary","Marks Report","Pass / Fail","Toppers","Subject Performance","Batch Comparison","Student Result History"]},
 {id:"certificates",title:"Certificate Reports",desc:"Eligibility, generation and certificate issue tracking.",icon:Award,reports:["Eligible Students","Pending Certificates","Generated Certificates","Issued Certificates","Completion Tracking"]},
 {id:"movement",title:"Student Movement",desc:"Transfers, course changes, dropout and rejoin history.",icon:ArrowLeftRight,reports:["Batch Transfers","Course Changes","Dropouts","Rejoins","Suspensions","Cancellations","Alumni Movement"]},
 {id:"tasks",title:"Task & Back Office",desc:"Assigned work, pending work and operational productivity.",icon:ListChecks,reports:["Task Register","Pending Tasks","Completed Tasks","Overdue Tasks","Employee Work Register","Replacement Work"]},
 {id:"audit",title:"Audit & Activity",desc:"Trace important administrative and data-change activity.",icon:ShieldCheck,reports:["User Activity","Data Changes","Fee Changes","Attendance Changes","Permission Activity","Administrative Actions"]},
 {id:"ai",title:"AI Intelligence Reports",desc:"Management insights, anomalies, risks and recommendations.",icon:BrainCircuit,reports:["AI Executive Brief","Risk Analysis","Anomaly Report","Trend Explanation","Management Recommendations","Period Comparison"]},
 {id:"custom",title:"Custom Report Builder",desc:"Choose fields, filters, grouping and output for a custom report.",icon:SlidersHorizontal,reports:["Build Custom Report","Saved Custom Reports","Favorite Reports"]}
];

function ExportMenu(){const[open,setOpen]=useState(false);return <div className="report-export"><button className="report-export-btn" onClick={()=>setOpen(!open)}><Download size={16}/>Export</button>{open&&<div className="report-export-menu"><button onClick={()=>window.print()}><FileText size={15}/>PDF / Print document</button><button><FileSpreadsheet size={15}/>Excel workbook</button><button><FileSpreadsheet size={15}/>CSV detailed data</button><button onClick={()=>window.print()}><Printer size={15}/>Print report</button></div>}</div>}

function ReportDocument({group,name,onBack}){
 const today=new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
 return <div className="report-document">
  <div className="report-document-toolbar"><button className="report-back" onClick={onBack}>← Back to {group.title}</button><ExportMenu/></div>
  <section className="report-paper">
   <header className="report-letterhead"><div><span>RCLD ISLAMPUR</span><h1>{name}</h1><p>{group.title} · Detailed Management Report</p></div><div className="report-id"><b>REPORT</b><span>{group.id.toUpperCase()}-{new Date().getFullYear()}-001</span></div></header>
   <div className="report-meta"><div><span>Reporting period</span><b>Selected reporting period</b></div><div><span>Generated on</span><b>{today}</b></div><div><span>Access</span><b>Super Admin / Office Admin</b></div><div><span>Format</span><b>Detailed documented report</b></div></div>
   <div className="report-filter-row"><label>Date from<input type="date"/></label><label>Date to<input type="date"/></label><label>Course<select><option>All courses</option></select></label><label>Batch<select><option>All batches</option></select></label><button>Generate report</button></div>
   <div className="report-kpis"><div><span>Total Records</span><strong>—</strong><small>Current filters</small></div><div><span>Current Period</span><strong>—</strong><small>Calculated from ERP data</small></div><div><span>Previous Period</span><strong>—</strong><small>For comparison</small></div><div><span>Attention Required</span><strong>—</strong><small>Rules & AI analysis</small></div></div>
   <div className="report-analysis-grid"><section className="report-chart-placeholder"><div className="report-section-title"><TrendingUp size={17}/><div><h3>Performance & Trend</h3><p>Visualization generated from the selected report data.</p></div></div><div className="report-chart-bars">{[38,62,48,76,58,82,68,90,72,84].map((x,i)=><i key={i} style={{height:x+"%"}}/>)}</div></section><section className="report-chart-placeholder"><div className="report-section-title"><BarChart3 size={17}/><div><h3>Distribution</h3><p>Course, batch or status breakdown.</p></div></div><div className="report-donut-demo"><div/><span>Live report<br/>visualization</span></div></section></div>
   <section className="ai-report-panel"><div className="ai-report-heading"><div className="ai-report-icon"><Sparkles size={20}/></div><div><span>AI REPORT INTELLIGENCE</span><h3>Management analysis</h3></div><button>Ask AI about this report</button></div><div className="ai-insight-grid"><article><b>Executive Summary</b><p>Generate a concise management summary after live report data is loaded.</p></article><article><b>Key Findings</b><p>Highlight important changes, concentrations and performance patterns.</p></article><article><b>Risks & Anomalies</b><p>Detect unusual values and records that may require management attention.</p></article><article><b>Recommended Actions</b><p>Provide data-grounded next actions without inventing ERP statistics.</p></article></div></section>
   <section className="report-detail-section"><div className="report-section-title"><FileText size={17}/><div><h3>Detailed Records</h3><p>Complete row-level report data will appear here after generation.</p></div></div><div className="report-table"><div className="report-table-head"><span>Record</span><span>Category</span><span>Status</span><span>Value</span><span>Remarks</span></div><div className="report-empty-row">Select filters and generate this report to document live ERP records.</div></div></section>
   <footer className="report-document-footer"><span>RCLD Islampur · Official ERP Report</span><span>Generated from authorized ERP data</span></footer>
  </section>
 </div>
}

export default function ReportsPage(){
 const[user,setUser]=useState(null),[loading,setLoading]=useState(true),[query,setQuery]=useState(""),[selected,setSelected]=useState(null),[report,setReport]=useState(null);
 useEffect(()=>{fetch("/api/auth/me",{cache:"no-store"}).then(async r=>{if(r.status===401){location.href="/dashboard/login";return null}return r.json()}).then(x=>{setUser(x?.user||null);setLoading(false)}).catch(()=>setLoading(false))},[]);
 const allowed=user?.isSuperAdmin||user?.role==="office-admin"||user?.role==="admin";
 const visible=useMemo(()=>groups.filter(g=>(g.title+" "+g.desc+" "+g.reports.join(" ")).toLowerCase().includes(query.toLowerCase())),[query]);
 if(loading)return <ERPLayout active="/dashboard/reports"><div className="report-loading">Loading Report Center…</div></ERPLayout>;
 if(!allowed)return <ERPLayout active="/dashboard/reports"><section className="report-denied"><ShieldCheck size={34}/><h1>Management reports are restricted</h1><p>The detailed Report & Analytics Center is available only to Super Admin and Office Admin accounts.</p><a href="/dashboard">Return to dashboard</a></section></ERPLayout>;
 const group=selected?groups.find(g=>g.id===selected):null;
 const GroupIcon=group?.icon;
 return <ERPLayout active="/dashboard/reports">
  <header className="topbar report-topbar"><div><div className="crumb">Management / Reports & Analytics</div><h1>Report & Analytics Center</h1></div><div className="report-header-badge"><ShieldCheck size={15}/>Management access</div></header>
  {report&&group?<ReportDocument group={group} name={report} onBack={()=>setReport(null)}/>:
  group?<><button className="report-category-back" onClick={()=>setSelected(null)}>← All report sections</button><section className="report-category-hero"><div className="report-category-icon"><GroupIcon size={24}/></div><div><span>REPORT CATEGORY</span><h2>{group.title}</h2><p>{group.desc}</p></div><b>{group.reports.length} reports</b></section><div className="report-type-grid">{group.reports.map((r,i)=><button className="report-type-card" key={r} onClick={()=>setReport(r)}><div><span>{String(i+1).padStart(2,"0")}</span><FileText size={18}/></div><h3>{r}</h3><p>Open a detailed, filterable and export-ready {r.toLowerCase()}.</p><footer>View detailed report <ChevronRight size={15}/></footer></button>)}</div></>:
  <><section className="report-center-hero"><div><span className="eyebrow">RCLD MANAGEMENT INTELLIGENCE</span><h2>Every institute report, organized and document-ready.</h2><p>Select a report section, choose the exact report, apply filters and generate a detailed management document with KPIs, charts, AI insights and export controls.</p></div><div className="report-hero-stat"><Sparkles size={22}/><strong>{groups.reduce((n,g)=>n+g.reports.length,0)}+</strong><span>Detailed reports</span></div></section>
  <section className="report-center-tools"><div className="report-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search attendance, payments, batches, employees, audit..."/></div><div className="report-tool-note"><FileText size={16}/>PDF · Excel · CSV · Print</div></section>
  <div className="report-category-grid">{visible.map(g=>{const Icon=g.icon;return <button className="report-category-card" key={g.id} onClick={()=>setSelected(g.id)}><div className={"report-card-icon "+g.id}><Icon size={20}/></div><div className="report-card-copy"><div><h3>{g.title}</h3><span>{g.reports.length} reports</span></div><p>{g.desc}</p><div className="report-card-tags">{g.reports.slice(0,3).map(x=><i key={x}>{x}</i>)}{g.reports.length>3&&<i>+{g.reports.length-3}</i>}</div></div><ArrowRight className="report-card-arrow" size={18}/></button>})}</div></>}
 </ERPLayout>
}
