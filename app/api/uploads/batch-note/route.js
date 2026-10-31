import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSession } from "@/lib/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const form = await req.formData();
    const file = form.get("file");
    if (!file || file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF notes are allowed." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "PDF must be 15 MB or smaller." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "raw", folder: "rcld/batch-notes", use_filename: true, unique_filename: true },
        (error, uploaded) => error ? reject(error) : resolve(uploaded)
      );
      stream.end(bytes);
    });
    return NextResponse.json({ note: { name: file.name, url: result.secure_url, publicId: result.public_id, uploadedAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Unable to upload PDF notes.", detail: error.message }, { status: 500 });
  }
}
