"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Download, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/ProgressBar";
import {
  useEntriesForSession,
  useItems,
  useItemsWithTotals,
  useSession,
} from "@/lib/hooks";
import { completeSession, deleteSession, reopenSession } from "@/lib/repo";
import { formatDate, formatDateTime } from "@/lib/utils";
import { exportSessionToXlsx, triggerDownload } from "@/lib/export";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

export default function SessionDetailPage() {
  return (
    <Suspense fallback={<PageHeader title="Session" back="/sessions" />}>
      <SessionDetailInner />
    </Suspense>
  );
}

function SessionDetailInner() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const session = useSession(id);
  const items = useItems();
  const entries = useEntriesForSession(id);
  const totals = useItemsWithTotals(id);
  const toast = useToast();
  const confirm = useConfirm();

  if (!session) {
    return (
      <>
        <PageHeader title="Session" back="/sessions" />
        <div className="p-4 text-muted">Loading…</div>
      </>
    );
  }

  const countedItems = totals?.filter((i) => i.total > 0) ?? [];
  const totalUnits = countedItems.reduce((sum, i) => sum + i.total, 0);

  async function onExport() {
    try {
      const { blob, filename } = await exportSessionToXlsx(id);
      triggerDownload(blob, filename);
      toast.show("Spreadsheet downloaded", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Export failed", "error");
    }
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this session?",
      message: "All count entries in this session will be permanently removed.",
      confirmLabel: "Delete session",
      destructive: true,
    });
    if (!ok) return;
    await deleteSession(id);
    toast.show("Session deleted", "info");
    router.replace("/sessions");
  }

  async function onComplete() {
    await completeSession(id);
    toast.show("Session marked complete", "success");
  }

  async function onReopen() {
    await reopenSession(id);
    toast.show("Session reopened", "info");
  }

  return (
    <>
      <PageHeader
        title={session.name}
        subtitle={`${formatDate(session.createdAt)}${session.countedBy ? " · " + session.countedBy : ""}`}
        back="/sessions"
      />

      <div className="space-y-4 p-4">
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-foreground">Progress</p>
            <p className="text-sm font-semibold tabular-nums">
              {countedItems.length} / {items?.length ?? 0}
            </p>
          </div>
          <ProgressBar value={countedItems.length} max={items?.length ?? 0} />
          <div className="grid grid-cols-3 gap-3 pt-1">
            <Stat label="Items" value={items?.length ?? 0} />
            <Stat label="Counted" value={countedItems.length} />
            <Stat label="Units" value={totalUnits} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {session.status === "in_progress" ? (
            <>
              <Link href="/count" className="block">
                <Button size="lg" block>Continue counting</Button>
              </Link>
              <Button variant="secondary" size="lg" onClick={onComplete} block>
                <CheckCircle2 className="h-5 w-5" /> Mark complete
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="lg" onClick={onReopen} block>
              Reopen session
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={onExport} block>
            <Download className="h-5 w-5" /> Export spreadsheet
          </Button>
          <Button variant="ghost" size="md" onClick={onDelete} block>
            <Trash2 className="h-4 w-4" /> Delete session
          </Button>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Counted items
          </h2>
          {countedItems.length === 0 && (
            <p className="text-sm text-muted">No counts yet — head to the Count tab.</p>
          )}
          <ul className="space-y-2">
            {countedItems.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/count/detail?id=${it.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{it.name}</p>
                    <p className="text-xs text-muted">
                      {it.sku} · {it.color} · {it.size}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{it.total}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      {it.entryCount} entr{it.entryCount === 1 ? "y" : "ies"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {entries && entries.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Latest entries
            </h2>
            <ul className="space-y-1.5">
              {entries.slice(0, 10).map((e) => {
                const item = items?.find((i) => i.id === e.itemId);
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item?.name ?? "—"}</p>
                      <p className="text-xs text-muted">
                        {e.location || "no location"} · {formatDateTime(e.createdAt)}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">+{e.quantity}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
