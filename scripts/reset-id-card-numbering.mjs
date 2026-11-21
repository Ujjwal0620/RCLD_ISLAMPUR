import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI is required to run the one-time ID-card reset.");

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;
const migrations = db.collection("system_migrations");
const migrationId = "reset_student_id_cards_v1";

try {
  const alreadyRun = await migrations.findOne({ _id: migrationId });
  if (alreadyRun) {
    console.log("ID-card reset already completed; no changes made.");
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
      await db.collection("students").updateMany(
        {},
        {
          $unset: { idCardNumber: "", idCardNo: "", idIssuedAt: "", lastDownloadedAt: "" },
          $set: { isIdDownloaded: false, isDownloaded: false },
        },
        { session },
      );
      await db.collection("idCardIssues").deleteMany({}, { session });
      await db.collection("id_card_counters").replaceOne(
        { _id: "student_id_card" },
        { _id: "student_id_card", lastIssuedNumber: 0 },
        { upsert: true, session },
      );
      await db.collection("system_migrations").insertOne(
        { _id: migrationId, completedAt: new Date(), description: "Reset student ID-card numbering to start at 1." },
        { session },
      );
      });
      console.log("ID-card reset completed. The next confirmed download will be RCLD/ID-NO/0001.");
  }
} finally {
  await mongoose.disconnect();
}
