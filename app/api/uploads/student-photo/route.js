import { NextResponse } from "next/server";
import { cloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in before uploading a student photo." }, { status: 401 });
    if (!cloudinaryConfigured) return NextResponse.json({ error: "Cloudinary is not configured. Add the Cloudinary credentials before uploading photos." }, { status: 503 });

    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") || "photo");
    if (!["photo", "signature", "payment-proof"].includes(purpose)) return NextResponse.json({ error: "Invalid upload purpose." }, { status: 400 });
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
    if (!String(file.type || "").startsWith("image/")) return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    const maxSize = purpose === "signature" ? 3 * 1024 * 1024 : 5 * 1024 * 1024;
    if (Number(file.size || 0) > maxSize) return NextResponse.json({ error: purpose === "signature" ? "Signature must be smaller than 3 MB." : "Photo must be smaller than 5 MB." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: purpose === "signature" ? "rcld-islampur/student-signatures" : purpose === "payment-proof" ? "rcld-islampur/payment-proofs" : "rcld-islampur/students",
        resource_type: "image",
        transformation: purpose === "signature" ? [{ width: 1400, height: 500, crop: "limit", quality: "auto", fetch_format: "auto" }] : purpose === "payment-proof" ? [{ width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }] : [{ width: 700, height: 900, crop: "limit", quality: "auto", fetch_format: "auto" }],
      }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(buffer);
    });

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id, purpose });
  } catch (error) {
    return NextResponse.json({ error: "Unable to upload student image.", detail: error.message }, { status: 500 });
  }
}
