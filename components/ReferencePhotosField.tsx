"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/scan/image";

interface ReferencePhotosFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  recommended?: number;
}

export function ReferencePhotosField({
  value,
  onChange,
  recommended = 4,
}: ReferencePhotosFieldProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const next = [...value];
      for (const f of files) {
        const url = await fileToCompressedDataUrl(f, { maxEdge: 1024, quality: 0.78 });
        next.push(url);
      }
      onChange(next);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAt(i: number) {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  }

  const hint =
    value.length === 0
      ? `Add ${recommended} angles for the best scan results (front, side, top, label).`
      : value.length < recommended
        ? `${value.length} of ${recommended} recommended. Add more angles for accuracy.`
        : `${value.length} reference photo${value.length === 1 ? "" : "s"}.`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="block text-sm font-medium text-foreground">
          Reference photos for AI scan
        </label>
        <span className="text-[11px] uppercase tracking-wider text-muted">Optional</span>
      </div>
      <p className="text-xs text-muted">{hint}</p>
      <div className="grid grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Reference ${i + 1}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white shadow active:scale-95"
              aria-label="Remove photo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-surface-2 text-muted active:scale-95 disabled:opacity-50"
          aria-label="Add reference photo"
        >
          <Camera className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wider">
            {busy ? "…" : "Add"}
          </span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
