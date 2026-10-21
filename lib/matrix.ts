import type { Item } from "./types";

// Lays the catalog out like the paper count sheets: one grid per product
// family, colours down the side, sizes across the top, and a Bin / Lid
// sub-column under each size. Items without a colour or size (spare parts)
// fall through to a plain list under the grid.

export type Part = "Bin" | "Lid" | "";

// Category (and sheet name) for wheels, axles and other loose parts.
export const SPARE_PARTS = "Spare Parts";

export interface MatrixColumn {
  key: string;
  size: string;
  part: Part;
}

export interface MatrixSizeGroup {
  size: string;
  columns: MatrixColumn[];
}

export interface MatrixRow {
  color: string;
  // column key -> item
  cells: Map<string, Item>;
}

export interface MatrixGroup {
  name: string;
  sizes: MatrixSizeGroup[];
  columns: MatrixColumn[];
  rows: MatrixRow[];
  // Items in this family that don't fit the grid (missing colour or size).
  loose: Item[];
}

// Row order used on the printed count sheets; anything else sorts after,
// alphabetically.
const COLOR_ORDER = [
  "Grass (Shadow) Green",
  "Grass Green",
  "Shadow Green",
  "Dark Green",
  "Council Green",
  "Mud Green",
  "Lime Green",
  "Dark Grey",
  "Light Grey",
  "Royal Blue",
  "Light Blue",
  "Sky Blue",
  "Black",
  "White",
  "Purple",
  "Ugly Purple",
  "Orange",
  "Red",
  "Ugly Red",
  "Red (AJ Bush)",
  "Yellow",
];

const PART_ORDER: Part[] = ["Bin", "Lid", ""];

export function partOf(item: Pick<Item, "name" | "category">): Part {
  const text = `${item.name} ${item.category}`;
  if (/\blids?\b/i.test(text)) return "Lid";
  if (/\bbins?\b|\bbody\b/i.test(text)) return "Bin";
  return "";
}

