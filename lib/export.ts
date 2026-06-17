import ExcelJS from "exceljs";
import type { CountEntry, CountSession, Item } from "./types";
import { db } from "./db";
import { formatDate, formatDateTime } from "./utils";

export async function exportSessionToXlsx(sessionId: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  const [items, entries] = await Promise.all([
    db.items.toArray(),
    db.entries.where("sessionId").equals(sessionId).sortBy("createdAt"),
  ]);

  const itemsById = new Map(items.map((i) => [i.id, i]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Warehouse Inventory App";
  workbook.created = new Date();

  buildSummarySheet(workbook, session, items, entries);
  buildDetailSheet(workbook, session, entries, itemsById);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const datePart = formatDate(session.createdAt).replace(/[^0-9A-Za-z]+/g, "-");
  const filename = `${slugify(session.name)}-${datePart}.xlsx`;
  return { blob, filename };
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  session: CountSession,
  items: Item[],
  entries: CountEntry[]
) {
  const sheet = workbook.addWorksheet("Summary");
  sheet.columns = [
    { header: "Category", key: "category", width: 16 },
    { header: "Item", key: "name", width: 28 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Color", key: "color", width: 12 },
    { header: "Size", key: "size", width: 10 },
    { header: "Total Count", key: "total", width: 14 },
    { header: "Locations", key: "locations", width: 34 },
  ];
  sheet.getRow(1).font = { bold: true };

  const totalsByItem = new Map<
    string,
    { total: number; locations: Map<string, number> }
  >();
  for (const e of entries) {
    const cur =
      totalsByItem.get(e.itemId) ?? { total: 0, locations: new Map<string, number>() };
    cur.total += e.quantity;
    if (e.location) {
      cur.locations.set(e.location, (cur.locations.get(e.location) ?? 0) + e.quantity);
    }
    totalsByItem.set(e.itemId, cur);
  }

  // Keep each category's rows together, sorted by item name within the group.
  const rows = items
    .map((item) => ({ item, t: totalsByItem.get(item.id) }))
    .filter((r): r is { item: Item; t: { total: number; locations: Map<string, number> } } =>
      Boolean(r.t && r.t.total > 0)
    )
    .sort((a, b) => {
      const byCat = a.item.category.localeCompare(b.item.category);
      return byCat !== 0 ? byCat : a.item.name.localeCompare(b.item.name);
    });

  // Very light alternating fills so adjacent categories read as distinct blocks.
  const palette = ["FFEFF4FB", "FFF7F4EC"];
  let lastCategory: string | null = null;
  let colorIndex = -1;
  for (const { item, t } of rows) {
    if (item.category !== lastCategory) {
      lastCategory = item.category;
      colorIndex = (colorIndex + 1) % palette.length;
    }
    const locations = Array.from(t.locations.entries())
      .map(([loc, qty]) => `${loc} (${qty})`)
      .join(", ");
    const row = sheet.addRow({
      category: item.category,
      name: item.name,
      sku: item.sku,
      color: item.color,
      size: item.size,
      total: t.total,
      locations,
    });
    const fill: ExcelJS.Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: palette[colorIndex] },
    };
    for (let c = 1; c <= 7; c++) row.getCell(c).fill = fill;
  }

  sheet.addRow([]);
  const meta = sheet.addRow([`Session: ${session.name}`]);
  meta.font = { italic: true, color: { argb: "FF888888" } };
  sheet.addRow([`Counted by: ${session.countedBy || "—"}`]);
  sheet.addRow([`Date: ${formatDate(session.createdAt)}`]);
}

function buildDetailSheet(
  workbook: ExcelJS.Workbook,
  session: CountSession,
  entries: CountEntry[],
  itemsById: Map<string, Item>
) {
  const sheet = workbook.addWorksheet("Detailed Counts");
  sheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Item", key: "name", width: 32 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Color", key: "color", width: 12 },
    { header: "Size", key: "size", width: 10 },
    { header: "Location", key: "location", width: 18 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Notes", key: "notes", width: 24 },
    { header: "Counted By", key: "countedBy", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const e of entries) {
    const item = itemsById.get(e.itemId);
    sheet.addRow({
      date: formatDateTime(e.createdAt),
      name: item?.name ?? "(deleted item)",
      sku: item?.sku ?? "",
      color: item?.color ?? "",
      size: item?.size ?? "",
      location: e.location,
      quantity: e.quantity,
      notes: e.notes ?? "",
      countedBy: session.countedBy,
    });
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "stocktake";
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
