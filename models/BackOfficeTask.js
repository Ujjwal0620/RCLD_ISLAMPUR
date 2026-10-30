import mongoose from "mongoose";

const BackOfficeTaskSchema = new mongoose.Schema({
  title:{type:String,required:true,trim:true},
  description:{type:String,default:""},
  assignedTo:{type:String,default:""},
  assignedToName:{type:String,default:""},
  status:{type:String,enum:["Open","In Progress","Completed","On Hold"],default:"Open"},
  priority:{type:String,enum:["Low","Medium","High","Urgent"],default:"Medium"},
  dueDate:{type:Date},
  remark:{type:String,default:""},
  createdBy:{type:String,default:""},
  createdByName:{type:String,default:""}
},{timestamps:true});

export default mongoose.models.BackOfficeTask || mongoose.model("BackOfficeTask",BackOfficeTaskSchema);
