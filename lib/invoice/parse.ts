import type { ParsedInvoice, ParsedInvoiceLine } from "./types";

// Mirrors lib/scan/gemini.ts: same model, same endpoint/proxy handling, same
// structured-output approach — just pointed at reading an invoice document
// instead of matching a photo.
export class InvoiceParseError extends Error {
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

const PROMPT =
  "You are reading a single invoice produced by MYOB accounting software. " +
  "It may be a PDF or an image. Extract its line items. For EACH product line " +
  "return the item code / SKU exactly as printed (empty string if the line has " +
  "none), the description, the quantity as a number, and the unit price as a " +
  "number when shown. Ignore non-product rows such as subtotal, freight, GST/tax, " +
  "rounding, and total lines — only return rows that represent goods with a " +
  "quantity. Also return the invoice number, the invoice date exactly as printed, " +
  "and the customer or supplier name. If a field is absent, omit it or use an " +
  "empty string. Return strictly the requested JSON.";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    invoiceNumber: { type: "string" },
    invoiceDate: { type: "string" },
    party: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sku: { type: "string" },
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
        },
        required: ["description", "quantity"],
      },
    },
  },
  required: ["lines"],
};

function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function cleanString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function cleanNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function parseInvoice(
  fileBase64: string,
  mimeType: string,
  apiKey: string
): Promise<ParsedInvoice> {
  const contents = [
    {
      role: "user",
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType, data: fileBase64 } },
      ],
    },
  ];
  const body = {
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
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
    throw new InvoiceParseError(
      "model_error",
      e instanceof Error ? e.message : "Network error contacting Gemini."
    );
  }

  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) || 30;
    throw new InvoiceParseError("rate_limited", "Gemini rate limit hit.", retry);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new InvoiceParseError(
      "model_error",
      `Gemini ${res.status}: ${text.slice(0, 200)}`
    );
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    throw new InvoiceParseError("parse_error", "Empty response from Gemini.");
  }

  let parsed: {
    invoiceNumber?: string;
    invoiceDate?: string;
    party?: string;
    lines?: Array<Record<string, unknown>>;
  };
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    throw new InvoiceParseError(
      "parse_error",
      `Gemini returned non-JSON output: ${text.slice(0, 120)}`
    );
  }

  const lines: ParsedInvoiceLine[] = (parsed.lines ?? [])
    .map((l) => ({
      sku: cleanString(l.sku),
      description: cleanString(l.description),
      quantity: cleanNumber(l.quantity) ?? 0,
      unitPrice: cleanNumber(l.unitPrice),
    }))
    // Keep only rows that actually moved goods.
    .filter((l) => l.quantity > 0 && (l.description || l.sku));

  if (lines.length === 0) {
    throw new InvoiceParseError(
      "parse_error",
      "No product line items were found on this invoice."
    );
  }

  return {
    invoiceNumber: cleanString(parsed.invoiceNumber) || undefined,
    invoiceDate: cleanString(parsed.invoiceDate) || undefined,
    party: cleanString(parsed.party) || undefined,
    lines,
  };
}
