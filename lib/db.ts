import Dexie, { type Table } from "dexie";
import type { CountEntry, CountSession, Item } from "./types";

class InventoryDB extends Dexie {
  items!: Table<Item, string>;
  sessions!: Table<CountSession, string>;
  entries!: Table<CountEntry, string>;

  constructor() {
    super("inventory-app");
    this.version(1).stores({
      items: "id, name, sku, category, color, size, updatedAt",
      sessions: "id, status, createdAt",
      entries: "id, sessionId, itemId, [sessionId+itemId], createdAt",
    });
    this.version(2).stores({
      items: "id, name, sku, category, color, size, updatedAt",
      sessions: "id, status, createdAt",
      entries: "id, sessionId, itemId, [sessionId+itemId], createdAt",
    });
  }
}

export const db = new InventoryDB();

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function now(): number {
  return Date.now();
}
