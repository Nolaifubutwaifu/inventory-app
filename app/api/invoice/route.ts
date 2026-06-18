import { NextResponse } from "next/server";
import type { InvoiceImport, InvoiceImportLine } from "@/lib/types";
import {
  DEFAULT_IMPORT_ACCOUNT,
  type InvoiceError,
  type InvoiceImportResult,
  type ParsedInvoice,
} from "@/lib/invoice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InvoiceRequest {
  filename?: string;
  mimeType?: string;
  dataBase64?: string;
  accountId?: string;
}

// Invoices are small, but base64 inflates by ~33%. Reject anything implausibly
// large so a stray file can't blow up the model call.
const MAX_BASE64_BYTES = 12 * 1024 * 1024;

function errorResponse(error: InvoiceError, status: number) {
  return NextResponse.json(error, { status });
}

function authorized(req: Request): boolean {
  const expected = process.env.INVOICE_IMPORT_TOKEN;
  if (!expected) return true; // no token configured -> open (dev convenience)
  const header =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-import-token") ??
    "";
  return header === expected;
}

function mockInvoice(): ParsedInvoice {
  return {
    invoiceNumber: "INV-MOCK-001",
    invoiceDate: "2026-06-18",
    party: "Mock Supplies Pty Ltd",
    lines: [
      { sku: "BIN-60-BLK", description: "60L Storage Bin Black", quantity: 24, unitPrice: 18.5 },
      { sku: "LID-60-BLK", description: "60L Bin Lid Black", quantity: 24, unitPrice: 6.0 },
      { sku: "BIN-80-BLU", description: "80L Storage Bin Blue", quantity: 10, unitPrice: 22.0 },
    ],
  };
}

function buildRecord(
  parsed: ParsedInvoice,
  filename: string,
  accountId: string
): InvoiceImport {
  const lines: InvoiceImportLine[] = parsed.lines.map((l) => ({
    rawSku: l.sku,
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    imported: false,
  }));
  return {
    id: crypto.randomUUID(),
    userId: accountId,
    filename,
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate,
    party: parsed.party,
    lines,
    status: "pending",
    createdAt: Date.now(),
  };
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return errorResponse(
      { error: "unauthorized", message: "Invalid or missing import token." },
      401
    );
  }

  let body: InvoiceRequest;
  try {
    body = (await req.json()) as InvoiceRequest;
  } catch {
    return errorResponse({ error: "bad_request", message: "Invalid JSON" }, 400);
  }

  const filename = (body.filename || "invoice").toString();
  const mimeType = (body.mimeType || "application/pdf").toString();
  const dataBase64 = body.dataBase64;
  if (!dataBase64 || typeof dataBase64 !== "string") {
    return errorResponse(
      { error: "bad_request", message: "Need dataBase64 (the invoice file)." },
      400
    );
  }
  if (dataBase64.length > MAX_BASE64_BYTES) {
    return errorResponse(
      { error: "bad_request", message: "Invoice file is too large." },
      413
    );
  }

  const accountId =
    (body.accountId && body.accountId.trim()) ||
    process.env.INVOICE_IMPORT_ACCOUNT_ID ||
    DEFAULT_IMPORT_ACCOUNT;

  // Parse the invoice (mock or real Gemini).
  let parsed: ParsedInvoice;
  if (process.env.INVOICE_MOCK === "1") {
    parsed = mockInvoice();
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse(
        { error: "missing_key", message: "Invoice parsing is not configured on this server." },
        503
      );
    }
    try {
      const { parseInvoice } = await import("@/lib/invoice/parse");
      parsed = await parseInvoice(dataBase64, mimeType, apiKey);
    } catch (e: unknown) {
      const err = e as { code?: string; retryAfterSec?: number; message?: string };
      if (err?.code === "rate_limited") {
        return errorResponse(
          {
            error: "rate_limited",
            message: "Slow down — Gemini rate limit hit.",
            retryAfterSec: err.retryAfterSec ?? 30,
          },
          429
        );
      }
      if (err?.code === "parse_error") {
        return errorResponse(
          { error: "parse_error", message: err.message ?? "Could not read this invoice." },
          422
        );
      }
      return errorResponse(
        { error: "model_error", message: err?.message ?? "Invoice parsing failed." },
        502
      );
    }
  }

  const record = buildRecord(parsed, filename, accountId);

  // Deliver to the app via Supabase sync. If that isn't possible, tell the
  // watcher so it can keep the file for a retry rather than dropping it.
  const { deliverInvoiceImport, isDeliveryConfigured } = await import(
    "@/lib/invoice/deliver"
  );
  if (!isDeliveryConfigured()) {
    return errorResponse(
      {
        error: "not_delivered",
        message:
          "Parsed the invoice but cross-device sync (Supabase) isn't configured, " +
          "so it can't reach the app. Set NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY.",
      },
      503
    );
  }
  try {
    await deliverInvoiceImport(record);
  } catch (e) {
    return errorResponse(
      {
        error: "not_delivered",
        message: e instanceof Error ? e.message : "Could not deliver the invoice to the app.",
      },
      502
    );
  }

  const result: InvoiceImportResult = {
    id: record.id,
    filename: record.filename,
    invoiceNumber: record.invoiceNumber,
    lineCount: record.lines.length,
    totalQuantity: record.lines.reduce((s, l) => s + l.quantity, 0),
    delivered: true,
  };
  return NextResponse.json(result);
}
