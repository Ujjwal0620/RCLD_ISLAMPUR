import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
const EmployeeSchema=new mongoose.Schema({employeeId:String,name:String,designation:String,department:String,skills:[String],status:String},{timestamps:true});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);
export async function GET(req){try{await connectMongoDB();const sp=new URL(req.url).searchParams;const courseId=sp.get("courseId");const course=courseId?await Course.findById(courseId).lean():null;const required=course?.requiredSkills||[];const employees=await Employee.find({status:"Active"}).lean();const batches=await Batch.find({status:{$in:["Draft","Active"]}}).lean();const options=employees.filter(e=>{if(required.length&&!required.some(skill=>(e.skills||[]).includes(skill)))return false;return true;}).map(e=>{const assigned=batches.filter(b=>b.facultyId===e.employeeId).length;return {...e,assignedBatches:assigned,skillMatch:required.filter(s=>(e.skills||[]).includes(s)).length};}).sort((a,b)=>b.skillMatch-a.skillMatch||a.assignedBatches-b.assignedBatches);return NextResponse.json({faculty:options,requiredSkills:required});}catch(e){return NextResponse.json({error:"Unable to load available faculty.",detail:e.message},{status:500});}}
