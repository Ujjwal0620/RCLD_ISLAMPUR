"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, UserRound, MapPin, BookOpen, FileText, CreditCard, CalendarDays, ClipboardCheck, WalletCards, Save, Pencil, Trash2, Printer, ArrowRightLeft, UserX, History, Phone as PhoneIcon } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";
import indiaLocations from "@/lib/indiaStatesDistricts.json";

const value = (v) => v === undefined || v === null || v === "" ? "—" : v;
function Detail({label,children}){return <div className="student-detail-field"><span>{label}</span><strong>{value(children)}</strong></div>}

function numberToIndianWords(input){const n=Math.round(Number(input)||0);if(!n)return "Zero Rupees Only";const one=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];const ten=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];const two=x=>x<20?one[x]:ten[Math.floor(x/10)]+(x%10?" "+one[x%10]:"");const part=x=>x>99?one[Math.floor(x/100)]+" Hundred"+(x%100?" "+two(x%100):""):two(x);let x=n,out=[];for(const [v,label] of [[10000000,"Crore"],[100000,"Lakh"],[1000,"Thousand"],[100,"Hundred"]])if(x>=v){const q=Math.floor(x/v);out.push(part(q)+" "+label);x%=v;}if(x)out.push(part(x));return out.join(" ")+" Rupees Only";}


function DigitBoxes({ label, value = "", onChange, length = 10 }) {
  const digits = String(value || "").padEnd(length, " ").slice(0, length).split("");
  function updateAt(start, raw) { const incoming=String(raw||"").replace(/\\D/g,"").slice(0,length-start); const next=digits.slice(); if(!String(raw||""))next[start]=" "; incoming.split("").forEach((d,i)=>next[start+i]=d); onChange(next.join("").replace(/\\s+$/,"")); }
  return <label className="form-field digit-box-field"><span>{label}</span><div className="rcld-digit-boxes">{Array.from({length},(_,i)=><input key={i} aria-label={label+" digit "+(i+1)} inputMode="numeric" maxLength={1} value={digits[i]===" "?"":digits[i]} onChange={e=>{updateAt(i,e.target.value.slice(-1));if(e.target.value&&i<length-1)e.currentTarget.parentElement.children[i+1]?.focus();}} onKeyDown={e=>{if(e.key==="Backspace"&&!digits[i]&&i>0)e.currentTarget.parentElement.children[i-1]?.focus();if(e.key==="ArrowLeft"&&i>0)e.currentTarget.parentElement.children[i-1]?.focus();if(e.key==="ArrowRight"&&i<length-1)e.currentTarget.parentElement.children[i+1]?.focus();}} onPaste={e=>{e.preventDefault();updateAt(i,e.clipboardData.getData("text"));const n=e.clipboardData.getData("text").replace(/\\D/g,"").length;e.currentTarget.parentElement.children[Math.min(length-1,i+n)]?.focus();}} />)}</div></label>;
}

