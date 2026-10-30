import { NextResponse } from "next/server";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import Course from "@/models/Course";

const StudentSchema=new mongoose.Schema({formNo:{type:String,required:true,unique:true},enrollmentNo:String,applicantName:{type:String,required:true},courseCode:String,courseName:String,sourceCourseLabel:String,admissionDate:String,mobileNumber:{type:String,required:true},whatsappNumber:String,guardianContactNumber:String,dueAmount:mongoose.Schema.Types.Mixed,paymentStatus:mongoose.Schema.Types.Mixed,nationality:String,dateOfBirth:String,sex:String,fatherOrHusbandName:String,address:String,pin:String,aecCode:String,regnNo:String,qualifications:Array,enclosures:Object,declarationDate:String,declarationPlace:String,signatureApplicant:String,photoUrl:String,status:String,importSource:String,sourceRowNo:Number},{timestamps:true,strict:false});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const FeeSchema=new mongoose.Schema({studentId:{type:mongoose.Schema.Types.ObjectId,unique:true,index:true},totalFee:Number,discount:Number,admissionFee:Number,payments:Array,updatedBy:String},{timestamps:true});
const StudentFee=mongoose.models.StudentFee||mongoose.model("StudentFee",FeeSchema);
const courseNames={DOM:"Diploma in Office Management",DCST:"Diploma in Computer Software Technology",DCA:"Diploma in Computer Applications",SM:"Coding for Kids",KIDS:"Coding for Kids",CCA:"Certificate in Computer Applications",ADCA:"Advanced Diploma in Computer Applications",CCC:"Course on Computer Concepts",CAO:"Certificate in Advanced Office",DWPD:"Diploma in Web Page Designing",DCAP:"Diploma in Computer Applications & Programming",DHNT:"Diploma in Hardware & Networking Technology"};
function normalizeCourse(v){const raw=String(v||"").trim().toUpperCase();const p=raw.replace(/_/g,"-").split("-")[0];const code=p==="SM"?"KIDS":p;return {raw,code,name:courseNames[code]||raw};}
function phone(v){const x=String(v??"").replace(/\D/g,"");return x.slice(-10);}
function dateValue(v){if(!v)return "";if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);return d?String(d.y)+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0"):"";}const s=String(v).trim();const m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):s;}
function dummyPhone(i){return "9"+String(100000000+i).slice(-9);}
function rowValue(row,...names){for(const n of names){if(row[n]!==undefined&&row[n]!==null&&String(row[n]).trim()!=="")return row[n];}return "";}
export async function POST(req){
 try{
  await connectMongoDB();
  const form=await req.formData();const file=form.get("file");if(!file)return NextResponse.json({error:"Excel file is required."},{status:400});
  const wb=XLSX.read(Buffer.from(await file.arrayBuffer()),{type:"buffer",cellDates:true});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
  const courses=await Course.find().lean();const courseMap=new Map(courses.map(c=>[String(c.code).toUpperCase(),c]));
  let created=0,skipped=0;const errors=[];
  for(let i=0;i<rows.length;i++){const row=rows[i];const name=String(rowValue(row,"NAME OF STUDENT","Name","Student Name")).trim();if(!name){skipped++;continue;}
   try{const enrollment=String(rowValue(row,"Enrollment No.","Enrollment No","Enrollment")).trim();const cn=normalizeCourse(rowValue(row,"Course"));let mobile=phone(rowValue(row,"Contact No.\nStudent","Contact No. Student","Student Mobile","Mobile"));let guardian=phone(rowValue(row,"Contact No.\nGuardian","Contact No. Guardian","Guardian Mobile"));if(!mobile)mobile=guardian||dummyPhone(i+1);if(!guardian)guardian=mobile;
    const base=enrollment?enrollment+"-"+String(i+2).padStart(4,"0"):"IMP-"+String(Date.now()).slice(-6)+"-"+String(i+2).padStart(4,"0");
    if(await Student.exists({formNo:base})){skipped++;continue;}
    const admissionDate=dateValue(rowValue(row,"Admn. Date","Admission Date"));const paymentStatus=rowValue(row,"Payment \nStatus","Payment Status");const due=rowValue(row,"DUE AMOUNT","Due Amount");
    const student=await Student.create({formNo:base,enrollmentNo:enrollment,applicantName:name,courseCode:cn.code,courseName:cn.name,sourceCourseLabel:cn.raw,admissionDate,mobileNumber:mobile,whatsappNumber:mobile,guardianContactNumber:guardian,dueAmount:due===""?0:due,paymentStatus:paymentStatus||"PENDING",nationality:"Indian",dateOfBirth:"2005-01-01",sex:i%2?"F":"M",fatherOrHusbandName:"Demo Guardian",address:"Islampur, Uttar Dinajpur, West Bengal",pin:"733202",aecCode:"AEC-"+base,regnNo:"REG-"+base,qualifications:[{examCourse:"Secondary",boardUniversity:"Demo / To be updated",collegeInstitute:"Demo / To be updated",year:"2025",percentage:"0"}],enclosures:{stampPhoto:false,qualifyingCertificates:false,matricAdmitCard:false},declarationDate:admissionDate||new Date().toISOString().slice(0,10),declarationPlace:"Islampur",signatureApplicant:name,photoUrl:"DUMMY_PLACEHOLDER",status:String(paymentStatus).toUpperCase()==="CLEAR"?"Active":"Admission Pending",importSource:file.name||"Student Bulk Import",sourceRowNo:i+2});
    const course=courseMap.get(cn.code);if(course)await StudentFee.findOneAndUpdate({studentId:student._id},{$set:{totalFee:Number(course.fee||0),admissionFee:Number(course.admissionFee||0),discount:0,updatedBy:"bulk-import"}},{upsert:true,new:true});
    created++;
   }catch(e){errors.push({row:i+2,error:e.message});}
  }
  return NextResponse.json({message:created+" students imported successfully.",created,skipped,errors:errors.slice(0,50),totalRows:rows.length});
 }catch(e){return NextResponse.json({error:"Unable to import students.",detail:e.message},{status:500});}
}
