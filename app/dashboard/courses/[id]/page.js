"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,Save,RefreshCw,BookOpen,IndianRupee} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

export default function CourseEditPage({params}){
 const [id,setId]=useState(""),[course,setCourse]=useState(null),[form,setForm]=useState({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{(async()=>{const p=await params;setId(p.id);try{const r=await fetch("/api/courses/"+p.id,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load course");setCourse(d.course);setForm({...d.course,requiredSkills:d.course.requiredSkills||[]});}catch(e){setMessage(e.message)}finally{setLoading(false)}})()},[params]);
 function change(k,v){setForm(f=>({...f,[k]:v}))}
 async function save(e){e.preventDefault();setSaving(true);setMessage("");try{const payload={...form,durationMonths:Number(form.durationMonths),classesPerWeek:Number(form.classesPerWeek),fee:Number(form.fee),admissionFee:Number(form.admissionFee),requiredSkills:Array.isArray(form.requiredSkills)?form.requiredSkills:[]};const r=await fetch("/api/courses/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save");setCourse(d.course);setForm({...d.course,requiredSkills:d.course.requiredSkills||[]});setMessage("Course master and fee structure updated successfully.");}catch(e){setMessage(e.message)}finally{setSaving(false)}}
 if(loading)return <ERPLayout active="/dashboard/courses"><section className="panel"><div className="empty">Loading course…</div></section></ERPLayout>;
 return <ERPLayout active="/dashboard/courses"><header className="topbar"><div><div className="crumb">Courses / Edit Course</div><h1>Edit Course</h1></div><div className="top-actions"><a className="ghost-btn" href="/dashboard/courses"><ArrowLeft size={17}/> Back</a></div></header>
 <main className="course-editor"><section className="course-editor-hero"><div className="course-editor-icon"><BookOpen size={22}/></div><div><span className="eyebrow">COURSE MASTER</span><h2>{course?.code} · {course?.name}</h2><p>Edit the complete course master, including the fee structure used by student admission and profiles.</p></div></section>
 <form className="course-editor-form" onSubmit={save}>
 <section className="edit-card"><h3>Basic Course Information</h3><div className="form-grid two">
 {[["code","Course Code"],["name","Course Name"],["durationMonths","Duration (months)"],["classesPerWeek","Classes / Week"]].map(([k,l])=><label className="form-field" key={k}><span>{l}</span><input name={k} value={form[k]??""} type={["durationMonths","classesPerWeek"].includes(k)?"number":"text"} onChange={e=>change(k,e.target.value)} required/></label>)}
 <label className="form-field"><span>Category</span><select value={form.category||"Diploma"} onChange={e=>change("category",e.target.value)}><option>Certificate</option><option>Foundation</option><option>Diploma</option><option>Advanced Diploma</option><option>Professional</option><option>Special</option></select></label>
 <label className="form-field"><span>Status</span><select value={form.active===false?"inactive":"active"} onChange={e=>change("active",e.target.value==="active")}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
 </div></section>
 <section className="edit-card fee-editor-card"><h3><IndianRupee size={17}/> Fee Structure</h3><p className="form-help">These values become the default fees whenever this course is selected during student registration or in a student profile.</p><div className="form-grid two">
 <label className="form-field"><span>Total Course Fee (₹)</span><input type="number" min="0" step="1" value={form.fee??0} onChange={e=>change("fee",e.target.value)} required/></label>
 <label className="form-field"><span>Admission Fee (₹)</span><input type="number" min="0" step="1" value={form.admissionFee??0} onChange={e=>change("admissionFee",e.target.value)} required/></label>
 </div><div className="fee-preview"><div><span>Total course fee</span><strong>₹{Number(form.fee||0).toLocaleString("en-IN")}</strong></div><div><span>Admission fee</span><strong>₹{Number(form.admissionFee||0).toLocaleString("en-IN")}</strong></div><div><span>Initial payable</span><strong>₹{(Number(form.fee||0)+Number(form.admissionFee||0)).toLocaleString("en-IN")}</strong></div></div></section>
 <section className="edit-card"><h3>Skills & Description</h3><label className="form-field full"><span>Required Skills</span><input value={(form.requiredSkills||[]).join(", ")} onChange={e=>change("requiredSkills",e.target.value.split(",").map(x=>x.trim()).filter(Boolean))}/></label><label className="form-field full"><span>Description</span><textarea rows="5" value={form.description||""} onChange={e=>change("description",e.target.value)}/></label></section>
 {message&&<div className={message.includes("successfully")?"success-msg":"error-msg"}>{message}</div>}
 <div className="sticky-edit-actions"><a className="ghost-btn" href="/dashboard/courses">Cancel</a><button className="primary-btn" disabled={saving}>{saving?<RefreshCw size={17}/> : <Save size={17}/>} {saving?"Saving…":"Save Course Master"}</button></div>
 </form></main></ERPLayout>;
}