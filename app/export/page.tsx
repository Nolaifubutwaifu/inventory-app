"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, HardDriveDownload, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { useSessions } from "@/lib/hooks";
import { exportSessionToXlsx, triggerDownload } from "@/lib/export";
import { exportBackup, importBackup } from "@/lib/backup";
import { formatDate } from "@/lib/utils";

export default function ExportPage() {
  const sessions = useSessions();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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

  async function onDownloadBackup() {
    setBackupBusy(true);
    setBackupMsg(null);
    setError(null);
    try {
      const { blob, filename } = await exportBackup();
      triggerDownload(blob, filename);
      setBackupMsg("Backup downloaded. Keep it somewhere safe.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBackupBusy(false);
    }
  }

  async function onImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setBackupBusy(true);
    setBackupMsg(null);
    setError(null);
    try {
      const result = await importBackup(await file.text());
      setBackupMsg(
        `Restored ${result.items} items, ${result.sessions} sessions, ${result.entries} counts.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBackupBusy(false);
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

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <HardDriveDownload className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">Backup &amp; restore</p>
              <p className="text-sm text-muted">
                Your data lives on this device. Download a full backup file to
                guard against losing it, and restore it here on a new device or
                after reinstalling.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="md"
              onClick={onDownloadBackup}
              disabled={backupBusy}
            >
              <Download className="h-5 w-5" />
              {backupBusy ? "…" : "Download backup"}
            </Button>
            <Button
              size="md"
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              disabled={backupBusy}
            >
              <Upload className="h-5 w-5" />
              Restore from file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportBackup}
            />
          </div>
          {backupMsg && (
            <p className="mt-3 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
              {backupMsg}
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
