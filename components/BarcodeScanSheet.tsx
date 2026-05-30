"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import type { Result } from "@zxing/library";
import { AlertTriangle, Camera, ChevronRight, Loader2, X } from "lucide-react";
import { Button } from "./Button";
import { ItemPhoto } from "./ItemPhoto";
import { findItemByBarcode } from "@/lib/repo";
import { displayPhoto } from "@/lib/utils";
import { haptic } from "@/lib/haptic";
import type { Item } from "@/lib/types";

export type BarcodeScanResult =
  | { kind: "match"; item: Item; code: string }
  | { kind: "no-match"; code: string }
  | { kind: "captured"; code: string };

interface BarcodeScanSheetProps {
  open: boolean;
  mode: "lookup" | "capture";
  onClose: () => void;
  onResult: (result: BarcodeScanResult) => void;
}

type SheetState =
  | { kind: "scanning" }
  | { kind: "no-camera"; message: string }
  | { kind: "no-match"; code: string }
  | { kind: "match"; item: Item; code: string };

// Live-camera barcode scanner. Two modes:
//  - "lookup":  decode -> find item by barcode -> success card OR no-match card
//  - "capture": decode -> return code immediately via onResult (caller closes)
export function BarcodeScanSheet({
  open,
  mode,
  onClose,
  onResult,
}: BarcodeScanSheetProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const decodedOnceRef = useRef(false);
  const [state, setState] = useState<SheetState>({ kind: "scanning" });

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const handleDecode = useCallback(
    async (raw: string) => {
      if (decodedOnceRef.current) return;
      decodedOnceRef.current = true;
      const code = raw.trim();
      haptic("success");
      stop();
      if (mode === "capture") {
        onResult({ kind: "captured", code });
        return;
      }
      const item = await findItemByBarcode(code);
      if (item) {
        setState({ kind: "match", item, code });
      } else {
        setState({ kind: "no-match", code });
      }
    },
    [mode, onResult, stop]
  );

  useEffect(() => {
    if (!open) return;
    decodedOnceRef.current = false;
    setState({ kind: "scanning" });
    const reader = new BrowserMultiFormatReader();

    let cancelled = false;
    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result: Result | undefined) => {
            if (result) handleDecode(result.getText());
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access in your browser settings."
            : err instanceof Error
              ? err.message
              : "Couldn't open the camera.";
        setState({ kind: "no-camera", message });
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, handleDecode, stop]);

  if (!open) return null;

  function rescan() {
    decodedOnceRef.current = false;
    setState({ kind: "scanning" });
    const video = videoRef.current;
    if (!video) return;
    const reader = new BrowserMultiFormatReader();
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        video,
        (result: Result | undefined) => {
          if (result) handleDecode(result.getText());
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Couldn't open the camera.";
        setState({ kind: "no-camera", message });
      });
  }

  function pickMatch(item: Item, code: string) {
    haptic("tap");
    onResult({ kind: "match", item, code });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-xl rounded-t-3xl bg-surface p-4 pb-8 shadow-2xl"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-surface-2" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "capture" ? "Scan barcode" : "Barcode scan"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video preview is always mounted (the ref must exist for ZXing) */}
        <div
          className={`relative overflow-hidden rounded-2xl bg-black ${
            state.kind === "scanning" ? "block" : "hidden"
          }`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-3/4 rounded-xl border-2 border-white/70" />
          </div>
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2 text-xs text-white/80">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aim at the barcode
          </div>
        </div>

        {state.kind === "no-camera" && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="font-medium">Camera unavailable</p>
                <p className="mt-0.5 text-sm text-muted">{state.message}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={onClose} block>
              Close
            </Button>
          </div>
        )}

        {state.kind === "match" && (
          <div className="space-y-3 py-1">
            <button
              type="button"
              onClick={() => pickMatch(state.item, state.code)}
              className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft p-3 text-left transition active:scale-[0.99]"
            >
              <ItemPhoto
                src={displayPhoto(state.item)}
                alt={state.item.name}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{state.item.name}</p>
                <p className="truncate text-xs text-muted">{state.item.sku}</p>
                <p className="mt-1 truncate text-[11px] text-muted">
                  Barcode: {state.code}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </button>
            <Button variant="ghost" onClick={rescan} block size="sm">
              <Camera className="h-4 w-4" /> Scan another
            </Button>
          </div>
        )}

        {state.kind === "no-match" && (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="font-medium">No item matches this barcode</p>
                <p className="mt-0.5 break-all text-xs text-muted">
                  {state.code}
                </p>
                <p className="mt-1.5 text-sm text-muted">
                  Open the item in your catalog and paste this code into the
                  Barcode field to link it.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={rescan} block>
                <Camera className="h-5 w-5" /> Scan again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
