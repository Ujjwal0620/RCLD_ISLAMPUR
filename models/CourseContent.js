import mongoose from "mongoose";
const TopicSchema=new mongoose.Schema({sNo:{type:Number,required:true},topic:{type:String,required:true,trim:true},notes:{type:[{name:String,url:String,publicId:String,uploadedAt:{type:Date,default:Date.now}}],default:[]}},{_id:true});
const ModuleSchema=new mongoose.Schema({moduleNo:{type:Number,required:true},module:{type:String,required:true,trim:true},topics:{type:[TopicSchema],default:[]}},{_id:true});
const CourseContentSchema=new mongoose.Schema({courseId:{type:mongoose.Schema.Types.ObjectId,ref:"Course",required:true,unique:true,index:true},courseCode:{type:String,required:true,index:true},courseName:{type:String,required:true},modules:{type:[ModuleSchema],default:[]},active:{type:Boolean,default:true}},{timestamps:true});
export default mongoose.models.CourseContent||mongoose.model("CourseContent",CourseContentSchema);
