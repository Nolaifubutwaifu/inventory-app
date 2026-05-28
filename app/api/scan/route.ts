import { NextResponse } from "next/server";
import type {
  ScanCandidate,
  ScanError,
  ScanRequest,
  ScanResponse,
} from "@/lib/scan/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: ScanError, status: number) {
  return NextResponse.json(error, { status });
}

function mockResponse(items: ScanRequest["items"]): ScanResponse {
  const fakeConfidences = [0.92, 0.71, 0.34];
  const topMatches: ScanCandidate[] = items.slice(0, 3).map((it, i) => ({
    itemId: it.id,
    confidence: fakeConfidences[i] ?? 0.2,
    reason: `mock match #${i + 1}`,
  }));
  return { topMatches };
}

export async function POST(req: Request) {
  let body: ScanRequest;
  try {
    body = (await req.json()) as ScanRequest;
  } catch {
    return errorResponse({ error: "bad_request", message: "Invalid JSON" }, 400);
  }

  if (!body || typeof body !== "object" || !body.queryImage || !Array.isArray(body.items)) {
    return errorResponse(
      { error: "bad_request", message: "Need queryImage and items[]" },
      400
    );
  }

  const itemsWithRefs = body.items.filter(
    (it) => Array.isArray(it.referencePhotos) && it.referencePhotos.length > 0
  );
  if (itemsWithRefs.length === 0) {
    return errorResponse(
      { error: "no_items", message: "No catalog items have reference photos yet." },
      422
    );
  }

  if (process.env.SCAN_MOCK === "1") {
    return NextResponse.json(mockResponse(itemsWithRefs));
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse(
      { error: "missing_key", message: "AI scan is not configured on this server." },
      503
    );
  }

  // Real Gemini wiring is implemented in lib/scan/gemini.ts (step 5).
  try {
    const { identifyItem } = await import("@/lib/scan/gemini");
    const result = await identifyItem(body.queryImage, itemsWithRefs, apiKey);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const err = e as { code?: string; status?: number; retryAfterSec?: number; message?: string };
    if (err?.code === "rate_limited") {
      return errorResponse(
        {
          error: "rate_limited",
          message: "Slow down — Gemini free tier limit hit.",
          retryAfterSec: err.retryAfterSec ?? 30,
        },
        429
      );
    }
    if (err?.code === "parse_error") {
      return errorResponse(
        { error: "parse_error", message: err.message ?? "Could not parse model output." },
        502
      );
    }
    return errorResponse(
      { error: "model_error", message: err?.message ?? "AI scan failed." },
      502
    );
  }
}
