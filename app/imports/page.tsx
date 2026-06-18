"use client";

import Link from "next/link";
import { ArrowRight, FileText, Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useInvoiceImports } from "@/lib/hooks";
import { isInvoiceImportEnabled } from "@/lib/invoice/featureFlag";
import { formatDate } from "@/lib/utils";
import type { InvoiceImport } from "@/lib/types";

function statusLabel(s: InvoiceImport["status"]): { text: string; cls: string } {
  switch (s) {
    case "pending":
      return { text: "Needs review", cls: "text-warning" };
    case "imported":
      return { text: "Imported", cls: "text-success" };
    case "dismissed":
      return { text: "Dismissed", cls: "text-muted" };
  }
}

export default function ImportsPage() {
  const imports = useInvoiceImports();

  if (!isInvoiceImportEnabled()) {
    return (
      <>
        <PageHeader title="MYOB Invoices" back="/" />
        <div className="p-4 text-sm text-muted">
          Invoice import is turned off. Set{" "}
          <code className="rounded bg-surface-2 px-1">NEXT_PUBLIC_MYOB_IMPORT_ENABLED=1</code>{" "}
          to enable it. See MYOB_IMPORT.md.
        </div>
      </>
    );
  }

  const pending = imports?.filter((i) => i.status === "pending") ?? [];
  const others = imports?.filter((i) => i.status !== "pending") ?? [];

  return (
    <>
      <PageHeader title="MYOB Invoices" back="/" />
      <div className="space-y-5 p-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">Invoices counted automatically</p>
              <p className="text-sm text-muted">
                Drop a MYOB invoice into your watched folder; its line items show up
                here to review and add to a stocktake.
              </p>
            </div>
          </div>
        </div>

        {imports && imports.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 font-medium">No invoices yet</p>
            <p className="mt-1 text-sm text-muted">
              Run the watcher and drop a MYOB invoice PDF into the folder it watches.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Needs review
            </h2>
            <ul className="space-y-2">
              {pending.map((imp) => (
                <ImportRow key={imp.id} imp={imp} />
              ))}
            </ul>
          </section>
        )}

        {others.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
              History
            </h2>
            <ul className="space-y-2">
              {others.map((imp) => (
                <ImportRow key={imp.id} imp={imp} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function ImportRow({ imp }: { imp: InvoiceImport }) {
  const status = statusLabel(imp.status);
  const units = imp.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <li>
      <Link
        href={`/imports/detail?id=${imp.id}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition active:scale-[0.99]"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">
            {imp.invoiceNumber ? `Invoice ${imp.invoiceNumber}` : imp.filename}
          </p>
          <p className="truncate text-xs text-muted">
            {imp.party ? `${imp.party} · ` : ""}
            {imp.lines.length} line{imp.lines.length === 1 ? "" : "s"} · {units} units ·{" "}
            <span className={status.cls}>{status.text}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted">
            {formatDate(imp.createdAt)}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
