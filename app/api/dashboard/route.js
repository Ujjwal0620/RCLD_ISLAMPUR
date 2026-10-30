import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";

const StudentSchema=new mongoose.Schema({}, {strict:false,timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const BatchSchema=new mongoose.Schema({}, {strict:false});
const Batch=mongoose.models.Batch||mongoose.model("Batch",BatchSchema);
const EmployeeSchema=new mongoose.Schema({}, {strict:false});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);
const FeeSchema=new mongoose.Schema({studentId:mongoose.Schema.Types.ObjectId,totalFee:Number,admissionFee:Number,discount:Number,payments:Array},{strict:false});
const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);

export async function GET(){
 try{
  await connectMongoDB();
  const [students,batches,employees,fees,recent]=await Promise.all([
    Student.find({}).lean(),
    Batch.find({}).lean(),
    Employee.find({}).lean(),
    StudentFee.find({}).lean(),
    Student.find({}).sort({createdAt:-1}).limit(8).select("formNo applicantName courseName courseCode mobileNumber status batchCode createdAt").lean()
  ]);

  const feeMap=new Map(fees.map(f=>[String(f.studentId),f]));
  const statusMap={},courseMap={},batchMap={};
  for(const s of students){
    const status=s.status||"Unknown"; statusMap[status]=(statusMap[status]||0)+1;
    const course=s.courseCode||s.courseName||"Unknown"; courseMap[course]=(courseMap[course]||0)+1;
    if(s.batchCode) batchMap[s.batchCode]=(batchMap[s.batchCode]||0)+1;
  }

  const monthlyMap={};
  for(const f of fees) for(const p of (f.payments||[])){
    const date=p.date?new Date(p.date):null;
    const key=date&&!Number.isNaN(date.getTime())?date.toLocaleString("en-IN",{month:"short",year:"numeric"}):"Unknown";
    monthlyMap[key]=(monthlyMap[key]||0)+Number(p.amount||0);
  }

  let payable=0,collected=0,due=0;
  for(const s of students){
    const f=feeMap.get(String(s._id))||{};
    const p=Math.max(0,Number(f.totalFee||0)+Number(f.admissionFee||0)-Number(f.discount||0));
    const paid=(f.payments||[]).reduce((n,x)=>n+Number(x.amount||0),0);
    payable+=p;collected+=paid;due+=Math.max(0,p-paid);
  }

  const activeStatuses=["Registered","Admission Pending","Active"];
  const activeStudents=students.filter(s=>activeStatuses.includes(s.status)).length;
  const assigned=students.filter(s=>s.batchId||s.batchCode).length;
  const dropout=students.filter(s=>s.status==="Dropped Out").length;
  const batchCapacity=batches.reduce((n,b)=>n+Number(b.capacity||0),0);
  const batchUtilization=batchCapacity?Math.round(assigned/batchCapacity*100):0;

  const batchPerformance=batches.map(b=>({
    label:b.batchCode||b.name||"Batch",
    students:students.filter(s=>String(s.batchId)===String(b._id)||(!s.batchId&&s.batchCode===b.batchCode)).length,
    capacity:Number(b.capacity||0)
  })).sort((a,b)=>b.students-a.students).slice(0,8);

  return NextResponse.json({
    students:students.length,registered:students.filter(s=>s.status==="Registered").length,recent,
    employees:employees.filter(e=>e.status!=="Inactive").length,batches:batches.length,
    activeStudents,assigned,unassigned:students.length-assigned,dropout,
    finance:{payable, collected, due, collectionPercentage:payable?Math.round(collected/payable*100):0},
    studentStatus:Object.entries(statusMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),
    courses:Object.entries(courseMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),
    monthlyCollections:Object.entries(monthlyMap).filter(([k])=>k!=="Unknown").map(([month,value])=>({month,value})).slice(-8),
    batchPerformance,
    batchUtilization,
    today:new Date().toISOString()
  });
 }catch(error){
  return NextResponse.json({error:"Dashboard data unavailable.",detail:error.message},{status:500});
 }
}
