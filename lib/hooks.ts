"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import {
  itemsWithTotalsForSession,
  listEntriesForItemInSession,
  listEntriesForSession,
} from "./repo";
import type { CountEntry, CountSession, Item, ItemWithTotal } from "./types";

export function useActiveSession(): CountSession | undefined {
  return useLiveQuery(async () => {
    const rows = await db.sessions
      .where("status")
      .equals("in_progress")
      .reverse()
      .sortBy("createdAt");
    return rows[0];
  }, []);
}

export function useSessions(): CountSession[] | undefined {
  return useLiveQuery(
    async () => db.sessions.orderBy("createdAt").reverse().toArray(),
    []
  );
}

export function useSession(id: string | undefined): CountSession | undefined {
  return useLiveQuery(
    async () => (id ? await db.sessions.get(id) : undefined),
    [id]
  );
}

export function useItems(): Item[] | undefined {
  return useLiveQuery(async () => db.items.orderBy("name").toArray(), []);
}

export function useItem(id: string | undefined): Item | undefined {
  return useLiveQuery(
    async () => (id ? await db.items.get(id) : undefined),
    [id]
  );
}

export function useItemsWithTotals(
  sessionId: string | undefined
): ItemWithTotal[] | undefined {
  return useLiveQuery(
    async () => (sessionId ? await itemsWithTotalsForSession(sessionId) : []),
    [sessionId]
  );
}

export function useEntriesForSession(
  sessionId: string | undefined
): CountEntry[] | undefined {
  return useLiveQuery(
    async () => (sessionId ? await listEntriesForSession(sessionId) : []),
    [sessionId]
  );
}

export function useEntriesForItem(
  sessionId: string | undefined,
  itemId: string | undefined
): CountEntry[] | undefined {
  return useLiveQuery(
    async () =>
      sessionId && itemId
        ? await listEntriesForItemInSession(sessionId, itemId)
        : [],
    [sessionId, itemId]
  );
}
