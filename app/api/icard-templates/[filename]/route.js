import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { filename } = await params;
    const safeName = path.basename(String(filename || ""));
    if (safeName !== filename || !/\.(?:jpe?g|png)$/i.test(safeName)) {
      return NextResponse.json({ error: "Invalid template filename." }, { status: 400 });
    }
    const filePath = path.join(process.cwd(), "public", "assets", "icardtemplates", safeName);
    const bytes = await readFile(filePath);
    const contentType = /\.png$/i.test(safeName) ? "image/png" : "image/jpeg";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error?.code === "ENOENT") return NextResponse.json({ error: "Template not found." }, { status: 404 });
    console.error("[icard-template-image]", error);
    return NextResponse.json({ error: "Unable to serve ID-card template." }, { status: 500 });
  }
}
