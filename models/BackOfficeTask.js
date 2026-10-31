import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema({
  employeeId:{type:String,required:true},
  employeeName:{type:String,required:true}
},{_id:false});

const BackOfficeTaskSchema = new mongoose.Schema({
  title:{type:String,required:true,trim:true},
  assignments:{type:[AssignmentSchema],default:[]},
  assignedTo:{type:String,default:""},
  assignedToName:{type:String,default:""},
  workArea:{type:String,enum:["T1","T2","L1","L2","L3","L4","Back Office","Front Office"],required:true},
  taskDate:{type:String,required:true},
  startTime:{type:String,required:true},
  endTime:{type:String,required:true},
  status:{type:String,enum:["Open","In Progress","Completed","On Hold"],default:"Open"},
  createdBy:{type:String,default:""},
  createdByName:{type:String,default:""}
},{timestamps:true});

BackOfficeTaskSchema.index({taskDate:1,"assignments.employeeId":1,startTime:1,endTime:1});

export default mongoose.models.BackOfficeTask || mongoose.model("BackOfficeTask",BackOfficeTaskSchema);
