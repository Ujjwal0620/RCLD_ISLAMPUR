import { NextResponse } from "next/server";
import { configureCloudinary } from "@/lib/cloudinary";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) {
      return NextResponse.json({ error: "Please sign in before uploading a student photo." }, { status: 401 });
    }

    const cloudinarySetup = configureCloudinary();
    if (!cloudinarySetup.configured) {
      return NextResponse.json({ error: cloudinarySetup.error }, { status: 503 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") || "photo");

    if (!["photo", "signature", "payment-proof"].includes(purpose)) {
      return NextResponse.json({ error: "Invalid upload purpose." }, { status: 400 });
    }
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
    }
    if (!String(file.type || "").startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    }

    const maxSize = purpose === "signature" ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
    if (Number(file.size || 0) > maxSize) {
      return NextResponse.json({
        error: purpose === "signature" ? "Signature must be smaller than 3 MB." : "Image must be smaller than 5 MB.",
      }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = purpose === "signature"
      ? "rcld-islampur/student-signatures"
      : purpose === "payment-proof"
        ? "rcld-islampur/payment-proofs"
        : "rcld-islampur/students";
    const transformation = purpose === "signature"
      ? [{ width: 1400, height: 500, crop: "limit", quality: "auto", fetch_format: "auto" }]
      : purpose === "payment-proof"
        ? [{ width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }]
        : [{ width: 700, height: 900, crop: "limit", quality: "auto", fetch_format: "auto" }];

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinarySetup.client.uploader.upload_stream(
        { folder, resource_type: "image", transformation },
        (error, uploaded) => {
          if (error) reject(error);
          else if (!uploaded?.secure_url) reject(new Error("Cloudinary completed the upload but did not return a secure image URL."));
          else resolve(uploaded);
        }
      );
      stream.on("error", reject);
      stream.end(buffer);
    });

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id, purpose });
  } catch (error) {
    const detail = String(error?.message || "Unknown upload error");
    console.error("[student-photo-upload]", detail);
    return NextResponse.json({
      error: "Unable to upload image to Cloudinary.",
      detail,
    }, { status: 500 });
  }
}
