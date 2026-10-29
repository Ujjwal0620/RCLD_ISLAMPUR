import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";

const StudentSchema=new mongoose.Schema({},{strict:false});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);

export async function POST(req){
  try{
    await connectMongoDB();
    const body=await req.json();
    const ids=Array.isArray(body.ids)?[...new Set(body.ids.map(String))]:[];
    if(!ids.length)return NextResponse.json({error:"Select at least one student."},{status:400});
    if(ids.some(id=>!mongoose.Types.ObjectId.isValid(id)))return NextResponse.json({error:"One or more student IDs are invalid."},{status:400});
    const result=await Student.deleteMany({_id:{$in:ids}});
    return NextResponse.json({deleted:result.deletedCount,message:`${result.deletedCount} student(s) permanently deleted.`});
  }catch(error){return NextResponse.json({error:"Unable to delete selected students.",detail:error.message},{status:400});}
}