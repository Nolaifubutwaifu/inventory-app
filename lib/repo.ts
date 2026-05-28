import { db, newId, now } from "./db";
import type { CountEntry, CountSession, Item, ItemWithTotal } from "./types";

// ===== Items =====

export async function listItems(): Promise<Item[]> {
  return db.items.orderBy("name").toArray();
}

export async function getItem(id: string): Promise<Item | undefined> {
  return db.items.get(id);
}

export async function createItem(
  data: Omit<Item, "id" | "createdAt" | "updatedAt">
): Promise<Item> {
  const item: Item = {
    id: newId(),
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.items.add(item);
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Omit<Item, "id" | "createdAt">>
): Promise<void> {
  await db.items.update(id, { ...patch, updatedAt: now() });
}

export async function deleteItem(id: string): Promise<void> {
  await db.transaction("rw", db.items, db.entries, async () => {
    await db.items.delete(id);
    await db.entries.where("itemId").equals(id).delete();
  });
}

// ===== Sessions =====

export async function listSessions(): Promise<CountSession[]> {
  return db.sessions.orderBy("createdAt").reverse().toArray();
}

export async function getSession(id: string): Promise<CountSession | undefined> {
  return db.sessions.get(id);
}

export async function getActiveSession(): Promise<CountSession | undefined> {
  return db.sessions
    .where("status")
    .equals("in_progress")
    .reverse()
    .sortBy("createdAt")
    .then((rows) => rows[0]);
}

export async function createSession(name: string, countedBy: string): Promise<CountSession> {
  const session: CountSession = {
    id: newId(),
    name,
    countedBy,
    status: "in_progress",
    createdAt: now(),
  };
  await db.sessions.add(session);
  return session;
}

export async function completeSession(id: string): Promise<void> {
  await db.sessions.update(id, { status: "completed", completedAt: now() });
}

export async function reopenSession(id: string): Promise<void> {
  await db.sessions.update(id, { status: "in_progress", completedAt: undefined });
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction("rw", db.sessions, db.entries, async () => {
    await db.sessions.delete(id);
    await db.entries.where("sessionId").equals(id).delete();
  });
}

// ===== Count entries =====

export async function listEntriesForSession(sessionId: string): Promise<CountEntry[]> {
  return db.entries
    .where("sessionId")
    .equals(sessionId)
    .reverse()
    .sortBy("createdAt");
}

export async function listEntriesForItemInSession(
  sessionId: string,
  itemId: string
): Promise<CountEntry[]> {
  return db.entries
    .where("[sessionId+itemId]")
    .equals([sessionId, itemId])
    .reverse()
    .sortBy("createdAt");
}

export async function addEntry(
  data: Omit<CountEntry, "id" | "createdAt">
): Promise<CountEntry> {
  const entry: CountEntry = {
    id: newId(),
    ...data,
    createdAt: now(),
  };
  await db.entries.add(entry);
  return entry;
}

export async function updateEntry(
  id: string,
  patch: Partial<Omit<CountEntry, "id" | "sessionId" | "itemId" | "createdAt">>
): Promise<void> {
  await db.entries.update(id, patch);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function totalForItemInSession(
  sessionId: string,
  itemId: string
): Promise<number> {
  const entries = await db.entries
    .where("[sessionId+itemId]")
    .equals([sessionId, itemId])
    .toArray();
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}

// ===== Aggregations =====

export async function itemsWithTotalsForSession(
  sessionId: string
): Promise<ItemWithTotal[]> {
  const [items, entries] = await Promise.all([
    db.items.orderBy("name").toArray(),
    db.entries.where("sessionId").equals(sessionId).toArray(),
  ]);
  const totals = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const cur = totals.get(e.itemId) ?? { total: 0, count: 0 };
    cur.total += e.quantity;
    cur.count += 1;
    totals.set(e.itemId, cur);
  }
  return items.map((it) => {
    const t = totals.get(it.id);
    return { ...it, total: t?.total ?? 0, entryCount: t?.count ?? 0 };
  });
}
