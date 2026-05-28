"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { useSessions } from "@/lib/hooks";
import { exportSessionToXlsx, triggerDownload } from "@/lib/export";
import { formatDate } from "@/lib/utils";

export default function ExportPage() {
  const sessions = useSessions();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onExport(id: string) {
    setBusy(id);
    setError(null);
    try {
      const { blob, filename } = await exportSessionToXlsx(id);
      triggerDownload(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Export" />
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">Export to Excel</p>
              <p className="text-sm text-muted">
                Two sheets: Summary (totals per item) and Detailed Counts (every entry).
              </p>
            </div>
          </div>
        </div>

        {sessions?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="font-medium">No sessions to export yet</p>
            <p className="mt-1 text-sm text-muted">
              Start a session and add some counts first.
            </p>
            <Link href="/sessions/new" className="mt-4 inline-block">
              <Button>Start session</Button>
            </Link>
          </div>
        )}

        <ul className="space-y-2">
          {sessions?.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(s.createdAt)} ·{" "}
                    {s.status === "in_progress" ? "Active" : "Completed"}
                    {s.countedBy ? ` · ${s.countedBy}` : ""}
                  </p>
                </div>
                <Button
                  size="md"
                  onClick={() => onExport(s.id)}
                  disabled={busy === s.id}
                >
                  <Download className="h-5 w-5" />
                  {busy === s.id ? "…" : "Export"}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {error && (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
