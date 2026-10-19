"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Delete, History, X } from "lucide-react";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";
import type { Item } from "@/lib/types";

interface CountKeypadProps {
  item: Item;
  total: number;
  entryCount: number;
  swatch?: string;
  onAdd: (qty: number) => void;
  onSetTotal: (qty: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  className?: string;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "±", "0", "⌫"] as const;

// On-screen number pad for the matrix view. Mount with `key={item.id}` so the
// typed value resets whenever a different box is selected.
export function CountKeypad({
  item,
  total,
  entryCount,
  swatch,
  onAdd,
  onSetTotal,
  onPrev,
  onNext,
  onClose,
  className,
}: CountKeypadProps) {
  const [value, setValue] = useState("");
  const qty = value === "" || value === "-" ? Number.NaN : Number(value);
  const hasQty = Number.isFinite(qty);

  function press(key: (typeof KEYS)[number]) {
    haptic("tap");
    setValue((v) => {
      if (key === "⌫") return v.slice(0, -1);
      if (key === "±") return v.startsWith("-") ? v.slice(1) : `-${v}`;
      const digits = v.replace("-", "");
      if (digits.length >= 6) return v;
      if (digits === "0") return v.startsWith("-") ? `-${key}` : key;
      return v + key;
    });
  }

  function add() {
    if (!hasQty || qty === 0) return;
    onAdd(Math.trunc(qty));
  }

  function setTotal() {
    if (!hasQty) return;
    onSetTotal(Math.trunc(qty));
  }

  // Hardware keyboard support (tablet keyboards, desktop testing). Ignored
  // while typing in a real input such as the location field.
  const handlers = useRef({ press, add, setTotal, onClose, onPrev, onNext });
  useEffect(() => {
    handlers.current = { press, add, setTotal, onClose, onPrev, onNext };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const h = handlers.current;
      if (/^[0-9]$/.test(e.key)) h.press(e.key as (typeof KEYS)[number]);
      else if (e.key === "Backspace") h.press("⌫");
      else if (e.key === "-") h.press("±");
      else if (e.key === "Enter") h.add();
      else if (e.key === "=") h.setTotal();
      else if (e.key === "Escape") h.onClose();
      else if (e.key === "Tab") {
        if (e.shiftKey) h.onPrev?.();
        else h.onNext?.();
      } else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const preview = hasQty ? total + Math.trunc(qty) : total;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-border bg-surface p-3 shadow-xl sm:grid sm:gap-y-3 sm:p-4 sm:grid-cols-2 sm:content-start sm:gap-x-5 lg:flex",
        className
      )}
      role="dialog"
      aria-label={`Count ${item.name}`}
    >
      <div className="flex items-start gap-3 sm:col-start-1">
        {swatch && (
          <span
            className="mt-1 h-5 w-5 shrink-0 rounded-full border border-black/10"
            style={{ background: swatch }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight">{item.name}</p>
          <p className="truncate text-xs text-muted">{item.sku}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
          aria-label="Close keypad"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-end justify-between gap-3 rounded-xl bg-surface-2 px-4 py-2 sm:col-start-1 sm:py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Counted</p>
          <p className="text-2xl font-bold tabular-nums leading-none">{total}</p>
          <Link
            href={`/count/detail?id=${item.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            <History className="h-3.5 w-3.5" />
            {entryCount} entr{entryCount === 1 ? "y" : "ies"}
          </Link>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-4xl font-bold tabular-nums leading-none sm:text-5xl",
              !hasQty && "text-muted/40"
            )}
            aria-live="polite"
          >
            {value === "" ? "0" : value}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:col-start-2 sm:row-span-4 sm:row-start-1">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={cn(
              "flex h-11 items-center justify-center rounded-xl text-2xl font-semibold tabular-nums active:scale-95 sm:h-12 lg:h-14",
              k === "⌫" || k === "±"
                ? "bg-surface-2 text-muted"
                : "border border-border bg-surface text-foreground"
            )}
            aria-label={k === "⌫" ? "Backspace" : k === "±" ? "Toggle minus" : k}
          >
            {k === "⌫" ? <Delete className="h-6 w-6" /> : k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:col-start-1">
        <button
          type="button"
          onClick={setTotal}
          disabled={!hasQty || Math.trunc(qty) === total}
          className="h-12 rounded-xl border border-border bg-surface-2 px-2 sm:h-14 text-sm font-semibold leading-tight active:scale-[0.98] disabled:opacity-40"
        >
          Set total
          <span className="block text-xs font-normal text-muted">
            {hasQty ? `= ${Math.trunc(qty)}` : "replace count"}
          </span>
        </button>
        <button
          type="button"
          onClick={add}
          disabled={!hasQty || qty === 0}
          className="h-12 rounded-xl bg-primary px-2 sm:h-14 text-sm font-semibold leading-tight text-primary-fg active:scale-[0.98] disabled:opacity-40"
        >
          {hasQty && qty !== 0 ? `Add ${qty > 0 ? "+" : ""}${Math.trunc(qty)}` : "Add"}
          <span className="block text-xs font-normal opacity-80">
            {hasQty && qty !== 0 ? `total ${preview}` : "to this count"}
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between sm:col-start-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface-2 disabled:opacity-30"
        >
          Skip <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
