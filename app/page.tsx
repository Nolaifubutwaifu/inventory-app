"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Download,
  ListChecks,
  Plus,
  ScanBarcode,
  Sparkles,
} from "lucide-react";
import {
  useActiveSession,
  useItems,
  useItemsWithTotals,
  useSessions,
} from "@/lib/hooks";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/Button";

export default function HomePage() {
  const active = useActiveSession();
  const sessions = useSessions();
  const items = useItems();
  const totals = useItemsWithTotals(active?.id);

  const itemCount = items?.length ?? 0;
  const sessionCount = sessions?.length ?? 0;
  const countedItems = totals?.filter((i) => i.total > 0).length ?? 0;
  const totalUnits = totals?.reduce((s, i) => s + i.total, 0) ?? 0;

  return (
    <div className="space-y-6 px-4 pt-8 pb-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Warehouse
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Inventory</h1>
      </header>

      {active ? (
        <Link
          href="/count"
          className="block overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-blue-700 p-5 text-primary-fg shadow-sm transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
            Active session
          </div>
          <p className="mt-1 text-xl font-semibold leading-tight">{active.name}</p>
          <p className="mt-0.5 text-xs opacity-80">
            {formatDate(active.createdAt)}
            {active.countedBy ? ` · ${active.countedBy}` : ""}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums leading-none">
                  {countedItems}
                </span>
                <span className="text-sm opacity-80">/ {itemCount} items counted</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{
                    width: `${itemCount === 0 ? 0 : Math.round((countedItems / itemCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums leading-none">
                {totalUnits}
              </p>
              <p className="text-xs opacity-80">units</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <ScanBarcode className="h-4 w-4" />
              Continue counting
            </span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      ) : (
        <Link
          href="/sessions/new"
          className="block rounded-2xl border border-border bg-surface p-5 shadow-sm transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
            <Sparkles className="h-3.5 w-3.5" />
            No active session
          </div>
          <p className="mt-1 text-xl font-semibold">Start a new stocktake</p>
          <p className="text-sm text-muted">
            Sessions group your counts so you can export them as one spreadsheet.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Plus className="h-4 w-4" />
            New session
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/items"
          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {itemCount}
            </p>
            <p className="mt-1 text-sm text-muted">Items</p>
          </div>
        </Link>
        <Link
          href="/sessions"
          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition active:scale-[0.98]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {sessionCount}
            </p>
            <p className="mt-1 text-sm text-muted">Sessions</p>
          </div>
        </Link>
      </div>

      <div className="space-y-2">
        <Link href="/sessions/new" className="block">
          <Button variant="secondary" size="lg" block>
            <Plus className="h-5 w-5" />
            New Count Session
          </Button>
        </Link>
        <Link href="/export" className="block">
          <Button variant="secondary" size="lg" block>
            <Download className="h-5 w-5" />
            Export Spreadsheet
          </Button>
        </Link>
      </div>

      {sessions && sessions.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Recent sessions
          </h2>
          <ul className="space-y-2">
            {sessions.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/detail?id=${s.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-muted">
                      {formatDate(s.createdAt)} ·{" "}
                      <span
                        className={
                          s.status === "in_progress"
                            ? "text-success"
                            : "text-muted"
                        }
                      >
                        {s.status === "in_progress" ? "Active" : "Completed"}
                      </span>
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
