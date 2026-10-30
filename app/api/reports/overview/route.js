import {NextResponse} from "next/server";
import mongoose from "mongoose";
import {connectMongoDB} from "@/lib/mongodb";
import Batch from "@/models/Batch";
const StudentSchema=new mongoose.Schema({applicantName:String,formNo:String,enrollmentNo:String,courseCode:String,courseName:String,batchId:mongoose.Schema.Types.ObjectId,batchCode:String,status:String,admissionDate:String,mobileNumber:String},{strict:false,timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const FeeSchema=new mongoose.Schema({studentId:mongoose.Schema.Types.ObjectId,totalFee:Number,admissionFee:Number,discount:Number,payments:Array},{strict:false,timestamps:true});
const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
const EmployeeSchema=new mongoose.Schema({employeeId:String,name:String,designation:String,status:String,offDays:[String]},{strict:false,timestamps:true});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);
const money=n=>Math.round(Number(n||0)*100)/100;
export async function GET(){
 try{await connectMongoDB();const [students,batches,employees,fees]=await Promise.all([Student.find({status:{$ne:"Cancelled"}}).lean(),Batch.find().lean(),Employee.find({status:{$ne:"Inactive"}}).lean(),StudentFee.find().lean()]);const feeMap=new Map(fees.map(f=>[String(f.studentId),f]));let payable=0,paid=0,due=0;const dueStudents=[];const courseMap={};const statusMap={};
 for(const s of students){const f=feeMap.get(String(s._id))||{};const p=Math.max(0,money(f.totalFee)+money(f.admissionFee)-money(f.discount));const pd=money((f.payments||[]).reduce((n,x)=>n+Number(x.amount||0),0));const d=Math.max(0,p-pd);payable+=p;paid+=pd;due+=d;if(d>0)dueStudents.push({_id:s._id,name:s.applicantName,formNo:s.formNo,course:s.courseCode||s.courseName,batch:s.batchCode||"Unassigned",mobile:s.mobileNumber,due:money(d),paid:pd,payable:p});const ck=s.courseCode||s.courseName||"Unknown";courseMap[ck]=(courseMap[ck]||0)+1;statusMap[s.status||"Unknown"]=(statusMap[s.status||"Unknown"]||0)+1;}
 const batchRows=batches.map(b=>{const list=students.filter(s=>String(s.batchId)===String(b._id)||(!s.batchId&&s.batchCode===b.batchCode));return {batchCode:b.batchCode,name:b.name,course:b.courseCode,status:b.status,students:list.length,capacity:b.capacity||0,faculty:(b.facultyNames?.length?b.facultyNames:[b.facultyName].filter(Boolean)).join(", ")||"Unassigned"}});
 const monthly={};for(const f of fees)for(const p of f.payments||[]){const key=String(p.date||"").slice(0,7)||"Unknown";monthly[key]=(monthly[key]||0)+Number(p.amount||0);}
 return NextResponse.json({summary:{students:students.length,batches:batches.length,employees:employees.length,payable:money(payable),collected:money(paid),due:money(due),collectionPercentage:payable?money(paid/payable*100):0},studentStatus:Object.entries(statusMap).map(([status,count])=>({status,count})),courses:Object.entries(courseMap).map(([course,count])=>({course,count})).sort((a,b)=>b.count-a.count),batchRows,dueStudents:dueStudents.sort((a,b)=>b.due-a.due),monthlyCollections:Object.entries(monthly).sort().map(([month,amount])=>({month,amount:money(amount)})),faculty:employees.filter(e=>String(e.designation||"").toLowerCase().includes("faculty")).map(e=>({employeeId:e.employeeId,name:e.name,designation:e.designation,offDays:e.offDays||[],assignedBatches:batches.filter(b=>(b.facultyIds||[b.facultyId]).includes(e.employeeId)).length}))});
 }catch(e){return NextResponse.json({error:"Unable to generate reports.",detail:e.message},{status:500})}
}