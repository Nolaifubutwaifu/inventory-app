"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-40 mx-auto flex w-full max-w-xl justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1.5 text-xs font-medium text-warning ring-1 ring-warning/30">
        <CloudOff className="h-3.5 w-3.5" />
        Offline — your work is saved on this device
      </div>
    </div>
  );
}
