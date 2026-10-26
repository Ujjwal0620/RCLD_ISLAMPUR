export const COURSE_CATALOG=[
{code:"CCA",name:"Certificate in Computer Application",category:"Certificate",durationMonths:3,requiredSkills:["Fundamentals","Windows","MS Word","MS Excel","MS PowerPoint"],description:"Foundation computer application course. Fees and detailed syllabus remain editable."},
{code:"DCA",name:"Diploma in Computer Application",category:"Diploma",durationMonths:12,requiredSkills:["Fundamentals","Windows","MS Word","MS Excel","MS PowerPoint","Internet and Email"],description:"One-year computer application diploma."},
{code:"ADCA",name:"Advanced Diploma in Computer Application",category:"Advanced Diploma",durationMonths:12,requiredSkills:["Fundamentals","HTML","CSS","JavaScript","SQL","Python"],description:"Advanced computer application programme."},
{code:"CCC",name:"Course on Computer Concepts",category:"Certificate",durationMonths:3,requiredSkills:["Fundamentals","Windows","MS Word","MS Excel","Internet and Email"],description:"Computer concepts and digital productivity programme."},
{code:"CAO",name:"Computer Accounting Operator",category:"Professional",durationMonths:6,requiredSkills:["MS Excel","MS Word","Tally ERP 9","Internet and Email"],description:"Computer accounting and office operations programme."},
{code:"DWPD",name:"Diploma in Web Page Designing",category:"Diploma",durationMonths:6,requiredSkills:["HTML","CSS","JavaScript","Photoshop","CorelDRAW"],description:"Web page design and front-end fundamentals programme."},
{code:"DOM",name:"Diploma in Office Management",category:"Diploma",durationMonths:12,requiredSkills:["MS Word","MS Excel","MS PowerPoint","MS Outlook","Internet and Email"],description:"Office management and productivity skills programme."},
{code:"DCST",name:"Diploma in Computer Science & Technology",category:"Diploma",durationMonths:12,requiredSkills:["Fundamentals","C Programming","JavaScript","Python","SQL","Networking"],description:"Computer science and technology diploma."},
{code:"DCAP",name:"Diploma in Computer Accounts Professional",category:"Diploma",durationMonths:12,requiredSkills:["MS Excel","Tally ERP 9","MS Word","Internet and Email"],description:"Computer accounts professional diploma."},
{code:"DHNT",name:"Diploma in Hardware Networking Technology",category:"Diploma",durationMonths:12,requiredSkills:["Hardware","Networking","Windows","CCTV Installation","Cyber Security Online Works"],description:"Hardware and networking technology diploma."},
{code:"DCPP",name:"Diploma in Computer Programming Professional",category:"Professional",durationMonths:12,requiredSkills:["C Programming","JavaScript","Python","SQL"],description:"Programming-focused professional diploma."},
{code:"KIDS",name:"Coding for Kids",category:"Special",durationMonths:3,requiredSkills:["Scratch","Fundamentals"],description:"Beginner-friendly coding programme for children."}
];
export function suggestedClassesPerWeek(durationMonths){const m=Number(durationMonths);if(m<=3)return 4;if(m>=12)return 2;return 3;}
