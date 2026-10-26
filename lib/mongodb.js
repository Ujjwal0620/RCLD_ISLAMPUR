import mongoose from "mongoose";

let cached = globalThis.__rcldMongoose;

if (!cached) {
  cached = globalThis.__rcldMongoose = { conn: null, promise: null };
}

export async function connectMongoDB() {
  if (cached.conn) return cached.conn;

  // Local development works without requiring NEXT_PUBLIC_APP_URL or a MongoDB env value.
  // Production should always provide MONGODB_URI explicitly.
  const uri =
    process.env.MONGODB_URI ||
    (process.env.NODE_ENV !== "production"
      ? "mongodb://127.0.0.1:27017/rcld_islampur"
      : "");

  if (!uri) {
    throw new Error("MONGODB_URI is not configured for this environment.");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
      })
      .catch((error) => {
        // A rejected cached promise would make every later API request fail
        // until the Next.js server is restarted. Reset it so the next request
        // can reconnect after MongoDB becomes available.
        cached.promise = null;
        cached.conn = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
