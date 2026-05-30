"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useItems } from "@/lib/hooks";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { ItemPhoto } from "@/components/ItemPhoto";
import { cn, displayPhoto, matchesQuery } from "@/lib/utils";

const ALL = "__all__";

export default function ItemsPage() {
  const items = useItems();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    if (!items) return [];
    const set = new Set<string>();
    for (const it of items) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    let list = items;
    if (category !== ALL) list = list.filter((i) => i.category === category);
    if (!q.trim()) return list;
    return list.filter((i) =>
      matchesQuery(q, [i.name, i.sku, i.color, i.size, i.category, i.notes])
    );
  }, [items, q, category]);

  return (
    <>
      <PageHeader
        title="Items"
        back="/"
        right={
          <Link href="/items/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> New
            </Button>
          </Link>
        }
      />
      <div className="space-y-3 p-4">
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

        {categories.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip active={category === ALL} onClick={() => setCategory(ALL)}>
              All
            </Chip>
            {categories.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
        )}

        {items && items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {filtered.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/items/edit?id=${it.id}`}
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
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-fg"
          : "bg-surface text-muted border border-border"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Plus className="h-7 w-7" />
      </div>
      <p className="mt-4 font-semibold">No items yet</p>
      <p className="mt-1 text-sm text-muted">
        Add your bins, lids, and other products here so you can count them.
      </p>
      <Link href="/items/new" className="mt-4 inline-block">
        <Button>
          <Plus className="h-5 w-5" /> Add first item
        </Button>
      </Link>
    </div>
  );
}
