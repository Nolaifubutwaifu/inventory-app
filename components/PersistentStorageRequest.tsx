"use client";

import { useEffect } from "react";

// Ask the browser to mark our origin's storage as "persistent" so the OS won't
// silently evict IndexedDB under storage pressure (or, on iOS/WebKit, after a
// few days of the app going unused). Best-effort and idempotent: if the browser
// doesn't support the API, or declines the request, the app keeps working
// exactly as before — this only ever *reduces* the chance of local data loss.
export function PersistentStorageRequest() {
  useEffect(() => {
    const storage = navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    void (async () => {
      try {
        // Don't re-prompt if we're already persisted.
        if (await storage.persisted()) return;
        await storage.persist();
      } catch {
        // Ignore — storage manager unavailable or request rejected.
      }
    })();
  }, []);

  return null;
}
