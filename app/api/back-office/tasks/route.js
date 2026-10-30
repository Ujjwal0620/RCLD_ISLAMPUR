import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import BackOfficeTask from "@/models/BackOfficeTask";
import { getSession } from "@/lib/auth";

async function guard(){
  const session=await getSession();
  if(!session?.employeeId) return {error:NextResponse.json({error:"Unauthorized"},{status:401})};
  if(!["superadmin","office-admin"].includes(session.role)) return {error:NextResponse.json({error:"Back Office is restricted to Office Admin and Super Admin."},{status:403})};
  return {session};
}

export async function GET(){
  const g=await guard(); if(g.error)return g.error;
  try{await connectMongoDB();const tasks=await BackOfficeTask.find().sort({createdAt:-1}).lean();return NextResponse.json({tasks});}
  catch(e){return NextResponse.json({error:"Unable to load Back Office.",detail:e.message},{status:500});}
}

export async function POST(req){
  const g=await guard(); if(g.error)return g.error;
  try{
    await connectMongoDB(); const b=await req.json();
    if(!String(b.title||"").trim()) return NextResponse.json({error:"Task title is required."},{status:400});
    const task=await BackOfficeTask.create({
      title:String(b.title).trim(),description:b.description||"",assignedTo:b.assignedTo||"",
      assignedToName:b.assignedToName||"",status:b.status||"Open",priority:b.priority||"Medium",
      dueDate:b.dueDate||undefined,remark:b.remark||"",createdBy:g.session.employeeId,createdByName:g.session.name||""
    });
    return NextResponse.json({task},{status:201});
  }catch(e){return NextResponse.json({error:"Unable to create task.",detail:e.message},{status:400});}
}

export async function PATCH(req){
  const g=await guard(); if(g.error)return g.error;
  try{
    await connectMongoDB(); const b=await req.json(); const id=String(b.id||"");
    if(!id)return NextResponse.json({error:"Task id is required."},{status:400});
    const task=await BackOfficeTask.findByIdAndUpdate(id,{$set:{
      title:String(b.title||"").trim(),description:b.description||"",assignedTo:b.assignedTo||"",
      assignedToName:b.assignedToName||"",status:b.status||"Open",priority:b.priority||"Medium",
      dueDate:b.dueDate||undefined,remark:b.remark||""
    }},{new:true});
    if(!task)return NextResponse.json({error:"Task not found."},{status:404});
    return NextResponse.json({task});
  }catch(e){return NextResponse.json({error:"Unable to update task.",detail:e.message},{status:400});}
}

export async function DELETE(req){
  const g=await guard(); if(g.error)return g.error;
  try{await connectMongoDB();const id=new URL(req.url).searchParams.get("id");if(!id)return NextResponse.json({error:"Task id is required."},{status:400});await BackOfficeTask.findByIdAndDelete(id);return NextResponse.json({ok:true});}
  catch(e){return NextResponse.json({error:"Unable to delete task.",detail:e.message},{status:400});}
}
