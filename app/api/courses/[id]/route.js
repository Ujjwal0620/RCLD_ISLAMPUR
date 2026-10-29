import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Course from "@/models/Course";
import Batch from "@/models/Batch";

const StudentSchema = new mongoose.Schema({ courseCode:String, courseName:String }, { timestamps:true });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
const FeeSchema = new mongoose.Schema({
  studentId:{type:mongoose.Schema.Types.ObjectId,unique:true,index:true,ref:"Student"},
  totalFee:{type:Number,default:0}, discount:{type:Number,default:0}, admissionFee:{type:Number,default:0},
  payments:Array, updatedBy:String
},{timestamps:true});
const StudentFee = mongoose.models.StudentFee || mongoose.model("StudentFee", FeeSchema);

async function idOf(params){return (await params)?.id}

export async function GET(req,{params}){
  try{await connectMongoDB();const course=await Course.findById(await idOf(params)).lean();if(!course)return NextResponse.json({error:"Course not found."},{status:404});return NextResponse.json({course});}
  catch(e){return NextResponse.json({error:"Unable to load course.",detail:e.message},{status:400});}
}

export async function PATCH(req,{params}){
  try{
    await connectMongoDB();
    const id=await idOf(params),body=await req.json();
    const allowed=["code","name","category","durationMonths","classesPerWeek","fee","admissionFee","description","requiredSkills","active"];
    const update={};for(const k of allowed)if(body[k]!==undefined)update[k]=body[k];
    if(update.code)update.code=String(update.code).trim().toUpperCase();
    for(const k of ["durationMonths","classesPerWeek","fee","admissionFee"])if(update[k]!==undefined)update[k]=Number(update[k]);

    const before=await Course.findById(id).lean();
    if(!before)return NextResponse.json({error:"Course not found."},{status:404});
    const course=await Course.findByIdAndUpdate(id,update,{new:true,runValidators:true}).lean();

    // Course master fee changes are reflected in existing students while preserving
    // each student's discount and payment history.
    const changedFee=update.fee!==undefined || update.admissionFee!==undefined || update.code!==undefined || update.name!==undefined;
    let mappedStudents=0;
    if(changedFee){
      const studentFilter={$or:[
        {courseCode:String(before.code||"").toUpperCase()},
        {courseName:String(before.name||"").trim()},
        {courseCode:String(course.code||"").toUpperCase()},
        {courseName:String(course.name||"").trim()}
      ]};
      const students=await Student.find(studentFilter,{_id:1}).lean();
      for(const student of students){
        await StudentFee.findOneAndUpdate(
          {studentId:student._id},
          {$set:{totalFee:Number(course.fee||0),admissionFee:Number(course.admissionFee||0),updatedBy:"course-master-update"}},
          {upsert:true,new:true,setDefaultsOnInsert:true}
        );
      }
      mappedStudents=students.length;
    }
    return NextResponse.json({course,message:"Course updated and existing student fees synchronized.",mappedStudents});
  }catch(e){
    return NextResponse.json({error:e?.code===11000?"Course code already exists.":"Unable to update course.",detail:e.message},{status:e?.code===11000?409:400});
  }
}

export async function DELETE(req,{params}){
  try{
    await connectMongoDB();const id=await idOf(params);
    const activeBatches=await Batch.countDocuments({courseId:id,status:{$in:["Draft","Active"]}});
    if(activeBatches)return NextResponse.json({error:"Course cannot be deleted while active/draft batches depend on it.",activeBatches},{status:409});
    const course=await Course.findByIdAndUpdate(id,{active:false},{new:true}).lean();
    if(!course)return NextResponse.json({error:"Course not found."},{status:404});
    return NextResponse.json({course,message:"Course archived."});
  }catch(e){return NextResponse.json({error:"Unable to archive course.",detail:e.message},{status:400});}
}