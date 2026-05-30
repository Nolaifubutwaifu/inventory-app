"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Minus, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ItemPhoto } from "@/components/ItemPhoto";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  useActiveSession,
  useEntriesForItem,
  useEntriesForSession,
  useItem,
} from "@/lib/hooks";
import { addEntry, deleteEntry, updateEntry } from "@/lib/repo";
import { displayPhoto, formatDateTime } from "@/lib/utils";
import { haptic } from "@/lib/haptic";
import type { CountEntry } from "@/lib/types";

const STEPS = [-10, -1, 1, 5, 10] as const;

export default function CountItemPage() {
  return (
    <Suspense fallback={<PageHeader title="Item" back="/count" />}>
      <CountItemInner />
    </Suspense>
  );
}

function CountItemInner() {
  const itemId = useSearchParams().get("id") ?? "";
  const session = useActiveSession();
  const item = useItem(itemId);
  const entries = useEntriesForItem(session?.id, itemId);
  const allEntries = useEntriesForSession(session?.id);
  const toast = useToast();
  const confirm = useConfirm();

  const recentLocations = useMemo(() => {
    if (!allEntries) return [];
    const seen = new Set<string>();
    const locs: string[] = [];
    for (const e of allEntries) {
      const l = e.location?.trim();
      if (!l || seen.has(l)) continue;
      seen.add(l);
      locs.push(l);
      if (locs.length >= 8) break;
    }
    return locs;
  }, [allEntries]);

  const [qty, setQty] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const justAddedRef = useRef(false);

  const total = entries?.reduce((sum, e) => sum + e.quantity, 0) ?? 0;
  const numericQty = qty === "" || qty === "-" ? NaN : Number(qty);

  // Focus the qty input on first render
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!session) {
    return (
      <>
        <PageHeader title="Count" back="/count" />
        <div className="p-4 text-muted">No active session.</div>
      </>
    );
  }
  if (!item) {
    return (
      <>
        <PageHeader title="Item" back="/count" />
        <div className="p-4 text-muted">Loading…</div>
      </>
    );
  }

  function adjust(delta: number) {
    haptic("tap");
    const current = Number.isFinite(numericQty) ? numericQty : 0;
    const next = current + delta;
    setQty(String(next));
    inputRef.current?.focus();
  }

  async function onAdd() {
    if (busy || !session || !item) return;
    if (!Number.isFinite(numericQty) || numericQty === 0) return;
    setBusy(true);
    try {
      await addEntry({
        sessionId: session.id,
        itemId: item.id,
        quantity: Math.trunc(numericQty),
        location: location.trim(),
      });
      const newTotal = total + Math.trunc(numericQty);
      setQty("");
      justAddedRef.current = true;
      haptic("success");
      toast.show(
        `Added ${numericQty > 0 ? "+" : ""}${Math.trunc(numericQty)} · total ${newTotal}`,
        "success"
      );
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteEntry(id: string) {
    const ok = await confirm({
      title: "Delete this count?",
      message: "This will remove the entry from the session history.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await deleteEntry(id);
    haptic("warning");
    toast.show("Entry deleted");
  }

  async function onSaveEdit(entry: CountEntry, newQty: number, newLoc: string) {
    await updateEntry(entry.id, { quantity: Math.trunc(newQty), location: newLoc });
    setEditingId(null);
    toast.show("Saved");
  }

  return (
    <>
      <PageHeader title={item.name} subtitle={`${item.sku} · ${item.color}`} back="/count" />

      <div className="space-y-4 p-4 pb-44">
        {/* Hero: total card */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
          <ItemPhoto src={displayPhoto(item)} alt={item.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted">
              Total in this session
            </p>
            <p className="text-5xl font-bold tabular-nums leading-none mt-1">{total}</p>
            <p className="mt-2 text-xs text-muted">
              {entries?.length ?? 0} entr
              {(entries?.length ?? 0) === 1 ? "y" : "ies"} · {item.size}
            </p>
          </div>
        </div>

        {/* Counter card */}
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-foreground">Quantity found</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjust(-1)}
              onMouseDown={(e) => e.preventDefault()}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-foreground active:scale-95"
              aria-label="Minus one"
            >
              <Minus className="h-6 w-6" />
            </button>
            <input
              ref={inputRef}
              inputMode="numeric"
              pattern="-?[0-9]*"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9-]/g, ""))}
              placeholder="0"
              className="h-16 min-w-0 flex-1 rounded-2xl border-2 border-border bg-surface-2 px-3 text-center text-4xl font-bold tabular-nums outline-none focus:border-primary focus:bg-surface placeholder:text-muted/40"
            />
            <button
              type="button"
              onClick={() => adjust(1)}
              onMouseDown={(e) => e.preventDefault()}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-fg active:scale-95"
              aria-label="Plus one"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STEPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => adjust(s)}
                onMouseDown={(e) => e.preventDefault()}
                className="rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-sm font-semibold tabular-nums active:scale-95"
              >
                {s > 0 ? `+${s}` : s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setQty("");
                inputRef.current?.focus();
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="ml-auto rounded-full px-3 py-1.5 text-sm font-medium text-muted"
            >
              Clear
            </button>
          </div>

          <div className="pt-1">
            <Input
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Aisle 3"
            />
            {recentLocations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {recentLocations.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocation(l)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium active:scale-95"
                  >
                    <MapPin className="h-3.5 w-3.5" /> {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Count history
          </h2>
          {entries?.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">
              No counts yet — enter a quantity and tap Add.
            </p>
          )}
          <ul className="space-y-2">
            {entries?.map((e) =>
              editingId === e.id ? (
                <EditEntryRow
                  key={e.id}
                  entry={e}
                  onCancel={() => setEditingId(null)}
                  onSave={(q, l) => onSaveEdit(e, q, l)}
                />
              ) : (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => setEditingId(e.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-base font-medium">
                      {e.location || <span className="text-muted">No location</span>}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        e.quantity < 0
                          ? "text-xl font-semibold tabular-nums text-danger"
                          : "text-xl font-semibold tabular-nums"
                      }
                    >
                      {e.quantity > 0 ? "+" : ""}
                      {e.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(e.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        </section>
      </div>

      {/* Sticky Add button — sits above BottomNav including its safe-area padding */}
      <div
        className="fixed inset-x-0 z-30 mx-auto w-full max-w-xl border-t border-border bg-surface/95 backdrop-blur"
        style={{ bottom: "calc(4rem + var(--safe-bottom))" }}
      >
        <div className="flex items-center gap-2 p-3">
          <Button
            size="lg"
            block
            onClick={onAdd}
            disabled={busy || !Number.isFinite(numericQty) || numericQty === 0}
          >
            {Number.isFinite(numericQty) && numericQty !== 0
              ? `Add ${numericQty > 0 ? "+" : ""}${Math.trunc(numericQty)}  →  total ${
                  total + Math.trunc(numericQty)
                }`
              : "Enter a quantity"}
          </Button>
        </div>
      </div>
    </>
  );
}

function EditEntryRow({
  entry,
  onCancel,
  onSave,
}: {
  entry: CountEntry;
  onCancel: () => void;
  onSave: (qty: number, location: string) => void;
}) {
  const [q, setQ] = useState(String(entry.quantity));
  const [l, setL] = useState(entry.location);
  return (
    <li className="space-y-3 rounded-xl border border-primary bg-primary-soft/30 p-3">
      <Input
        label="Quantity"
        inputMode="numeric"
        pattern="-?[0-9]*"
        value={q}
        onChange={(e) => setQ(e.target.value.replace(/[^0-9-]/g, ""))}
        autoFocus
      />
      <Input label="Location" value={l} onChange={(e) => setL(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} block>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => onSave(Number(q), l.trim())}
          block
          disabled={!q || Number(q) === 0}
        >
          Save
        </Button>
      </div>
    </li>
  );
}
