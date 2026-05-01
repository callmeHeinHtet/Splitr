import { NextRequest, NextResponse } from "next/server";
import { parseReceipt } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 10 receipts per minute per IP. Stops accidental hammering and keeps
  // the Gemini quota safe if the URL is shared publicly.
  const limit = rateLimit(req, {
    name: "parse",
    max: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((limit.resetAt - Date.now()) / 1000),
    );
    return NextResponse.json(
      {
        error: "Too many requests",
        detail: `Try again in ${retryAfter}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No image uploaded" },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be under 10MB" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseReceipt(buffer, file.type);

    if (parsed.items.length === 0) {
      return NextResponse.json(
        { error: "Could not detect any items. Try a clearer photo." },
        { status: 422 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/parse] error", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Failed to parse receipt",
        detail: detail.slice(0, 400),
      },
      { status: 500 },
    );
  }
}
