import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import { buildSessionWorkbook } from "./export";
import type { CountEntry, CountSession, Item } from "./types";

const session: CountSession = {
  id: "session-1",
  userId: "user-1",
  name: "23/10/26",
  countedBy: "",
  status: "in_progress",
  createdAt: Date.parse("2026-10-23T00:00:00Z"),
};

function item(partial: Pick<Item, "id" | "name" | "sku" | "category" | "color" | "size">): Item {
  return {
    userId: "user-1",
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

function entry(
  itemId: string,
  quantity: number,
  location = "",
  createdAt = 1
): CountEntry {
  return {
    id: `${itemId}-${createdAt}-${quantity}-${location}`,
    userId: "user-1",
    sessionId: session.id,
    itemId,
    quantity,
    location,
    createdAt,
  };
}

const items: Item[] = [
  item({
    id: "royal",
    name: "660L Bin Royal Blue",
    sku: "660L-BIN-ROYAL-BLUE",
    category: "Bin",
    color: "Royal Blue",
    size: "660L",
  }),
  item({
    id: "lime",
    name: "660L Bin Lime Green",
    sku: "660L-BIN-LIME-GREEN",
    category: "Bin",
    color: "Lime Green",
    size: "660L",
  }),
  item({
    id: "vermin",
    name: "120L Vermin Lid Red",
    sku: "120L-VERMIN-LID-RED",
    category: "Vermin Lid",
    color: "Red",
    size: "120L",
  }),
  item({
    id: "lid-red",
    name: "80L Lid Red",
    sku: "80L-LID-RED",
    category: "Lid",
    color: "Red",
    size: "80L",
  }),
  item({
    id: "dark-green",
    name: "240L Bin Dark Green",
    sku: "240L-BIN-DARK-GREEN",
    category: "Bin",
    color: "Dark Green",
    size: "240L",
  }),
  item({
    id: "light-blue",
    name: "240L Lid Light Blue",
    sku: "240L-LID-LIGHT-BLUE",
    category: "Lid",
    color: "Light Blue",
    size: "240L",
  }),
  item({
    id: "untouched",
    name: "100L Bin Black",
    sku: "100L-BIN-BLACK",
    category: "Bin",
    color: "Black",
    size: "100L",
  }),
];

// Nets match the 23 Oct stocktake: backorders stay negative, a counted
// SKU can net to 0, and positive rows are the plain sum of their quantities
// (the spreadsheet's later -1 edits are not applied here).
const entries: CountEntry[] = [
  entry("royal", -60, "Backorder", 1),
  entry("lime", 2, "Aisle", 2),
  entry("lime", -10, "Backorder", 3),
  entry("lime", 0, "Aisle", 4),
  entry("vermin", -37, "", 5),
  entry("lid-red", 4, "Shelf", 6),
  entry("lid-red", -4, "Shelf", 7),
  entry("dark-green", 30, "", 8),
  entry("dark-green", 24, "", 9),
  entry("light-blue", 100, "", 10),
  entry("light-blue", 18, "", 11),
];

function summaryTable(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("Summary");
  assert.ok(sheet, "Summary sheet missing");
  let headerRow = 0;
  sheet.eachRow((row, n) => {
    if (row.getCell(1).value === "Category") headerRow = n;
  });
  assert.ok(headerRow > 0, "Summary header row missing");

  const records: { sku: string; total: ExcelJS.CellValue; locations: ExcelJS.CellValue }[] = [];
  let grand: ExcelJS.CellValue = null;
  sheet.eachRow((row, n) => {
    if (n <= headerRow) return;
    const label = row.getCell(1).value;
    if (label === "Grand total") {
      grand = row.getCell(6).value;
      return;
    }
    const sku = row.getCell(3).value;
    if (typeof sku !== "string" || sku === "") return;
    records.push({
      sku,
      total: row.getCell(6).value,
      locations: row.getCell(7).value,
    });
  });
  return { records, grand };
}

function detailGrandTotal(workbook: ExcelJS.Workbook): ExcelJS.CellValue {
  const sheet = workbook.getWorksheet("Detailed Counts");
  assert.ok(sheet, "Detailed Counts sheet missing");
  let grand: ExcelJS.CellValue = null;
  let quantityRows = 0;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === "Grand total") grand = row.getCell(7).value;
    if (typeof row.getCell(7).value === "number" && row.getCell(1).value !== "Grand total") {
      quantityRows += 1;
    }
  });
  assert.equal(quantityRows, entries.length);
  return grand;
}

describe("stocktake summary export", () => {
  const workbook = buildSessionWorkbook(session, items, entries);
  const { records, grand } = summaryTable(workbook);
  const bySku = new Map(records.map((r) => [r.sku, r]));

  it("includes zero and negative nets as real numbers", () => {
    assert.equal(bySku.get("660L-BIN-ROYAL-BLUE")?.total, -60);
    assert.equal(bySku.get("660L-BIN-LIME-GREEN")?.total, -8);
    assert.equal(bySku.get("120L-VERMIN-LID-RED")?.total, -37);
    assert.equal(bySku.get("80L-LID-RED")?.total, 0);
    for (const sku of [
      "660L-BIN-ROYAL-BLUE",
      "660L-BIN-LIME-GREEN",
      "120L-VERMIN-LID-RED",
      "80L-LID-RED",
    ]) {
      assert.equal(typeof bySku.get(sku)?.total, "number", sku);
    }
  });

  it("keeps positive totals as the sum of count quantities", () => {
    assert.equal(bySku.get("240L-BIN-DARK-GREEN")?.total, 54);
    assert.equal(bySku.get("240L-LID-LIGHT-BLUE")?.total, 118);
  });

  it("omits SKUs that have no count rows", () => {
    assert.equal(bySku.has("100L-BIN-BLACK"), false);
    assert.equal(records.length, 6);
  });

  it("shows negative location quantities without clamping", () => {
    assert.equal(bySku.get("660L-BIN-ROYAL-BLUE")?.locations, "Backorder (-60)");
    assert.equal(
      bySku.get("660L-BIN-LIME-GREEN")?.locations,
      "Aisle (2), Backorder (-10)"
    );
  });

  it("sets the grand total to the sum of every summary total, including negatives", () => {
    const columnSum = records.reduce((sum, r) => sum + Number(r.total), 0);
    assert.equal(columnSum, -60 + -8 + -37 + 0 + 54 + 118);
    assert.equal(grand, columnSum);
    assert.equal(detailGrandTotal(workbook), columnSum);
  });

  it("keeps negative quantities on the detailed counts sheet", () => {
    const sheet = workbook.getWorksheet("Detailed Counts");
    assert.ok(sheet);
    const quantities: number[] = [];
    sheet.eachRow((row) => {
      const sku = row.getCell(3).value;
      const qty = row.getCell(7).value;
      if (sku === "660L-BIN-ROYAL-BLUE" && typeof qty === "number") quantities.push(qty);
    });
    assert.deepEqual(quantities, [-60]);
  });
});