export default function StudentDetailsPage({params}){
  const [student,setStudent]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [fee,setFee]=useState(null),[courses,setCourses]=useState([]),[batches,setBatches]=useState([]),[referrals,setReferrals]=useState([]),[attendance,setAttendance]=useState({records:[],summary:{total:0,present:0,absent:0,leave:0,percentage:0}});
  const [feeForm,setFeeForm]=useState({totalFee:"",discount:"",admissionFee:"",registrationFee:"",amount:"",date:new Date().toISOString().slice(0,10),method:"Cash",reference:"",utrNumber:"",screenshotUrl:"",paymentType:"Installment",installmentMonth:""});
  const [proofUploading,setProofUploading]=useState(false);
  const [attForm,setAttForm]=useState({date:new Date().toISOString().slice(0,10),status:"Present",subject:"",batch:"",note:""});
  const [message,setMessage]=useState(""); const [editing,setEditing]=useState(false); const [editForm,setEditForm]=useState({});
  const [history,setHistory]=useState([]),[contactLogs,setContactLogs]=useState([]); const [transition,setTransition]=useState({action:"",batchId:"",remark:""}); const [transitioning,setTransitioning]=useState(false);

  async function loadOperational(id){
    const [fr,ar]=await Promise.all([fetch("/api/students/"+id+"/fees",{cache:"no-store"}),fetch("/api/students/"+id+"/attendance",{cache:"no-store"})]);
    const [fj,aj]=await Promise.all([fr.json(),ar.json()]);
    if(fr.ok){setFee(fj.fee);setFeeForm(f=>({...f,totalFee:f.totalFee||fj.fee.totalFee||"",discount:f.discount||fj.fee.discount||"",admissionFee:f.admissionFee||fj.fee.admissionFee||"",registrationFee:f.registrationFee||fj.fee.registrationFee||""}));}
    if(ar.ok)setAttendance(aj);
  }

  useEffect(()=>{(async()=>{try{const [courseResponse,batchResponse,referralResponse]=await Promise.all([fetch("/api/courses",{cache:"no-store"}),fetch("/api/batches",{cache:"no-store"}),fetch("/api/referrals",{cache:"no-store"})]);const [courseData,batchData,referralData]=await Promise.all([courseResponse.json(),batchResponse.json(),referralResponse.json()]);setCourses(courseData.courses||[]);setBatches(batchData.batches||[]);setReferrals((referralData.referrals||[]).filter(x=>x.status==="Active"));const {id}=await params;const r=await fetch("/api/students/"+id,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load student.");setStudent(d.student);setEditForm(d.student);const hr=await fetch("/api/students/"+id+"/batch-history",{cache:"no-store"});const hd=await hr.json();if(hr.ok)setHistory(hd.history||[]);const cr=await fetch("/api/students/"+id+"/contact-log",{cache:"no-store"});const cd=await cr.json();if(cr.ok)setContactLogs(cd.logs||[]);if(new URLSearchParams(window.location.search).get("edit")==="1")setEditing(true);await loadOperational(id);}catch(e){setError(e.message)}finally{setLoading(false)}})()},[params]);

  async function saveStudent(e){e.preventDefault();setMessage("");const r=await fetch("/api/students/"+student._id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...editForm,permanentAddress:editForm.sameAsPresentAddress?(editForm.presentAddress||editForm.address||""):editForm.permanentAddress})});const d=await r.json();if(!r.ok)return setMessage(d.error||"Unable to update student.");const fr=await fetch("/api/students/"+student._id+"/fees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({totalFee:feeForm.totalFee,discount:feeForm.discount||0,admissionFee:feeForm.admissionFee,registrationFee:feeForm.registrationFee,admissionDate:student.admissionDate})});const fd=await fr.json();if(!fr.ok)return setMessage(fd.error||"Student saved, but fee mapping failed.");setFee(fd.fee);setStudent(d.student);setEditForm(d.student);setEditing(false);setMessage("Student profile and course fee mapping updated successfully.");}
  async function deleteStudent(){if(!confirm("Permanently delete this student from the database? This cannot be undone."))return;const r=await fetch("/api/students/"+student._id,{method:"DELETE"});const d=await r.json();if(!r.ok)return setMessage(d.error||"Unable to archive student.");window.location.href="/dashboard/students";}
  async function saveFees(e){e.preventDefault();setMessage("");if(!student)return;const r=await fetch("/api/students/"+student._id+"/fees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({totalFee:feeForm.totalFee,discount:feeForm.discount,admissionFee:feeForm.admissionFee,registrationFee:feeForm.registrationFee,admissionDate:student.admissionDate,payment:feeForm.amount?{amount:feeForm.amount,date:feeForm.date,method:feeForm.method,reference:feeForm.reference,utrNumber:feeForm.utrNumber,screenshotUrl:feeForm.screenshotUrl,paymentType:feeForm.paymentType,installmentMonth:feeForm.installmentMonth}:undefined})});const d=await r.json();if(!r.ok){setMessage(d.error||"Unable to save fees.");return}setFee(d.fee);setFeeForm(f=>({...f,amount:"",reference:"",utrNumber:"",screenshotUrl:""}));setMessage("Fee information saved.");}
  async function uploadPaymentProof(file) {
    if(!file)return;
    if(!file.type.startsWith("image/")||file.size>5*1024*1024){setMessage("Choose an image smaller than 5 MB.");return;}
    setProofUploading(true);
    try{const fd=new FormData();fd.append("file",file);fd.append("purpose","payment-proof");const r=await fetch("/api/uploads/student-photo",{method:"POST",body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to upload screenshot.");setFeeForm(f=>({...f,screenshotUrl:d.url}));}
    catch(e){setMessage(e.message);}finally{setProofUploading(false);}
  }

  function printStudentForm(){
    if(!student)return;
    const esc=v=>String(v??"—").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const field=(label,v)=>'<div class="data-field"><b>'+esc(label)+'</b><span>'+esc(v)+'</span></div>';
    const present=[student.presentAddress||student.address,student.postOffice&&("P.O. "+student.postOffice),student.policeStation&&("P.S. "+student.policeStation),student.district,student.state,student.pin&&("PIN "+student.pin),student.nearestLandmark&&("Landmark: "+student.nearestLandmark)].filter(Boolean).join(", ");
    const permanent=student.sameAsPresentAddress?"Same as present address":[student.permanentAddress,student.permanentPostOffice&&("P.O. "+student.permanentPostOffice),student.permanentDistrict,student.permanentState,student.permanentPin&&("PIN "+student.permanentPin),student.permanentNearestLandmark&&("Landmark: "+student.permanentNearestLandmark)].filter(Boolean).join(", ");
    const qualifications=(student.qualifications||[]).map(q=>'<tr><td>'+esc(q.examCourse)+'</td><td>'+esc(q.collegeInstitute)+'</td><td>'+esc(q.boardUniversity)+'</td><td>'+esc(q.year)+'</td><td>'+esc(q.percentage)+'</td></tr>').join("")||'<tr><td colspan="5">Not provided</td></tr>';
    const photo=student.photoUrl?'<img class="student-photo" src="'+esc(student.photoUrl)+'" alt="Student photo"/>':'<div class="student-photo photo-empty">PHOTO</div>';
    const w=window.open("","_blank");
    if(!w){setMessage("Please allow pop-ups to print the student form.");return;}
    const css=`
      @page{size:A4 portrait;margin:5mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#092d63}
      body{font-size:7.1pt;line-height:1.15;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sheet{width:200mm;height:287mm;margin:0 auto;padding:3.5mm 4mm 4mm;border:1px solid #0d4a91;background:linear-gradient(180deg,#fbfdff 0%,#edf6ff 100%);position:relative;overflow:hidden}
      .brand{height:24mm;display:grid;grid-template-columns:24mm 1fr 24mm;align-items:center;gap:3mm;border-bottom:2.4mm solid #168bd0;padding-bottom:2.5mm;margin-bottom:2mm;position:relative}
      .brand:after{content:"";position:absolute;bottom:-3.5mm;left:0;right:0;height:1mm;background:#073d87}
      .seal{height:20mm;width:20mm;border:1.2mm double #0c4b8e;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9pt;font-weight:900;color:#0a3f81;background:#fff}
      .seal small{font-size:5.5pt;letter-spacing:.08em}
      .brand-title{text-align:center}
      .brand-title h1{font-family:Georgia,serif;font-size:18pt;line-height:.98;letter-spacing:.015em;margin:0;color:#073b80}
      .brand-title p{font-size:6.6pt;font-weight:800;margin:2mm 0 0;letter-spacing:.08em}
      .brand-right{text-align:center;font-weight:900;font-size:11pt;color:#0b438a}
      .brand-right small{display:block;font-size:6pt}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:3mm;background:#dceeff;border-radius:2mm;padding:2mm 2.5mm;margin-bottom:2mm}
      .data-field{display:flex;align-items:center;gap:2mm;min-width:0;margin:0 0 1.1mm}
      .data-field b{flex:0 0 34mm;font-size:6.8pt;color:#0c326b}
      .data-field span{display:block;flex:1;min-width:0;min-height:5.2mm;padding:1mm 1.4mm;border:1px solid #91add1;border-radius:1mm;background:#fff;overflow-wrap:anywhere}
      .section{margin-top:1.7mm}
      .section h2{font-size:8pt;line-height:1.2;color:#fff;background:linear-gradient(90deg,#063b85,#0d5ba9);padding:1.2mm 2mm;margin:0 0 1.3mm;border-radius:1.2mm}
      .office{display:grid;grid-template-columns:1fr 30mm;gap:3mm;align-items:start}
      .office-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 3mm}
      .student-photo{width:27mm;height:30mm;object-fit:cover;border:1px solid #0d4a91;background:#fff}
      .photo-empty{display:flex;align-items:center;justify-content:center;font-weight:900;color:#6d85a8}
      .applicant{display:grid;grid-template-columns:1.4fr 1fr;gap:0 3mm}
      .wide{grid-column:1/-1}
      .address{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
      .address-box{border:1px solid #aac3e2;border-radius:1.5mm;padding:2mm;background:#f8fbff;min-width:0}
      .address-box h3{font-size:7pt;color:#0a4388;margin:0 0 1.2mm}
      .address-box p{min-height:12mm;margin:0;padding:1.5mm;border:1px solid #c2d3e8;background:#fff;overflow-wrap:anywhere}
      .contact{display:grid;grid-template-columns:1fr 1fr;gap:0 3mm}
      table{width:100%;border-collapse:collapse;font-size:6.4pt}
      th,td{border:1px solid #9eb8da;padding:1.2mm 1.5mm;text-align:left;overflow-wrap:anywhere}
      th{background:#dcecff;color:#083b7b;font-weight:800}
      .checks{display:flex;align-items:center;flex-wrap:wrap;gap:2mm 6mm;padding:1mm 1.5mm}
      .check{display:flex;align-items:center;gap:1.2mm;font-size:6.6pt}
      .square{width:3.2mm;height:3.2mm;border:1px solid #174b91;display:inline-flex;align-items:center;justify-content:center;background:#fff;font-weight:bold}
      .declaration{font-size:6.1pt;line-height:1.25;color:#193c67;margin:1.5mm 0}
      .signatures{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:3mm;margin-top:2mm}
      .signbox{height:15mm;border:1px solid #174b91;border-radius:1.5mm;background:#fff;display:flex;flex-direction:column;justify-content:space-between;text-align:center;overflow:hidden}
      .signbox b{background:#0b438a;color:#fff;padding:1mm;font-size:6.4pt}
      .signbox span{padding:1mm;font-size:7pt;overflow-wrap:anywhere}
      .signline{border-top:1px solid #9eb8da;margin:0 2mm;padding:1mm}
      .footer{position:absolute;bottom:0;left:0;right:0;height:2.5mm;background:linear-gradient(90deg,#0b3d86,#168ed4,#0b3d86)}
      @media print{.sheet{break-inside:avoid;page-break-inside:avoid}}
    `;
    const html='<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Registration Form - '+esc(student.applicantName)+'</title><style>'+css+'</style></head><body><main class="sheet">'+
      '<header class="brand"><div class="seal">RCLD<small>ISLAMPUR</small></div><div class="brand-title"><h1>RASHTRIYA COMPUTER<br/>LITERACY DRIVE</h1><p>STUDENT REGISTRATION FORM · RCLD ISLAMPUR</p></div><div class="brand-right">RCLD<small>Islampur</small></div></header>'+
      '<div class="meta">'+field("Reg. No.",student.regnNo||student.enrollmentNo)+field("Date",student.admissionDate||student.createdAt?.slice?.(0,10))+'</div>'+
      '<section class="section"><h2>Office / Registration Details</h2><div class="office"><div class="office-grid">'+field("AEC Code","RCLD/ISL-001")+field("Form No.",student.formNo)+field("Course",student.courseName)+field("Course Code",student.courseCode)+field("Enrollment No.",student.enrollmentNo)+field("Referral",student.referralName)+field("Marketing Employee",student.marketingEmployeeName)+field("Student Status",student.status)+'</div>'+photo+'</div></section>'+
      '<section class="section"><h2>Applicant Details</h2><div class="applicant">'+field("① Name",student.applicantName)+field("② DOB",student.dateOfBirth)+field("③ Sex",student.sex==="M"?"M":student.sex==="F"?"F":student.sex)+field("④ Nationality",student.nationality)+'<div class="wide">'+field("⑤ Father / Mother / Husband",student.fatherOrHusbandName)+'</div></div></section>'+
      '<section class="section"><h2>Address</h2><div class="address"><div class="address-box"><h3>◉ Present Address</h3><p>'+esc(present||"—")+'</p></div><div class="address-box"><h3>□ Permanent Address</h3><p>'+esc(permanent||"—")+'</p></div></div></section>'+
      '<section class="section"><h2>Contact Details</h2><div class="contact">'+field("＊ Mobile No.",student.mobileNumber)+field("＊ Mob. of Guardian",student.guardianContactNumber)+field("＊ WhatsApp No.",student.whatsappNumber)+field("＊ Email Id",student.email)+field("＊ Aadhaar No.",student.aadhaarNumber)+'</div></section>'+
      '<section class="section"><h2>Qualifications</h2><table><thead><tr><th>Class / Sem / Course</th><th>Institute</th><th>Board / Council / University</th><th>Year</th><th>Percentage of Marks</th></tr></thead><tbody>'+qualifications+'</tbody></table></section>'+
      '<section class="section"><h2>Enclosure</h2><div class="checks"><span class="check"><i class="square">'+(student.enclosures?.stampPhoto?"✓":"")+'</i> 2 Passport size photo</span><span class="check"><i class="square">'+(student.enclosures?.qualifyingCertificates?"✓":"")+'</i> Aadhaar / Qualifying certificates</span><span class="check"><i class="square">'+(student.enclosures?.matricAdmitCard?"✓":"")+'</i> Admit / Caste worksheet</span></div></section>'+
      '<p class="declaration">I do hereby declare that all the information stated in this application form is true to the best of my knowledge. I have read and understood the rules and regulations and agree to abide by them.</p>'+
      '<div class="signatures"><div class="signbox"><b>Date</b><span>'+esc(student.declarationDate)+'</span></div><div class="signbox"><b>Place</b><span>'+esc(student.declarationPlace)+'</span></div><div class="signbox"><b>Browse Image / Signature</b><span class="signline">'+(student.signatureUrl?'<img src="'+esc(student.signatureUrl)+'" style="max-width:100%;max-height:24mm;object-fit:contain" alt="Student signature"/>':esc(student.signatureApplicant||"—"))+'</span><b>Signature</b></div></div><div class="footer"></div></main><script>window.onload=()=>{const page=document.querySelector(".sheet");if(page&&page.scrollHeight>page.clientHeight){page.style.transformOrigin="top center";page.style.transform="scaleY("+Math.max(.55,page.clientHeight/page.scrollHeight)+")";}setTimeout(()=>window.print(),500);};</script></body></html>';
    w.document.write(html);w.document.close();
  }

  function printBill(){
    if(!student||!fee)return;
    const esc=v=>String(v??"—").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
    const payable=Math.max(0,Number(fee.totalFee||0)+Number(fee.admissionFee||0)+Number(fee.registrationFee||0)-Number(fee.discount||0));
    const paid=Number(fee.paid||0),due=Math.max(0,Number(fee.due??(payable-paid)));
    const payments=(fee.payments||[]).slice().sort((x,y)=>String(x.date||"").localeCompare(String(y.date||"")));
    const latest=payments[payments.length-1]||null;
    const course=courses.find(x=>String(x.code||"").toUpperCase()===String(student.courseCode||"").toUpperCase());
    const duration=student.courseDuration||course?.duration||course?.durationText||"—";
    const receiptNo=latest?.receiptNo||"Receipt number not generated";
    let runningPaid=0;
    const history=(latest?[latest]:[]).map(p=>{
      runningPaid+=Number(p.amount||0);
      const remaining=Math.max(0,Number(fee.due??(payable-runningPaid)));
      return '<tr><td>'+esc(p.paymentType||"Course Fee")+'</td><td>'+money(fee.totalFee)+'</td><td>'+money(p.amount)+'</td><td>'+money(remaining)+'</td><td>'+esc(p.dueDate||p.installmentMonth||"—")+'</td></tr>';
    }).join("")||'<tr><td colspan="5" class="empty-row">No payment history recorded</td></tr>';
    const method=String(latest?.method||"").toLowerCase();
    const w=window.open("","_blank");
    if(!w){setMessage("Please allow pop-ups to print the fee receipt.");return;}
    const css=`
      @page{size:A4 portrait;margin:5mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#172b4d}
      body{font-size:6.5pt;line-height:1.08;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .receipt{width:200mm;height:138mm;min-height:138mm;margin:0 auto;border:1px solid #9bb5d5;background:#fff;padding:3mm 4mm;position:relative;overflow:hidden}
      .receipt-title{text-align:center;font-size:9pt;font-weight:800;color:#26384f;margin:0 0 1.5mm}
      .head{display:grid;grid-template-columns:20mm 1fr;gap:2mm;align-items:center;border-bottom:1px solid #9fb8d8;padding-bottom:1mm}
      .logo{height:12mm;width:18mm;border:1px solid #a8bfdc;border-radius:1mm;display:flex;align-items:center;justify-content:center;text-align:center;color:#0b438a;font-weight:900;font-size:9pt}
      .head h1{font-family:Arial,sans-serif;font-size:12pt;line-height:1.02;color:#174f91;margin:0;font-weight:900}
      .head p{font-size:8pt;margin:1.5mm 0 0;color:#1e293b}
      .branch{background:#dce8f7;color:#1e3d65;text-align:center;font-size:6pt;font-weight:700;padding:1mm;margin:1mm -4mm 1.5mm}
      .topgrid{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
      .panel{border:1px solid #9fb8d8;border-radius:1mm;padding:1.3mm;background:#f8fbff;min-width:0}
      .panel h3{font-size:7pt;margin:0 0 1mm;color:#152d4c;background:#dfeafa;padding:1.4mm}
      .row{display:grid;grid-template-columns:23mm 1fr;gap:1mm;margin:.6mm 0;font-size:6pt}
      .row b{font-weight:700;color:#354b68}
      .line{border:1px solid #c1d0e2;background:#fff;min-height:4mm;padding:.6mm;overflow-wrap:anywhere}
      table{width:100%;border-collapse:collapse;font-size:6.2pt}
      th,td{border:1px solid #9fb5d2;padding:1.1mm .8mm;text-align:left;overflow-wrap:anywhere}
      th{background:#dcecff;color:#0b3d7c;font-weight:800}
      .purpose{height:15mm;background:#fff;border:1px solid #c1d0e2;padding:2mm;overflow-wrap:anywhere}
      .fees{margin-top:1.5mm}
      .fee-layout{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
      .fee-list{display:grid;grid-template-columns:1fr 24mm;border:1px solid #aabed8;background:#f4f8fe}
      .fee-list div{padding:.65mm 1mm;border-bottom:1px solid #c8d7e9;font-size:6pt}
      .fee-list .amount{text-align:right;background:#fff;border-left:1px solid #c8d7e9;font-weight:700}
      .fee-list .total{background:#dcecff;font-weight:900}
      .fee-list .total.amount{background:#dcecff}
      .fee-side{border:1px solid #aabed8;background:#eaf2fc;min-height:100%;padding:1mm}
      .fee-side h4{margin:0 0 2mm;color:#183e71;font-size:7.5pt}
      .fee-side p{font-size:7pt;margin:0 0 2mm;line-height:1.35}
      .words{display:grid;grid-template-columns:18mm 1fr;gap:1.5mm;margin-top:2mm;font-size:7pt}
      .words strong{border:1px solid #bdcde0;background:#fff;padding:1.6mm;min-height:6mm}
      .bottom{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:2mm;align-items:end}
      .payment-method{font-size:7.5pt;line-height:1.9}
      .utr{margin-top:2mm;font-size:7.2pt}
      .signature{text-align:center;padding-top:5mm;border-top:1px dotted #536a88;font-size:7.5pt;font-weight:700}
      .footnote{font-size:5.5pt;color:#64748b;margin-top:1mm}
      .empty-row{text-align:center;padding:3mm;color:#697b91}
      @media print{.receipt{break-inside:avoid;page-break-inside:avoid}}
    `;
    const html='<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Student Receipt - '+esc(student.applicantName)+'</title><style>'+css+'</style></head><body><main class="receipt">'+
      '<div class="receipt-title">Student Receipt</div>'+
      '<header class="head"><div class="logo">RCLD<br/>ISLAMPUR</div><div><h1>Rashtriya Computer Literacy Drive</h1><p>Admission organised by <b>Sunita Services Pvt. Ltd.</b></p></div></header>'+
      '<div class="branch">RCLD Islampur, ASC: Cyberworld, Deshbandhu Road, O/H, B/D · ASC Code: RCLD/011</div>'+
      '<div class="topgrid"><section class="panel"><h3>Receipt Details</h3>'+
      '<div class="row"><b>Receipt No.</b><span class="line">'+esc(receiptNo)+'</span></div><div class="row"><b>Date</b><span class="line">'+esc(latest?.date||new Date().toLocaleDateString("en-IN"))+'</span></div><div class="row"><b>Enrolment No.</b><span class="line">'+esc(student.enrollmentNo||student.regnNo)+'</span></div><div class="row"><b>Student Name</b><span class="line">'+esc(student.applicantName)+'</span></div><div class="row"><b>Course</b><span class="line">'+esc(student.courseName||student.courseCode)+'</span></div><div class="row"><b>Duration</b><span class="line">'+esc(duration)+'</span></div></section>'+
      '<section class="panel"><h3>Payment History</h3><table><thead><tr><th>History</th><th>C/Fee</th><th>Paid</th><th>Due</th><th>Due Date</th></tr></thead><tbody>'+history+'</tbody></table><h3 style="margin-top:2mm">Purpose</h3><div class="purpose">'+esc(latest?.note||latest?.paymentType||"Course fee payment")+'</div></section></div>'+
      '<section class="panel fees"><h3>Fees Details</h3><div class="fee-layout"><div class="fee-list">'+
      '<div>Admn. Fee</div><div class="amount">'+money(fee.admissionFee)+'</div>'+
      '<div>Installment Fee</div><div class="amount">'+money(fee.totalFee)+'</div>'+
      '<div>Registration Fee (one-time)</div><div class="amount">'+money(fee.registrationFee)+'</div>'+
      '<div>Lab Charge</div><div class="amount">—</div>'+
      '<div>Late Fee</div><div class="amount">'+money(fee.lateFine)+'</div>'+
      '<div>ID-Card</div><div class="amount">—</div>'+
      '<div>Examination</div><div class="amount">—</div>'+
      '<div>Others</div><div class="amount">—</div>'+
      '<div>Discount</div><div class="amount">− '+money(fee.discount)+'</div>'+
      '<div class="total">Total</div><div class="amount total">'+money(payable)+'</div>'+
      '</div><aside class="fee-side"><h4>Payment / Fee Summary</h4><p><b>Student:</b> '+esc(student.applicantName)+'</p><p><b>Course:</b> '+esc(student.courseCode||student.courseName)+'</p><p><b>Total Paid:</b> '+money(paid)+'</p><p><b>Balance Due:</b> '+money(due)+'</p><p><b>Payment Count:</b> '+payments.length+'</p></aside></div><div class="words"><b>In Words</b><strong>'+esc(numberToIndianWords(payable))+'</strong></div></section>'+
      '<div class="bottom"><div><div class="payment-method">'+(method==="cash"?"☑":"☐")+' Cash &nbsp;&nbsp; '+(method&&method!=="cash"?"☑":"☐")+' Online</div><div class="utr">UTR NO.: '+esc(latest?.utrNumber||latest?.reference||"—")+(latest?.screenshotUrl?' · <a href="'+esc(latest.screenshotUrl)+'">Payment proof</a>':"")+'</div></div><div class="signature">For RCLD - Islampur<br/><br/>Authorized Signatory with Office Seal</div></div>'+
      '<div class="receipt-terms"><b>Terms & Conditions:</b> 1. A receipt is valid only after being authorised by an AEC representative. 2. Late fee of ₹50 per month applies after the 10th of every month while dues remain unpaid. 3. Admission fee includes nominal charges towards ID-Card, course module, terminal & final Diploma Examination, and certification.</div><p class="footnote">Computer-generated receipt · Please retain this document for your records.</p></main><script>window.onload=()=>{const page=document.querySelector(".receipt");if(page&&page.scrollHeight>page.clientHeight){page.style.transformOrigin="top center";page.style.transform="scaleY("+Math.max(.55,page.clientHeight/page.scrollHeight)+")";}setTimeout(()=>window.print(),350);};</script></body></html>';
    w.document.write(html);w.document.close();
  }

  async function saveAttendance(e){e.preventDefault();setMessage("");if(!student)return;const r=await fetch("/api/students/"+student._id+"/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(attForm)});const d=await r.json();if(!r.ok){setMessage(d.error||"Unable to save attendance.");return}const ar=await fetch("/api/students/"+student._id+"/attendance",{cache:"no-store"});setAttendance(await ar.json());setMessage("Attendance saved.");}

  return <ERPLayout active="/dashboard/students">
    <header className="topbar"><div><div className="crumb">Students / Student Details</div><h1>{student?.applicantName||"Student Details"}</h1></div><div className="top-actions">{student&&<><button className="ghost-btn" onClick={printStudentForm}><Printer size={16}/> Print Registration Form</button><button className="ghost-btn" onClick={printBill}><Printer size={16}/> Print Fee Receipt</button><button className="ghost-btn" onClick={()=>setEditing(true)}><Pencil size={16}/> Edit</button><button className="ghost-btn" onClick={deleteStudent}><Trash2 size={16}/> Delete</button></>}<a className="ghost-btn" href="/dashboard/students"><ArrowLeft size={17}/> Back</a></div></header>
    {loading&&<section className="panel"><div className="empty">Loading student details…</div></section>}
    {error&&<section className="panel"><div className="empty error-text">{error}</div></section>}
    {student&&<main className="student-details student-profile-page">
      {editing&&<section className="detail-section student-edit-panel"><div className="detail-section-title"><Pencil size={17}/><div><h3>Edit Student Profile</h3><span>Complete student master data. Imported Excel values are preserved; synthetic values are marked as demo data in the source import.</span></div></div><form onSubmit={saveStudent}><div className="student-edit-grid">
<div className="edit-card"><h4>Identity & Registration</h4><div className="form-grid two">{[["formNo","Form No."],["enrollmentNo","Enrollment No."],["applicantName","Applicant Name"],["aecCode","AEC Code"],["regnNo","Registration No."],["admissionDate","Admission Date"]].map(([k,l])=><label className="form-field" key={k}><span>{l}</span><input type={k==="admissionDate"?"date":"text"} value={editForm[k]||""} readOnly={["formNo","enrollmentNo","aecCode"].includes(k)} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/></label>)}</div></div>
<div className="edit-card"><h4>Course & Fee</h4><div className="form-grid two">
<label className="form-field"><span>Course</span><select value={editForm.courseCode||""} onChange={e=>{const selected=courses.find(x=>x.code===e.target.value);setEditForm(f=>({...f,courseCode:selected?.code||"",courseName:selected?.name||"",sourceCourseLabel:selected?.code||""}));if(selected)setFeeForm(f=>({...f,totalFee:selected.fee||0,admissionFee:selected.admissionFee||0,registrationFee:selected.registrationFee||f.registrationFee||0}));}} required><option value="">Select course</option>{courses.map(x=><option key={x._id} value={x.code}>{x.code} — {x.name}</option>)}</select></label>
<label className="form-field"><span>Course Code</span><input value={editForm.courseCode??""} readOnly/></label>
<label className="form-field"><span>Course Fee (₹)</span><input value={feeForm.totalFee??0} readOnly/></label>
<label className="form-field"><span>Admission Fee (₹)</span><input value={feeForm.admissionFee??0} readOnly/></label>
<label className="form-field"><span>Due Amount</span><input value={editForm.dueAmount??""} onChange={e=>setEditForm(f=>({...f,dueAmount:e.target.value}))}/></label>
<label className="form-field"><span>Payment Status</span><input value={editForm.paymentStatus??""} onChange={e=>setEditForm(f=>({...f,paymentStatus:e.target.value}))}/></label>
<label className="form-field"><span>Batch Assignment</span><select value={editForm.batchId||""} onChange={e=>{const b=batches.find(x=>String(x._id)===e.target.value);setEditForm(f=>({...f,batchId:e.target.value||null,batchCode:b?.batchCode||""}));}}><option value="">Not assigned</option>{batches.filter(b=>String(b.courseCode||"").toUpperCase()===String(editForm.courseCode||"").toUpperCase() && !["Cancelled","Completed"].includes(b.status)).map(b=><option key={b._id} value={b._id}>{b.batchCode} — {b.name} ({b.courseCode})</option>)}</select></label>
<label className="form-field"><span>Original Course / Series</span><input value={editForm.sourceCourseLabel??""} onChange={e=>setEditForm(f=>({...f,sourceCourseLabel:e.target.value}))}/></label>
<label className="form-field"><span>Payment Note</span><input value={editForm.paymentNote??""} onChange={e=>setEditForm(f=>({...f,paymentNote:e.target.value}))}/></label>
</div></div>
<div className="edit-card"><h4>Personal Information</h4><div className="form-grid two">{[["nationality","Nationality"],["dateOfBirth","Date of Birth"],["fatherOrHusbandName","Father / Husband Name"],["pin","PIN"]].map(([k,l])=><label className="form-field" key={k}><span>{l}</span><input type={k==="dateOfBirth"?"date":"text"} value={editForm[k]||""} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/></label>)}<DigitBoxes label="Mobile No. (10 digits)" value={editForm.mobileNumber||""} onChange={v=>setEditForm(f=>({...f,mobileNumber:v}))}/><DigitBoxes label="Mob. of Guardian (10 digits)" value={editForm.guardianContactNumber||""} onChange={v=>setEditForm(f=>({...f,guardianContactNumber:v}))}/><DigitBoxes label="WhatsApp No. (10 digits)" value={editForm.whatsappNumber||""} onChange={v=>setEditForm(f=>({...f,whatsappNumber:v}))}/><label className="form-field"><span>Email Address *</span><input type="email" required value={editForm.email||""} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}/></label><label className="form-field"><span>Aadhaar Card Number *</span><input inputMode="numeric" pattern="[0-9]{12}" maxLength="12" required value={editForm.aadhaarNumber||""} onChange={e=>setEditForm(f=>({...f,aadhaarNumber:e.target.value.replace(/\D/g,"").slice(0,12)}))}/></label><label className="form-field"><span>Referral</span><select value={editForm.referralId||""} onChange={e=>setEditForm(f=>({...f,referralId:e.target.value}))}><option value="">Direct / No referral</option>{referrals.map(r=><option key={r._id} value={r._id}>{r.name} — {r.marketingEmployeeName}</option>)}</select></label><label className="form-field"><span>Sex</span><select value={editForm.sex||""} onChange={e=>setEditForm(f=>({...f,sex:e.target.value}))}><option value="">Select</option><option value="M">Male</option><option value="F">Female</option></select></label></div><div className="student-address-edit-grid"><label className="form-field"><span>Present Address / Ward / Village / Town</span><textarea rows="3" value={editForm.presentAddress||editForm.address||""} onChange={e=>setEditForm(f=>({...f,presentAddress:e.target.value,address:e.target.value}))}/></label><label className="form-field"><span>Permanent Address / Ward / Village / Town</span><textarea rows="3" value={editForm.permanentAddress||""} disabled={!!editForm.sameAsPresentAddress} onChange={e=>setEditForm(f=>({...f,permanentAddress:e.target.value,sameAsPresentAddress:false}))}/></label><label className="registration-same-address"><input type="checkbox" checked={!!editForm.sameAsPresentAddress} onChange={e=>setEditForm(f=>({...f,sameAsPresentAddress:e.target.checked,permanentAddress:e.target.checked?(f.presentAddress||f.address||""):f.permanentAddress}))}/> Same as present address</label><div className="form-grid two"><label className="form-field"><span>Present P.O.</span><input value={editForm.postOffice||""} onChange={e=>setEditForm(f=>({...f,postOffice:e.target.value}))}/></label><label className="form-field"><span>Present P.S.</span><input value={editForm.policeStation||""} onChange={e=>setEditForm(f=>({...f,policeStation:e.target.value}))}/></label><label className="form-field"><span>Present State</span><select value={editForm.state||""} onChange={e=>setEditForm(f=>({...f,state:e.target.value,district:""}))}><option value="">Select state</option>{indiaLocations.map(st=><option key={st.code} value={st.name}>{st.name}</option>)}</select></label><label className="form-field"><span>Present District</span><select value={editForm.district||""} disabled={!editForm.state} onChange={e=>setEditForm(f=>({...f,district:e.target.value}))}><option value="">Select district</option>{(indiaLocations.find(st=>st.name===editForm.state)?.districts||[]).map(d=><option key={d.code} value={d.name}>{d.name}</option>)}</select></label><label className="form-field"><span>Present PIN</span><input value={editForm.pin||""} onChange={e=>setEditForm(f=>({...f,pin:e.target.value}))}/></label><label className="form-field"><span>Present Nearest Landmark</span><input value={editForm.nearestLandmark||""} onChange={e=>setEditForm(f=>({...f,nearestLandmark:e.target.value}))}/></label><label className="form-field"><span>Permanent P.O.</span><input value={editForm.permanentPostOffice||""} onChange={e=>setEditForm(f=>({...f,permanentPostOffice:e.target.value}))}/></label><label className="form-field"><span>Permanent State</span><select value={editForm.permanentState||""} onChange={e=>setEditForm(f=>({...f,permanentState:e.target.value,permanentDistrict:""}))}><option value="">Select state</option>{indiaLocations.map(st=><option key={st.code} value={st.name}>{st.name}</option>)}</select></label><label className="form-field"><span>Permanent District</span><select value={editForm.permanentDistrict||""} disabled={!editForm.permanentState} onChange={e=>setEditForm(f=>({...f,permanentDistrict:e.target.value}))}><option value="">Select district</option>{(indiaLocations.find(st=>st.name===editForm.permanentState)?.districts||[]).map(d=><option key={d.code} value={d.name}>{d.name}</option>)}</select></label><label className="form-field"><span>Permanent PIN</span><input value={editForm.permanentPin||""} onChange={e=>setEditForm(f=>({...f,permanentPin:e.target.value}))}/></label><label className="form-field"><span>Permanent Nearest Landmark</span><input value={editForm.permanentNearestLandmark||""} onChange={e=>setEditForm(f=>({...f,permanentNearestLandmark:e.target.value}))}/></label></div></div></div>
<div className="edit-card"><h4>Academic & Documents</h4><div className="form-grid two"><label className="form-field"><span>Qualification</span><input value={editForm.qualifications?.[0]?.examCourse||""} onChange={e=>setEditForm(f=>({...f,qualifications:[{...(f.qualifications?.[0]||{}),examCourse:e.target.value}]}))}/></label><label className="form-field"><span>Board / University</span><input value={editForm.qualifications?.[0]?.boardUniversity||""} onChange={e=>setEditForm(f=>({...f,qualifications:[{...(f.qualifications?.[0]||{}),boardUniversity:e.target.value}]}))}/></label><label className="form-field"><span>Qualification Year</span><input value={editForm.qualifications?.[0]?.year||""} onChange={e=>setEditForm(f=>({...f,qualifications:[{...(f.qualifications?.[0]||{}),year:e.target.value}]}))}/></label><label className="form-field"><span>Percentage</span><input value={editForm.qualifications?.[0]?.percentage||""} onChange={e=>setEditForm(f=>({...f,qualifications:[{...(f.qualifications?.[0]||{}),percentage:e.target.value}]}))}/></label><label className="form-field"><span>Declaration Date</span><input type="date" value={editForm.declarationDate||""} onChange={e=>setEditForm(f=>({...f,declarationDate:e.target.value}))}/></label><label className="form-field"><span>Declaration Place</span><input value={editForm.declarationPlace||""} onChange={e=>setEditForm(f=>({...f,declarationPlace:e.target.value}))}/></label></div></div>
<div className="edit-card"><h4>Status & Enclosures</h4><div className="form-grid two"><label className="form-field"><span>Status</span><select value={editForm.status||"Registered"} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}>{["Registered","Admission Pending","Active","Course Completed","Dropped Out","Cancelled","Suspended","Alumni"].map(x=><option key={x}>{x}</option>)}</select></label><label className="form-field"><span>Student Signature Image</span><input type="file" accept="image/*" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>3*1024*1024){setMessage("Signature image must be smaller than 3 MB.");return;}const fd=new FormData();fd.append("file",file);fd.append("purpose","signature");const r=await fetch("/api/uploads/student-photo",{method:"POST",body:fd});const d=await r.json();if(!r.ok){setMessage(d.error||"Unable to upload signature.");return;}setEditForm(f=>({...f,signatureUrl:d.url}));}}/>{editForm.signatureUrl&&<img src={editForm.signatureUrl} alt="Student signature" style={{display:"block",maxWidth:220,maxHeight:80,objectFit:"contain",marginTop:8}}/>}</label></div><div className="checks edit-checks">{[["stampPhoto","Photo"],["qualifyingCertificates","Qualification Certificates"],["matricAdmitCard","Matric Admit Card"]].map(([k,l])=><label key={k}><input type="checkbox" checked={!!editForm.enclosures?.[k]} onChange={e=>setEditForm(f=>({...f,enclosures:{...(f.enclosures||{}),[k]:e.target.checked}}))}/>{l}</label>)}</div></div>
</div><div className="form-actions sticky-edit-actions"><button type="button" className="ghost-btn" onClick={()=>setEditing(false)}>Cancel</button><button className="primary-btn"><Save size={16}/> Save Changes</button></div></form></section>}
      <section className="student-profile-card student-profile-hero"><div className="student-avatar">{student.photoUrl?<img src={student.photoUrl} alt=""/>:<UserRound size={30}/>}</div><div><div className="eyebrow">Super Admin / Student Profile</div><h2>{student.applicantName}</h2><p>Form No. {value(student.formNo)} · {value(student.courseName)} · {value(student.mobileNumber)}</p></div><span className="badge profile-status">{value(student.status)}</span></section>
<section className="detail-section student-transition-panel">
  <div className="detail-section-title"><History size={17}/><div><h3>Batch Movement & Student Status</h3><span>Every shift, dropout and rejoin is permanently recorded with batch, series, faculty, schedule, attendance footprint and remark.</span></div></div>
  <div className="transition-actions">
    {student.batchId && student.status!=="Dropped Out" && <button className="ghost-btn" onClick={()=>setTransition({action:"SHIFTED",batchId:"",remark:""})}><ArrowRightLeft size={16}/> Shift Batch</button>}
    {student.batchId && student.status!=="Dropped Out" && <button className="danger-btn" onClick={()=>setTransition({action:"DROPPED_OUT",batchId:"",remark:""})}><UserX size={16}/> Mark Dropout</button>}
    {student.status==="Dropped Out" && <button className="primary-btn" onClick={()=>setTransition({action:"REJOINED",batchId:String(history.find(h=>h.action==="DROPPED_OUT")?.fromBatch?.batchId||""),remark:""})}><ArrowRightLeft size={16}/> Drop Back to Batch</button>}
  </div>
  {transition.action && <div className="transition-form">
    <div className="transition-form-head"><strong>{transition.action==="SHIFTED"?"Shift Student":transition.action==="DROPPED_OUT"?"Mark Student as Dropout":"Drop Student Back to Batch"}</strong><button className="ghost-btn" onClick={()=>setTransition({action:"",batchId:"",remark:""})}>Cancel</button></div>
    {(transition.action==="SHIFTED"||transition.action==="REJOINED")&&<label className="form-field"><span>{transition.action==="REJOINED"?"Restore / Select Batch":"Target Batch"}</span><select value={transition.batchId} onChange={e=>setTransition(t=>({...t,batchId:e.target.value}))}><option value="">Select batch</option>{batches.filter(b=>["Draft","Active"].includes(b.status)&&String(b.courseCode||"").toUpperCase()===String(student.courseCode||"").toUpperCase()).map(b=><option key={b._id} value={b._id}>{b.batchCode} — {b.name} · {b.courseCode}</option>)}</select></label>}
    <label className="form-field"><span>Remark <b>*</b></span><textarea rows="3" value={transition.remark} onChange={e=>setTransition(t=>({...t,remark:e.target.value}))} placeholder={transition.action==="SHIFTED"?"Why is the student being shifted?":transition.action==="DROPPED_OUT"?"Reason for dropout":"Reason for rejoining / dropping back to batch"}/></label>
    <button className="primary-btn" disabled={transitioning||transition.remark.trim().length<3||(transition.action!=="DROPPED_OUT"&&!transition.batchId)} onClick={async()=>{
      setTransitioning(true);setMessage("");
      try{const r=await fetch("/api/students/"+student._id+"/batch-history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:transition.action,toBatchId:transition.batchId,remark:transition.remark,actor:"superadmin",actorRole:"superadmin"})});const d=await r.json();if(!r.ok){setMessage(d.error||"Unable to update student movement.");return;}const sr=await fetch("/api/students/"+student._id,{cache:"no-store"});const sd=await sr.json();if(sr.ok){setStudent(sd.student);setEditForm(sd.student);}const hr=await fetch("/api/students/"+student._id+"/batch-history",{cache:"no-store"});const hd=await hr.json();if(hr.ok)setHistory(hd.history||[]);setTransition({action:"",batchId:"",remark:""});setMessage(d.message||"Student movement updated.");}finally{setTransitioning(false);}
    }} >{transitioning?"Saving…":"Confirm Movement"}</button>
  </div>}
  <div className="movement-history">
    <div className="movement-history-title">Movement Footprint</div>
    {history.length===0?<div className="empty">No batch movement history yet.</div>:history.map(h=><div className="movement-card" key={h._id}>
      <div className="movement-card-head"><strong>{h.action==="SHIFTED"?"Batch Shifted":h.action==="DROPPED_OUT"?"Dropped Out":"Rejoined Batch"}</strong><span>{h.occurredAt?new Date(h.occurredAt).toLocaleString():""}</span></div>
      <div className="movement-grid"><div><small>From</small><b>{h.fromBatch?.batchCode||"—"}</b></div><div><small>To</small><b>{h.toBatch?.batchCode||"Dropout / —"}</b></div><div><small>From Faculty</small><b>{(h.fromBatch?.faculty||[]).map(x=>x.name).filter(Boolean).join(", ")||"—"}</b></div><div><small>To Faculty</small><b>{(h.toBatch?.faculty||[]).map(x=>x.name).filter(Boolean).join(", ")||"—"}</b></div></div>
      <div className="movement-remark"><strong>Remark:</strong> {h.remark}</div>
      <div className="movement-grid"><div><small>From Series</small><b>{(h.fromBatch?.series||[]).join(", ")||"—"}</b></div><div><small>To Series</small><b>{(h.toBatch?.series||[]).join(", ")||"—"}</b></div><div><small>From Schedule</small><b>{(h.fromBatch?.schedules||[]).map(x=>`${x.day} ${x.time} ${x.series||""}`).join(" · ")||"—"}</b></div><div><small>To Schedule</small><b>{(h.toBatch?.schedules||[]).map(x=>`${x.day} ${x.time} ${x.series||""}`).join(" · ")||"—"}</b></div></div>
      {h.attendanceSnapshot?.from&&<div className="movement-footprint">Attendance footprint: {h.attendanceSnapshot.from.total||0} records · {h.attendanceSnapshot.from.percentage||0}% present</div>}
    </div>)}
  </div>
</section>


      <section className="detail-section"><div className="detail-section-title"><PhoneIcon size={17}/><h3>Calling & Follow-up History</h3></div><div className="table-wrap"><table><thead><tr><th>Date / Time</th><th>Phone</th><th>Calling Remark</th><th>Remarks</th><th>By</th></tr></thead><tbody>{contactLogs.length?contactLogs.map(x=><tr key={x._id}><td>{x.createdAt?new Date(x.createdAt).toLocaleString():"—"}</td><td><a href={x.phoneNumber?"tel:"+String(x.phoneNumber).replace(/\s+/g,""):"#"}>{x.phoneNumber||"—"}</a></td><td>{x.callingRemark||"—"}</td><td>{x.remarks||"—"}</td><td>{x.actorName||x.actorId||"—"}</td></tr>):<tr><td colSpan="5"><div className="empty">No calling or follow-up remarks recorded yet.</div></td></tr>}</tbody></table></div></section>

<section className="student-summary-grid">
        <div className="summary-card"><WalletCards size={18}/><span>Fees Due</span><strong>₹{Number(fee?.due||0).toLocaleString("en-IN")}</strong></div>
        <div className="summary-card"><ClipboardCheck size={18}/><span>Attendance</span><strong>{attendance.summary?.percentage||0}%</strong></div>
        <div className="summary-card"><BookOpen size={18}/><span>Course</span><strong>{value(student.courseName)}</strong></div>
        <div className="summary-card"><CalendarDays size={18}/><span>Attendance Records</span><strong>{attendance.summary?.total||0}</strong></div>
      </section>

      <section className="detail-section"><div className="detail-section-title"><UserRound size={17}/><h3>Personal Details</h3></div><div className="student-detail-grid">
        <Detail label="Form No.">{student.formNo}</Detail><Detail label="Enrollment No.">{student.enrollmentNo}</Detail><Detail label="Registration No.">{student.regnNo}</Detail><Detail label="Applicant Name">{student.applicantName}</Detail><Detail label="Father / Husband Name">{student.fatherOrHusbandName}</Detail><Detail label="Nationality">{student.nationality}</Detail><Detail label="Sex">{student.sex==="M"?"Male":student.sex==="F"?"Female":student.sex}</Detail><Detail label="Date of Birth">{student.dateOfBirth}</Detail><Detail label="Mobile Number">{student.mobileNumber}</Detail><Detail label="Guardian Contact">{student.guardianContactNumber}</Detail><Detail label="Email Address">{student.email}</Detail><Detail label="Aadhaar Number">{student.aadhaarNumber ? "XXXX XXXX " + String(student.aadhaarNumber).slice(-4) : "—"}</Detail><Detail label="Referral">{student.referralName}</Detail><Detail label="Marketing Employee">{student.marketingEmployeeName}</Detail><Detail label="WhatsApp Number">{student.whatsappNumber}</Detail><Detail label="Guardian Contact">{student.guardianContactNumber}</Detail><Detail label="PIN">{student.pin}</Detail><Detail label="Status">{student.status}</Detail>
      </div><div className="student-address"><MapPin size={16}/><div><span>Present Address</span><strong>{value(student.presentAddress||student.address)}</strong><small>{[student.postOffice&&("P.O. "+student.postOffice),student.policeStation&&("P.S. "+student.policeStation),student.district,student.state,student.pin&&("PIN "+student.pin),student.nearestLandmark&&("Landmark "+student.nearestLandmark)].filter(Boolean).join(" · ")}</small><span style={{marginTop:8}}>Permanent Address</span><strong>{value(student.sameAsPresentAddress?"Same as present address":student.permanentAddress||"Not separately recorded")}</strong><small>{[student.permanentPostOffice&&("P.O. "+student.permanentPostOffice),student.permanentDistrict,student.permanentState,student.permanentPin&&("PIN "+student.permanentPin),student.permanentNearestLandmark&&("Landmark "+student.permanentNearestLandmark)].filter(Boolean).join(" · ")}</small></div></div></section>

      <section className="detail-section"><div className="detail-section-title"><BookOpen size={17}/><h3>Course, Batch & Academic Tracking</h3></div><div className="student-detail-grid">
        <Detail label="Course Name">{student.courseName}</Detail><Detail label="Course Code">{student.courseCode}</Detail><Detail label="Original Course / Series">{student.sourceCourseLabel}</Detail><Detail label="Batch">{student.batchCode||"Not assigned"}</Detail><Detail label="Admission Date">{student.admissionDate}</Detail><Detail label="Imported Due Amount">{student.dueAmount}</Detail><Detail label="Imported Payment Status">{student.paymentStatus}</Detail><Detail label="AEC Code">RCLD/ISL-001</Detail><Detail label="Registered On">{student.createdAt?new Date(student.createdAt).toLocaleString():""}</Detail><Detail label="Last Updated">{student.updatedAt?new Date(student.updatedAt).toLocaleString():""}</Detail>
      </div><div className="operational-placeholder"><strong>Course Content Progress</strong><span>Course content and batch-wise topic completion will be shown here after this student is assigned to a batch.</span></div></section>

      <section className="detail-section student-fees-section"><div className="detail-section-title"><CreditCard size={17}/><div><h3>Fees & Payments</h3><span>Fee summary and payment entries for this student</span></div></div>
        <div className="student-summary-grid compact fee-summary-three">
          <div className="summary-card"><span>Total Fee</span><strong>₹{Number(fee?.payable||0).toLocaleString("en-IN")}</strong></div>
          <div className="summary-card"><span>Fee Paid</span><strong>₹{Number(fee?.paid||0).toLocaleString("en-IN")}</strong></div>
          <div className="summary-card danger"><span>Total Due (incl. late fine)</span><strong>₹{Number(fee?.due||0).toLocaleString("en-IN")}</strong></div>
        </div>
        <div className="fee-breakdown-strip">
          <span>Course fee: ₹{Number(fee?.totalFee||0).toLocaleString("en-IN")}</span><span>Admission fee (one-time): ₹{Number(fee?.admissionFee||0).toLocaleString("en-IN")}</span><span>Registration fee (one-time): ₹{Number(fee?.registrationFee||0).toLocaleString("en-IN")}</span><span>Discount: ₹{Number(fee?.discount||0).toLocaleString("en-IN")}</span><span>Late fine: ₹{Number(fee?.lateFine||0).toLocaleString("en-IN")}</span>
        </div>
        <details className="fee-entry-expander"><summary><strong>Fee setup & record a payment</strong><span>Expand to update fee plan or add payment</span></summary>
          <form className="inline-operation-form" onSubmit={saveFees}><h4>Fee Plan</h4><div className="form-grid four">
            <label className="form-field"><span>Course Fee</span><input type="number" min="0" value={feeForm.totalFee} onChange={e=>setFeeForm(f=>({...f,totalFee:e.target.value}))}/></label>
            <label className="form-field"><span>Discount</span><input type="number" min="0" value={feeForm.discount} onChange={e=>setFeeForm(f=>({...f,discount:e.target.value}))}/></label>
            <label className="form-field"><span>Admission Fee (one-time)</span><input type="number" min="0" value={feeForm.admissionFee} onChange={e=>setFeeForm(f=>({...f,admissionFee:e.target.value}))}/></label>
            <label className="form-field"><span>Registration Fee (one-time)</span><input type="number" min="0" value={feeForm.registrationFee} onChange={e=>setFeeForm(f=>({...f,registrationFee:e.target.value}))}/></label>
          </div><h4 className="fee-payment-subheading">New Payment Entry</h4><div className="form-grid four">
            <label className="form-field"><span>Payment Amount</span><input type="number" min="1" value={feeForm.amount} onChange={e=>setFeeForm(f=>({...f,amount:e.target.value}))}/></label>
            <label className="form-field"><span>Payment Date</span><input type="date" value={feeForm.date} onChange={e=>setFeeForm(f=>({...f,date:e.target.value}))}/></label>
            <label className="form-field"><span>Payment Type</span><select value={feeForm.paymentType} onChange={e=>setFeeForm(f=>({...f,paymentType:e.target.value}))}><option value="Admission Fee">Admission Fee</option><option value="Registration Fee">Registration Fee</option><option value="Installment">Installment</option><option value="Course Fee">Course Fee</option><option value="Other">Other</option></select></label>
            <label className="form-field"><span>Installment Month</span><input type="month" value={feeForm.installmentMonth} onChange={e=>setFeeForm(f=>({...f,installmentMonth:e.target.value}))}/></label>
            <label className="form-field"><span>Payment Method</span><select value={feeForm.method} onChange={e=>setFeeForm(f=>({...f,method:e.target.value}))}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>PhonePe</option></select></label>
            <label className="form-field"><span>UTR / Transaction No.</span><input value={feeForm.utrNumber} onChange={e=>setFeeForm(f=>({...f,utrNumber:e.target.value}))} placeholder="Enter UTR number"/></label>
            <label className="form-field"><span>Other Reference</span><input value={feeForm.reference} onChange={e=>setFeeForm(f=>({...f,reference:e.target.value}))}/></label>
            <label className="form-field"><span>Payment Screenshot</span><input type="file" accept="image/*" disabled={proofUploading} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){setMessage("Payment screenshot must be smaller than 5 MB.");return;}setProofUploading(true);try{const fd=new FormData();fd.append("file",file);fd.append("purpose","payment-proof");const up=await fetch("/api/uploads/student-photo",{method:"POST",body:fd});const ud=await up.json();if(!up.ok)throw new Error(ud.error||"Unable to upload screenshot.");setFeeForm(f=>({...f,screenshotUrl:ud.url}));setMessage("Payment screenshot uploaded.");}catch(err){setMessage(err.message);}finally{setProofUploading(false);}}}/>{feeForm.screenshotUrl&&<a href={feeForm.screenshotUrl} target="_blank" rel="noreferrer">View uploaded screenshot</a>}</label>
            <button className="primary-btn operation-btn" disabled={proofUploading}><Save size={16}/>{proofUploading?"Uploading…":"Save Fee & Payment"}</button>
          </div></form>
        </details>
        {(fee?.payments||[]).length>0&&<div className="fee-payment-history"><h4>Payment History</h4>{fee.payments.slice().reverse().map(p=><details className="fee-payment-item" key={p._id}><summary><span><b>{p.receiptNo||"Receipt pending"}</b><small>{p.date} · {p.method}</small></span><strong>₹{Number(p.amount||0).toLocaleString("en-IN")}</strong><span className="fee-expand-label">View details</span></summary><div className="fee-payment-detail-grid"><div><small>Payment Type</small><b>{p.paymentType||"General"}</b></div><div><small>Installment Month</small><b>{p.installmentMonth||"—"}</b></div><div><small>UTR Number</small><b>{p.utrNumber||p.reference||"—"}</b></div><div><small>Other Reference</small><b>{p.reference||"—"}</b></div><div><small>Recorded By</small><b>{p.recordedBy||"—"}</b></div><div><small>Receipt Number</small><b>{p.receiptNo||"—"}</b></div><div><small>AEC Authorisation</small><b>{p.authorisedBy||"Pending AEC representative authorisation"}</b></div>{p.screenshotUrl&&<div><small>Payment Screenshot</small><a href={p.screenshotUrl} target="_blank" rel="noreferrer">Open screenshot</a></div>}</div><button type="button" className="ghost-btn" onClick={printBill}>Print latest receipt</button></details>)}</div>}
      </section>

      <section className="detail-section"><div className="detail-section-title"><ClipboardCheck size={17}/><h3>Attendance</h3></div>
        <div className="student-summary-grid compact"><div className="summary-card"><span>Present</span><strong>{attendance.summary?.present||0}</strong></div><div className="summary-card"><span>Absent</span><strong>{attendance.summary?.absent||0}</strong></div><div className="summary-card"><span>Leave</span><strong>{attendance.summary?.leave||0}</strong></div><div className="summary-card"><span>Percentage</span><strong>{attendance.summary?.percentage||0}%</strong></div></div>
        <form className="inline-operation-form" onSubmit={saveAttendance}><h4>Mark / Update Attendance</h4><div className="form-grid four"><label className="form-field"><span>Date</span><input type="date" value={attForm.date} onChange={e=>setAttForm(f=>({...f,date:e.target.value}))}/></label><label className="form-field"><span>Status</span><select value={attForm.status} onChange={e=>setAttForm(f=>({...f,status:e.target.value}))}><option>Present</option><option>Absent</option><option>Leave</option></select></label><label className="form-field"><span>Subject</span><input value={attForm.subject} onChange={e=>setAttForm(f=>({...f,subject:e.target.value}))} placeholder="Subject"/></label><label className="form-field"><span>Batch</span><input value={attForm.batch} onChange={e=>setAttForm(f=>({...f,batch:e.target.value}))} placeholder="Batch / Series"/></label><button className="primary-btn operation-btn"><Save size={16}/> Save Attendance</button></div></form>
        {(attendance.records||[]).length>0&&<div className="table-wrap"><table><thead><tr><th>Date</th><th>Subject</th><th>Batch</th><th>Status</th></tr></thead><tbody>{attendance.records.map(r=><tr key={r._id}><td>{r.date}</td><td>{r.subject||"—"}</td><td>{r.batch||"—"}</td><td><span className="badge">{r.status}</span></td></tr>)}</tbody></table></div>}
      </section>

      <section className="detail-section"><div className="detail-section-title"><FileText size={17}/><h3>Qualification, Documents & Declaration</h3></div>
        {(student.qualifications||[]).length?<div className="table-wrap"><table><thead><tr><th>Exam / Course</th><th>Board / University</th><th>College / Institute</th><th>Year</th><th>Percentage</th></tr></thead><tbody>{student.qualifications.map((q,i)=><tr key={i}><td>{value(q.examCourse)}</td><td>{value(q.boardUniversity)}</td><td>{value(q.collegeInstitute)}</td><td>{value(q.year)}</td><td>{value(q.percentage)}</td></tr>)}</tbody></table></div>:<div className="empty">No qualification information available.</div>}
        <div className="student-detail-grid"><Detail label="Declaration Date">{student.declarationDate}</Detail><Detail label="Declaration Place">{student.declarationPlace}</Detail><Detail label="Applicant Signature">{student.signatureUrl?<img src={student.signatureUrl} alt="Student signature" style={{maxWidth:180,maxHeight:64,objectFit:"contain"}}/>:student.signatureApplicant}</Detail><Detail label="Photo">{student.enclosures?.stampPhoto?"Attached":"Not attached"}</Detail><Detail label="Certificates">{student.enclosures?.qualifyingCertificates?"Attached":"Not attached"}</Detail><Detail label="Matric Admit Card">{student.enclosures?.matricAdmitCard?"Attached":"Not attached"}</Detail></div>
      </section>
      {message&&<div className="success-msg">{message}</div>}
    </main>}
  </ERPLayout>
}
