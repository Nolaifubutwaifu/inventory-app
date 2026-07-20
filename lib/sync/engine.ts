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
  Item,
  LocationTemplate,
} from "../types";
import { getSupabase, isSyncConfigured } from "./supabase";

// One generic table mirrors every collection so the schema stays reusable as
// the app grows. Each row is `{ collection, id, account_id, data, deleted }`.
const SYNC_TABLE = "sync_records";

type Collection = "items" | "sessions" | "entries" | "location_templates";
type SyncEntity = Item | CountSession | CountEntry | LocationTemplate;

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

  // A tombstone only needs the id — peers just delete the row locally.
  // Keeping the full snapshot (photos included) would make every device
  // re-download dead data on every initial sync, forever.
  const payload = deleted
    ? ({ id: entity.id, userId: currentAccount } as SyncEntity)
    : entity;

  const row: SyncRow = { collection, id: entity.id, data: payload, deleted };
  // Fast path first so peers update immediately, then persist.
  broadcastChange(row);

  const { error } = await sb.from(SYNC_TABLE).upsert(
    {
      collection,
      id: entity.id,
      account_id: currentAccount,
      data: payload,
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

// Per-account high-water mark of the newest server row this device has
// applied. Lets the next initial sync pull only what changed since, instead
// of re-downloading the whole account on every app open.
const CHECKPOINT_PREFIX = "inventory:syncCheckpoint:";
// updated_at is stamped by whichever device wrote the row, so clocks can
// disagree. Re-pulling a small overlap window is cheap; missing a row is not.
const CHECKPOINT_SLACK_MS = 5 * 60 * 1000;

function getCheckpoint(account: string): number {
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_PREFIX + account);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function setCheckpoint(account: string, ts: number) {
  try {
    window.localStorage.setItem(CHECKPOINT_PREFIX + account, String(ts));
  } catch {
    // ignore — storage unavailable
  }
}

async function initialSync() {
  const sb = getSupabase();
  if (!sb || !currentAccount) return;
  const account = currentAccount;

  // Light pass: ids + timestamps only (no payloads). Tells us what the server
  // has — both to find rows worth pulling and to seed-push local rows the
  // server has never seen — for a few bytes per row.
  const { data: index, error: indexError } = await sb
    .from(SYNC_TABLE)
    .select("collection,id,updated_at")
    .eq("account_id", account);
  if (indexError) {
    console.warn("[sync] initial pull failed:", indexError.message);
    return;
  }

  const seen = new Set<string>();
  let newest = 0;
  for (const row of (index ?? []) as Array<{
    collection: Collection;
    id: string;
    updated_at: number;
  }>) {
    seen.add(`${row.collection}:${row.id}`);
    if (row.updated_at > newest) newest = row.updated_at;
  }

  // Payload pass: only rows changed since this device last synced.
  const since = Math.max(0, getCheckpoint(account) - CHECKPOINT_SLACK_MS);
  let changed: SyncRow[] = [];
  if (newest > since) {
    const { data, error } = await sb
      .from(SYNC_TABLE)
      .select("collection,id,data,deleted")
      .eq("account_id", account)
      .gt("updated_at", since);
    if (error) {
      console.warn("[sync] initial pull failed:", error.message);
      return;
    }
    changed = (data ?? []) as SyncRow[];
  }

  // Apply per collection in bulk — one transaction instead of one await per row.
  for (const { collection, table } of mirrors()) {
    const rows = changed.filter((r) => r.collection === collection);
    if (rows.length === 0) continue;
    const puts = rows.filter((r) => !r.deleted).map((r) => r.data);
    const dels = rows.filter((r) => r.deleted).map((r) => r.id);
    applyingRemote = true;
    try {
      if (puts.length) await table.bulkPut(puts);
      if (dels.length) await table.bulkDelete(dels);
    } finally {
      applyingRemote = false;
    }
  }

  if (newest > 0) setCheckpoint(account, newest);

  // Seed the server with any local rows it hasn't seen yet (e.g. data created
  // on this device before sync was configured, or whose push never landed).
  for (const { collection, table } of mirrors()) {
    const rows = await table.toArray();
    for (const row of rows) {
      if ((row as { userId?: string }).userId !== account) continue;
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
