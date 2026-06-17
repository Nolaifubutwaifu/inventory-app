"use client";

import { useEffect } from "react";
import { useCurrentUserId } from "@/lib/auth";
import { startSync, stopSync } from "@/lib/sync/engine";

// Drives cross-device sync: starts the engine for the signed-in account and
// tears it down on sign-out / account switch. No-ops when sync isn't
// configured (see lib/sync/supabase.ts).
export function SyncProvider() {
  const userId = useCurrentUserId();

  useEffect(() => {
    if (!userId) return;
    void startSync(userId);
    return () => stopSync();
  }, [userId]);

  return null;
}
