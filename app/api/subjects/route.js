import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Subject from "@/models/Subject";
import Course from "@/models/Course";

export async function GET(req){
  try{
    await connectMongoDB();
    const sp=new URL(req.url).searchParams;
    const courseId=sp.get("courseId")||"";
    const search=(sp.get("search")||"").trim();
    const filter={active:true};
    if(courseId)filter.courseId=courseId;
    if(search){const rx=new RegExp(search.replace(/[.*+?^{}()|[\]\\]/g,"\\$&"),"i");filter.$or=[{code:rx},{name:rx},{courseCode:rx},{courseName:rx}];}
    const subjects=await Subject.find(filter).sort({courseCode:1,code:1}).lean();
    return NextResponse.json({subjects});
  }catch(e){return NextResponse.json({error:"Unable to load subjects.",detail:e.message},{status:500});}
}

export async function POST(req){
  try{
    await connectMongoDB();
    const b=await req.json();
    const course=await Course.findById(b.courseId).lean();
    if(!course)return NextResponse.json({error:"Course not found."},{status:400});
    if(!String(b.code||"").trim()||!String(b.name||"").trim())return NextResponse.json({error:"Subject code and name are required."},{status:400});
    const chapters=Array.isArray(b.chapters)?b.chapters.filter(x=>String(x?.name||"").trim()).map((x,i)=>({name:String(x.name).trim(),description:x.description||"",order:Number(x.order)||i+1})):[];
    const subject=await Subject.create({code:String(b.code).trim().toUpperCase(),name:String(b.name).trim(),courseId:course._id,courseCode:course.code,courseName:course.name,requiredSkills:Array.isArray(b.requiredSkills)?b.requiredSkills:[],chapters,active:true});
    return NextResponse.json({subject},{status:201});
  }catch(e){return NextResponse.json({error:e?.code===11000?"A subject with this code already exists for the selected course.":"Unable to create subject.",detail:e.message},{status:e?.code===11000?409:400});}
}