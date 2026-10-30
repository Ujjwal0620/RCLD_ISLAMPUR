import mongoose from "mongoose";

const FacultySnapshotSchema=new mongoose.Schema({
  employeeId:{type:String,default:""},
  name:{type:String,default:""},
},{_id:false});

const BatchSnapshotSchema=new mongoose.Schema({
  batchId:{type:mongoose.Schema.Types.ObjectId,ref:"Batch",default:null},
  batchCode:{type:String,default:""},
  name:{type:String,default:""},
  courseId:{type:mongoose.Schema.Types.ObjectId,ref:"Course",default:null},
  courseCode:{type:String,default:""},
  courseName:{type:String,default:""},
  series:{type:[String],default:[]},
  faculty:{type:[FacultySnapshotSchema],default:[]},
  schedules:{type:Array,default:[]},
  status:{type:String,default:""},
},{_id:false});

const StudentBatchHistorySchema=new mongoose.Schema({
  studentId:{type:mongoose.Schema.Types.ObjectId,ref:"Student",required:true,index:true},
  action:{type:String,enum:["SHIFTED","DROPPED_OUT","REJOINED"],required:true,index:true},
  fromBatch:{type:BatchSnapshotSchema,default:null},
  toBatch:{type:BatchSnapshotSchema,default:null},
  remark:{type:String,required:true,trim:true},
  actor:{type:String,default:"superadmin"},
  actorRole:{type:String,default:"superadmin"},
  occurredAt:{type:Date,default:Date.now,index:true},
  attendanceSnapshot:{type:Object,default:{}},
},{timestamps:true});

StudentBatchHistorySchema.index({studentId:1,occurredAt:-1});
export default mongoose.models.StudentBatchHistory || mongoose.model("StudentBatchHistory",StudentBatchHistorySchema);
