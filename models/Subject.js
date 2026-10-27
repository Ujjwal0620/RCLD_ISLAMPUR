import mongoose from "mongoose";

const ChapterSchema=new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  description:{type:String,default:""},
  order:{type:Number,default:0}
},{_id:true});

const SubjectSchema=new mongoose.Schema({
  code:{type:String,required:true,trim:true,uppercase:true},
  name:{type:String,required:true,trim:true},
  courseId:{type:mongoose.Schema.Types.ObjectId,ref:"Course",required:true,index:true},
  courseCode:{type:String,required:true},
  courseName:{type:String,required:true},
  requiredSkills:{type:[String],default:[]},
  chapters:{type:[ChapterSchema],default:[]},
  active:{type:Boolean,default:true}
},{timestamps:true});

SubjectSchema.index({courseId:1,code:1},{unique:true});
export default mongoose.models.Subject||mongoose.model("Subject",SubjectSchema);