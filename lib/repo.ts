import { getCurrentUserIdSync } from "./auth";
import { db, newId, now } from "./db";
import {
  canonicalCountItemId,
  entryItemIdsFor,
  foldPlainLids,
  resolveNewLidItem,
} from "./lids";
import type {
  CountEntry,
  CountSession,
  Item,
  ItemWithTotal,
  LocationTemplate,
} from "./types";

function uid(): string {
  const id = getCurrentUserIdSync();
  if (!id) {
    throw new Error("No user is logged in");
  }
  return id;
}

// ===== Items =====

async function userItems(): Promise<Item[]> {
  return db.items.where("userId").equals(uid()).toArray();
}

export async function listItems(): Promise<Item[]> {
  const rows = await userItems();
  return foldPlainLids(rows).items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getItem(id: string): Promise<Item | undefined> {
  const u = uid();
  const rows = await userItems();
  const fold = foldPlainLids(rows);
  const canonicalId = fold.canonicalIdByItemId.get(id) ?? id;
  const item = fold.items.find((it) => it.id === canonicalId);
  if (!item || item.userId !== u) return undefined;
  return item;
}

export async function createItem(
  data: Omit<Item, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<Item> {
  const u = uid();
  const resolved = resolveNewLidItem(await userItems(), data);
  if ("item" in resolved) return resolved.item;
  const item: Item = {
    id: newId(),
    userId: u,
    ...resolved.draft,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.items.add(item);
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Omit<Item, "id" | "userId" | "createdAt">>
): Promise<void> {
  const u = uid();
  const existing = await db.items.get(id);
  if (!existing || existing.userId !== u) return;
  await db.items.update(id, { ...patch, updatedAt: now() });
}

export async function findItemByBarcode(barcode: string): Promise<Item | undefined> {
  const u = uid();
  const trimmed = barcode.trim();
  if (!trimmed) return undefined;
  const rows = await db.items
    .where("[userId+barcode]")
    .equals([u, trimmed])
    .toArray();
  const hit = rows[0];
  if (!hit) return undefined;
  const fold = foldPlainLids(await userItems());
  const canonicalId = fold.canonicalIdByItemId.get(hit.id) ?? hit.id;
  return fold.items.find((it) => it.id === canonicalId);
}

export async function deleteItem(id: string): Promise<void> {
  const u = uid();
  // An 80L plain lid is the same product as its 120L lid. Deleting either
  // row removes both, so the hidden SKU cannot reappear with the old counts.
  const ids = entryItemIdsFor(await userItems(), id);
  await db.transaction("rw", db.items, db.entries, async () => {
    for (const itemId of ids) {
      const existing = await db.items.get(itemId);
      if (!existing || existing.userId !== u) continue;
      await db.items.delete(itemId);
      await db.entries.where("itemId").equals(itemId).delete();
    }
  });
}

// ===== Sessions =====

export async function listSessions(): Promise<CountSession[]> {
  const u = uid();
  const rows = await db.sessions.where("userId").equals(u).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSession(id: string): Promise<CountSession | undefined> {
  const u = uid();
  const session = await db.sessions.get(id);
  if (!session || session.userId !== u) return undefined;
  return session;
}

export async function getActiveSession(): Promise<CountSession | undefined> {
  const u = uid();
  const rows = await db.sessions
    .where("[userId+status]")
    .equals([u, "in_progress"])
    .toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function createSession(name: string, countedBy: string): Promise<CountSession> {
  const u = uid();
  const session: CountSession = {
    id: newId(),
    userId: u,
    name,
    countedBy,
    status: "in_progress",
    createdAt: now(),
  };
  await db.sessions.add(session);
  return session;
}

export async function completeSession(id: string): Promise<void> {
  const u = uid();
  const existing = await db.sessions.get(id);
  if (!existing || existing.userId !== u) return;
  await db.sessions.update(id, { status: "completed", completedAt: now() });
}

export async function reopenSession(id: string): Promise<void> {
  const u = uid();
  const existing = await db.sessions.get(id);
  if (!existing || existing.userId !== u) return;
  await db.sessions.update(id, { status: "in_progress", completedAt: undefined });
}

export async function deleteSession(id: string): Promise<void> {
  const u = uid();
  await db.transaction("rw", db.sessions, db.entries, async () => {
    const existing = await db.sessions.get(id);
    if (!existing || existing.userId !== u) return;
    await db.sessions.delete(id);
    await db.entries.where("sessionId").equals(id).delete();
  });
}

// ===== Count entries =====

export async function listEntriesForSession(sessionId: string): Promise<CountEntry[]> {
  const u = uid();
  const [rows, items] = await Promise.all([
    db.entries.where("[userId+sessionId]").equals([u, sessionId]).toArray(),
    userItems(),
  ]);
  const canonical = foldPlainLids(items).canonicalIdByItemId;
  return rows
    .map((entry) => {
      const itemId = canonical.get(entry.itemId) ?? entry.itemId;
      return itemId === entry.itemId ? entry : { ...entry, itemId };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listEntriesForItemInSession(
  sessionId: string,
  itemId: string
): Promise<CountEntry[]> {
  const u = uid();
  const [items, rows] = await Promise.all([
    userItems(),
    db.entries.where("[userId+sessionId]").equals([u, sessionId]).toArray(),
  ]);
  const ids = entryItemIdsFor(items, itemId);
  return rows
    .filter((entry) => ids.has(entry.itemId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addEntry(
  data: Omit<CountEntry, "id" | "userId" | "createdAt">
): Promise<CountEntry> {
  const u = uid();
  const itemId = canonicalCountItemId(await userItems(), data.itemId);
  const entry: CountEntry = {
    id: newId(),
    userId: u,
    ...data,
    itemId,
    createdAt: now(),
  };
  await db.entries.add(entry);
  return entry;
}

export async function updateEntry(
  id: string,
  patch: Partial<Omit<CountEntry, "id" | "userId" | "sessionId" | "itemId" | "createdAt">>
): Promise<void> {
  const u = uid();
  const existing = await db.entries.get(id);
  if (!existing || existing.userId !== u) return;
  await db.entries.update(id, patch);
}

export async function deleteEntry(id: string): Promise<void> {
  const u = uid();
  const existing = await db.entries.get(id);
  if (!existing || existing.userId !== u) return;
  await db.entries.delete(id);
}

export async function totalForItemInSession(
  sessionId: string,
  itemId: string
): Promise<number> {
  const entries = await listEntriesForItemInSession(sessionId, itemId);
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}

// ===== Location templates =====

export async function listLocationTemplates(): Promise<LocationTemplate[]> {
  const u = uid();
  const rows = await db.locationTemplates.where("userId").equals(u).toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createLocationTemplate(label: string): Promise<LocationTemplate> {
  const u = uid();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");
  const existing = await db.locationTemplates.where("userId").equals(u).toArray();
  if (existing.some((t) => t.label.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("That template already exists");
  }
  const template: LocationTemplate = {
    id: newId(),
    userId: u,
    label: trimmed,
    createdAt: now(),
  };
  await db.locationTemplates.add(template);
  return template;
}

export async function updateLocationTemplate(id: string, label: string): Promise<void> {
  const u = uid();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");
  const existing = await db.locationTemplates.get(id);
  if (!existing || existing.userId !== u) return;
  await db.locationTemplates.update(id, { label: trimmed });
}

export async function deleteLocationTemplate(id: string): Promise<void> {
  const u = uid();
  const existing = await db.locationTemplates.get(id);
  if (!existing || existing.userId !== u) return;
  await db.locationTemplates.delete(id);
}

// ===== Aggregations =====

export async function itemsWithTotalsForSession(
  sessionId: string
): Promise<ItemWithTotal[]> {
  const u = uid();
  const [items, entries] = await Promise.all([
    db.items.where("userId").equals(u).toArray(),
    db.entries.where("[userId+sessionId]").equals([u, sessionId]).toArray(),
  ]);
  const fold = foldPlainLids(items);
  const totals = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const itemId = fold.canonicalIdByItemId.get(e.itemId) ?? e.itemId;
    const cur = totals.get(itemId) ?? { total: 0, count: 0 };
    cur.total += e.quantity;
    cur.count += 1;
    totals.set(itemId, cur);
  }
  return fold.items
    .map((it) => {
      const t = totals.get(it.id);
      return { ...it, total: t?.total ?? 0, entryCount: t?.count ?? 0 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
