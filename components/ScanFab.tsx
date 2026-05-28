"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, ChevronRight, Loader2, X } from "lucide-react";
import { useItems } from "@/lib/hooks";
import { isScanEnabled } from "@/lib/scan/featureFlag";
import { fileToCompressedDataUrl, compressDataUrl } from "@/lib/scan/image";
import { displayPhoto } from "@/lib/utils";
import type {
  ScanCandidate,
  ScanError,
  ScanItemRef,
  ScanResponse,
} from "@/lib/scan/types";
import { ItemPhoto } from "./ItemPhoto";
import { Button } from "./Button";
import { haptic } from "@/lib/haptic";

type SheetState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; matches: ScanCandidate[] }
  | { kind: "error"; code: ScanError["error"] | "network"; message: string; retryAfterSec?: number };

export function ScanFab() {
  const router = useRouter();
  const items = useItems();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SheetState>({ kind: "idle" });
  const [countdown, setCountdown] = useState(0);

  // Tick down the rate-limit countdown.
  useEffect(() => {
    if (state.kind !== "error" || state.code !== "rate_limited" || !state.retryAfterSec)
      return;
    setCountdown(state.retryAfterSec);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  if (!isScanEnabled()) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    haptic("tap");
    setOpen(true);
    setState({ kind: "loading" });
    try {
      const queryImage = await fileToCompressedDataUrl(file, {
        maxEdge: 1280,
        quality: 0.82,
      });

      const catalog = items ?? [];
      const refItems: ScanItemRef[] = [];
      for (const it of catalog) {
        const refs = it.referencePhotos ?? [];
        const fallback = it.photoUrl ? [it.photoUrl] : [];
        const source = refs.length > 0 ? refs : fallback;
        if (source.length === 0) continue;
        // Down-size again server-side budget: 2 refs/item max, 768px each.
        const compressed: string[] = [];
        for (const r of source.slice(0, 2)) {
          try {
            compressed.push(await compressDataUrl(r, { maxEdge: 768, quality: 0.78 }));
          } catch {
            compressed.push(r);
          }
        }
        refItems.push({
          id: it.id,
          name: it.name,
          sku: it.sku,
          color: it.color || undefined,
          size: it.size || undefined,
          category: it.category || undefined,
          referencePhotos: compressed,
        });
      }

      if (refItems.length === 0) {
        setState({
          kind: "error",
          code: "no_items",
          message:
            "No items have reference photos yet. Add a few per item, then try again.",
        });
        return;
      }

      const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryImage, items: refItems }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as ScanError | null;
        setState({
          kind: "error",
          code: err?.error ?? "model_error",
          message:
            err?.message ??
            (res.status === 503
              ? "AI scan isn't configured on this server."
              : "AI scan failed. Try again."),
          retryAfterSec: err?.retryAfterSec,
        });
        haptic("warning");
        return;
      }
      const data = (await res.json()) as ScanResponse;
      const sorted = [...data.topMatches].sort((a, b) => b.confidence - a.confidence);
      setState({ kind: "results", matches: sorted });
      haptic("success");
    } catch (err: unknown) {
      setState({
        kind: "error",
        code: "network",
        message:
          err instanceof Error
            ? err.message
            : "Couldn't reach the scan service. Check your connection.",
      });
      haptic("warning");
    }
  }

  function close() {
    setOpen(false);
    setTimeout(() => setState({ kind: "idle" }), 200);
  }

  function pickCandidate(c: ScanCandidate) {
    haptic("tap");
    setOpen(false);
    router.push(`/count/detail?id=${c.itemId}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="fixed bottom-24 right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/30 active:scale-95"
        aria-label="Scan item with camera"
      >
        <Camera className="h-7 w-7" />
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-xl rounded-t-3xl bg-surface p-4 pb-8 shadow-2xl"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-2" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Scan result</h2>
              <button
                type="button"
                onClick={close}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <SheetBody
              state={state}
              items={items ?? []}
              onPick={pickCandidate}
              onRetake={() => fileRef.current?.click()}
              countdown={countdown}
            />
          </div>
        </div>
      )}
    </>
  );
}

function SheetBody({
  state,
  items,
  onPick,
  onRetake,
  countdown,
}: {
  state: SheetState;
  items: ReturnType<typeof useItems> extends infer T ? Exclude<T, undefined> : never;
  onPick: (c: ScanCandidate) => void;
  onRetake: () => void;
  countdown: number;
}) {
  if (state.kind === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted">Identifying item…</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0">
            <p className="font-medium">Couldn’t identify</p>
            <p className="mt-0.5 text-sm text-muted">
              {state.message}
              {state.code === "rate_limited" && countdown > 0 && (
                <> Try again in {countdown}s.</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onRetake} block>
            <Camera className="h-5 w-5" /> Retake
          </Button>
        </div>
      </div>
    );
  }

  if (state.kind === "results") {
    const visible = state.matches.slice(0, 3);
    if (visible.length === 0) {
      return (
        <div className="space-y-4 py-2">
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
            No candidates returned.
          </p>
          <Button variant="secondary" onClick={onRetake} block>
            <Camera className="h-5 w-5" /> Retake
          </Button>
        </div>
      );
    }
    const top = visible[0];
    const weak = top.confidence < 0.5;
    return (
      <div className="space-y-3 py-1">
        {weak && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>Weak match — pick carefully, or retake from a clearer angle.</span>
          </div>
        )}
        <ul className="space-y-2">
          {visible.map((c) => {
            const item = items.find((i) => i.id === c.itemId);
            if (!item) return null;
            const pct = Math.round(c.confidence * 100);
            return (
              <li key={c.itemId}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-left transition active:scale-[0.99]"
                >
                  <ItemPhoto src={displayPhoto(item)} alt={item.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted">{item.sku}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted">{pct}%</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="ghost" onClick={onRetake} block size="sm">
          <Camera className="h-4 w-4" /> Retake
        </Button>
      </div>
    );
  }

  return null;
}
