import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
let cached = globalThis.__rcldMongoose;

if (!cached) cached = globalThis.__rcldMongoose = { conn: null, promise: null };

export async function connectMongoDB() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  if (cached.conn) return cached.conn;
  if (!cached.promise) cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  cached.conn = await cached.promise;
  return cached.conn;
}
