import {NextResponse} from "next/server";
import mongoose from "mongoose";
import {connectMongoDB} from "@/lib/mongodb";
import {getSession} from "@/lib/auth";
import StudentContactLog from "@/models/StudentContactLog";

export async function GET(req,{params}){
  try{
    const session=await getSession();if(!session?.employeeId)return NextResponse.json({error:"Unauthorized"},{status:401});
    await connectMongoDB();const {id}=await params;
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const logs=await StudentContactLog.find({studentId:id}).sort({createdAt:-1}).limit(30).lean();
    return NextResponse.json({logs});
  }catch(e){return NextResponse.json({error:"Unable to load student contact history.",detail:e.message},{status:500});}
}

export async function POST(req,{params}){
  try{
    const session=await getSession();if(!session?.employeeId)return NextResponse.json({error:"Unauthorized"},{status:401});
    await connectMongoDB();const {id}=await params;
    if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});
    const b=await req.json();
    const log=await StudentContactLog.create({
      studentId:id,type:"CALL",phoneNumber:String(b.phoneNumber||"").trim(),
      callingRemark:String(b.callingRemark||"").trim(),remarks:String(b.remarks||"").trim(),
      actorId:session.employeeId,actorName:session.name||"",actorRole:session.role||""
    });
    return NextResponse.json({log},{status:201});
  }catch(e){return NextResponse.json({error:"Unable to save calling remarks.",detail:e.message},{status:400});}
}
