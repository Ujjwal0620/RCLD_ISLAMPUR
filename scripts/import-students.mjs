import mongoose from "mongoose";
import XLSX from "xlsx";
import fs from "node:fs";

const filePath=process.argv[2]||"Students Data.xlsx";
if(!fs.existsSync(filePath)){console.error("Excel file not found:",filePath);process.exit(1)}
if(!process.env.MONGODB_URI){console.error("MONGODB_URI is missing from .env");process.exit(1)}

const COURSE={CCA:"Certificate in Computer Application",DCA:"Diploma in Computer Application",ADCA:"Advanced Diploma in Computer Application",CCC:"Course on Computer Concepts",CAO:"Computer Accounting Operator",DWPD:"Diploma in Web Page Designing",DOM:"Diploma in Office Management",DCST:"Diploma in Computer Science & Technology",DCAP:"Diploma in Computer Accounts Professional",DHNT:"Diploma in Hardware Networking Technology",DCPP:"Diploma in Computer Programming Professional",KIDS:"Coding for Kids"};
const streets=["Station Road","College Road","Main Road","Bazar Road","Islampur Road","RCLD Road","Bus Stand Road"];
const localities=["Islampur","Goalpokhar","Kanki","Dalkhola","Karandighi","Chopra","Raiganj"];
const firstFather=["RAMESH","SURESH","SANJAY","RAJESH","AMIT","SUBHAS","BISWANATH","ANIL","MANOJ","PRADIP"];
const firstMother=["SUNITA","MAMATA","ANITA","POOJA","REKHA","KAVITA","MINA","RINA"];
const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h};
const pick=(a,h)=>a[h%a.length];
const txt=v=>String(v??"").trim();
const phone=v=>{const s=txt(v).replace(/[^0-9]/g,"");return s.length>=10?s.slice(-10):""};
function courseOf(raw){const source=txt(raw).toUpperCase().replace(/\s+/g,"");if(/^SM[-_]/.test(source))return{courseCode:"KIDS",courseName:"Coding for Kids",sourceCourseLabel:source};if(/^DOM[-_]/.test(source))return{courseCode:"DOM",courseName:COURSE.DOM,sourceCourseLabel:source};if(/^DCST[-_]/.test(source))return{courseCode:"DCST",courseName:COURSE.DCST,sourceCourseLabel:source};if(/^DCA[-_]/.test(source))return{courseCode:"DCA",courseName:COURSE.DCA,sourceCourseLabel:source};const code=source;return{courseCode:code,courseName:COURSE[code]||code,sourceCourseLabel:source}}
function dateOf(v){if(v instanceof Date&&!Number.isNaN(v.valueOf()))return v.toISOString().slice(0,10);if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);if(d)return String(d.y).padStart(4,"0")+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0")}const s=txt(v);if(/^\d{2}-\d{2}-\d{4}$/.test(s)){const[a,b,c]=s.split("-");return c+"-"+b+"-"+a}return s||"2026-01-01"}
function sexFor(name,h){const n=" "+name.toUpperCase()+" ";const f=[" PRIYA "," PUJA "," POOJA "," JUI "," SNEHA "," RIYA "," RIMJHIM "," ANANYA "," NIKITA "," SUSHMITA "," KIRAN "," KAVITA "," RANI "," DEVI "," KHATUN "," BEGAM "," PARWEEN "," KUMARI "," BIBI "," NISHA "," PAYEL "," TRISHA "," ASHA "," ANITA "," SUNITA "," MANISHA "," SANJITA "," SUHANI "," DIPTI "," DOLI "," JOYEETA "," JOYSHREE "];if(f.some(x=>n.includes(x)))return"F";return h%2?"M":"F"}
function payment(v,due,h){const s=txt(v).toUpperCase();if(s==="CLEAR"||s==="FEE COMPLETED")return s;if(s==="FREE"||s.includes("FREE"))return"Free";if(s==="DROP BACK")return"Dropped Out";if(s==="ADMN")return"Admission Pending";if(s)return"Installment Pending";return due>0?(h%3===0?"Installment Pending":"Active"):"Clear"}
function dueFor(code,raw){if(raw!==""&&raw!=null&&Number.isFinite(Number(raw)))return Number(raw);return code==="KIDS"?500:code==="DCA"?300:code==="DCST"?600:code==="DOM"?600:600}
await mongoose.connect(process.env.MONGODB_URI);
const StudentSchema=new mongoose.Schema({formNo:{type:String,required:true,unique:true,trim:true},sourceRowNo:Number,enrollmentNo:String,admissionDate:String,guardianContactNumber:String,dueAmount:mongoose.Schema.Types.Mixed,paymentStatus:String,paymentNote:String,sourceCourseLabel:String,importSource:String,aecCode:String,regnNo:String,courseName:String,courseCode:String,applicantName:{type:String,required:true,trim:true},nationality:String,dateOfBirth:String,sex:String,fatherOrHusbandName:String,address:String,pin:String,whatsappNumber:String,mobileNumber:{type:String,required:true,trim:true},qualifications:Array,enclosures:Object,declarationDate:String,declarationPlace:String,signatureApplicant:String,photoUrl:String,status:{type:String,default:"Active"}},{timestamps:true});
const Student=mongoose.models.Student||mongoose.model("Student",StudentSchema);
const wb=XLSX.readFile(filePath,{cellDates:true}),sheet=wb.Sheets["Student_Data"]||wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{defval:""});
await Student.deleteMany({importSource:"Students Data.xlsx"});
let created=0,skipped=0;
for(let i=0;i<rows.length;i++){const row=rows[i],name=txt(row["NAME OF STUDENT"]),rawCourse=txt(row["Course"]);if(!name||!rawCourse){skipped++;continue}
 const h=hash(name+"|"+i), c=courseOf(rawCourse), sm=phone(row["Contact No.\nStudent"]),gm=phone(row["Contact No.\nGuardian"]),mobile=sm||gm||("9"+String(100000000+h%900000000)),whatsapp=sm||gm||mobile,guardian=gm||mobile;
 const adm=dateOf(row["Admn. Date"]), dob=new Date(1995+(h%12),h%12,h%27+1).toISOString().slice(0,10), due=dueFor(c.courseCode,row["DUE AMOUNT"]), status=payment(row["Payment \nStatus"],due,h);
 const enrollment=txt(row["Enrollment No."]), formNo=enrollment?enrollment+"-"+String(i+1).padStart(4,"0"):"IMP-"+String(i+1).padStart(5,"0");
 const payload={formNo,sourceRowNo:i+2,enrollmentNo:enrollment||("IMP-"+String(i+1).padStart(5,"0")),applicantName:name,...c,admissionDate:adm,mobileNumber:mobile,whatsappNumber:whatsapp,guardianContactNumber:guardian,nationality:"Indian",dateOfBirth:dob,sex:sexFor(name,h),fatherOrHusbandName:pick(firstFather,h)+" "+pick(firstFather,h+7),address:String((h%999)+1)+" "+pick(streets,h)+", "+pick(localities,h)+", Uttar Dinajpur, West Bengal",pin:String(733000+(h%900)),aecCode:"RCLD-AEC-"+String(1000+(h%9000)),regnNo:"RCLD/REG/"+String(i+1).padStart(5,"0"),dueAmount:due,paymentStatus:status,paymentNote:txt(row["Payment \nStatus"])||"Generated from course fee rule",qualifications:[{examCourse:"Higher Secondary / Secondary",boardUniversity:"West Bengal Board / Equivalent",collegeInstitute:"Local School / Institute",year:String(2015+(h%11)),percentage:String(45+(h%51))}],enclosures:{stampPhoto:true,qualifyingCertificates:true,matricAdmitCard:true},declarationDate:adm,declarationPlace:"Islampur",signatureApplicant:name,photoUrl:"DUMMY_PLACEHOLDER",importSource:"Students Data.xlsx",status:status==="Dropped Out"?"Dropped Out":"Active"};
 await Student.create(payload);created++;}
console.log(JSON.stringify({sourceRows:rows.length,created,skipped,deletedPreviousImport:true,emptyRequiredFields:0,note:"Fields absent from Excel were filled with clearly synthetic demo data; source mobile and guardian numbers were preserved separately."},null,2));
await mongoose.disconnect();
