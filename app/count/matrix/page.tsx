"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, List, MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { CountKeypad } from "@/components/CountKeypad";
import { useToast } from "@/components/Toast";
import { useActiveSession, useEntriesForSession, useItems } from "@/lib/hooks";
import { addEntry, createItem } from "@/lib/repo";
import {
  buildMatrixGroups,
  groupOrder,
  inkFor,
  SPARE_PARTS,
  swatchFor,
  type MatrixGroup,
} from "@/lib/matrix";
import { haptic } from "@/lib/haptic";
import { cn, formatDate, suggestSkuFromName } from "@/lib/utils";
import type { Item } from "@/lib/types";

const GROUP_KEY = "inventory:matrixGroup";

interface Tally {
  total: number;
  count: number;
}

export default function MatrixCountPage() {
  const session = useActiveSession();
  const items = useItems();
  const entries = useEntriesForSession(session?.id);
  const toast = useToast();

  // Last-viewed sheet on this device. The grid only renders once IndexedDB has
  // loaded, so reading storage up front can't cause a hydration mismatch.
  const [groupName, setGroupName] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(GROUP_KEY);
    } catch {
      return null;
    }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const groups = useMemo(() => buildMatrixGroups(items ?? []), [items]);

  const tallies = useMemo(() => {
    const map = new Map<string, Tally>();
    for (const e of entries ?? []) {
      const t = map.get(e.itemId) ?? { total: 0, count: 0 };
      t.total += e.quantity;
      t.count += 1;
      map.set(e.itemId, t);
    }
    return map;
  }, [entries]);

  const recentLocations = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries ?? []) {
      const l = e.location?.trim();
      if (l) seen.add(l);
      if (seen.size >= 12) break;
    }
    return Array.from(seen);
  }, [entries]);

  const group: MatrixGroup | undefined =
    groups.find((g) => g.name === groupName) ?? groups[0];
  const order = useMemo(() => (group ? groupOrder(group) : []), [group]);
  const activeIndex = activeId ? order.findIndex((it) => it.id === activeId) : -1;
  const active = activeIndex >= 0 ? order[activeIndex] : undefined;

  function selectGroup(name: string) {
    setGroupName(name);
    setActiveId(null);
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
    try {
      window.localStorage.setItem(GROUP_KEY, name);
    } catch {
      // ignore
    }
  }

  // Keep the selected box visible (sticky header / colour column included,
  // via the cells' scroll-margin).
  useEffect(() => {
    if (!activeId) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-item-id="${CSS.escape(activeId)}"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeId]);

  function step(delta: 1 | -1) {
    if (activeIndex < 0) return;
    const next = order[activeIndex + delta];
    setActiveId(next ? next.id : null);
  }

  async function record(item: Item, quantity: number, note?: string) {
    if (!session) return;
    await addEntry({
      sessionId: session.id,
      itemId: item.id,
      quantity,
      location: location.trim(),
      ...(note ? { notes: note } : {}),
    });
  }

  async function onAdd(qty: number) {
    if (!active) return;
    const item = active;
    const before = tallies.get(item.id)?.total ?? 0;
    step(1);
    await record(item, qty);
    haptic("success");
    toast.show(`${item.name}: ${qty > 0 ? "+" : ""}${qty} → ${before + qty}`, "success");
  }

  async function onSetTotal(target: number) {
    if (!active) return;
    const item = active;
    const before = tallies.get(item.id)?.total ?? 0;
    const diff = target - before;
    step(1);
    if (diff === 0) return;
    await record(item, diff, `Set total to ${target}`);
    haptic("success");
    toast.show(`${item.name}: total set to ${target}`, "success");
  }

  async function onCreatePart(name: string, select: boolean) {
    const existing = items?.find(
      (it) => it.category === SPARE_PARTS && it.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      toast.show(`${existing.name} is already on the list`);
      if (select) setActiveId(existing.id);
      return;
    }
    const item = await createItem({
      name,
      sku: suggestSkuFromName(name, items ?? []),
      category: SPARE_PARTS,
      color: "",
      size: name.match(/\b\d+L\b/i)?.[0].toUpperCase() ?? "",
      notes: "",
    });
    haptic("success");
    toast.show(`Added ${item.name}`, "success");
    if (select) setActiveId(item.id);
  }

  if (session === undefined && items === undefined) {
    return <PageHeader title="Matrix count" back="/count" />;
  }

  if (!session) {
    return (
      <>
        <PageHeader title="Matrix count" back="/count" />
        <div className="mx-auto max-w-xl p-4">
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Boxes className="h-7 w-7" />
            </div>
            <p className="mt-4 font-semibold">No active session</p>
            <p className="mt-1 text-sm text-muted">
              Start a stocktake session to begin counting items.
            </p>
            <Link href="/sessions/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-5 w-5" /> New session
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  const keypad = active ? (
    <CountKeypad
      key={active.id}
      item={active}
      total={tallies.get(active.id)?.total ?? 0}
      entryCount={tallies.get(active.id)?.count ?? 0}
      swatch={swatchFor(active.color)}
      onAdd={onAdd}
      onSetTotal={onSetTotal}
      onPrev={activeIndex > 0 ? () => step(-1) : undefined}
      onNext={activeIndex < order.length - 1 ? () => step(1) : undefined}
      onClose={() => setActiveId(null)}
      className="h-full overflow-y-auto"
    />
  ) : null;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh - 4rem - var(--safe-bottom) - var(--safe-top))" }}
    >
      <PageHeader
        title="Matrix count"
        subtitle={`${session.name} · ${formatDate(session.createdAt)}`}
        back="/count"
        right={
          <Link href="/count">
            <Button size="sm" variant="secondary">
              <List className="h-4 w-4" /> List
            </Button>
          </Link>
        }
      />

      <div className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1">
          {groups.map((g) => {
            const members = groupOrder(g);
            const done = members.filter((it) => (tallies.get(it.id)?.count ?? 0) > 0).length;
            const selected = g.name === group?.name;
            return (
              <button
                key={g.name}
                type="button"
                onClick={() => selectGroup(g.name)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                  selected
                    ? "bg-primary text-primary-fg"
                    : "border border-border bg-surface text-muted"
                )}
              >
                {g.name}
                <span className={cn("ml-2 tabular-nums", selected ? "opacity-80" : "")}>
                  {done}/{members.length}
                </span>
              </button>
            );
          })}
        </div>
        <label className="relative flex w-32 shrink-0 items-center sm:w-56">
          <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            list="matrix-locations"
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 outline-none focus:border-primary"
          />
          <datalist id="matrix-locations">
            {recentLocations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>
      </div>

      {items?.length === 0 ? (
        <div className="mx-auto w-full max-w-xl p-4">
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="font-semibold">No items in the catalog</p>
            <p className="mt-1 text-sm text-muted">
              Add your bins and lids first so you can count them.
            </p>
            <Link href="/items/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-5 w-5" /> Add item
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            ref={scrollRef}
            className="min-w-0 flex-1 overflow-auto overscroll-contain"
          >
            {group && (
              <MatrixTable
                group={group}
                tallies={tallies}
                activeId={activeId}
                onSelect={(id) => {
                  haptic("tap");
                  setActiveId((cur) => (cur === id ? null : id));
                }}
                onCreatePart={group.name === SPARE_PARTS ? onCreatePart : undefined}
              />
            )}
          </div>

          {/* One keypad instance (it owns keyboard shortcuts). It takes its
              own space rather than floating, so the grid shrinks and the
              selected box can always scroll into view: below the grid on
              narrow screens, beside it on wide ones. */}
          {keypad && (
            <aside className="max-h-[62dvh] shrink-0 overflow-y-auto border-t border-border lg:max-h-none lg:w-[22rem] lg:border-l lg:border-t-0">
              {keypad}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function MatrixTable({
  group,
  tallies,
  activeId,
  onSelect,
  onCreatePart,
}: {
  group: MatrixGroup;
  tallies: Map<string, Tally>;
  activeId: string | null;
  onSelect: (id: string) => void;
  // Set on the spare parts sheet: adds blank rows that create new parts.
  onCreatePart?: (name: string, select: boolean) => Promise<void>;
}) {
  const hasGrid = group.rows.length > 0;
  const showParts = group.columns.some((c) => c.part !== "") && group.columns.length > group.sizes.length;

  const columnTotals = group.columns.map((col) =>
    group.rows.reduce((sum, row) => {
      const it = row.cells.get(col.key);
      return sum + (it ? tallies.get(it.id)?.total ?? 0 : 0);
    }, 0)
  );

  return (
    <div className="space-y-6 p-3 sm:p-4">
      {hasGrid && (
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                rowSpan={showParts ? 2 : 1}
                className="sticky left-0 top-0 z-30 min-w-[8.5rem] border-b border-r border-border bg-surface-2 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Colour
              </th>
              {group.sizes.map((s, i) => (
                <th
                  key={s.size}
                  colSpan={s.columns.length}
                  className={cn(
                    "sticky top-0 z-20 h-9 border-b border-border bg-primary px-2 text-center text-sm font-bold text-primary-fg",
                    i > 0 && "border-l-2 border-l-white/60"
                  )}
                >
                  {s.size}
                </th>
              ))}
            </tr>
            {showParts && (
              <tr>
                {group.sizes.map((s, si) =>
                  s.columns.map((c, ci) => (
                    <th
                      key={c.key}
                      className={cn(
                        "sticky top-9 z-20 h-7 border-b border-border bg-surface-2 px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted",
                        si > 0 && ci === 0 && "border-l-2 border-l-border"
                      )}
                    >
                      {c.part || "—"}
                    </th>
                  ))
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {group.rows.map((row) => {
              const swatch = swatchFor(row.color);
              return (
                <tr key={row.color}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 text-left font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                        style={{ background: swatch ?? "transparent" }}
                      />
                      <span className="whitespace-nowrap">{row.color}</span>
                    </span>
                  </th>
                  {group.sizes.map((s, si) =>
                    s.columns.map((col, ci) => {
                      const it = row.cells.get(col.key);
                      const edge = si > 0 && ci === 0 && "border-l-2 border-l-border";
                      if (!it) {
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "h-12 min-w-[3.25rem] border-b border-l border-border bg-surface-2/60",
                              edge
                            )}
                            aria-hidden
                          />
                        );
                      }
                      const t = tallies.get(it.id);
                      const isActive = it.id === activeId;
                      return (
                        <td
                          key={col.key}
                          className={cn("h-12 border-b border-l border-border p-0", edge)}
                        >
                          <button
                            type="button"
                            data-item-id={it.id}
                            onClick={() => onSelect(it.id)}
                            aria-label={`${it.name}: ${t ? t.total : "not counted"}`}
                            aria-pressed={isActive}
                            // Boxes take their row's colour so a colour can be
                            // followed across the sheet; the selected box keeps
                            // it and gets a heavy outline instead.
                            style={
                              swatch
                                ? {
                                    background: swatch,
                                    color: inkFor(swatch),
                                    // White inner + dark outer ring shows on every row colour.
                                    ...(isActive && {
                                      boxShadow: "inset 0 0 0 3px #ffffff, 0 0 0 3px #0f172a",
                                    }),
                                  }
                                : undefined
                            }
                            className={cn(
                              "flex h-12 w-full min-w-[3.25rem] scroll-ml-40 scroll-mt-20 items-center justify-center text-lg font-semibold tabular-nums",
                              !swatch &&
                                (t ? "bg-primary-soft/60 text-foreground" : "bg-surface text-muted/40"),
                              isActive &&
                                (swatch
                                  ? "relative z-[5]"
                                  : "relative z-[5] bg-primary text-primary-fg ring-2 ring-primary ring-offset-2 ring-offset-surface")
                            )}
                          >
                            {t ? (
                              t.total
                            ) : (
                              <span className={swatch ? "opacity-60" : undefined}>·</span>
                            )}
                          </button>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 border-r border-border bg-surface-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Total
              </th>
              {group.sizes.map((s, si) =>
                s.columns.map((col, ci) => {
                  const idx = group.columns.findIndex((c) => c.key === col.key);
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "border-l border-border bg-surface-2 px-1 py-2 text-center font-bold tabular-nums",
                        si > 0 && ci === 0 && "border-l-2 border-l-border"
                      )}
                    >
                      {columnTotals[idx] || ""}
                    </td>
                  );
                })
              )}
            </tr>
          </tfoot>
        </table>
      )}

      {(group.loose.length > 0 || !hasGrid) && (
        <section className="max-w-xl">
          {hasGrid && (
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Other items
            </h2>
          )}
          {/* Two-column list, like the paper spare parts sheet. */}
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-border text-sm">
            <thead>
              <tr>
                <th className="h-9 border-b border-border bg-surface-2 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Item
                </th>
                <th className="h-9 w-28 border-b border-l border-border bg-surface-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {group.loose.map((it, i) => {
                const t = tallies.get(it.id);
                const isActive = it.id === activeId;
                return (
                  <tr
                    key={it.id}
                    onClick={() => onSelect(it.id)}
                    className={cn(
                      "cursor-pointer",
                      // Light zebra tint so each part row is easy to follow across.
                      isActive
                        ? "bg-primary text-primary-fg"
                        : i % 2 === 0
                          ? "bg-primary-soft/70"
                          : "bg-primary-soft"
                    )}
                  >
                    <td className="h-12 border-b border-border px-4 font-medium">{it.name}</td>
                    <td className="h-12 border-b border-l border-border p-0">
                      <button
                        type="button"
                        data-item-id={it.id}
                        aria-label={`${it.name}: ${t ? t.total : "not counted"}`}
                        aria-pressed={isActive}
                        className={cn(
                          "flex h-12 w-full scroll-mt-12 items-center justify-center text-lg font-semibold tabular-nums",
                          !t && !isActive && "text-muted/40"
                        )}
                      >
                        {t ? t.total : "·"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {onCreatePart &&
                Array.from({ length: BLANK_PART_ROWS }, (_, i) => (
                  <BlankPartRow key={i} onCreate={onCreatePart} />
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const BLANK_PART_ROWS = 3;

// An empty row: tap the name cell, type a part name, and it becomes a real
// catalog item (Enter also opens the keypad on it).
function BlankPartRow({
  onCreate,
}: {
  onCreate: (name: string, select: boolean) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const busy = useRef(false);

  async function commit(select: boolean) {
    const trimmed = name.trim();
    if (!trimmed || busy.current) return;
    busy.current = true;
    try {
      await onCreate(trimmed, select);
      setName("");
    } finally {
      busy.current = false;
    }
  }

  return (
    // Warm tint marks the rows that are still free to name.
    <tr className="bg-warning/20">
      <td className="h-12 border-b border-border p-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void commit(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit(true);
              e.currentTarget.blur();
            }
          }}
          placeholder="Tap to name a part…"
          enterKeyHint="done"
          autoComplete="off"
          className="h-12 w-full bg-transparent px-4 font-medium outline-none placeholder:font-normal placeholder:text-warning focus:bg-surface"
        />
      </td>
      <td className="h-12 border-b border-l border-border text-center text-warning/60">—</td>
    </tr>
  );
}
