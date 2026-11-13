const DEVELOPMENT_SECRET = "rcld-islampur-local-development-only-secret";

export function getAuthSecret() {
  const configured = String(process.env.AUTH_SECRET || "").trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!configured || configured.length < 32 || configured === "change-this-local-secret") {
      throw new Error("AUTH_SECRET must be configured with at least 32 characters in production.");
    }
    return new TextEncoder().encode(configured);
  }

  return new TextEncoder().encode(configured || DEVELOPMENT_SECRET);
}
