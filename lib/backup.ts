"use client";

import { db } from "./db";
import { getCurrentUserIdSync } from "./auth";
import type {
  CountEntry,
  CountSession,
  Item,
  LocationTemplate,
} from "./types";

// A full backup is a self-contained JSON snapshot of everything the signed-in
// account owns. It exists as a safety net against local-data loss: IndexedDB
// can be evicted by the browser/OS, a destructive schema migration could wipe
// it, and (unless Supabase sync is configured) there is no server-side copy.
// Export periodically, keep the file somewhere safe, and re-import to restore.

const BACKUP_FORMAT = "inventory-app-backup";
const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  // The account the data was exported from. Informational only — on import the
  // rows are re-homed onto the *current* account so a backup can be restored
  // even after the underlying user id changes.
  accountId: string;
  data: {
    items: Item[];
    sessions: CountSession[];
    entries: CountEntry[];
    locationTemplates: LocationTemplate[];
  };
}

export interface ImportResult {
  items: number;
  sessions: number;
  entries: number;
  locationTemplates: number;
}

// Serialize every row the current account owns into a downloadable JSON blob.
export async function exportBackup(): Promise<{ blob: Blob; filename: string }> {
  const userId = getCurrentUserIdSync();
  if (!userId) throw new Error("Not signed in");

  const [items, sessions, entries, locationTemplates] = await Promise.all([
    db.items.where("userId").equals(userId).toArray(),
    db.sessions.where("userId").equals(userId).toArray(),
    db.entries.where("userId").equals(userId).toArray(),
    db.locationTemplates.where("userId").equals(userId).toArray(),
  ]);

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    accountId: userId,
    data: { items, sessions, entries, locationTemplates },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const date = new Date().toISOString().slice(0, 10);
  return { blob, filename: `inventory-backup-${date}.json` };
}

function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<BackupFile>;
  return (
    v.format === BACKUP_FORMAT &&
    typeof v.version === "number" &&
    !!v.data &&
    Array.isArray(v.data.items) &&
    Array.isArray(v.data.sessions) &&
    Array.isArray(v.data.entries) &&
    Array.isArray(v.data.locationTemplates)
  );
}

// Restore a backup file into the current account. Rows are merged (bulkPut), so
// re-importing is idempotent and never deletes anything already present — it
// only adds back what's missing or overwrites by id. Every row is re-homed onto
// the current user id so a backup survives an account/id change.
export async function importBackup(text: string): Promise<ImportResult> {
  const userId = getCurrentUserIdSync();
  if (!userId) throw new Error("Not signed in");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON");
  }
  if (!isBackupFile(parsed)) {
    throw new Error("That doesn't look like an inventory backup file");
  }
  if (parsed.version > BACKUP_VERSION) {
    throw new Error(
      "This backup was made by a newer version of the app. Update first, then import."
    );
  }

  const { items, sessions, entries, locationTemplates } = parsed.data;
  const rehome = <T extends { userId: string }>(rows: T[]): T[] =>
    rows.map((r) => ({ ...r, userId }));

  await db.transaction(
    "rw",
    [db.items, db.sessions, db.entries, db.locationTemplates],
    async () => {
      await db.items.bulkPut(rehome(items));
      await db.sessions.bulkPut(rehome(sessions));
      await db.entries.bulkPut(rehome(entries));
      await db.locationTemplates.bulkPut(rehome(locationTemplates));
    }
  );

  return {
    items: items.length,
    sessions: sessions.length,
    entries: entries.length,
    locationTemplates: locationTemplates.length,
  };
}
