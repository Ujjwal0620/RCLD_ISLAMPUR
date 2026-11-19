import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const directory = path.join(process.cwd(), "public", "assets", "icardtemplates");
    const files = await readdir(directory, { withFileTypes: true });
    const templates = files
      .filter((file) => file.isFile() && /\.(jpe?g|png)$/i.test(file.name))
      .map((file) => file.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Unable to read I-card templates:", error);
    return NextResponse.json({ error: "Unable to load I-card templates." }, { status: 500 });
  }
}
