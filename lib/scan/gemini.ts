import type { ScanCandidate, ScanItemRef, ScanResponse } from "./types";

export class GeminiScanError extends Error {
  code: "rate_limited" | "parse_error" | "model_error";
  retryAfterSec?: number;
  constructor(
    code: "rate_limited" | "parse_error" | "model_error",
    message: string,
    retryAfterSec?: number
  ) {
    super(message);
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

const MODEL = "gemini-2.5-flash";
const DEFAULT_BASE = "https://generativelanguage.googleapis.com";

function endpoint(): string {
  const base = (process.env.GOOGLE_GEMINI_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  return `${base}/v1beta/models/${MODEL}:generateContent`;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function dataUrlToInline(url: string): GeminiPart {
  const m = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!m) {
    throw new GeminiScanError(
      "model_error",
      "Reference photo is not a base64 data URL."
    );
  }
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

function buildContents(queryImage: string, items: ScanItemRef[]): GeminiPart[] {
  const parts: GeminiPart[] = [
    {
      text:
        "You identify warehouse storage items by visual appearance. Below is a catalog. " +
        "Each item is introduced by a header line (ITEM id=… sku=… name=… color=… size=…) " +
        "followed by 1-2 reference photos of that item. Then a final QUERY IMAGE — your " +
        "task is to decide which catalog item is shown in the query image. Compare exact " +
        "shade of color, shape, and size cues. Return the top 3 candidate item ids with " +
        "confidence between 0 and 1, plus a brief reason. If nothing matches well, still " +
        "return your top guesses with low confidences.",
    },
  ];

  for (const it of items) {
    parts.push({
      text: `ITEM id=${it.id} sku=${it.sku} name=${it.name} color=${it.color ?? ""} size=${it.size ?? ""} category=${it.category ?? ""}`,
    });
    for (const ref of it.referencePhotos) parts.push(dataUrlToInline(ref));
  }

  parts.push({
    text: "QUERY IMAGE — identify which catalog item id this is.",
  });
  parts.push(dataUrlToInline(queryImage));
  return parts;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    topMatches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["itemId", "confidence"],
      },
    },
  },
  required: ["topMatches"],
};

function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function identifyItem(
  queryImage: string,
  items: ScanItemRef[],
  apiKey: string
): Promise<ScanResponse> {
  const contents = [{ role: "user", parts: buildContents(queryImage, items) }];
  const body = {
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
    },
  };

  let res: Response;
  try {
    res = await fetch(`${endpoint()}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new GeminiScanError(
      "model_error",
      e instanceof Error ? e.message : "Network error contacting Gemini."
    );
  }

  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) || 30;
    throw new GeminiScanError("rate_limited", "Gemini rate limit hit.", retry);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiScanError(
      "model_error",
      `Gemini ${res.status}: ${text.slice(0, 200)}`
    );
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    throw new GeminiScanError("parse_error", "Empty response from Gemini.");
  }

  let parsed: { topMatches?: ScanCandidate[] };
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    throw new GeminiScanError(
      "parse_error",
      `Gemini returned non-JSON output: ${text.slice(0, 120)}`
    );
  }

  const matches = (parsed.topMatches ?? [])
    .filter((m) => m && typeof m.itemId === "string" && Number.isFinite(m.confidence))
    .map((m) => ({
      itemId: m.itemId,
      confidence: Math.max(0, Math.min(1, m.confidence)),
      reason: m.reason,
    }))
    .slice(0, 5);

  return { topMatches: matches };
}
