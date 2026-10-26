import { NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import Batch from "@/models/Batch";

export async function GET(_req, { params }) {
  try {
    await connectMongoDB();
    const batch = await Batch.findById(params.id).lean();
    if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    return NextResponse.json({ batch });
  } catch (e) {
    return NextResponse.json({ error: "Unable to load batch.", detail: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();
    const body = await req.json();
    const allowed = ["name", "status", "capacity", "startDate", "endDate", "notes"];
    const update = {};
    for (const key of allowed) if (body[key] !== undefined) update[key] = body[key];
    if (update.capacity !== undefined) update.capacity = Number(update.capacity);
    const batch = await Batch.findByIdAndUpdate(params.id, update, { new: true, runValidators: true }).lean();
    if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    return NextResponse.json({ batch });
  } catch (e) {
    return NextResponse.json({ error: "Unable to update batch.", detail: e.message }, { status: 400 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    await connectMongoDB();
    const batch = await Batch.findByIdAndUpdate(
      params.id,
      { status: "Cancelled" },
      { new: true, runValidators: true }
    ).lean();
    if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    return NextResponse.json({ batch, message: "Batch cancelled." });
  } catch (e) {
    return NextResponse.json({ error: "Unable to cancel batch.", detail: e.message }, { status: 400 });
  }
}
