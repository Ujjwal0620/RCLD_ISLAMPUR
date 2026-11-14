import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";
import Course from "@/models/Course";
import { COURSE_CATALOG, suggestedClassesPerWeek } from "@/data/courseCatalog";
async function ensureCatalog(){
  for(const item of COURSE_CATALOG){
    await Course.updateOne({code:item.code},{$setOnInsert:{...item,classesPerWeek:suggestedClassesPerWeek(item.durationMonths),source:"RCLD Islampur website/catalog"}},{upsert:true});
  }
  const db = mongoose.connection.db;
  const migrations = db.collection("rcld_data_migrations");
  const marker = "official-course-fees-and-cfk-semesters-v1";
  if (!(await migrations.findOne({_id:marker}))) {
    const official = {CCA:2500,DCA:4500,ADCA:6000,CCC:5000,CAO:5500,DWPD:12000,DOM:9000,DCST:14000,DCAP:16500,DHNT:20900};
    for (const [code,fee] of Object.entries(official)) await Course.updateOne({code},{$set:{fee,admissionFee:0}});
    const kids = COURSE_CATALOG.find(x=>x.code==="KIDS");
    await Course.updateOne({code:"KIDS"},{$set:{name:kids.name,durationMonths:36,fee:24600,admissionFee:0,semesterPlans:kids.semesterPlans,description:kids.description}});
    await migrations.insertOne({_id:marker,appliedAt:new Date()});
  }
}
export async function GET(){try{await connectMongoDB();await ensureCatalog();const courses=await Course.find({active:true}).sort({code:1}).lean();return NextResponse.json({courses});}catch(e){return NextResponse.json({error:"Unable to load courses.",detail:e.message},{status:500});}}
export async function POST(req){try{await connectMongoDB();const b=await req.json();const duration=Number(b.durationMonths);const course=await Course.create({code:String(b.code||"").trim().toUpperCase(),name:String(b.name||"").trim(),category:b.category||"Diploma",durationMonths:duration,classesPerWeek:Number(b.classesPerWeek)||suggestedClassesPerWeek(duration),fee:Number(b.fee)||0,admissionFee:Number(b.admissionFee)||0,description:b.description||"",requiredSkills:Array.isArray(b.requiredSkills)?b.requiredSkills:[],active:b.active!==false});return NextResponse.json({course},{status:201});}catch(e){return NextResponse.json({error:"Unable to create course.",detail:e.message},{status:400});}}
