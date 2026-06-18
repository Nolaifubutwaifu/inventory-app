"use client";

import type { Table } from "dexie";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { db } from "../db";
import type {
  CountEntry,
  CountSession,
  InvoiceImport,
  Item,
  LocationTemplate,
} from "../types";
import { getSupabase, isSyncConfigured } from "./supabase";

// One generic table mirrors every collection so the schema stays reusable as
// the app grows. Each row is `{ collection, id, account_id, data, deleted }`.
const SYNC_TABLE = "sync_records";

type Collection =
  | "items"
  | "sessions"
  | "entries"
  | "location_templates"
  | "invoice_imports";
type SyncEntity =
  | Item
  | CountSession
  | CountEntry
  | LocationTemplate
  | InvoiceImport;

interface Mirror {
  collection: Collection;
  table: Table<SyncEntity, string>;
}

// Map each local Dexie table to its server collection name.
function mirrors(): Mirror[] {
  return [
    { collection: "items", table: db.items as unknown as Table<SyncEntity, string> },
    { collection: "sessions", table: db.sessions as unknown as Table<SyncEntity, string> },
    { collection: "entries", table: db.entries as unknown as Table<SyncEntity, string> },
    {
      collection: "location_templates",
      table: db.locationTemplates as unknown as Table<SyncEntity, string>,
    },
    {
      collection: "invoice_imports",
      table: db.invoiceImports as unknown as Table<SyncEntity, string>,
    },
  ];
}

interface SyncRow {
  collection: Collection;
  id: string;
  data: SyncEntity;
  deleted: boolean;
}

// ---- module state ----
let started = false;
let currentAccount: string | null = null;
let channel: RealtimeChannel | null = null;
// While we write a remote change into Dexie, suppress the outbound hooks so we
// don't echo it straight back to the server.
let applyingRemote = false;
const unhooks: Array<() => void> = [];

// ---- outbound: local Dexie writes -> Supabase ----

// Broadcast the change over the realtime channel for an instant cross-device
// update, bypassing the slower DB write-ahead-log -> postgres_changes pipeline.
// Ephemeral and best-effort: the DB upsert below is the durable source of truth.
function broadcastChange(row: SyncRow) {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "change", payload: row });
}

async function pushRow(collection: Collection, entity: SyncEntity, deleted: boolean) {
  const sb = getSupabase();
  if (!sb || !currentAccount) return;
  // Only sync rows that belong to the active (shared) account.
  if ((entity as { userId?: string }).userId !== currentAccount) return;

  const row: SyncRow = { collection, id: entity.id, data: entity, deleted };
  // Fast path first so peers update immediately, then persist.
  broadcastChange(row);

  const { error } = await sb.from(SYNC_TABLE).upsert(
    {
      collection,
      id: entity.id,
      account_id: currentAccount,
      data: entity,
      deleted,
      updated_at: Date.now(),
    },
    { onConflict: "collection,id" }
  );
  if (error) console.warn(`[sync] push ${collection}/${entity.id} failed:`, error.message);
}

function registerHooks() {
  for (const { collection, table } of mirrors()) {
    const creating = (_pk: string, obj: SyncEntity) => {
      if (applyingRemote) return;
      const snapshot = obj;
      queueMicrotask(() => void pushRow(collection, snapshot, false));
    };
    const updating = (
      mods: Partial<SyncEntity>,
      _pk: string,
      obj: SyncEntity
    ) => {
      if (applyingRemote) return;
      const merged = { ...obj, ...mods } as SyncEntity;
      queueMicrotask(() => void pushRow(collection, merged, false));
    };
    const deleting = (_pk: string, obj: SyncEntity) => {
      if (applyingRemote) return;
      const snapshot = obj;
      queueMicrotask(() => void pushRow(collection, snapshot, true));
    };

    table.hook("creating", creating);
    table.hook("updating", updating);
    table.hook("deleting", deleting);
    unhooks.push(() => {
      table.hook("creating").unsubscribe(creating);
      table.hook("updating").unsubscribe(updating);
      table.hook("deleting").unsubscribe(deleting);
    });
  }
}

// ---- inbound: Supabase -> local Dexie ----

async function applyRemote(row: SyncRow) {
  const mirror = mirrors().find((m) => m.collection === row.collection);
  if (!mirror) return;
  applyingRemote = true;
  try {
    if (row.deleted) {
      await mirror.table.delete(row.id);
    } else {
      await mirror.table.put(row.data);
    }
  } finally {
    applyingRemote = false;
  }
}

async function initialSync() {
  const sb = getSupabase();
  if (!sb || !currentAccount) return;

  const { data, error } = await sb
    .from(SYNC_TABLE)
    .select("collection,id,data,deleted")
    .eq("account_id", currentAccount);
  if (error) {
    console.warn("[sync] initial pull failed:", error.message);
    return;
  }

  const seen = new Set<string>();
  for (const row of (data ?? []) as SyncRow[]) {
    seen.add(`${row.collection}:${row.id}`);
    await applyRemote(row);
  }

  // Seed the server with any local rows it hasn't seen yet (e.g. data created
  // on this device before sync was configured).
  for (const { collection, table } of mirrors()) {
    const rows = await table.toArray();
    for (const row of rows) {
      if ((row as { userId?: string }).userId !== currentAccount) continue;
      if (!seen.has(`${collection}:${row.id}`)) {
        await pushRow(collection, row, false);
      }
    }
  }
}

function subscribeRealtime() {
  const sb = getSupabase();
  if (!sb || !currentAccount) return;
  channel = sb
    .channel(`sync:${currentAccount}`, {
      // Don't echo our own broadcasts back to us — we already applied locally.
      config: { broadcast: { self: false } },
    })
    // Fast path: peers broadcast their changes for near-instant updates.
    .on("broadcast", { event: "change" }, ({ payload }) => {
      const rec = payload as SyncRow | undefined;
      if (!rec || !rec.collection || !rec.id) return;
      void applyRemote(rec);
    })
    // Durable backstop / catch-up for anything not received via broadcast.
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: SYNC_TABLE,
        filter: `account_id=eq.${currentAccount}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const rec = (payload.new ?? payload.old) as unknown as SyncRow | undefined;
        if (!rec || !rec.collection || !rec.id) return;
        const deleted = payload.eventType === "DELETE" ? true : Boolean(rec.deleted);
        void applyRemote({
          collection: rec.collection,
          id: rec.id,
          data: rec.data,
          deleted,
        });
      }
    )
    .subscribe();
}

// ---- public API ----

// Begin syncing the given account across devices. Safe to call repeatedly;
// no-ops when sync isn't configured. Switching accounts restarts the engine.
export async function startSync(accountId: string) {
  if (!isSyncConfigured) return;
  if (started && currentAccount === accountId) return;
  if (started) stopSync();

  currentAccount = accountId;
  started = true;
  registerHooks();
  subscribeRealtime();
  await initialSync();
}

export function stopSync() {
  if (channel) {
    getSupabase()?.removeChannel(channel);
    channel = null;
  }
  for (const off of unhooks.splice(0)) off();
  started = false;
  currentAccount = null;
}
