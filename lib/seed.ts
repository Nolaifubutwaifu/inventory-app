import { db, newId, now } from "./db";
import { createItem } from "./repo";

const DEFAULT_LOCATION_LABELS = ["Aisle", "Shelf", "Rack", "Bay"];

// Seeds a sample catalog so a brand-new user can immediately see the count
// flow, item editor, and AI scan against realistic data. Does NOT create a
// session — the user should start their own first stocktake from the Home
// screen's "Start a new stocktake" CTA.
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

  await createItem({
    name: "60L Storage Bin",
    sku: "BIN-60-BLK",
    category: "Bin",
    color: "Black",
    size: "60L",
    matchingLidSku: "LID-60-BLK",
    notes: "",
  });
  await createItem({
    name: "60L Storage Bin",
    sku: "BIN-60-BLU",
    category: "Bin",
    color: "Blue",
    size: "60L",
    matchingLidSku: "LID-60-BLU",
    notes: "",
  });
  await createItem({
    name: "60L Lid",
    sku: "LID-60-BLK",
    category: "Lid",
    color: "Black",
    size: "60L",
    notes: "",
  });
  await createItem({
    name: "80L Storage Bin",
    sku: "BIN-80-GRY",
    category: "Bin",
    color: "Grey",
    size: "80L",
    matchingLidSku: "LID-80-GRY",
    notes: "",
  });
  await createItem({
    name: "80L Lid",
    sku: "LID-80-GRY",
    category: "Lid",
    color: "Grey",
    size: "80L",
    notes: "",
  });
  await createItem({
    name: "120L Storage Bin",
    sku: "BIN-120-BLK",
    category: "Bin",
    color: "Black",
    size: "120L",
    matchingLidSku: "LID-120-BLK",
    notes: "",
  });
}
