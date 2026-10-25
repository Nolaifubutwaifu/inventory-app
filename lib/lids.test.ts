import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalCountItemId,
  entryItemIdsFor,
  foldPlainLids,
  foldStocktake,
  plainLidIdentity,
  resolveNewLidItem,
} from "./lids";
import { buildMatrixGroups, columnKey } from "./matrix";
import type { CountEntry, Item } from "./types";

function item(partial: Pick<Item, "id" | "name" | "sku" | "category" | "color" | "size"> & Partial<Item>): Item {
  return {
    userId: "user-1",
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

function entry(itemId: string, quantity: number): CountEntry {
  return {
    id: `${itemId}-${quantity}`,
    userId: "user-1",
    sessionId: "session-1",
    itemId,
    quantity,
    location: "",
    createdAt: 1,
  };
}

const lid120 = item({
  id: "lid-120",
  name: "120L Lid Red",
  sku: "120L-LID-RED",
  category: "Lid",
  color: "Red",
  size: "120L",
  createdAt: 2,
});
const lid80 = item({
  id: "lid-80",
  name: "80L Lid Red",
  sku: "80L-LID-RED",
  category: "Lid",
  color: "Red",
  size: "80L",
  createdAt: 1,
  photoUrl: "data:image/jpeg;base64,eighty",
  barcode: "80-BAR",
});
const bin80 = item({
  id: "bin-80",
  name: "80L Bin Red",
  sku: "80L-BIN-RED",
  category: "Bin",
  color: "Red",
  size: "80L",
});
const bin120 = item({
  id: "bin-120",
  name: "120L Bin Red",
  sku: "120L-BIN-RED",
  category: "Bin",
  color: "Red",
  size: "120L",
});
const vermin = item({
  id: "vermin",
  name: "120L Vermin Lid Red",
  sku: "120L-VERMIN-LID-RED",
  category: "Vermin Lid",
  color: "Red",
  size: "120L",
});
const pedal = item({
  id: "pedal",
  name: "80L Pedal Bin Lid Red",
  sku: "80L-LID-RED",
  category: "Pedal Bin Lid",
  color: "Red",
  size: "80L",
});

describe("plain lid identity", () => {
  it("matches only 80L and 120L plain lid SKUs", () => {
    assert.equal(plainLidIdentity(lid80)?.litres, "80");
    assert.equal(plainLidIdentity(lid120)?.colourKey, "red");
    assert.equal(plainLidIdentity(bin80), null);
    assert.equal(plainLidIdentity(bin120), null);
    assert.equal(plainLidIdentity(vermin), null);
    assert.equal(plainLidIdentity(pedal), null);
    assert.equal(
      plainLidIdentity(
        item({
          id: "dark",
          name: "120L Lid Dark Green",
          sku: "120L-LID-DARK-GREEN",
          category: "Lid",
          color: "Dark Green",
          size: "120L",
        })
      )?.colour,
      "DARK-GREEN"
    );
  });
});

describe("foldPlainLids", () => {
  const catalogue = [bin80, bin120, lid80, lid120, vermin, pedal];

  it("hides the 80L lid behind the matching 120L lid and sums later", () => {
    const fold = foldPlainLids(catalogue);
    const ids = fold.items.map((it) => it.id);
    assert.equal(ids.includes("lid-80"), false);
    assert.ok(ids.includes("lid-120"));
    assert.ok(ids.includes("bin-80"));
    assert.ok(ids.includes("bin-120"));
    assert.ok(ids.includes("vermin"));
    assert.ok(ids.includes("pedal"));
    assert.equal(fold.canonicalIdByItemId.get("lid-80"), "lid-120");
    assert.equal(fold.canonicalIdByItemId.get("lid-120"), "lid-120");
    assert.equal(fold.canonicalIdByItemId.get("bin-80"), undefined);
    const shown = fold.items.find((it) => it.id === "lid-120");
    assert.equal(shown?.sku, "120L-LID-RED");
    assert.equal(shown?.photoUrl, "data:image/jpeg;base64,eighty");
    assert.equal(shown?.barcode, "80-BAR");
  });

  it("shows a lone 80L lid as the 120L SKU without dropping it", () => {
    const fold = foldPlainLids([lid80, bin80]);
    assert.equal(fold.items.length, 2);
    const shown = fold.items.find((it) => it.id === "lid-80");
    assert.equal(shown?.sku, "120L-LID-RED");
    assert.equal(shown?.size, "120L");
    assert.equal(shown?.name, "120L Lid Red");
    assert.equal(fold.canonicalIdByItemId.get("lid-80"), "lid-80");
    const bin = fold.items.find((it) => it.id === "bin-80");
    assert.equal(bin?.sku, "80L-BIN-RED");
    assert.equal(bin?.size, "80L");
  });

  it("does not fold lids across accounts", () => {
    const other = item({
      ...lid80,
      id: "other-80",
      userId: "user-2",
    });
    const fold = foldPlainLids([lid120, other]);
    assert.equal(fold.items.length, 2);
    assert.equal(fold.canonicalIdByItemId.get("other-80"), "other-80");
    assert.equal(fold.items.find((it) => it.id === "other-80")?.sku, "120L-LID-RED");
  });

  it("is idempotent", () => {
    const once = foldPlainLids(catalogue);
    const twice = foldPlainLids(once.items);
    assert.deepEqual(
      twice.items.map((it) => [it.id, it.sku, it.size]),
      once.items.map((it) => [it.id, it.sku, it.size])
    );
  });

  it("puts the shared lid on the 120L column and leaves the 80L bin", () => {
    const groups = buildMatrixGroups(foldPlainLids(catalogue).items);
    const wheelie = groups.find((g) => g.name === "Wheelie Bins");
    assert.ok(wheelie);
    const keys = wheelie.columns.map((c) => c.key);
    assert.equal(keys.includes(columnKey("80L", "Lid")), false);
    assert.equal(keys.includes(columnKey("80L", "Bin")), true);
    assert.equal(keys.includes(columnKey("120L", "Lid")), true);
    assert.equal(keys.includes(columnKey("120L", "Bin")), true);
    const pedalGroup = groups.find((g) => g.name === "Pedal Lids");
    assert.ok(pedalGroup);
    assert.equal(
      pedalGroup.columns.some((c) => c.key === columnKey("80L", "Lid")),
      true
    );
    const verminGroup = groups.find((g) => g.name === "Vermin Lids");
    assert.ok(verminGroup);
    assert.equal(verminGroup.rows.length, 1);
  });
});

describe("count routing", () => {
  const catalogue = [lid80, lid120, bin80, vermin, pedal];

  it("sends a new 80L lid count to the 120L lid", () => {
    assert.equal(canonicalCountItemId(catalogue, "lid-80"), "lid-120");
    assert.equal(canonicalCountItemId(catalogue, "lid-120"), "lid-120");
    assert.equal(canonicalCountItemId(catalogue, "bin-80"), "bin-80");
    assert.equal(canonicalCountItemId(catalogue, "vermin"), "vermin");
    assert.equal(canonicalCountItemId(catalogue, "pedal"), "pedal");
  });

  it("includes stored 80L history when the 120L lid is opened", () => {
    const ids = entryItemIdsFor(catalogue, "lid-120");
    assert.equal(ids.has("lid-120"), true);
    assert.equal(ids.has("lid-80"), true);
    assert.equal(ids.has("bin-80"), false);
    assert.equal(ids.has("pedal"), false);
    assert.equal(entryItemIdsFor(catalogue, "bin-80").has("lid-80"), false);
  });

  it("reuses the 120L lid when someone adds an 80L lid of that colour", () => {
    const resolved = resolveNewLidItem(catalogue, {
      name: "80L Lid Red",
      sku: "80L-LID-RED",
      category: "Lid",
      size: "80L",
    });
    assert.equal("item" in resolved && resolved.item.id, "lid-120");
  });

  it("stores a new colour under the 120L SKU", () => {
    const resolved = resolveNewLidItem(catalogue, {
      name: "80L Lid Blue",
      sku: "80L-LID-BLUE",
      category: "Lid",
      size: "80L",
    });
    assert.ok("draft" in resolved);
    if (!("draft" in resolved)) return;
    assert.equal(resolved.draft.sku, "120L-LID-BLUE");
    assert.equal(resolved.draft.size, "120L");
    assert.equal(resolved.draft.name, "120L Lid Blue");
  });

  it("does not rewrite a pedal lid or a bin body", () => {
    const pedalDraft = resolveNewLidItem(catalogue, {
      name: "80L Pedal Bin Lid Blue",
      sku: "80L-LID-BLUE",
      category: "Pedal Bin Lid",
      size: "80L",
    });
    assert.ok("draft" in pedalDraft);
    if ("draft" in pedalDraft) assert.equal(pedalDraft.draft.sku, "80L-LID-BLUE");
    const binDraft = resolveNewLidItem(catalogue, {
      name: "80L Bin Blue",
      sku: "80L-BIN-BLUE",
      category: "Bin",
      size: "80L",
    });
    assert.ok("draft" in binDraft);
    if ("draft" in binDraft) {
      assert.equal(binDraft.draft.sku, "80L-BIN-BLUE");
      assert.equal(binDraft.draft.size, "80L");
    }
  });
});

describe("foldStocktake", () => {
  it("sums 80L and 120L quantities once, including a second pass", () => {
    const items = [lid80, lid120, bin80];
    const entries = [entry("lid-120", 98), entry("lid-80", 7), entry("bin-80", 3)];
    const once = foldStocktake(items, entries);
    const twice = foldStocktake(once.items, once.entries);
    const sum = (rows: CountEntry[]) => rows.reduce((total, row) => total + row.quantity, 0);
    assert.equal(sum(once.entries), 98 + 7 + 3);
    assert.equal(sum(twice.entries), 98 + 7 + 3);
    assert.deepEqual(
      twice.entries.map((row) => row.itemId),
      ["lid-120", "lid-120", "bin-80"]
    );
    assert.equal(once.items.some((it) => it.sku === "80L-LID-RED"), false);
  });
});
