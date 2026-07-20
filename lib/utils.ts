import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Item } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// photoUrl wins when set; otherwise fall back to first reference photo.
export function displayPhoto(item: Pick<Item, "photoUrl" | "referencePhotos">): string | undefined {
  return item.photoUrl || item.referencePhotos?.[0];
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// AND-matches every whitespace-separated token in `query` against the joined
// haystack. Lets "bin black" match an item whose name, color, and SKU don't
// sit next to each other in any single field.
export function matchesQuery(query: string, fields: (string | undefined | null)[]): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

// Suggests a SKU for a new item name by learning from existing items:
//  - exact name match -> reuse that item's SKU,
//  - a name differing by a single word (same word count) -> reuse its SKU and
//    swap only the changed segment, so "Bin 80L Black" (BIN-80-BLACK) makes
//    "Bin 80L Green" suggest "BIN-80-GREEN",
//  - otherwise a generic UPPER-CASE-DASHED transform of the name.
// The result is only a default — the user can always edit it.
export function suggestSkuFromName(
  name: string,
  items: Pick<Item, "name" | "sku">[]
): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  const seg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const target = name.trim().toLowerCase();

  const exact = items.find(
    (it) => it.sku && it.name.trim().toLowerCase() === target
  );
  if (exact) return exact.sku;

  let best: { itemTokens: string[]; skuSegs: string[] } | null = null;
  for (const it of items) {
    if (!it.sku) continue;
    const itemTokens = it.name.trim().split(/\s+/).filter(Boolean);
    const skuSegs = it.sku.split("-");
    // Only learn from items whose name and SKU line up word-for-word.
    if (itemTokens.length !== tokens.length || skuSegs.length !== tokens.length) {
      continue;
    }
    let matches = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].toLowerCase() === itemTokens[i].toLowerCase()) matches++;
    }
    // Differ by exactly one word — the variant case we want to template from.
    if (matches === tokens.length - 1) {
      best = { itemTokens, skuSegs };
      break;
    }
  }

  if (best) {
    const segs = best.skuSegs.slice();
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].toLowerCase() !== best.itemTokens[i].toLowerCase()) {
        segs[i] = seg(tokens[i]);
      }
    }
    return segs.join("-");
  }

  return tokens.map(seg).join("-");
}

