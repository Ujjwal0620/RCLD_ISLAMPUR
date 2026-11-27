import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import ImportLog from "@/models/ImportLog";
import StudentImportStaging from "@/models/StudentImportStaging";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "office-admin"]);

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session?.sub) return NextResponse.json({ error: "Please sign in to view import status." }, { status: 401 });
    if (!ALLOWED_ROLES.has(String(session.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You do not have permission to view student imports." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const importBatchId = String(searchParams.get("importBatchId") || "").trim();
    if (!importBatchId || importBatchId.length > 80) {
      return NextResponse.json({ error: "A valid importBatchId is required." }, { status: 400 });
    }

    await connectMongoDB();
    const log = await ImportLog.findOne({ importBatchId }).lean();
    if (!log) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    const isPrivileged = String(session.role || "").toLowerCase() === "superadmin";
    if (!isPrivileged && String(log.actorId || "") !== String(session.sub)) {
      return NextResponse.json({ error: "You cannot view another user's import batch." }, { status: 403 });
    }

    const [counts, committed, pending] = await Promise.all([
      StudentImportStaging.aggregate([
        { $match: { importBatchId } },
        { $group: { _id: "$action", count: { $sum: 1 } } }
      ]),
      StudentImportStaging.countDocuments({ importBatchId, committedAt: { $ne: null } }),
      StudentImportStaging.countDocuments({ importBatchId, committedAt: null })
    ]);
    return NextResponse.json({
      importBatchId,
      status: log.status,
      summary: log.summary || {},
      totalGroups: Number(log.totalGroups || 0),
      committedGroups: Number(log.committedGroups || committed),
      pendingGroups: pending,
      totalChunks: Number(log.totalChunks || 0),
      completedChunks: log.completedChunks || [],
      actionCounts: Object.fromEntries(counts.map(item => [item._id || "REVIEW", item.count])),
      conflictCount: Number(log.conflictCount || 0),
      lastError: log.lastError || "",
      startedAt: log.startedAt || null,
      completedAt: log.completedAt || null,
      updatedAt: log.updatedAt || null
    });
  } catch (error) {
    console.error("[student-import-status]", error);
    return NextResponse.json({ error: "Unable to load import status." }, { status: 500 });
  }
}
