"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCurrentUserId } from "./auth";
import { db } from "./db";
import {
  itemsWithTotalsForSession,
  listEntriesForItemInSession,
  listEntriesForSession,
} from "./repo";
import type {
  CountEntry,
  CountSession,
  InvoiceImport,
  Item,
  ItemWithTotal,
  LocationTemplate,
} from "./types";

export function useActiveSession(): CountSession | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!userId) return undefined;
    const rows = await db.sessions
      .where("[userId+status]")
      .equals([userId, "in_progress"])
      .toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt)[0];
  }, [userId]);
}

export function useSessions(): CountSession[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db.sessions.where("userId").equals(userId).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [userId]);
}

export function useSession(id: string | undefined): CountSession | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!id || !userId) return undefined;
    const s = await db.sessions.get(id);
    return s && s.userId === userId ? s : undefined;
  }, [id, userId]);
}

export function useItems(): Item[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db.items.where("userId").equals(userId).toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [userId]);
}

export function useCategories(): string[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db.items.where("userId").equals(userId).toArray();
    const set = new Set<string>();
    for (const it of rows) {
      const c = it.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [userId]);
}

export function useItem(id: string | undefined): Item | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!id || !userId) return undefined;
    const it = await db.items.get(id);
    return it && it.userId === userId ? it : undefined;
  }, [id, userId]);
}

export function useItemsWithTotals(
  sessionId: string | undefined
): ItemWithTotal[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(
    async () =>
      sessionId && userId ? await itemsWithTotalsForSession(sessionId) : [],
    [sessionId, userId]
  );
}

export function useEntriesForSession(
  sessionId: string | undefined
): CountEntry[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(
    async () =>
      sessionId && userId ? await listEntriesForSession(sessionId) : [],
    [sessionId, userId]
  );
}

export function useLocationTemplates(): LocationTemplate[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db.locationTemplates
      .where("userId")
      .equals(userId)
      .toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }, [userId]);
}

export function useInvoiceImports(): InvoiceImport[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db.invoiceImports.where("userId").equals(userId).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [userId]);
}

export function usePendingInvoiceImports(): InvoiceImport[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db.invoiceImports
      .where("[userId+status]")
      .equals([userId, "pending"])
      .toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [userId]);
}

export function useInvoiceImport(id: string | undefined): InvoiceImport | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(async () => {
    if (!id || !userId) return undefined;
    const row = await db.invoiceImports.get(id);
    return row && row.userId === userId ? row : undefined;
  }, [id, userId]);
}

export function useEntriesForItem(
  sessionId: string | undefined,
  itemId: string | undefined
): CountEntry[] | undefined {
  const userId = useCurrentUserId();
  return useLiveQuery(
    async () =>
      sessionId && itemId && userId
        ? await listEntriesForItemInSession(sessionId, itemId)
        : [],
    [sessionId, itemId, userId]
  );
}
