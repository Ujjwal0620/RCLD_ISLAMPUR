import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";

const StudentSchema=new mongoose.Schema({formNo:String,applicantName:String,mobileNumber:String,courseCode:String,courseName:String,admissionDate:Date,batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch"},batchCode:String,status:String},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const FeeSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},totalFee:Number,discount:Number,admissionFee:Number,payments:Array},{timestamps:true});
const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
const EmployeeSchema=new mongoose.Schema({employeeId:String,name:String,offDays:[String],status:String},{timestamps:true});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);
const AttendanceSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},date:String,status:String,subject:String,batch:String,markedBy:String},{timestamps:true});
const StudentAttendance=mongoose.models.StudentAttendance||mongoose.model("StudentAttendance",AttendanceSchema);

export async function GET(req,{params}){
  try{
    await connectMongoDB();
    const {id}=await params;
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid batch ID."},{status:400});
    const batch=await Batch.findById(id).lean();if(!batch)return NextResponse.json({error:"Batch not found."},{status:404});
    const date=new URL(req.url).searchParams.get("date")||new Date().toISOString().slice(0,10);
    const batchFilter={$or:[{batchId:id},{batchId:new mongoose.Types.ObjectId(id)},{batchCode:String(batch.batchCode||"")} ]};
    const students=await Student.find(batchFilter).sort({applicantName:1}).lean();
    const ids=students.map(s=>s._id);
    const facultyIds=(batch.facultyIds?.length?batch.facultyIds:[batch.facultyId]).filter(Boolean);
    const facultyRows=facultyIds.length?await Employee.find({employeeId:{$in:facultyIds}}).lean():[];
    const weekday=new Date(date+"T00:00:00").toLocaleDateString("en-US",{weekday:"long"});
    const primary=facultyRows.find(e=>e.employeeId===facultyIds[0]); const backup=facultyRows.find(e=>e.employeeId===facultyIds[1]);
    const primaryOff=!!primary?.offDays?.includes(weekday);
    const activeFaculty=primaryOff&&backup?backup:primary||backup||null;
    const [fees,attendance]=await Promise.all([
      ids.length?StudentFee.find({studentId:{$in:ids}}).lean():[],
      ids.length?StudentAttendance.find({studentId:{$in:ids},date}).lean():[]
    ]);
    const feeMap=new Map(fees.map(f=>[String(f.studentId),f]));
    const attMap=new Map();
    attendance.forEach(a=>attMap.set(String(a.studentId),a));
    const monthlyInstallment=600;
    const roster=students.map(s=>{
      const f=feeMap.get(String(s._id))||{totalFee:0,discount:0,admissionFee:0,payments:[]};
      const payable=Math.max(0,Number(f.totalFee||0)+Number(f.admissionFee||0)-Number(f.discount||0));
      const paid=(f.payments||[]).reduce((sum,p)=>sum+Number(p.amount||0),0);
      const a=attMap.get(String(s._id));
      const startRaw=s.admissionDate||batch.startDate||new Date(date);
      const start=new Date(startRaw), asOf=new Date(date+"T00:00:00");
      const monthKey=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
      const monthsElapsed=asOf>=new Date(start.getFullYear(),start.getMonth(),1)?((asOf.getFullYear()-start.getFullYear())*12+(asOf.getMonth()-start.getMonth())+1):0;
      const currentKey=monthKey(asOf);
      const monthlyPayments=(f.payments||[]).filter(p=>p.paymentType==="Monthly Installment"||String(p.note||"").includes("Monthly Installment"));
      const currentMonthPaid=monthlyPayments.filter(p=>(p.installmentMonth||String(p.date||"").slice(0,7))===currentKey).reduce((sum,p)=>sum+Number(p.amount||0),0);
      const totalMonthlyPaid=monthlyPayments.reduce((sum,p)=>sum+Number(p.amount||0),0);
      const expectedToDate=monthsElapsed*monthlyInstallment;
      const currentMonthlyDue=monthsElapsed?Math.max(0,monthlyInstallment-currentMonthPaid):0;
      const previousExpected=Math.max(0,expectedToDate-monthlyInstallment);
      const previousPaid=Math.max(0,totalMonthlyPaid-currentMonthPaid);
      const outstandingPreviousDue=Math.max(0,previousExpected-previousPaid);
      const totalPayableDueTillDate=outstandingPreviousDue+currentMonthlyDue;
      return {...s,monthlyFee:{installment:monthlyInstallment,currentMonth:currentKey,outstandingPreviousDue,currentMonthlyDue,totalPayableDueTillDate},fee:{totalFee:Number(f.totalFee||0),admissionFee:Number(f.admissionFee||0),discount:Number(f.discount||0),paid,due:Math.max(0,payable-paid)},attendance:a?{status:a.status,subject:a.subject||"",note:a.note||"",markedBy:a.markedBy||""}:null};
    });
    return NextResponse.json({batch:{...batch,facultyIds,facultyNames:facultyIds.map(fid=>facultyRows.find(e=>e.employeeId===fid)?.name||""),activeFaculty:activeFaculty?{employeeId:activeFaculty.employeeId,name:activeFaculty.name,reason:primaryOff?"Primary faculty off day":"Primary faculty"}:null,primaryFacultyOffDay:primaryOff},date,students:roster});
  }catch(error){return NextResponse.json({error:"Unable to load batch students.",detail:error.message},{status:500});}
}