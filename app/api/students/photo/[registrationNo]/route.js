import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "assets",
  "id card coding images",
  "id card coding"
);

const EXTENSIONS = [
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
];

export async function GET(_request, { params }) {
  try {
    const { registrationNo } = await params;
    const code = String(registrationNo || "").trim();

    // Only allow a registration-code filename, never a filesystem path.
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(code)) {
      return NextResponse.json({ error: "Invalid registration number." }, { status: 400 });
    }

    for (const [extension, contentType] of EXTENSIONS) {
      try {
        const image = await readFile(path.join(PHOTO_DIRECTORY, code + extension));
        return new NextResponse(new Uint8Array(image), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    return NextResponse.json({ error: "No photograph found for this registration number." }, { status: 404 });
  } catch (error) {
    console.error("[student-photo]", error);
    return NextResponse.json({ error: "Unable to load student photograph." }, { status: 500 });
  }
}
