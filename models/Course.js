import mongoose from "mongoose";
const CourseSchema = new mongoose.Schema({
  code:{type:String,required:true,unique:true,trim:true,uppercase:true}, name:{type:String,required:true,trim:true}, category:{type:String,default:"Diploma"}, durationMonths:{type:Number,required:true,min:1}, classesPerWeek:{type:Number,required:true,min:1,max:7}, fee:{type:Number,default:0,min:0}, admissionFee:{type:Number,default:0,min:0}, description:{type:String,default:""}, requiredSkills:{type:[String],default:[]}, active:{type:Boolean,default:true}, source:{type:String,default:"RCLD Islampur"}
},{timestamps:true});
export default mongoose.models.Course || mongoose.model("Course",CourseSchema);
