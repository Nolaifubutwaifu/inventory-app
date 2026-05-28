"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, CircleCheck, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { ItemPhoto } from "@/components/ItemPhoto";
import { ScanFab } from "@/components/ScanFab";
import { useActiveSession, useItemsWithTotals } from "@/lib/hooks";
import { displayPhoto, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export default function CountPage() {
  const session = useActiveSession();
  const items = useItemsWithTotals(session?.id);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "counted" | "not-counted">("all");
  const [category, setCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    if (!items) return [];
    const set = new Set<string>();
    for (const it of items) if (it.category) set.add(it.category);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const query = q.trim().toLowerCase();
    let list = items;
    if (filter === "counted") list = list.filter((i) => i.total > 0);
    if (filter === "not-counted") list = list.filter((i) => i.total === 0);
    if (category !== ALL) list = list.filter((i) => i.category === category);
    if (!query) return list;
    return list.filter((i) =>
      [i.name, i.sku, i.color, i.size, i.category]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, q, filter, category]);

  const counted = items?.filter((i) => i.total > 0).length ?? 0;

  if (!session) {
    return (
      <>
        <PageHeader title="Count" />
        <div className="space-y-4 p-4">
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

  return (
    <>
      <PageHeader
        title="Count"
        subtitle={`${session.name} · ${formatDate(session.createdAt)}`}
      />
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CircleCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {counted} of {items?.length ?? 0} items counted
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(items?.length ?? 0) === 0 ? 0 : Math.round((counted / (items?.length ?? 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items"
            className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-base outline-none focus:border-primary"
            inputMode="search"
            autoComplete="off"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          <Chip active={filter === "counted"} onClick={() => setFilter("counted")}>
            Counted ({counted})
          </Chip>
          <Chip
            active={filter === "not-counted"}
            onClick={() => setFilter("not-counted")}
          >
            Remaining ({(items?.length ?? 0) - counted})
          </Chip>
        </div>

        {categories.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={category === ALL} onClick={() => setCategory(ALL)}>
              All categories
            </Chip>
            {categories.map((c) => (
              <Chip
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </Chip>
            ))}
          </div>
        )}

        {items && items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
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
        ) : (
          <ul className="space-y-2">
            {filtered.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/count/detail?id=${it.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition active:scale-[0.99]"
                >
                  <ItemPhoto src={displayPhoto(it)} alt={it.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{it.name}</p>
                    <p className="truncate text-xs text-muted">
                      {it.sku}
                      {it.color && ` · ${it.color}`}
                      {it.size && ` · ${it.size}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-2xl font-bold tabular-nums leading-none",
                        it.total === 0 && "text-muted/40"
                      )}
                    >
                      {it.total}
                    </p>
                    {it.entryCount > 0 && (
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {it.entryCount} entr{it.entryCount === 1 ? "y" : "ies"}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
            {filtered.length === 0 && items && items.length > 0 && (
              <li className="rounded-xl bg-surface p-4 text-center text-sm text-muted">
                No items match.
              </li>
            )}
          </ul>
        )}
      </div>
      <ScanFab />
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-fg"
          : "bg-surface text-muted border border-border"
      )}
    >
      {children}
    </button>
  );
}
