import mongoose from "mongoose";

let cached = globalThis.__rcldMongoose;

if (!cached) {
  cached = globalThis.__rcldMongoose = { conn: null, promise: null };
}

async function queryDnsOverHttps(hostname, type) {
  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${type}`,
  ];

  let lastError;

  for (const endpoint of providers) {
    try {
      const response = await fetch(endpoint, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`DNS-over-HTTPS returned HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.Status !== 0) {
        throw new Error(`DNS lookup failed with status ${result.Status}`);
      }

      return (result.Answer || []).filter((record) => record.type === (type === "SRV" ? 33 : 16));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Unable to resolve MongoDB Atlas ${type} records over HTTPS: ${lastError?.message || "unknown DNS error"}`
  );
}

function decodeTxtRecord(value) {
  // DNS JSON represents TXT chunks as quoted strings. Join the chunks.
  return String(value || "")
    .replace(/^"|"$/g, "")
    .replace(/"\s*"/g, "");
}

async function resolveSrvUriWithHttps(uri) {
  if (!/^mongodb\+srv:\/\//i.test(uri)) return uri;

  const parsed = new URL(uri);
  const hostname = parsed.hostname;

  if (!hostname) {
    throw new Error("MONGODB_URI must contain a valid MongoDB Atlas hostname.");
  }

  const [srvRecords, txtRecords] = await Promise.all([
    queryDnsOverHttps(`_mongodb._tcp.${hostname}`, "SRV"),
    queryDnsOverHttps(hostname, "TXT").catch(() => []),
  ]);

  if (!srvRecords.length) {
    throw new Error("MongoDB Atlas returned no SRV records. Check the Atlas hostname in MONGODB_URI.");
  }

  const hosts = srvRecords
    .map((record) => {
      const parts = String(record.data || "").trim().split(/\s+/);
      const port = Number(parts[2]);
      const target = String(parts[3] || "").replace(/\.$/, "");

      if (!target || !Number.isInteger(port) || port < 1 || port > 65535) return null;
      return `${target}:${port}`;
    })
    .filter(Boolean);

  if (!hosts.length) {
    throw new Error("MongoDB Atlas SRV records did not contain valid host and port values.");
  }

  const options = new URLSearchParams(parsed.search);
  options.set("tls", options.get("tls") || "true");

  for (const record of txtRecords) {
    const txt = decodeTxtRecord(record.data);
    const txtOptions = new URLSearchParams(txt);
    for (const [key, value] of txtOptions.entries()) {
      if (!options.has(key)) options.set(key, value);
    }
  }

  const credentials =
    parsed.username || parsed.password
      ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
      : "";
  const pathname = parsed.pathname || "/";
  const query = options.toString();

  return `mongodb://${credentials}${hosts.join(",")}${pathname}${query ? `?${query}` : ""}`;
}

export async function connectMongoDB() {
  if (cached.conn) return cached.conn;

  // Local development works without requiring NEXT_PUBLIC_APP_URL or a MongoDB env value.
  // Production should always provide MONGODB_URI explicitly.
  const configuredUri =
    process.env.MONGODB_URI ||
    (process.env.NODE_ENV !== "production"
      ? "mongodb://127.0.0.1:27017/rcld_islampur"
      : "");

  if (!configuredUri) {
    throw new Error("MONGODB_URI is not configured for this environment.");
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      // Resolve Atlas SRV/TXT records through HTTPS. This avoids Node's native
      // querySrv UDP/TCP resolver, which can be refused by some networks.
      const uri = await resolveSrvUriWithHttps(configuredUri);

      return mongoose.connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
      });
    })().catch((error) => {
      cached.promise = null;
      cached.conn = null;
      throw error;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
