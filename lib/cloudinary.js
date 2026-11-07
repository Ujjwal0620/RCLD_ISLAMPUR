import { v2 as cloudinary } from "cloudinary";

/**
 * Read Cloudinary credentials at request time so local .env changes are not
 * hidden behind a module-level boolean. Supports either the three standard
 * variables or Cloudinary's CLOUDINARY_URL.
 */
export function configureCloudinary() {
  let cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  let apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  let apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  const cloudinaryUrl = String(process.env.CLOUDINARY_URL || "").trim();
  if ((!cloudName || !apiKey || !apiSecret) && cloudinaryUrl) {
    try {
      const parsed = new URL(cloudinaryUrl);
      if (parsed.protocol !== "cloudinary:") {
        return { configured: false, error: "CLOUDINARY_URL must start with cloudinary://." };
      }
      apiKey = apiKey || decodeURIComponent(parsed.username || "");
      apiSecret = apiSecret || decodeURIComponent(parsed.password || "");
      cloudName = cloudName || parsed.hostname;
    } catch {
      return { configured: false, error: "CLOUDINARY_URL is invalid. Use the format cloudinary://API_KEY:API_SECRET@CLOUD_NAME." };
    }
  }

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      configured: false,
      error: "Cloudinary credentials are missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or set CLOUDINARY_URL.",
    };
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { configured: true, client: cloudinary };
}

export { cloudinary };
