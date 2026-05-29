"use client";

import { useEffect } from "react";

// Bootstraps client-only side effects that should run once per app load.
// Currently: ask the browser to keep our IndexedDB on disk under storage
// pressure (matters on iOS WKWebView where unprivileged origins can be evicted).
export function SeedOnMount() {
  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.storage?.persist) {
      nav.storage.persist().catch(() => {
        // best-effort; ignore failures
      });
    }
  }, []);
  return null;
}
