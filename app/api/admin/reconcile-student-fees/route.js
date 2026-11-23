import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { reconcileStudentFees } from "@/lib/student-import/reconcile-student-fees";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    if (!["superadmin", "admin", "office-admin"].includes(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to reconcile fees." }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Choose the Excel workbook to reconcile." }, { status: 400 });
    }
    if (!/\.(xlsx|xls|csv)$/i.test(String(file.name || ""))) {
      return NextResponse.json({ error: "Only .xlsx, .xls and .csv files are supported." }, { status: 400 });
    }
    if (Number(file.size || 0) > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "The file must be smaller than 15 MB." }, { status: 413 });
    }
    await connectMongoDB();
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const result = await reconcileStudentFees(workbook, { sourceName: String(file.name || "Fee reconciliation").slice(0, 180) });
    return NextResponse.json({
      message: "Fee reconciliation completed. Student profile and non-fee records were not imported or overwritten.",
      ...result
    });
  } catch (error) {
    console.error("[reconcile-student-fees]", error);
    return NextResponse.json({ error: "Unable to reconcile student fees.", detail: error.message }, { status: 500 });
  }
}
