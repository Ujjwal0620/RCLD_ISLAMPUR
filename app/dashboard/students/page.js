"use client";
import { useEffect, useState } from "react";
import { Search, UserPlus, ChevronLeft, ChevronRight, SlidersHorizontal, X, RotateCcw, Filter, Pencil, Trash2, Send, Upload, ShieldCheck, Users, UserRoundCheck, GraduationCap } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const fallbackCourses=["CCA","DCA","ADCA","CCC","CAO","DWPD","DOM","DCST","DCAP","DHNT"];

export default function StudentsPage(){
  const [students,setStudents]=useState([]),[pagination,setPagination]=useState({page:1,limit:50,total:0,totalPages:1});
  const [options,setOptions]=useState({courses:fallbackCourses,statuses:["Registered"],sexes:["M","F"]});
  const [filters,setFilters]=useState({search:"",sex:"",course:"",status:"",registration:"",fromDate:"",toDate:"",formNo:"",enrollmentNo:"",regnNo:"",aecCode:"",fatherOrHusbandName:"",mobileNumber:"",whatsappNumber:"",guardianContactNumber:"",email:"",aadhaarNumber:"",nationality:"",dateOfBirth:"",district:"",state:"",pin:"",postOffice:"",policeStation:"",nearestLandmark:"",permanentDistrict:"",permanentState:"",permanentPin:"",permanentPostOffice:"",permanentNearestLandmark:"",courseCode:"",batchCode:"",referralName:"",marketingEmployeeName:"",paymentStatus:"",declarationPlace:"",address:"",presentAddress:"",permanentAddress:"",sourceCourseLabel:"",importSource:"",signatureApplicant:"",declarationDate:"",referralId:"",marketingEmployeeId:"",sameAsPresentAddress:"",hasPhoto:"",hasSignature:"",stampPhoto:"",qualifyingCertificates:"",matricAdmitCard:"",qualification:"",dueMin:"",dueMax:"",admissionFrom:"",admissionTo:""});
  const [advanced,setAdvanced]=useState(false),[loading,setLoading]=useState(true);
  const [selectedStudents,setSelectedStudents]=useState([]),[batches,setBatches]=useState([]),[selectedBatch,setSelectedBatch]=useState(""),[assigning,setAssigning]=useState(false);
  const [selectAllMatching,setSelectAllMatching]=useState(false),[bulkStatus,setBulkStatus]=useState(""),[bulkBusy,setBulkBusy]=useState(false);

  async function load(page=1,override=filters){
    setLoading(true);
    try{
      const params=new URLSearchParams({page:String(page),limit:"50"});
      Object.entries(override).forEach(([k,v])=>{if(v)params.set(k,v)});
      const r=await fetch("/api/students?"+params.toString(),{cache:"no-store"}),d=await r.json();
      setStudents(d.students||[]);setPagination(d.pagination||{page:1,limit:50,total:0,totalPages:1});
      if(d.filterOptions)setOptions({courses:d.filterOptions.courses?.length?d.filterOptions.courses:fallbackCourses,statuses:d.filterOptions.statuses?.length?d.filterOptions.statuses:["Registered"],sexes:d.filterOptions.sexes?.length?d.filterOptions.sexes:["M","F"]});
    }finally{setLoading(false)}
  }
  async function loadBatches(){const r=await fetch("/api/students/bulk-assign-batch",{cache:"no-store"});const d=await r.json();setBatches(d.batches||[])}
  useEffect(()=>{load(1)},[filters.sex,filters.course,filters.status,filters.registration,filters.fromDate,filters.toDate,filters.formNo,filters.enrollmentNo,filters.regnNo,filters.aecCode,filters.fatherOrHusbandName,filters.mobileNumber,filters.whatsappNumber,filters.guardianContactNumber,filters.email,filters.aadhaarNumber,filters.nationality,filters.dateOfBirth,filters.district,filters.state,filters.pin,filters.postOffice,filters.policeStation,filters.nearestLandmark,filters.permanentDistrict,filters.permanentState,filters.permanentPin,filters.permanentPostOffice,filters.permanentNearestLandmark,filters.courseCode,filters.batchCode,filters.referralName,filters.marketingEmployeeName,filters.paymentStatus,filters.declarationPlace,filters.address,filters.presentAddress,filters.permanentAddress,filters.sourceCourseLabel,filters.importSource,filters.signatureApplicant,filters.declarationDate,filters.referralId,filters.marketingEmployeeId,filters.sameAsPresentAddress,filters.hasPhoto,filters.hasSignature,filters.stampPhoto,filters.qualifyingCertificates,filters.matricAdmitCard,filters.qualification,filters.dueMin,filters.dueMax,filters.admissionFrom,filters.admissionTo]);
  useEffect(()=>{loadBatches()},[]);
  useEffect(()=>{setSelectedStudents([]);setSelectAllMatching(false);setSelectedBatch("")},[students]);

  function updateFilter(k,v){setFilters(c=>({...c,[k]:v}))}
  const emptyFilters={search:"",sex:"",course:"",status:"",registration:"",fromDate:"",toDate:"",formNo:"",enrollmentNo:"",regnNo:"",aecCode:"",fatherOrHusbandName:"",mobileNumber:"",whatsappNumber:"",guardianContactNumber:"",email:"",aadhaarNumber:"",nationality:"",dateOfBirth:"",district:"",state:"",pin:"",postOffice:"",policeStation:"",nearestLandmark:"",permanentDistrict:"",permanentState:"",permanentPin:"",permanentPostOffice:"",permanentNearestLandmark:"",courseCode:"",batchCode:"",referralName:"",marketingEmployeeName:"",paymentStatus:"",declarationPlace:"",address:"",presentAddress:"",permanentAddress:"",sourceCourseLabel:"",importSource:"",signatureApplicant:"",declarationDate:"",referralId:"",marketingEmployeeId:"",sameAsPresentAddress:"",hasPhoto:"",hasSignature:"",stampPhoto:"",qualifyingCertificates:"",matricAdmitCard:"",qualification:"",dueMin:"",dueMax:"",admissionFrom:"",admissionTo:""};
  const advancedFields=[["formNo","Form number"],["enrollmentNo","Enrollment number"],["regnNo","Registration number"],["aecCode","AEC code"],["fatherOrHusbandName","Father / guardian"],["mobileNumber","Mobile number"],["whatsappNumber","WhatsApp number"],["guardianContactNumber","Guardian contact"],["email","Email"],["aadhaarNumber","Aadhaar number"],["nationality","Nationality"],["dateOfBirth","Date of birth","date"],["district","Present district"],["state","Present state"],["pin","Present PIN"],["postOffice","Present post office"],["policeStation","Police station"],["nearestLandmark","Nearest landmark"],["permanentDistrict","Permanent district"],["permanentState","Permanent state"],["permanentPin","Permanent PIN"],["permanentPostOffice","Permanent post office"],["permanentNearestLandmark","Permanent landmark"],["courseCode","Course code"],["batchCode","Batch code"],["referralName","Referral name"],["marketingEmployeeName","Marketing employee"],["paymentStatus","Payment status"],["qualification","Qualification / board"],["declarationPlace","Declaration place"],["address","Address"],["presentAddress","Present address"],["permanentAddress","Permanent address"],["sourceCourseLabel","Source course label"],["importSource","Import source"],["signatureApplicant","Applicant signature name"],["declarationDate","Declaration date","date"],["referralId","Referral ID"],["marketingEmployeeId","Marketing employee ID"]];
  function clearFilters(){setFilters(emptyFilters);load(1,emptyFilters)}
  const activeCount=Object.values(filters).filter(Boolean).length;
  const selectedRecords=students.filter(s=>selectedStudents.includes(s._id));
  const unassignedStudents=students.filter(s=>!s.batchId&&!s.batchCode);
  const allVisibleSelected=students.length>0&&students.every(s=>selectedStudents.includes(s._id));
  const selectedUnassigned=selectedRecords.filter(s=>!s.batchId&&!s.batchCode);
  const normalizeCourse=(value)=>{
    const v=String(value||"").trim().toUpperCase();
    if(!v)return "";
    if(/^SM(?:[-_ ]|$)/.test(v)||v.includes("CODING FOR KIDS"))return "KIDS";
    if(/^DOM(?:[-_ ]|$)/.test(v)||v.includes("DIPLOMA IN OFFICE MANAGEMENT"))return "DOM";
    if(/^DCST(?:[-_ ]|$)/.test(v))return "DCST";
    if(/^DCA(?:[-_ ]|$)/.test(v))return "DCA";
    return v.replace(/\\s+/g,"");
  };
  const selectedCourses=[...new Set(selectedRecords.map(s=>normalizeCourse(s.courseCode||s.courseName||s.sourceCourseLabel)).filter(Boolean))];
  const compatibleBatches=batches.filter(b=>b.available&&(!selectedCourses.length||selectedCourses.length!==1||normalizeCourse(b.courseCode||b.courseName)===selectedCourses[0]));
  async function runBulk(action){
    if(bulkBusy)return;
    if(!selectAllMatching&&!selectedStudents.length)return alert("Select at least one student.");
    if(action==="delete"&&!confirm("Permanently delete the selected students? This cannot be undone."))return;
    if(action==="status"&&!bulkStatus)return alert("Select the new status first.");
    setBulkBusy(true);
    try{
      const r=await fetch("/api/students/bulk-actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        action,studentIds:selectAllMatching?[]:selectedStudents,selectAllMatching,...filters,status:bulkStatus
      })});
      const d=await r.json();
      if(!r.ok)return alert(d.error||"Bulk action failed.");
      alert(d.message||"Bulk action completed.");
      setSelectedStudents([]);setSelectAllMatching(false);setBulkStatus("");
      await load(pagination.page);await loadBatches();
    }finally{setBulkBusy(false)}
  }
  function toggleAll(){
    if(selectAllMatching){setSelectAllMatching(false);setSelectedStudents([]);return}
    if(allVisibleSelected){setSelectedStudents([]);return}
    setSelectedStudents(students.map(s=>s._id));
  }
  async function sendToBatch(){
    if(assigning)return;
    if((!selectedStudents.length&&!selectAllMatching)||!selectedBatch)return alert("Select students and an available batch.");
    setAssigning(true);
    try{
      const r=await fetch("/api/students/bulk-assign-batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentIds:selectAllMatching?[]:selectedStudents,batchId:selectedBatch,selectAllMatching,...filters})});
      const d=await r.json();if(!r.ok)return alert(d.error||"Unable to send students to batch.");
      alert(d.message||"Students assigned.");setSelectedStudents([]);setSelectAllMatching(false);setSelectedBatch("");await load(pagination.page);await loadBatches();
    }finally{setAssigning(false)}
  }

  return <ERPLayout active="/dashboard/students">
    <header className="topbar"><div><div className="crumb">Students / Registry</div><h1>Students</h1></div><div className="top-actions"><a className="ghost-btn" href="/dashboard/students/import"><Upload size={17}/> Bulk Import</a><a className="primary-btn" href="/dashboard/students/register"><UserPlus size={17}/> Register Student</a></div></header>
    <section className="directory-overview">
      <div>
        <span className="eyebrow">STUDENT OPERATIONS</span>
        <h2>Student directory</h2>
        <p>Review registrations, find student records, and move eligible unassigned students into their course batches.</p>
      </div>
      <div className="directory-overview-meta">
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        <span>50 records per page</span>
      </div>
    </section>
    <section className="metric-grid directory-metrics" aria-label="Student directory summary">
      <div className="metric"><div className="metric-icon blue"><Users size={18}/></div><span>Total student records</span><strong>{pagination.total.toLocaleString("en-IN")}</strong></div>
      <div className="metric"><div className="metric-icon purple"><GraduationCap size={18}/></div><span>Visible on this page</span><strong>{students.length}</strong></div>
      <div className="metric"><div className="metric-icon orange"><UserRoundCheck size={18}/></div><span>Unassigned on this page</span><strong>{unassignedStudents.length}</strong></div>
      <div className="metric"><div className="metric-icon green"><ShieldCheck size={18}/></div><span>Selected records</span><strong>{selectAllMatching ? pagination.total.toLocaleString("en-IN") : selectedStudents.length}</strong></div>
    </section>
    <section className="panel filter-panel">
      <div className="filter-title"><div><h3>Student Registry</h3><p>Search a student by name, course, form number or mobile. Select multiple unassigned students and send them to an available batch.</p></div><button className="filter-toggle" onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal size={17}/>{advanced?"Hide filters":"Advanced filters"}{activeCount>0&&<span>{activeCount}</span>}</button></div>
      <div className="filters primary-filters"><div className="search-box"><Search size={17}/><input value={filters.search} onChange={e=>updateFilter("search",e.target.value)} onKeyDown={e=>e.key==="Enter"&&load(1)} placeholder="Search student name, course, form no., mobile…"/></div><select value={filters.course} onChange={e=>updateFilter("course",e.target.value)}><option value="">All Courses</option>{options.courses.map(c=><option key={c} value={c}>{c}</option>)}</select><select value={filters.status} onChange={e=>updateFilter("status",e.target.value)}><option value="">All Status</option>{options.statuses.map(s=><option key={s}>{s}</option>)}</select><button className="search-action" onClick={()=>load(1)}><Search size={16}/> Search</button></div>
      {advanced&&<div className="advanced-filters advanced-filters-expanded">
        <div className="filter-field"><label>Sex</label><select value={filters.sex} onChange={e=>updateFilter("sex",e.target.value)}><option value="">All</option>{options.sexes.map(s=><option key={s} value={s}>{s==="M"?"Male":s==="F"?"Female":s}</option>)}</select></div>
        <div className="filter-field"><label>Registration number</label><select value={filters.registration} onChange={e=>updateFilter("registration",e.target.value)}><option value="">All records</option><option value="assigned">Assigned</option><option value="unassigned">Not assigned</option></select></div>
        <div className="filter-field"><label>Registered from</label><input type="date" value={filters.fromDate} onChange={e=>updateFilter("fromDate",e.target.value)}/></div>
        <div className="filter-field"><label>Registered to</label><input type="date" value={filters.toDate} onChange={e=>updateFilter("toDate",e.target.value)}/></div>
        <div className="filter-field"><label>Admission from</label><input type="date" value={filters.admissionFrom} onChange={e=>updateFilter("admissionFrom",e.target.value)}/></div>
        <div className="filter-field"><label>Admission to</label><input type="date" value={filters.admissionTo} onChange={e=>updateFilter("admissionTo",e.target.value)}/></div>
        <div className="filter-field"><label>Minimum due (₹)</label><input type="number" min="0" value={filters.dueMin} onChange={e=>updateFilter("dueMin",e.target.value)} placeholder="0"/></div>
        <div className="filter-field"><label>Maximum due (₹)</label><input type="number" min="0" value={filters.dueMax} onChange={e=>updateFilter("dueMax",e.target.value)} placeholder="Any"/></div>
        <div className="filter-field"><label>Same as present address</label><select value={filters.sameAsPresentAddress} onChange={e=>updateFilter("sameAsPresentAddress",e.target.value)}><option value="">All</option><option value="true">Yes</option><option value="false">No</option></select></div>
        <div className="filter-field"><label>Student photo</label><select value={filters.hasPhoto} onChange={e=>updateFilter("hasPhoto",e.target.value)}><option value="">All</option><option value="yes">Uploaded</option><option value="no">Missing</option></select></div>
        <div className="filter-field"><label>Applicant signature</label><select value={filters.hasSignature} onChange={e=>updateFilter("hasSignature",e.target.value)}><option value="">All</option><option value="yes">Uploaded</option><option value="no">Missing</option></select></div>
        {["stampPhoto","qualifyingCertificates","matricAdmitCard"].map(key=><div className="filter-field" key={key}><label>{key==="stampPhoto"?"Photo enclosure":key==="qualifyingCertificates"?"Qualification certificate":"Matric admit card"}</label><select value={filters[key]} onChange={e=>updateFilter(key,e.target.value)}><option value="">All</option><option value="true">Available</option><option value="false">Not available</option></select></div>)}
        {advancedFields.map(([key,label,type])=><div className="filter-field" key={key}><label>{label}</label><input type={type||"text"} value={filters[key]} onChange={e=>updateFilter(key,e.target.value)} placeholder={"Filter by "+label.toLowerCase()}/></div>)}
        <button className="clear-btn" type="button" onClick={clearFilters}><RotateCcw size={15}/> Reset all</button>
      </div>}
      <div className="filter-summary"><span><Filter size={14}/> {pagination.total} matching student records</span><button className="clear-inline" onClick={clearFilters} disabled={!activeCount}><X size={14}/> Clear filters</button></div>
    </section>
    <>{(selectedStudents.length>0||selectAllMatching)&&<section className="bulk-selection-bar">
    <div><strong>{selectAllMatching?pagination.total:selectedStudents.length} student{(selectAllMatching?pagination.total:selectedStudents.length)!==1?"s":""} selected</strong><span>{selectAllMatching?"All matching records across every page are selected.":"Selected on this page."}</span></div>
    {!selectAllMatching&&allVisibleSelected&&pagination.total>students.length&&<button className="link-action" onClick={()=>setSelectAllMatching(true)}>Select all {pagination.total} matching students</button>}
    <div className="bulk-actions">
      <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}><option value="">Change status…</option>{["Registered","Admission Pending","Active","Course Completed","Alumni","Suspended","Cancelled"].map(s=><option key={s}>{s}</option>)}</select>
      <button className="ghost-btn" disabled={bulkBusy} onClick={()=>runBulk("status")}><ShieldCheck size={15}/> Apply Status</button>
      <button className="danger-btn" disabled={bulkBusy} onClick={()=>runBulk("delete")}><Trash2 size={15}/> Bulk Delete</button>
    </div>
  </section>}</><section className="panel table-panel directory-table-panel" aria-busy={loading}>
      {((selectedUnassigned.length>0&&selectedUnassigned.length===selectedStudents.length)||(selectAllMatching&&filters.registration==="unassigned"))&&<div className="batch-assignment-toolbar"><div><strong>{selectedStudents.length} student{selectedStudents.length>1?"s":""} selected</strong><span>Only unassigned students can be sent to a batch. Multiple selected students must match the selected batch course.</span></div><div className="top-actions"><select value={selectedBatch} onChange={e=>setSelectedBatch(e.target.value)}><option value="">Select available batch</option>{compatibleBatches.map(b=><option key={b._id} value={b._id}>{b.batchCode} — {b.courseCode} · {b.remaining} seats left</option>)}</select><button className="primary-btn" disabled={assigning||!selectedBatch} onClick={sendToBatch}><Send size={16}/>{assigning?"Sending…":"Send to Batch"}</button></div></div>}
      {loading?<div className="empty">Loading students…</div>:students.length===0?<div className="empty">No students match the selected filters.</div>:<div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Select all visible students" checked={selectAllMatching||allVisibleSelected} onChange={toggleAll}/></th><th>Form No.</th><th>Applicant Name</th><th>Course</th><th>Batch</th><th>Mobile</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>{students.map(s=><tr key={s._id} className="student-row" tabIndex="0" onClick={()=>window.location.href=`/dashboard/students/${s._id}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();window.location.href=`/dashboard/students/${s._id}`;}}}><td onClick={e=>e.stopPropagation()}><input type="checkbox" disabled={false} checked={selectAllMatching||selectedStudents.includes(s._id)} onChange={e=>setSelectedStudents(v=>e.target.checked?[...new Set([...v,s._id])]:v.filter(id=>id!==s._id))}/></td><td><strong>{s.formNo}</strong></td><td>{s.applicantName}</td><td>{s.courseCode||s.courseName||"—"}</td><td>{s.batchCode||"Unassigned"}</td><td>{s.mobileNumber}</td><td>₹{Number(s.dueAmount||0).toLocaleString("en-IN")}</td><td><span className="badge">{s.status}</span></td><td><div className="top-actions" onClick={e=>e.stopPropagation()}><a className="ghost-btn" href={`/dashboard/students/${s._id}?edit=1`}><Pencil size={14}/> Edit</a><button className="ghost-btn" onClick={async e=>{e.stopPropagation();if(!confirm("Permanently delete this student?"))return;const r=await fetch(`/api/students/${s._id}`,{method:"DELETE"});const d=await r.json();if(!r.ok)return alert(d.error||"Unable to delete student");load(pagination.page)}}><Trash2 size={14}/> Delete</button></div></td></tr>)}</tbody></table></div>}
      <div className="pagination"><span>Showing {students.length?((pagination.page-1)*50)+1:0}–{Math.min(pagination.page*50,pagination.total)} of {pagination.total}</span><div><button disabled={pagination.page<=1} onClick={()=>load(pagination.page-1)}><ChevronLeft size={17}/></button><span className="page-no">Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page>=pagination.totalPages} onClick={()=>load(pagination.page+1)}><ChevronRight size={17}/></button></div></div>
    </section>
  </ERPLayout>
}