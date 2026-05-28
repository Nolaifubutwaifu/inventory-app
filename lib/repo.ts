import { getCurrentUserIdSync } from "./auth";
import { db, newId, now } from "./db";
import type { CountEntry, CountSession, Item, ItemWithTotal } from "./types";

function uid(): string {
  const id = getCurrentUserIdSync();
  if (!id) {
    throw new Error("No user is logged in");
  }
  return id;
}

// ===== Items =====

export async function listItems(): Promise<Item[]> {
  const u = uid();
  const rows = await db.items.where("userId").equals(u).toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getItem(id: string): Promise<Item | undefined> {
  const u = uid();
  const item = await db.items.get(id);
  if (!item || item.userId !== u) return undefined;
  return item;
}

export async function createItem(
  data: Omit<Item, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<Item> {
  const u = uid();
  const item: Item = {
    id: newId(),
    userId: u,
    ...data,
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

export async function deleteItem(id: string): Promise<void> {
  const u = uid();
  await db.transaction("rw", db.items, db.entries, async () => {
    const existing = await db.items.get(id);
    if (!existing || existing.userId !== u) return;
    await db.items.delete(id);
    await db.entries.where("itemId").equals(id).delete();
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
  const rows = await db.entries
    .where("[userId+sessionId]")
    .equals([u, sessionId])
    .toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listEntriesForItemInSession(
  sessionId: string,
  itemId: string
): Promise<CountEntry[]> {
  const u = uid();
  const rows = await db.entries
    .where("[userId+sessionId+itemId]")
    .equals([u, sessionId, itemId])
    .toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addEntry(
  data: Omit<CountEntry, "id" | "userId" | "createdAt">
): Promise<CountEntry> {
  const u = uid();
  const entry: CountEntry = {
    id: newId(),
    userId: u,
    ...data,
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
  const u = uid();
  const entries = await db.entries
    .where("[userId+sessionId+itemId]")
    .equals([u, sessionId, itemId])
    .toArray();
  return entries.reduce((sum, e) => sum + e.quantity, 0);
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
  const totals = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const cur = totals.get(e.itemId) ?? { total: 0, count: 0 };
    cur.total += e.quantity;
    cur.count += 1;
    totals.set(e.itemId, cur);
  }
  return items
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((it) => {
      const t = totals.get(it.id);
      return { ...it, total: t?.total ?? 0, entryCount: t?.count ?? 0 };
    });
}
