import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Subject from "@/models/Subject";
import Course from "@/models/Course";

async function idOf(params){return (await params)?.id}

export async function GET(_req,{params}){
  try{await connectMongoDB();const subject=await Subject.findById(await idOf(params)).lean();if(!subject)return NextResponse.json({error:"Subject not found."},{status:404});return NextResponse.json({subject});}
  catch(e){return NextResponse.json({error:"Unable to load subject.",detail:e.message},{status:400});}
}

export async function PATCH(req,{params}){
  try{
    await connectMongoDB();const id=await idOf(params);const b=await req.json();const subject=await Subject.findById(id);
    if(!subject)return NextResponse.json({error:"Subject not found."},{status:404});
    if(b.courseId!==undefined){
      const course=await Course.findById(b.courseId).lean();
      if(!course)return NextResponse.json({error:"Course not found."},{status:400});
      subject.courseId=course._id;subject.courseCode=course.code;subject.courseName=course.name;
    }
    for(const k of ["code","name","active"]){if(b[k]!==undefined)subject[k]=k==="code"?String(b[k]).trim().toUpperCase():b[k];}
    if(b.requiredSkills!==undefined)subject.requiredSkills=Array.isArray(b.requiredSkills)?b.requiredSkills:[];
    if(b.chapters!==undefined)subject.chapters=Array.isArray(b.chapters)?b.chapters.filter(x=>String(x?.name||"").trim()).map((x,i)=>({name:String(x.name).trim(),description:x.description||"",order:Number(x.order)||i+1})):[]; 
    await subject.save();return NextResponse.json({subject,message:"Subject updated."});
  }catch(e){return NextResponse.json({error:e?.code===11000?"A subject with this code already exists for the selected course.":"Unable to update subject.",detail:e.message},{status:e?.code===11000?409:400});}
}

export async function DELETE(_req,{params}){
  try{await connectMongoDB();const subject=await Subject.findByIdAndUpdate(await idOf(params),{active:false},{new:true}).lean();if(!subject)return NextResponse.json({error:"Subject not found."},{status:404});return NextResponse.json({subject,message:"Subject archived."});}
  catch(e){return NextResponse.json({error:"Unable to archive subject.",detail:e.message},{status:400});}
}