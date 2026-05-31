"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw } from "lucide-react";

export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    // Skip when running inside the Capacitor native shell — assets are
    // already bundled and SW caching would only add coherence problems.
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (w.Capacitor?.isNativePlatform?.()) return;

    let cancelled = false;

    const handle = (reg: ServiceWorkerRegistration) => {
      if (cancelled) return;

      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaiting(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (
            sw.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setWaiting(sw);
          }
        });
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(handle)
      .catch((err) => {
        console.warn("SW register failed:", err);
      });

    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  if (!waiting) return null;

  const apply = () => {
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 mx-auto flex w-full max-w-xl justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <div className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-background shadow-lg">
        <Download className="h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm font-medium leading-tight">
          A newer version is ready.
        </p>
        <button
          onClick={apply}
          className="-mr-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-background/15 px-3 text-xs font-semibold backdrop-blur-sm active:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Update
        </button>
      </div>
    </div>
  );
}
