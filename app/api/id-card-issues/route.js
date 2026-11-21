import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import IdCardIssue from "@/models/IdCardIssue";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    await connectMongoDB();
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get("search") || "").trim();
    const filter = { status: "Downloaded" };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\\]\\]/g, "\\search.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")");
      const rx = new RegExp(escaped, "i");
      filter.$or = [
        { idCardNumber: rx }, { formNo: rx }, { applicantName: rx }, { mobile: rx },
      ];
    }
    const [issues, total, totalIssued] = await Promise.all([
      IdCardIssue.find(filter).populate("studentId").lean(),
      IdCardIssue.countDocuments(filter),
      IdCardIssue.countDocuments({ status: "Downloaded" }),
    ]);
    issues.sort((a, b) => {
      const left = Number(String(a.idCardNumber || "").match(/(\\d+)$/)?.[1] || 0);
      const right = Number(String(b.idCardNumber || "").match(/(\\d+)$/)?.[1] || 0);
      return left - right;
    });
    return NextResponse.json({ issues, total, totalIssued });
  } catch (error) {
    console.error("[id-card-issues]", error);
    return NextResponse.json({ error: "Unable to load ID-card issue records." }, { status: 500 });
  }
}
