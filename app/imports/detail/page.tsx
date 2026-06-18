"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  useActiveSession,
  useInvoiceImport,
  useItems,
} from "@/lib/hooks";
import {
  createItem,
  createSession,
  deleteInvoiceImport,
  dismissInvoiceImport,
  importInvoiceToSession,
} from "@/lib/repo";
import { formatDate } from "@/lib/utils";
import type { InvoiceImport, Item } from "@/lib/types";

export default function InvoiceImportDetailPage() {
  return (
    <Suspense fallback={<PageHeader title="Invoice" back="/imports" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const imp = useInvoiceImport(id);
  const items = useItems();
  const active = useActiveSession();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  // Case-insensitive SKU -> item map, recomputed live as the catalog changes.
  const bySku = useMemo(() => {
    const m = new Map<string, Item>();
    for (const it of items ?? []) {
      const k = it.sku.trim().toLowerCase();
      if (k && !m.has(k)) m.set(k, it);
    }
    return m;
  }, [items]);

  if (!imp) {
    return (
      <>
        <PageHeader title="Invoice" back="/imports" />
        <div className="p-4 text-muted">Loading…</div>
      </>
    );
  }

  const rows = imp.lines.map((line, index) => ({
    index,
    line,
    item: bySku.get(line.rawSku.trim().toLowerCase()),
  }));
  const importable = rows.filter((r) => r.item && !r.line.imported);
  const unmatched = rows.filter((r) => !r.item && !r.line.imported);

  async function onCreateItem(description: string, rawSku: string) {
    setBusy(true);
    try {
      await createItem({
        name: description || rawSku || "Untitled item",
        sku: rawSku,
        category: "",
        color: "",
        size: "",
      });
      toast.show("Item added to catalog", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not create item", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (busy) return;
    setBusy(true);
    try {
      let sessionId = active?.id;
      if (!sessionId) {
        const name = imp!.invoiceNumber
          ? `MYOB ${imp!.invoiceNumber}`
          : "MYOB Invoices";
        const session = await createSession(name, imp!.party ?? "");
        sessionId = session.id;
      }
      const { imported, skipped } = await importInvoiceToSession(imp!.id, sessionId);
      if (imported > 0) {
        toast.show(
          `Added ${imported} count${imported === 1 ? "" : "s"}` +
            (skipped > 0 ? ` · ${skipped} still unmatched` : ""),
          "success"
        );
      } else {
        toast.show("Nothing to import — match items first", "info");
      }
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDismiss() {
    await dismissInvoiceImport(imp!.id);
    toast.show("Invoice dismissed", "info");
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this invoice?",
      message: "It will be removed from the app. Counts already imported stay.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await deleteInvoiceImport(imp!.id);
    toast.show("Invoice deleted", "info");
    router.replace("/imports");
  }

  const units = imp.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <>
      <PageHeader
        title={imp.invoiceNumber ? `Invoice ${imp.invoiceNumber}` : imp.filename}
        subtitle={[imp.party, imp.invoiceDate].filter(Boolean).join(" · ") || undefined}
        back="/imports"
      />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Lines" value={imp.lines.length} />
          <Stat label="Units" value={units} />
          <Stat label="Matched" value={rows.filter((r) => r.item).length} />
        </div>

        <StatusBanner imp={imp} />

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">
            Line items
          </h2>
          <ul className="space-y-2">
            {rows.map(({ index, line, item }) => (
              <li
                key={index}
                className="rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {line.description || line.rawSku || "—"}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {line.rawSku ? `SKU ${line.rawSku}` : "no SKU"}
                      {item ? (
                        <span className="text-success"> · matched “{item.name}”</span>
                      ) : (
                        <span className="text-warning"> · no catalog match</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold tabular-nums">{line.quantity}</p>
                    {line.imported && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-success">
                        <CheckCircle2 className="h-3 w-3" /> imported
                      </span>
                    )}
                  </div>
                </div>
                {!item && !line.imported && (
                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => onCreateItem(line.description, line.rawSku)}
                    >
                      <Plus className="h-4 w-4" /> Create item
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {imp.status !== "dismissed" && (
          <div className="flex flex-col gap-2">
            <Button size="lg" block disabled={busy || importable.length === 0} onClick={onImport}>
              {importable.length > 0
                ? `Add ${importable.length} count${importable.length === 1 ? "" : "s"}` +
                  (active ? ` to “${active.name}”` : " to a new session")
                : "All matched lines imported"}
            </Button>
            {unmatched.length > 0 && (
              <p className="px-1 text-center text-xs text-muted">
                {unmatched.length} line{unmatched.length === 1 ? "" : "s"} still need a
                catalog item before they can be counted.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          {imp.status === "pending" && (
            <Button variant="ghost" size="md" block onClick={onDismiss}>
              <XCircle className="h-4 w-4" /> Dismiss invoice
            </Button>
          )}
          <Button variant="ghost" size="md" block onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Delete invoice
          </Button>
        </div>
      </div>
    </>
  );
}

function StatusBanner({ imp }: { imp: InvoiceImport }) {
  if (imp.status === "imported") {
    return (
      <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
        All lines imported{imp.importedAt ? ` on ${formatDate(imp.importedAt)}` : ""}.
      </div>
    );
  }
  if (imp.status === "dismissed") {
    return (
      <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
        This invoice was dismissed.
      </div>
    );
  }
  return null;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
