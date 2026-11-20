import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const raw = new URL(request.url).searchParams.get("url");
    if (!raw) return NextResponse.json({ error: "Photo URL is required." }, { status: 400 });
    const url = new URL(raw);
    if (url.protocol !== "https:" || !/(^|\.)res\.cloudinary\.com$/i.test(url.hostname)) {
      return NextResponse.json({ error: "Only trusted Cloudinary photo URLs are supported." }, { status: 400 });
    }
    const response = await fetch(url, {
      cache: "force-cache",
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!response.ok || !/(^image\/(jpeg|png|webp))$/i.test(response.headers.get("content-type") || "")) {
      return NextResponse.json({ error: "Unable to retrieve the student photo." }, { status: 502 });
    }
    const finalUrl = new URL(response.url);
    if (!/(^|\.)res\.cloudinary\.com$/i.test(finalUrl.hostname)) {
      return NextResponse.json({ error: "Photo redirect was rejected." }, { status: 502 });
    }
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": response.headers.get("content-type"),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[icard-photo-proxy]", error);
    return NextResponse.json({ error: "Unable to load student photo." }, { status: 502 });
  }
}
