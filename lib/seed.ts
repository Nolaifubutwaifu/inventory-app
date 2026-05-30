import { db, newId, now } from "./db";
import { createItem } from "./repo";

const DEFAULT_LOCATION_LABELS = ["Aisle", "Shelf", "Rack", "Bay"];

// Seeds a few obviously-placeholder items so a brand-new user can immediately
// see the count flow, item editor, and scan UX without an empty catalog.
// Names are intentionally generic ("Example item N") so they read as
// throwaway data the user should replace, not real catalog seeding.
// Does NOT create a session — the user starts their own from Home.
export async function seedDemoDataForUser(userId: string) {
  const templateCount = await db.locationTemplates
    .where("userId")
    .equals(userId)
    .count();
  if (templateCount === 0) {
    const base = now();
    await db.locationTemplates.bulkAdd(
      DEFAULT_LOCATION_LABELS.map((label, i) => ({
        id: newId(),
        userId,
        label,
        createdAt: base + i,
      }))
    );
  }

  const count = await db.items.where("userId").equals(userId).count();
  if (count > 0) return;

  for (let i = 1; i <= 6; i++) {
    await createItem({
      name: `Example item ${i}`,
      sku: `EX-${String(i).padStart(3, "0")}`,
      category: "Item",
      color: "",
      size: "",
      notes: "",
    });
  }
}
