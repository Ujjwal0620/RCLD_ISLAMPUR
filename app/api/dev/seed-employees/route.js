import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import { ALL_EMPLOYEE_SKILLS } from "@/lib/access-control";

const EmployeeSchema = new mongoose.Schema({
  employeeId:{type:String,required:true,unique:true,index:true},name:{type:String,required:true,trim:true},
  age:Number,dateOfBirth:String,gender:String,mobile:String,email:String,address:String,joiningDate:String,
  designation:String,department:String,employmentType:{type:String,default:"Full Time"},salary:{type:Number,default:0},
  salaryFrequency:{type:String,default:"Monthly"},bankName:String,accountNumber:String,ifsc:String,
  emergencyContactName:String,emergencyContactNumber:String,
  leaveBalance:{casual:{type:Number,default:0},sick:{type:Number,default:0},earned:{type:Number,default:0},other:{type:Number,default:0}},
  skills:{type:[String],default:[]},status:{type:String,default:"Active"},notes:String
},{timestamps:true});
const Employee=mongoose.models.Employee||mongoose.model("Employee",EmployeeSchema);

const PROGRAMMING_SKILLS=["Blue Java","HTML","C Programming","JavaScript","Python","SQL","Visual Basic","VB .NET","Scratch","CSS","Android App Development"];
const without=(...excluded)=>ALL_EMPLOYEE_SKILLS.filter(skill=>!excluded.flat().includes(skill));
const base=(n)=>({
  age:24+n,dateOfBirth:`200${n%4}-0${(n%8)+1}-1${n%9}`,gender:n===6||n===8||n===9?"Female":"Male",
  mobile:`90000000${String(n).padStart(2,"0")}`,email:`employee${n}@rcld.in`,
  address:"Islampur, Uttar Dinajpur, West Bengal",joiningDate:`2026-0${(n%8)+1}-01`,
  employmentType:"Full Time",salary:15000+(n*1000),salaryFrequency:"Monthly",
  bankName:"State Bank of India",accountNumber:`10000000000${n}`,ifsc:"SBIN0000001",
  emergencyContactName:`Emergency Contact ${n}`,emergencyContactNumber:`91000000${String(n).padStart(2,"0")}`,
  leaveBalance:{casual:12,sick:10,earned:15,other:3},status:"Active"
});
const DUMMY_EMPLOYEES=[
  {...base(1),name:"SHUBHAM SHARMA",email:"shubham.sharma@rcld.in",designation:"Faculty",department:"Academic",skills:ALL_EMPLOYEE_SKILLS},
  {...base(2),name:"RAJEN TUDU",email:"rajen.tudu@rcld.in",designation:"Faculty",department:"Academic",skills:without(PROGRAMMING_SKILLS)},
  {...base(3),name:"UJJWAL KARMAKAR",email:"ujjwal.karmakar@rcld.in",designation:"Faculty & Developer",department:"Academic / Development",skills:without(["Tally ERP 9","Photoshop","CorelDRAW"])},
  {...base(4),name:"TUSHAR CHAKRABARTY",email:"tushar.chakrabarty@rcld.in",designation:"Faculty & Accountant",department:"Academic / Accounts",skills:without(PROGRAMMING_SKILLS)},
  {...base(5),name:"PRODIP DAS",email:"prodip.das@rcld.in",designation:"Faculty",department:"Academic",skills:without(PROGRAMMING_SKILLS)},
  {...base(6),name:"SUHANI AGARWAL",email:"suhani.agarwal@rcld.in",designation:"Lab Assistant",department:"Lab",skills:without(PROGRAMMING_SKILLS)},
  {...base(7),name:"MRITYUNJAY BISWAS",email:"mrityunjay.biswas@rcld.in",designation:"Faculty",department:"Academic",skills:ALL_EMPLOYEE_SKILLS},
  {...base(8),name:"DIPTISHREE",email:"diptishree@rcld.in",designation:"Office Admin",department:"Administration",skills:[]},
  {...base(9),name:"SANJITA NANDI",email:"sanjita.nandi@rcld.in",designation:"Office Admin",department:"Administration",skills:[]}
].map(x=>({...x,notes:"Dummy employee profile for RCLD ERP local testing. Replace placeholder personal, banking and emergency-contact data before production use."}));

async function lowestFreeIds(count){
  const rows=await Employee.find({employeeId:/^RCLD\/ISL\/\d+$/}).select("employeeId").lean();
  const used=new Set(rows.map(r=>Number(String(r.employeeId||"").split("/").pop())).filter(n=>Number.isInteger(n)&&n>0));
  const ids=[];for(let n=1;ids.length<count;n++)if(!used.has(n))ids.push(`RCLD/ISL/${String(n).padStart(3,"0")}`);return ids;
}

export async function POST(){
  try{
    await connectMongoDB();
    const names=DUMMY_EMPLOYEES.map(x=>x.name);
    const existing=await Employee.find({name:{$in:names}}).select("name employeeId").lean();
    const existingMap=new Map(existing.map(x=>[x.name,x]));
    const pending=DUMMY_EMPLOYEES.filter(x=>!existingMap.has(x.name));
    const ids=await lowestFreeIds(pending.length);
    const created=pending.length?await Employee.insertMany(pending.map((item,index)=>({...item,employeeId:ids[index]}))):[];
    const updated=[];
    for(const item of DUMMY_EMPLOYEES.filter(x=>existingMap.has(x.name))){
      const employee=await Employee.findByIdAndUpdate(existingMap.get(item.name)._id,{$set:item},{new:true,runValidators:true}).lean();
      updated.push(employee);
    }
    return NextResponse.json({created,updated,message:`${created.length} dummy employees created; ${updated.length} existing dummy employees updated with complete test profiles.`},{status:created.length?201:200});
  }catch(error){return NextResponse.json({error:"Unable to seed dummy employees.",detail:error.message},{status:500});}
}
