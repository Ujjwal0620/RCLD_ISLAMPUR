import mongoose from "mongoose";

const StudentContactLogSchema=new mongoose.Schema({
  studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student",required:true,index:true},
  type:{type:String,enum:["CALL","NOTE"],default:"CALL"},
  phoneNumber:{type:String,default:""},
  callingRemark:{type:String,default:"",trim:true},
  remarks:{type:String,default:"",trim:true},
  actorId:{type:String,default:""},
  actorName:{type:String,default:""},
  actorRole:{type:String,default:""},
  createdAt:{type:Date,default:Date.now,index:true}
},{timestamps:true});

StudentContactLogSchema.index({studentId:1,createdAt:-1});
export default mongoose.models.StudentContactLog||mongoose.model("StudentContactLog",StudentContactLogSchema);
