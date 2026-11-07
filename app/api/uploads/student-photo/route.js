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
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
    if (!String(file.type || "").startsWith("image/")) return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    if (Number(file.size || 0) > 5 * 1024 * 1024) return NextResponse.json({ error: "Photo must be smaller than 5 MB." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: "rcld-islampur/students",
        resource_type: "image",
        transformation: [{ width: 700, height: 900, crop: "limit", quality: "auto", fetch_format: "auto" }],
      }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(buffer);
    });

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
  } catch (error) {
    return NextResponse.json({ error: "Unable to upload student photo.", detail: error.message }, { status: 500 });
  }
}
