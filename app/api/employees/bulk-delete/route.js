import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectMongoDB } from "@/lib/mongodb";

const EmployeeSchema=new mongoose.Schema({},{strict:false});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);

export async function POST(req){
  try{
    await connectMongoDB();
    const body=await req.json();
    const ids=Array.isArray(body.ids)?[...new Set(body.ids.map(String))]:[];
    if(!ids.length)return NextResponse.json({error:"Select at least one employee."},{status:400});
    if(ids.some(id=>!mongoose.Types.ObjectId.isValid(id)))return NextResponse.json({error:"One or more employee IDs are invalid."},{status:400});
    const result=await Employee.deleteMany({_id:{$in:ids}});
    return NextResponse.json({deleted:result.deletedCount,message:`${result.deletedCount} employee(s) permanently deleted.`});
  }catch(error){return NextResponse.json({error:"Unable to delete selected employees.",detail:error.message},{status:400});}
}