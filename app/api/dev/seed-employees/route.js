import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import { ALL_EMPLOYEE_SKILLS } from "@/lib/access-control";

const EmployeeSchema = new mongoose.Schema({
  employeeId:{type:String,required:true,unique:true,index:true},name:{type:String,required:true,trim:true},
  designation:String,department:String,employmentType:{type:String,default:"Full Time"},
  skills:{type:[String],default:[]},status:{type:String,default:"Active"},notes:String
},{timestamps:true});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);

const PROGRAMMING_SKILLS=["Blue Java","HTML","C Programming","JavaScript","Python","SQL","Visual Basic","VB .NET","Scratch","CSS","Android App Development"];
const without=(...excluded)=>ALL_EMPLOYEE_SKILLS.filter(skill=>!excluded.flat().includes(skill));

const DUMMY_EMPLOYEES=[
  {name:"SHUBHAM SHARMA",designation:"Faculty",department:"Academic",skills:ALL_EMPLOYEE_SKILLS},
  {name:"RAJEN TUDU",designation:"Faculty",department:"Academic",skills:without(PROGRAMMING_SKILLS)},
  {name:"UJJWAL KARMAKAR",designation:"Faculty & Developer",department:"Academic / Development",skills:without(["Tally ERP 9","Photoshop","CorelDRAW"])},
  {name:"TUSHAR CHAKRABARTY",designation:"Faculty & Accountant",department:"Academic / Accounts",skills:without(PROGRAMMING_SKILLS)},
  {name:"PRODIP DAS",designation:"Faculty",department:"Academic",skills:without(PROGRAMMING_SKILLS)},
  {name:"SUHANI AGARWAL",designation:"Lab Assistant",department:"Lab",skills:without(PROGRAMMING_SKILLS)},
  {name:"MRITYUNJAY BISWAS",designation:"Faculty",department:"Academic",skills:ALL_EMPLOYEE_SKILLS},
  {name:"DIPTISHREE",designation:"Office Admin",department:"Administration",skills:[]},
  {name:"SANJITA NANDI",designation:"Office Admin",department:"Administration",skills:[]},
];

async function lowestFreeIds(count){
  const rows=await Employee.find({employeeId:/^RCLD\/ISL\/\d+$/}).select("employeeId").lean();
  const used=new Set(rows.map(r=>Number(String(r.employeeId||"").split("/").pop())).filter(n=>Number.isInteger(n)&&n>0));
  const ids=[];
  for(let n=1;ids.length<count;n++)if(!used.has(n))ids.push(`RCLD/ISL/${String(n).padStart(3,"0")}`);
  return ids;
}

export async function POST(){
  try{
    await connectMongoDB();
    const existing=await Employee.find({name:{$in:DUMMY_EMPLOYEES.map(x=>x.name)}}).select("name employeeId").lean();
    const existingNames=new Set(existing.map(x=>x.name));
    const pending=DUMMY_EMPLOYEES.filter(x=>!existingNames.has(x.name));
    const ids=await lowestFreeIds(pending.length);
    const created=pending.length?await Employee.insertMany(pending.map((item,index)=>({
      ...item,employeeId:ids[index],employmentType:"Full Time",status:"Active",
      notes:"RCLD requested dummy employee for local ERP testing."
    }))):[];
    return NextResponse.json({created,existing,message:`${created.length} dummy employees created; ${existing.length} already existed.`},{status:created.length?201:200});
  }catch(error){
    return NextResponse.json({error:"Unable to seed dummy employees.",detail:error.message},{status:500});
  }
}
