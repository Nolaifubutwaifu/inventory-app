import { db } from "./db";
import { createItem, createSession } from "./repo";

export async function seedDemoDataForUser(userId: string) {
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

  const sessionCount = await db.sessions.where("userId").equals(userId).count();
  if (sessionCount === 0) {
    await createSession(`Stocktake — ${new Date().toLocaleDateString()}`, "Me");
  }
}
