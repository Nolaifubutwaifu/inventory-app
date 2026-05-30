import Dexie, { type Table } from "dexie";
import type {
  CountEntry,
  CountSession,
  Item,
  LocationTemplate,
  User,
} from "./types";

class InventoryDB extends Dexie {
  users!: Table<User, string>;
  items!: Table<Item, string>;
  sessions!: Table<CountSession, string>;
  entries!: Table<CountEntry, string>;
  locationTemplates!: Table<LocationTemplate, string>;

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
    // v3: multi-user — adds users table and userId scoping on every entity.
    // Pre-v3 unscoped rows are dropped on upgrade so each new account starts clean.
    this.version(3)
      .stores({
        users: "id, &email, createdAt",
        items: "id, userId, [userId+name], [userId+sku], sku, updatedAt",
        sessions: "id, userId, [userId+status], [userId+createdAt], createdAt",
        entries:
          "id, userId, sessionId, itemId, [userId+sessionId], [sessionId+itemId], [userId+sessionId+itemId], createdAt",
      })
      .upgrade(async (tx) => {
        await tx.table("items").clear();
        await tx.table("sessions").clear();
        await tx.table("entries").clear();
      });
    // v4: add `barcode` index on items for fast lookup. Optional field, no data migration.
    this.version(4).stores({
      users: "id, &email, createdAt",
      items: "id, userId, [userId+name], [userId+sku], [userId+barcode], sku, updatedAt",
      sessions: "id, userId, [userId+status], [userId+createdAt], createdAt",
      entries:
        "id, userId, sessionId, itemId, [userId+sessionId], [sessionId+itemId], [userId+sessionId+itemId], createdAt",
    });
    // v5: locationTemplates table for user-managed quick-pick location chips.
    this.version(5).stores({
      users: "id, &email, createdAt",
      items: "id, userId, [userId+name], [userId+sku], [userId+barcode], sku, updatedAt",
      sessions: "id, userId, [userId+status], [userId+createdAt], createdAt",
      entries:
        "id, userId, sessionId, itemId, [userId+sessionId], [sessionId+itemId], [userId+sessionId+itemId], createdAt",
      locationTemplates: "id, userId, [userId+createdAt], createdAt",
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
