import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";

const StudentSchema = new mongoose.Schema({
  formNo:String, enrollmentNo:String, applicantName:String, mobileNumber:String,
  whatsappNumber:String, guardianContactNumber:String, courseCode:String, courseName:String,
  batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch"}, batchCode:String,
  status:String, admissionDate:String, dueAmount:Number, paymentStatus:String,
  sourceCourseLabel:String
},{timestamps:true});
const Student = mongoose.models.Student || mongoose.model("Student",StudentSchema);

const FeeSchema = new mongoose.Schema({
  studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student"},
  totalFee:Number, discount:Number, admissionFee:Number, payments:Array
},{timestamps:true});
const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee",FeeSchema);

function money(value){ return Math.round(Number(value||0)*100)/100; }

export async function GET(req){
  try{
    await connectMongoDB();
    const selectedBatchId = new URL(req.url).searchParams.get("batchId") || "";

    const batches = await Batch.find().sort({createdAt:-1}).lean();
    const students = await Student.find({batchId:{$ne:null}}).lean();
    const ids = students.map(s=>s._id);
    const fees = ids.length ? await StudentFee.find({studentId:{$in:ids}}).lean() : [];
    const feeMap = new Map(fees.map(f=>[String(f.studentId),f]));

    const byBatch = new Map();
    for(const student of students){
      const key = String(student.batchId);
      if(!byBatch.has(key)) byBatch.set(key,[]);
      byBatch.get(key).push(student);
    }

    const summaries = batches.map(batch=>{
      const list = byBatch.get(String(batch._id)) || [];
      let payable=0, collected=0, due=0;
      for(const s of list){
        const f = feeMap.get(String(s._id)) || {};
        const p = Math.max(0, money(f.totalFee)+money(f.admissionFee)-money(f.discount));
        const paid = money((f.payments||[]).reduce((sum,x)=>sum+Number(x.amount||0),0));
        payable += p; collected += paid; due += Math.max(0,p-paid);
      }
      const completed = list.filter(s=>String(s.status||"").toLowerCase()==="course completed").length;
      return {
        ...batch,
        studentCount:list.length,
        completedCount:completed,
        completionPercentage:list.length ? money(completed/list.length*100) : 0,
        payable:money(payable),
        collected:money(collected),
        due:money(due),
        collectionPercentage:payable ? money(Math.min(100,collected/payable*100)) : 0
      };
    });

    if(!selectedBatchId){
      return NextResponse.json({batches:summaries});
    }

    if(!mongoose.Types.ObjectId.isValid(selectedBatchId)){
      return NextResponse.json({error:"Invalid batch ID."},{status:400});
    }

    const batch = batches.find(b=>String(b._id)===selectedBatchId);
    if(!batch) return NextResponse.json({error:"Batch not found."},{status:404});

    const list = byBatch.get(selectedBatchId) || [];
    const roster = list
      .map(s=>{
        const f=feeMap.get(String(s._id))||{};
        const payable=Math.max(0,money(f.totalFee)+money(f.admissionFee)-money(f.discount));
        const paid=money((f.payments||[]).reduce((sum,x)=>sum+Number(x.amount||0),0));
        return {
          _id:s._id, formNo:s.formNo||"", enrollmentNo:s.enrollmentNo||"",
          applicantName:s.applicantName||"", mobileNumber:s.mobileNumber||"",
          whatsappNumber:s.whatsappNumber||"", guardianContactNumber:s.guardianContactNumber||"",
          courseCode:s.courseCode||batch.courseCode||"", courseName:s.courseName||batch.courseName||"",
          sourceCourseLabel:s.sourceCourseLabel||"", admissionDate:s.admissionDate||"",
          status:s.status||"", paymentStatus:s.paymentStatus||"",
          totalFee:money(f.totalFee), admissionFee:money(f.admissionFee),
          discount:money(f.discount), payable:money(payable), paid:money(paid),
          due:money(Math.max(0,payable-paid))
        };
      })
      .sort((a,b)=>String(a.applicantName).localeCompare(String(b.applicantName)));

    const summary = summaries.find(x=>String(x._id)===selectedBatchId);
    return NextResponse.json({
      batch,
      summary,
      faculty:{
        employeeId:batch.facultyId||"",
        name:batch.facultyName||"",
        assigned:!!batch.facultyId
      },
      students:roster
    });
  }catch(error){
    return NextResponse.json({error:"Unable to generate batch report.",detail:error.message},{status:500});
  }
}
