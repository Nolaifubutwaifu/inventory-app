// Shape of an invoice after the model has read it. Kept deliberately small —
// just what's needed to turn lines into count entries and to trace them back.
export interface ParsedInvoiceLine {
  sku: string; // item code / SKU as printed ("" when the line has none)
  description: string;
  quantity: number;
  unitPrice?: number;
}

export interface ParsedInvoice {
  invoiceNumber?: string;
  invoiceDate?: string; // free-form, exactly as printed
  party?: string; // customer or supplier name
  lines: ParsedInvoiceLine[];
}

export type InvoiceErrorCode =
  | "missing_key"
  | "bad_request"
  | "unauthorized"
  | "rate_limited"
  | "model_error"
  | "parse_error"
  | "not_delivered";

export interface InvoiceError {
  error: InvoiceErrorCode;
  message?: string;
  retryAfterSec?: number;
}

// What the /api/invoice route hands back to the watcher for each file.
export interface InvoiceImportResult {
  id: string;
  filename: string;
  invoiceNumber?: string;
  lineCount: number;
  totalQuantity: number;
  delivered: boolean; // true once written to Supabase for the app to pick up
}

// The collection name used in the generic `sync_records` table and the local
// Dexie `invoiceImports` table mirror. Shared so server and client agree.
export const INVOICE_COLLECTION = "invoice_imports";

// Account the watcher writes to. Defaults to the shared dev account id so the
// out-of-the-box (dev-bypass) setup just works; override per real account.
export const DEFAULT_IMPORT_ACCOUNT = "dev-shared-account";
