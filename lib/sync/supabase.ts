"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cross-device sync is opt-in: when these env vars are absent the whole sync
// layer no-ops and the app runs purely local (IndexedDB only), exactly as it
// did before. Set them in .env.local / Vercel to turn syncing on.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSyncConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

// Lazily create a single browser client. Returns null when sync is not
// configured or when called during SSR.
export function getSupabase(): SupabaseClient | null {
  if (!isSyncConfigured) return null;
  if (typeof window === "undefined") return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}
