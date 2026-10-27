import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  formNo: { type: String, required: true, unique: true, trim: true },
  kitIssueNo: String, aecCode: String, regnNo: String, courseName: String, courseCode: String,
  demandDraftNo: String, amount: String, demandDraftDate: String, bank: String,
  applicantName: { type: String, required: true, trim: true }, nationality: String, dateOfBirth: String, sex: String,
  fatherOrHusbandName: String, address: String, pin: String, stdCode: String, telephoneNumber: String,
  mobileNumber: { type: String, required: true, trim: true },
  qualifications: [{ examCourse: String, boardUniversity: String, collegeInstitute: String, year: String, percentage: String }],
  gdcaSem2: String, gdcaSem3: String,
  enclosures: { stampPhoto: Boolean, qualifyingCertificates: Boolean, demandDraft: Boolean },
  declarationDate: String, declarationPlace: String, signatureApplicant: String, photoUrl: String,
  status: { type: String, default: "Registered" }
}, { timestamps: true });
const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
async function idOf(params){return (await params)?.id}
export async function GET(request,{params}){try{await connectMongoDB();const id=await idOf(params);if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});const student=await Student.findById(id).lean();if(!student)return NextResponse.json({error:"Student not found."},{status:404});return NextResponse.json({student});}catch(error){return NextResponse.json({error:"Unable to load student.",detail:error.message},{status:500});}}
export async function PATCH(req,{params}){try{await connectMongoDB();const id=await idOf(params);if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});const body=await req.json();const allowed=["formNo","kitIssueNo","aecCode","regnNo","courseName","courseCode","applicantName","nationality","dateOfBirth","sex","fatherOrHusbandName","address","pin","stdCode","telephoneNumber","mobileNumber","gdcaSem2","gdcaSem3","declarationDate","declarationPlace","signatureApplicant","photoUrl","status"];const update={};for(const k of allowed)if(body[k]!==undefined)update[k]=body[k];if(!String(update.applicantName??"x").trim()||!String(update.mobileNumber??"x").trim())return NextResponse.json({error:"Applicant name and mobile are required."},{status:400});const student=await Student.findByIdAndUpdate(id,update,{new:true,runValidators:true}).lean();if(!student)return NextResponse.json({error:"Student not found."},{status:404});return NextResponse.json({student,message:"Student updated."});}catch(error){return NextResponse.json({error:error?.code===11000?"Form number already exists.":"Unable to update student.",detail:error.message},{status:error?.code===11000?409:400});}}
export async function DELETE(req,{params}){try{await connectMongoDB();const id=await idOf(params);if(!mongoose.Types.ObjectId.isValid(id))return NextResponse.json({error:"Invalid student ID."},{status:400});const student=await Student.findByIdAndUpdate(id,{status:"Cancelled"},{new:true}).lean();if(!student)return NextResponse.json({error:"Student not found."},{status:404});return NextResponse.json({student,message:"Student archived as Cancelled. Historical records were preserved."});}catch(error){return NextResponse.json({error:"Unable to archive student.",detail:error.message},{status:400});}}