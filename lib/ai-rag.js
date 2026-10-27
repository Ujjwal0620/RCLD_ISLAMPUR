import mongoose from "mongoose";
import AIKnowledge from "@/models/AIKnowledge";
import { RCLD_AI_CONTEXT } from "@/data/aiContext";

const SEED_KNOWLEDGE = [
  { key:"project-core", title:"RCLD ERP Core Context", category:"project", priority:100, keywords:["rcld","erp","project","workflow","system"], content:RCLD_AI_CONTEXT },
  { key:"student-lifecycle", title:"Student Lifecycle", category:"students", priority:90, keywords:["student","admission","registration","enrollment","fees","attendance","exam","result","certificate"], content:"RCLD student lifecycle: Registration/Admission -> Course Selection -> Enrollment -> Batch Selection -> Fees/Installments -> Attendance -> Exams -> Results -> Certificate. Only the RCLD registration form is used. Student operational statuses include Registered, Admission Pending, Active, Course Completed, Dropped Out, Cancelled, Suspended, and Alumni." },
  { key:"batch-rules", title:"Batch and Schedule Rules", category:"batches", priority:95, keywords:["batch","series","schedule","timetable","faculty","a1","b1","t1","t2","lab"], content:"Academic operations use Course -> Batch -> Batch Series -> Schedule. Students belong to the main Batch, not separately to series. A-series belongs only to T1 and L1/L2. B-series belongs only to T2 and L3/L4. Faculty must match required skills and must not have timetable conflicts. One selected series represents one weekly class day." },
  { key:"employee-rules", title:"Employee and Faculty Rules", category:"employees", priority:80, keywords:["employee","faculty","skill","attendance","leave","task","performance"], content:"Employees have skills, designation, department, employment status, salary/banking details, leave balances and operational records. Faculty eligibility is skill-based. Employee operations include attendance, office in/out, breaks, official/personal out-time, tasks and performance." },
  { key:"erp-boundary", title:"ERP Scope Boundary", category:"project", priority:100, keywords:["lms","scope","erp","portal"], content:"RCLD is an ERP, not an LMS. Do not introduce lesson players, online learning paths, LMS content management or learning-progress tracking. Student-facing features are operational ERP features such as profile, admission, enrollment, fees, attendance, exams/results, certificate status, notices and documents." }
];

export async function ensureAIKnowledge() {
  for (const item of SEED_KNOWLEDGE) await AIKnowledge.updateOne({ key:item.key }, { $set:item }, { upsert:true });
}

function tokens(text) {
  return [...new Set(String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [])].filter((word) => word.length > 2).slice(0,30);
}

function scoreDocument(doc, words) {
  const haystack = [doc.title, doc.category, ...(doc.keywords || []), doc.content].join(" ").toLowerCase();
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0) + Number(doc.priority || 0) / 1000;
}

async function liveERPContext(query) {
  const words = tokens(query);
  const context = [];
  const Student = mongoose.models.Student;
  const Employee = mongoose.models.Employee;
  const Course = mongoose.models.Course;
  const Batch = mongoose.models.Batch;

  const counts = await Promise.all([
    Student ? Student.countDocuments({}) : 0,
    Employee ? Employee.countDocuments({}) : 0,
    Course ? Course.countDocuments({active:true}) : 0,
    Batch ? Batch.countDocuments({status:{$ne:"Cancelled"}}) : 0
  ]);
  context.push("LIVE ERP SUMMARY: students=" + counts[0] + ", employees=" + counts[1] + ", active courses=" + counts[2] + ", non-cancelled batches=" + counts[3] + ".");

  const escaped = words.slice(0,8).map((word) => word.replace(/[.*+?^$()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return context;
  const rx = new RegExp(escaped.join("|"), "i");

  if (Student) {
    const rows = await Student.find({$or:[{applicantName:rx},{formNo:rx},{regnNo:rx},{courseName:rx}]}).select("formNo regnNo applicantName courseName courseCode status").limit(8).lean();
    if (rows.length) context.push("MATCHING STUDENTS:\n" + rows.map((x)=>JSON.stringify(x)).join("\n"));
  }
  if (Employee) {
    const rows = await Employee.find({$or:[{name:rx},{employeeId:rx},{designation:rx},{department:rx},{skills:rx}]}).select("employeeId name designation department skills status").limit(8).lean();
    if (rows.length) context.push("MATCHING EMPLOYEES:\n" + rows.map((x)=>JSON.stringify(x)).join("\n"));
  }
  if (Course) {
    const rows = await Course.find({active:true,$or:[{code:rx},{name:rx},{category:rx},{requiredSkills:rx}]}).select("code name category durationMonths classesPerWeek fee admissionFee requiredSkills").limit(10).lean();
    if (rows.length) context.push("MATCHING COURSES:\n" + rows.map((x)=>JSON.stringify(x)).join("\n"));
  }
  if (Batch) {
    const rows = await Batch.find({status:{$ne:"Cancelled"},$or:[{batchCode:rx},{name:rx},{courseCode:rx},{courseName:rx},{series:rx},{facultyName:rx}]}).select("batchCode name courseCode courseName series classFrequency facultyId facultyName status schedules").limit(8).lean();
    if (rows.length) context.push("MATCHING BATCHES:\n" + rows.map((x)=>JSON.stringify(x)).join("\n"));
  }
  return context;
}

export async function retrieveRAGContext(query) {
  await ensureAIKnowledge();
  const words = tokens(query);
  const docs = await AIKnowledge.find({active:true}).lean();
  const selected = docs.map((doc)=>({...doc,_score:scoreDocument(doc,words)})).filter((doc)=>doc._score>0).sort((a,b)=>b._score-a._score).slice(0,6);
  const live = await liveERPContext(query);
  return {
    sources:selected.map((doc)=>({key:doc.key,title:doc.title,category:doc.category})),
    context:[...selected.map((doc)=>"KNOWLEDGE: " + doc.title + "\n" + doc.content),...live].join("\n\n")
  };
}
