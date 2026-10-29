import mongoose from "mongoose";
import XLSX from "xlsx";
import fs from "node:fs";

const filePath=process.argv[2]||"Students Data.xlsx";
if(!fs.existsSync(filePath)){console.error("Excel file not found:",filePath);process.exit(1)}
if(!process.env.MONGODB_URI){console.error("MONGODB_URI is missing from .env");process.exit(1)}

const knownNames={
 CCA:"Certificate in Computer Application",DCA:"Diploma in Computer Application",ADCA:"Advanced Diploma in Computer Application",
 CCC:"Course on Computer Concepts",CAO:"Computer Accounting Operator",DWPD:"Diploma in Web Page Designing",
 DOM:"Diploma in Office Management",DCST:"Diploma in Computer Science & Technology",DCAP:"Diploma in Computer Accounts Professional",
 DHNT:"Diploma in Hardware Networking Technology",DCPP:"Diploma in Computer Programming Professional",KIDS:"Coding for Kids"
};
function courseOf(raw){
 const source=String(raw||"").trim().toUpperCase();
 if(source.startsWith("SM-"))return {courseCode:"KIDS",courseName:"Coding for Kids",sourceCourseLabel:source};
 let code=source;
 if(source.startsWith("DOM-"))code="DOM";
 else if(source.startsWith("DCST-"))code="DCST";
 else if(source.startsWith("DCS-"))code="DCS";
 else if(source.startsWith("SC-"))code="SC";
 else if(source.startsWith("DCA_")||source.startsWith("DCA-"))code="DCA";
 return {courseCode:code,courseName:knownNames[code]||code,sourceCourseLabel:source};
}
function phone(v){return String(v??"").replace(/[^0-9+]/g,"").trim()}
function isoDate(v){
 if(!v)return "";
 if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v.toISOString().slice(0,10);
 if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);if(d)return String(d.y).padStart(4,"0")+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0")}
 const d=new Date(v);return Number.isNaN(d.valueOf())?String(v):d.toISOString().slice(0,10);
}
await mongoose.connect(process.env.MONGODB_URI);
const StudentSchema=new mongoose.Schema({
 formNo:{type:String,required:true,unique:true,trim:true},enrollmentNo:String,admissionDate:String,guardianContactNumber:String,
 dueAmount:mongoose.Schema.Types.Mixed,paymentStatus:mongoose.Schema.Types.Mixed,sourceCourseLabel:String,importSource:String,
 aecCode:String,regnNo:String,courseName:String,courseCode:String,applicantName:{type:String,required:true,trim:true},
 nationality:String,dateOfBirth:String,sex:String,fatherOrHusbandName:String,address:String,pin:String,whatsappNumber:String,
 mobileNumber:{type:String,required:true,trim:true},qualifications:Array,enclosures:Object,declarationDate:String,declarationPlace:String,
 signatureApplicant:String,photoUrl:String,status:{type:String,default:"Registered"}
},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const workbook=XLSX.readFile(filePath,{cellDates:true});
const sheet=workbook.Sheets["Student_Data"]||workbook.Sheets[workbook.SheetNames[0]];
const rows=XLSX.utils.sheet_to_json(sheet,{defval:""});
const seen=new Map();let created=0,updated=0,skipped=0;
for(const row of rows){
 const enrollmentNo=String(row["Enrollment No."]||"").trim();
 const applicantName=String(row["NAME OF STUDENT"]||"").trim();
 const rawCourse=String(row["Course"]||"").trim();
 if(!applicantName||!rawCourse){skipped++;continue}
 const n=(seen.get(enrollmentNo)||0)+1;seen.set(enrollmentNo,n);
 const formNo=n===1?enrollmentNo:(enrollmentNo+"-"+n);
 const c=courseOf(rawCourse);
 const mobileNumber=phone(row["Contact No.\nStudent"]);
 const guardianContactNumber=phone(row["Contact No.\nGuardian"]);
 const payload={
  formNo,enrollmentNo,applicantName,...c,admissionDate:isoDate(row["Admn. Date"]),
  mobileNumber:mobileNumber||"N/A",whatsappNumber:mobileNumber,guardianContactNumber,
  dueAmount:row["DUE AMOUNT"]===""?null:row["DUE AMOUNT"],
  paymentStatus:row["Payment \nStatus"]===""?null:row["Payment \nStatus"],
  importSource:"Students Data.xlsx",status:"Active"
 };
 const existing=await Student.findOne({importSource:"Students Data.xlsx",formNo}).select("_id").lean();
 if(existing){await Student.updateOne({_id:existing._id},{$set:payload});updated++}
 else{await Student.create(payload);created++}
}
console.log(JSON.stringify({file:filePath,created,updated,skipped,totalImported:created+updated},null,2));
await mongoose.disconnect();