// Family the item belongs to — its category with the bin/lid wording removed,
// so "Pedal Bin" and "Pedal Bin Lid" share a grid. Plain "Bin" / "Lid" are
// the wheelie bins.
export function familyOf(item: Pick<Item, "category">): string {
  const raw = (item.category || "").trim();
  if (!raw) return "Other";
  const cleaned = raw
    .replace(/\b(bins?|lids?|bodies|body)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Wheelie";
}

// "Wheelie" + bins -> "Wheelie Bins"; a lid-only family -> "Vermin Lids".
function familyLabel(family: string, items: Item[]): string {
  if (family === "Other") return family;
  const parts = new Set(items.map(partOf));
  if (parts.has("Bin")) return `${family} Bins`;
  if (parts.has("Lid")) return `${family} Lids`;
  return family;
}

function sizeValue(size: string): number {
  const m = size.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : Number.NaN;
}

function compareSizesDesc(a: string, b: string): number {
  const va = sizeValue(a);
  const vb = sizeValue(b);
  if (Number.isFinite(va) && Number.isFinite(vb) && va !== vb) return vb - va;
  if (Number.isFinite(va) !== Number.isFinite(vb)) return Number.isFinite(va) ? -1 : 1;
  return a.localeCompare(b);
}

function colorRank(color: string): number {
  const i = COLOR_ORDER.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  return i === -1 ? COLOR_ORDER.length : i;
}

function compareColors(a: string, b: string): number {
  const d = colorRank(a) - colorRank(b);
  return d !== 0 ? d : a.localeCompare(b);
}

export function columnKey(size: string, part: Part): string {
  return `${size.toLowerCase()}|${part}`;
}

export function buildMatrixGroups(items: Item[]): MatrixGroup[] {
  const byFamily = new Map<string, Item[]>();
  for (const it of items) {
    const fam = familyOf(it);
    const list = byFamily.get(fam);
    if (list) list.push(it);
    else byFamily.set(fam, [it]);
  }

  const groups: MatrixGroup[] = [];
  for (const [family, list] of byFamily) {
    const name = familyLabel(family, list);
    const gridItems: Item[] = [];
    const loose: Item[] = [];
    for (const it of list) {
      if (it.color?.trim() && it.size?.trim()) gridItems.push(it);
      else loose.push(it);
    }

    // Columns: every size seen, each split by the parts that exist for it.
    const partsBySize = new Map<string, { label: string; parts: Set<Part> }>();
    for (const it of gridItems) {
      const label = it.size.trim();
      const k = label.toLowerCase();
      const entry = partsBySize.get(k) ?? { label, parts: new Set<Part>() };
      entry.parts.add(partOf(it));
      partsBySize.set(k, entry);
    }
    const sizes: MatrixSizeGroup[] = Array.from(partsBySize.values())
      .sort((a, b) => compareSizesDesc(a.label, b.label))
      .map(({ label, parts }) => ({
        size: label,
        columns: PART_ORDER.filter((p) => parts.has(p)).map((part) => ({
          key: columnKey(label, part),
          size: label,
          part,
        })),
      }));
    const columns = sizes.flatMap((s) => s.columns);

    const rowsByColor = new Map<string, MatrixRow>();
    for (const it of gridItems) {
      const color = it.color.trim();
      const k = color.toLowerCase();
      const row = rowsByColor.get(k) ?? { color, cells: new Map<string, Item>() };
      const ck = columnKey(it.size.trim(), partOf(it));
      // Duplicate (colour, size, part) items: keep the first, list the rest
      // separately so nothing becomes uncountable.
      if (row.cells.has(ck)) loose.push(it);
      else row.cells.set(ck, it);
      rowsByColor.set(k, row);
    }
    const rows = Array.from(rowsByColor.values()).sort((a, b) =>
      compareColors(a.color, b.color)
    );

    // A pure list (spare parts) keeps the order items were added in, so new
    // rows land at the bottom; leftovers under a grid sort A-Z.
    if (rows.length === 0) loose.sort((a, b) => a.createdAt - b.createdAt);
    else loose.sort((a, b) => a.name.localeCompare(b.name));
    groups.push({ name, sizes, columns, rows, loose });
  }

  // The spare parts sheet is always offered so parts can be added from it.
  if (!groups.some((g) => g.name === SPARE_PARTS)) {
    groups.push({ name: SPARE_PARTS, sizes: [], columns: [], rows: [], loose: [] });
  }

  // Families with a real grid first (biggest first, matching the sheet
  // order: wheelie, pedal, vermin), then list-only families A-Z.
  const gridSize = (g: MatrixGroup) =>
    g.rows.reduce((n, r) => n + r.cells.size, 0);
  return groups.sort((a, b) => {
    const ga = a.rows.length > 0 ? 0 : 1;
    const gb = b.rows.length > 0 ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const d = gridSize(b) - gridSize(a);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

// Reading order of every countable item in a group: across each row, then
// down, then the loose list. Drives "save and move to the next box".
export function groupOrder(group: MatrixGroup): Item[] {
  const out: Item[] = [];
  for (const row of group.rows) {
    for (const col of group.columns) {
      const it = row.cells.get(col.key);
      if (it) out.push(it);
    }
  }
  out.push(...group.loose);
  return out;
}

// Text colour that stays readable on a swatch: near-black on light colours
// (yellow, lime, white), white on dark ones.
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.3 ? "#0f172a" : "#ffffff";
}

// Rough swatch colour for each row, keyed off the colour name.
export function swatchFor(color: string): string | undefined {
  const c = color.toLowerCase();
  if (c.includes("black")) return "#111827";
  if (c.includes("white")) return "#f8fafc";
  if (c.includes("dark grey") || c.includes("charcoal")) return "#4b5563";
  if (c.includes("light grey") || c.includes("grey") || c.includes("gray")) return "#cbd5e1";
  if (c.includes("royal blue")) return "#1d4ed8";
  if (c.includes("sky blue")) return "#38bdf8";
  if (c.includes("light blue")) return "#7dd3fc";
  if (c.includes("blue")) return "#2563eb";
  if (c.includes("lime")) return "#84cc16";
  if (c.includes("mud")) return "#6b7a3a";
  if (c.includes("council")) return "#2f6b3a";
  if (c.includes("dark green")) return "#14532d";
  if (c.includes("grass") || c.includes("shadow")) return "#3f7d3a";
  if (c.includes("green")) return "#16a34a";
  // Variants get their own shade so neighbouring rows stay distinguishable.
  if (c.includes("ugly purple")) return "#a855f7";
  if (c.includes("purple")) return "#7e22ce";
  if (c.includes("orange")) return "#f97316";
  if (c.includes("ugly red")) return "#991b1b";
  if (c.includes("aj bush")) return "#f05252";
  if (c.includes("red")) return "#dc2626";
  if (c.includes("yellow")) return "#facc15";
  if (c.includes("brown")) return "#78350f";
  return undefined;
}
