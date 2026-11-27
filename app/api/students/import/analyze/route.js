import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { analyzeWorkbookWithGroq } from "@/lib/student-import/groq-template-analyzer";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to analyze a workbook." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to analyze student imports." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Choose an .xlsx, .xls, or .csv workbook." }, { status: 400 });
    }
    const extension = "." + String(file.name || "").split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) return NextResponse.json({ error: "Unsupported workbook format." }, { status: 415 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Workbook exceeds the 25 MB upload limit." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeWorkbookWithGroq(buffer);
    return NextResponse.json({
      blueprint: analysis.blueprint,
      provider: analysis.provider,
      fallbackReason: analysis.reason || null,
      metadata: analysis.metadata
    });
  } catch (error) {
    console.error("[student-import-analyze]", error);
    return NextResponse.json({ error: "Workbook analysis failed.", detail: error.message }, { status: 500 });
  }
}
