import { createClient } from "@supabase/supabase-js";
import type { InvoiceImport } from "../types";
import { INVOICE_COLLECTION } from "./types";

const SYNC_TABLE = "sync_records";

// Server-side counterpart to lib/sync/supabase.ts. The client module is
// `"use client"` and no-ops during SSR, so the route needs its own client.
// The anon key is enough: the testing RLS policy lets anon read/write
// sync_records (see SUPABASE_SETUP.md).
export function isDeliveryConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Push one parsed invoice into the shared sync table so every device on the
// account picks it up through the normal realtime sync path. Throws on failure
// so the caller can report `delivered: false`.
export async function deliverInvoiceImport(record: InvoiceImport): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase sync is not configured on this server.");
  }

  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await sb.from(SYNC_TABLE).upsert(
    {
      collection: INVOICE_COLLECTION,
      id: record.id,
      account_id: record.userId,
      data: record,
      deleted: false,
      updated_at: Date.now(),
    },
    { onConflict: "collection,id" }
  );
  if (error) throw new Error(error.message);
}
