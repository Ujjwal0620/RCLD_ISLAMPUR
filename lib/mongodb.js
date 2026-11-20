import mongoose from "mongoose";
import dns from "node:dns";

let cached = globalThis.__rcldMongoose;

if (!cached) {
  cached = globalThis.__rcldMongoose = { conn: null, promise: null };
}

function configureMongoDns(uri) {
  // mongodb+srv connections require SRV/TXT DNS lookups. Use public resolvers
  // from this Node.js process instead of relying only on the machine/router DNS.
  if (!/^mongodb\+srv:\/\//i.test(uri)) return;

  const servers = String(process.env.MONGODB_DNS_SERVERS || "1.1.1.1,8.8.8.8")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (!servers.length) return;

  try {
    dns.setServers(servers);
  } catch (error) {
    // Do not hide the original MongoDB connection error if DNS cannot be changed
    // while another DNS request is in progress.
    console.warn("[mongodb] Could not apply custom DNS servers:", error.message);
  }
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

  configureMongoDns(uri);

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
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
