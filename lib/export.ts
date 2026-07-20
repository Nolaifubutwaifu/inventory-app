import ExcelJS from "exceljs";
import type { CountEntry, CountSession, Item } from "./types";
import { db } from "./db";
import { formatDate, formatDateTime } from "./utils";

// Styling shared by both sheets, modelled on the MYOB-style reports the
// business already uses (title block, generated line, bold header band,
// grand-total row) with per-category color coding on top.
const TITLE_COLOR = "FF1F3864";
const HEADER_FILL = "FF2F5597";
const HEADER_TEXT = "FFFFFFFF";
const TOTAL_FILL = "FFD6DCE4";
const BORDER_COLOR = "FFB8C2D1";

// Distinct pastel fills, one per category (cycled if there are more
// categories than colors).
const CATEGORY_FILLS = [
  "FFDDEBF7", // blue
  "FFE2EFDA", // green
  "FFFFF2CC", // yellow
  "FFFCE4D6", // orange
  "FFE4DFEC", // purple
  "FFD9E8E8", // teal
  "FFF2DCDB", // pink
  "FFEDEDED", // grey
];

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
  const fillByCategory = buildCategoryFills(items);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Warehouse Inventory App";
  workbook.created = new Date();

  buildSummarySheet(workbook, session, items, entries, fillByCategory);
  buildDetailSheet(workbook, session, entries, itemsById, fillByCategory);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const datePart = formatDate(session.createdAt).replace(/[^0-9A-Za-z]+/g, "-");
  const filename = `${slugify(session.name)}-${datePart}.xlsx`;
  return { blob, filename };
}

function buildCategoryFills(items: Item[]): Map<string, string> {
  const categories = Array.from(new Set(items.map((i) => i.category))).sort(
    (a, b) => a.localeCompare(b)
  );
  return new Map(
    categories.map((c, i) => [c, CATEGORY_FILLS[i % CATEGORY_FILLS.length]])
  );
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER_COLOR } },
  bottom: { style: "thin", color: { argb: BORDER_COLOR } },
  left: { style: "thin", color: { argb: BORDER_COLOR } },
  right: { style: "thin", color: { argb: BORDER_COLOR } },
};

// Rows 1-4: report title, session, counted by, generated timestamp — each
// merged across the full sheet width. Row 5 is a spacer; the column header
// band lands on row 6.
function addTitleBlock(
  sheet: ExcelJS.Worksheet,
  title: string,
  session: CountSession,
  colCount: number
) {
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 14, color: { argb: TITLE_COLOR } };
  const nameRow = sheet.addRow([session.name]);
  nameRow.font = { bold: true, size: 12 };
  sheet.addRow([`Counted by: ${session.countedBy || "—"}`]);
  const generated = sheet.addRow([
    `Generated ${formatDate(session.createdAt)}, exported ${formatDateTime(Date.now())}`,
  ]);
  generated.font = { italic: true, color: { argb: "FF808080" } };
  for (let r = 1; r <= 4; r++) sheet.mergeCells(r, 1, r, colCount);
  sheet.addRow([]);
}

function addHeaderRow(sheet: ExcelJS.Worksheet, headers: string[]): ExcelJS.Row {
  const row = sheet.addRow(headers);
  row.height = 20;
  for (let c = 1; c <= headers.length; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = solidFill(HEADER_FILL);
    cell.border = thinBorder;
    cell.alignment = { vertical: "middle" };
  }
  sheet.views = [{ state: "frozen", ySplit: row.number }];
  return row;
}

function addGrandTotalRow(
  sheet: ExcelJS.Worksheet,
  colCount: number,
  totalCol: number,
  total: number
) {
  const values: (string | number)[] = new Array(colCount).fill("");
  values[0] = "Grand total";
  values[totalCol - 1] = total;
  const row = sheet.addRow(values);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true };
    cell.fill = solidFill(TOTAL_FILL);
    cell.border = {
      ...thinBorder,
      top: { style: "medium", color: { argb: HEADER_FILL } },
    };
  }
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  session: CountSession,
  items: Item[],
  entries: CountEntry[],
  fillByCategory: Map<string, string>
) {
  const sheet = workbook.addWorksheet("Summary");
  sheet.columns = [
    { key: "category", width: 16 },
    { key: "name", width: 28 },
    { key: "sku", width: 16 },
    { key: "color", width: 12 },
    { key: "size", width: 10 },
    { key: "total", width: 14 },
    { key: "locations", width: 34 },
  ];
  const colCount = 7;

  addTitleBlock(sheet, "Stock take report", session, colCount);
  const headerRow = addHeaderRow(sheet, [
    "Category",
    "Item",
    "SKU",
    "Color",
    "Size",
    "Total Count",
    "Locations",
  ]);

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

  let grandTotal = 0;
  for (const { item, t } of rows) {
    grandTotal += t.total;
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
    const fill = solidFill(
      fillByCategory.get(item.category) ?? CATEGORY_FILLS[0]
    );
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = fill;
      cell.border = thinBorder;
    }
    row.getCell(6).font = { bold: true };
  }

  addGrandTotalRow(sheet, colCount, 6, grandTotal);
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number + rows.length, column: colCount },
  };
}

function buildDetailSheet(
  workbook: ExcelJS.Workbook,
  session: CountSession,
  entries: CountEntry[],
  itemsById: Map<string, Item>,
  fillByCategory: Map<string, string>
) {
  const sheet = workbook.addWorksheet("Detailed Counts");
  sheet.columns = [
    { key: "date", width: 20 },
    { key: "name", width: 32 },
    { key: "sku", width: 16 },
    { key: "color", width: 12 },
    { key: "size", width: 10 },
    { key: "location", width: 18 },
    { key: "quantity", width: 12 },
    { key: "notes", width: 24 },
    { key: "countedBy", width: 16 },
  ];
  const colCount = 9;

  addTitleBlock(sheet, "Stock take report — detailed counts", session, colCount);
  const headerRow = addHeaderRow(sheet, [
    "Date",
    "Item",
    "SKU",
    "Color",
    "Size",
    "Location",
    "Quantity",
    "Notes",
    "Counted By",
  ]);

  let grandTotal = 0;
  for (const e of entries) {
    const item = itemsById.get(e.itemId);
    grandTotal += e.quantity;
    const row = sheet.addRow({
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
    // Color-code detail rows by the item's category too, so both sheets
    // share one legend.
    const fill = item
      ? solidFill(fillByCategory.get(item.category) ?? CATEGORY_FILLS[0])
      : solidFill("FFF2F2F2");
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.fill = fill;
      cell.border = thinBorder;
    }
    row.getCell(7).font = { bold: true };
  }

  addGrandTotalRow(sheet, colCount, 7, grandTotal);
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number + entries.length, column: colCount },
  };
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
