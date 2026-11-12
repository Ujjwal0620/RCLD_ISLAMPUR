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

function reportDataType(group,name){
 const n=name.toLowerCase();
 if(group.id==="students"||group.id==="movement")return "students";
 if(group.id==="payments")return n.includes("collection")||n.includes("payment history")?"collections":"fees";
 if(group.id==="batches"||group.id==="timetable")return "batches";
 if(group.id==="employees"||group.id==="faculty")return "employees";
 if(group.id==="attendance")return n.includes("employee")?"employee-attendance":"student-attendance";
 if(group.id==="tasks")return "tasks";
 return "overview";
}

function ReportDocument({group,name,onBack}){
 const [from,setFrom]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10));
 const [to,setTo]=useState(new Date().toISOString().slice(0,10));
 const [course,setCourse]=useState("");
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [ai,setAi]=useState("");
 const [aiLoading,setAiLoading]=useState(false);
 const type=reportDataType(group,name);
 const today=new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
 async function generate(){
  setLoading(true);setError("");setAi("");
  try{
   const params=new URLSearchParams({type,from,to});if(course)params.set("course",course);
   const response=await fetch("/api/reports/data?"+params.toString(),{cache:"no-store"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||"Report generation failed.");
   setData(result);
  }catch(e){setError(e.message);setData(null)}finally{setLoading(false)}
 }
 function exportCsv(){
  if(!data?.rows?.length)return;
  const columns=[...new Set(data.rows.flatMap(row=>Object.keys(row)))];
  const quote=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
  const csv=[columns.map(quote).join(","),...data.rows.map(row=>columns.map(key=>quote(row[key])).join(","))].join("\r\n");
  const blob=new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="RCLD-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".csv";a.click();URL.revokeObjectURL(url);
 }
 async function askAI(){
  if(!data)return;setAiLoading(true);setAi("");
  try{
   const prompt="Analyze this generated RCLD ERP report. Report: "+name+". Filters: "+JSON.stringify(data.filters)+". Summary: "+JSON.stringify(data.summary)+". First 40 rows: "+JSON.stringify(data.rows.slice(0,40))+". Explain key findings, risks and recommended actions. Clearly state that the analysis is limited to the supplied rows and never invent totals.";
   const response=await fetch("/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({messages:[{role:"user",content:prompt}]})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"AI analysis unavailable.");setAi(result.reply||"No AI response.");
  }catch(e){setAi(e.message)}finally{setAiLoading(false)}
 }
 useEffect(()=>{generate()},[]);
 const rows=data?.rows||[];
 const columns=rows.length?Object.keys(rows[0]):[];
 return <div className="report-document">
  <div className="report-document-toolbar"><button className="report-back" onClick={onBack}>← Back to {group.title}</button><div className="report-export"><button className="report-export-btn" onClick={exportCsv} disabled={!rows.length}><Download size={16}/>Export CSV</button><button className="report-export-btn" onClick={()=>window.print()}><Printer size={16}/>Print / PDF</button></div></div>
  <section className="report-paper">
   <header className="report-letterhead"><div><span>RCLD ISLAMPUR</span><h1>{name}</h1><p>{group.title} · Live operational report</p></div><div className="report-id"><b>REPORT</b><span>{type.toUpperCase()}</span></div></header>
   <div className="report-meta"><div><span>Generated on</span><b>{data?new Date(data.generatedAt).toLocaleString("en-IN"):today}</b></div><div><span>Data source</span><b>MongoDB · Live ERP</b></div><div><span>Reporting period</span><b>{from} — {to}</b></div><div><span>Report type</span><b>{type}</b></div></div>
   <div className="report-filter-row"><label>Date from<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Date to<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Course<input value={course} onChange={e=>setCourse(e.target.value)} placeholder="All courses"/></label><button onClick={generate} disabled={loading}>{loading?"Generating…":"Generate report"}</button></div>
   {error&&<div className="report-error" role="alert">{error}</div>}
   {data&&<><div className="report-kpis">{Object.entries(data.summary||{}).map(([key,value])=><div key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><strong>{typeof value==="number"&&/payable|collected|due/i.test(key)?"₹":""}{typeof value==="number"?value.toLocaleString("en-IN"):String(value)}</strong><small>Calculated from live records</small></div>)}</div>
   {data.notes?.length>0&&<div className="report-notes">{data.notes.map(note=><p key={note}>{note}</p>)}</div>}
   {data.charts?.courses?.length>0&&<section className="report-detail-section"><div className="report-section-title"><TrendingUp size={17}/><div><h3>Course distribution</h3><p>Student records in the selected scope</p></div></div><div className="report-chart-bars">{data.charts.courses.slice(0,12).map(item=><div key={item.name} title={item.name+": "+item.value} style={{height:"100%",display:"flex",alignItems:"end",gap:4,flexDirection:"column",justifyContent:"end",flex:1}}><i style={{height:Math.max(5,item.value/Math.max(...data.charts.courses.map(x=>x.value))*100)+"%",width:"100%"}}/><small>{item.name}</small><b>{item.value}</b></div>)}</div></section>}
   <section className="report-detail-section"><div className="report-section-title"><FileText size={17}/><div><h3>Detailed records</h3><p>{rows.length.toLocaleString("en-IN")} records returned by the ERP</p></div></div><div className="report-table" style={{overflowX:"auto"}}>{rows.length?<table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}><thead><tr>{columns.map(col=><th key={col} style={{textAlign:"left",padding:10,whiteSpace:"nowrap"}}>{col.replace(/([A-Z])/g," $1")}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{columns.map(col=><td key={col} style={{padding:10,borderTop:"1px solid #e7ebf2",fontSize:13}}>{row[col]===null||row[col]===undefined?"—":typeof row[col]==="object"?JSON.stringify(row[col]):String(row[col])}</td>)}</tr>)}</tbody></table>:<div className="report-empty-row">No records match the selected filters.</div>}</div></section>
   <section className="ai-report-panel"><div className="ai-report-heading"><div className="ai-report-icon"><Sparkles size={20}/></div><div><span>AI REPORT INTELLIGENCE</span><h3>Evidence-based management analysis</h3></div><button onClick={askAI} disabled={aiLoading}>{aiLoading?"Analyzing…":"Analyze with AI"}</button></div>{ai?<div className="ai-report-result" style={{whiteSpace:"pre-wrap"}}>{ai}</div>:<p>AI analysis uses this generated report's live summary and a sample of its records. It does not change ERP data.</p>}</section>
   </>}
   <footer className="report-document-footer"><span>RCLD Islampur · Official ERP Report</span><span>Generated from authorized ERP data · {data?.rows?.length||0} rows</span></footer>
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
