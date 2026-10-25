import type { CountEntry, Item } from "./types";

// 80L and 120L wheelie-bin lids are the same physical lid. The catalogue
// still has separate rows (80L-LID-<COLOUR> next to 120L-LID-<COLOUR>)
// because those SKUs were entered as different products. 120L-LID-<COLOUR>
// is the one we keep.
//
// Counts live in IndexedDB and are synced through Supabase. Rewriting history
// and deleting the 80L rows from code would race with other devices, so the
// fold is applied every time items or counts are read. It is idempotent:
// running it again does not add the 80L quantities a second time. New counts
// and newly created 80L lid SKUs are stored on the matching 120L lid instead.
//
// Vermin lids, pedal bins, and bin bodies are different products. A SKU only
// matches when it is exactly 80L-LID-<COLOUR> or 120L-LID-<COLOUR>, and the
// name, category, and SKU do not mention vermin or pedal.

const PLAIN_LID_SKU = /^(80|120)L-LID-(.+)$/i;
const OTHER_PRODUCT = /\b(vermin|pedal)\b/i;

export interface PlainLidIdentity {
  litres: "80" | "120";
  /** Colour suffix as written on the SKU, e.g. "RED" or "DARK-GREEN". */
  colour: string;
  colourKey: string;
}

export function plainLidIdentity(
  item: Pick<Item, "sku" | "name" | "category">
): PlainLidIdentity | null {
  const sku = item.sku.trim();
  const haystack = `${sku} ${item.name} ${item.category}`;
  if (OTHER_PRODUCT.test(haystack)) return null;
  const match = PLAIN_LID_SKU.exec(sku);
  if (!match) return null;
  const colour = match[2].trim();
  if (!colour || OTHER_PRODUCT.test(colour)) return null;
  return {
    litres: match[1] === "80" ? "80" : "120",
    colour,
    colourKey: colour.toLowerCase(),
  };
}

export interface LidFold<T extends Item = Item> {
  items: T[];
  /**
   * Plain-lid item id -> the id that should own its counts. The canonical
   * 120L lid maps to itself. An 80L lid maps to that 120L lid when one
   * exists, otherwise to the oldest 80L lid of that colour (shown as 120L).
   */
  canonicalIdByItemId: ReadonlyMap<string, string>;
}

function byAge<T extends Item>(items: readonly T[]): T[] {
  return items
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

function canonicalSku(colour: string): string {
  return `120L-LID-${colour}`;
}

function rewriteLidSize(size: string): string {
  return /^\s*80\s*L\s*$/i.test(size) ? "120L" : size;
}

function rewriteLidName(name: string): string {
  return name.replace(/\b80\s*L\b/gi, "120L");
}

/** Show an 80L plain-lid row as the canonical 120L lid. The id is unchanged. */
function promote80To120<T extends Item>(item: T): T {
  const parsed = plainLidIdentity(item);
  if (!parsed || parsed.litres !== "80") return item;
  return {
    ...item,
    sku: canonicalSku(parsed.colour),
    size: rewriteLidSize(item.size),
    name: rewriteLidName(item.name),
  };
}

// The 80L row may be the one with the photo or barcode. Keep those on the
// line people actually see, without writing them back to the database.
function withAliasDetails<T extends Item>(canonical: T, aliases: readonly T[]): T {
  if (aliases.length === 0) return canonical;
  const patch: Partial<Item> = {};
  if (!canonical.photoUrl) {
    const photo = aliases.find((alias) => alias.photoUrl)?.photoUrl;
    if (photo) patch.photoUrl = photo;
  }
  if (!canonical.referencePhotos?.length) {
    const refs = aliases.find((alias) => alias.referencePhotos?.length)?.referencePhotos;
    if (refs) patch.referencePhotos = refs;
  }
  if (!canonical.barcode) {
    const barcode = aliases.find((alias) => alias.barcode)?.barcode;
    if (barcode) patch.barcode = barcode;
  }
  if (Object.keys(patch).length === 0) return canonical;
  return { ...canonical, ...patch };
}

export function foldPlainLids<T extends Item>(items: readonly T[]): LidFold<T> {
  const byUserColour = new Map<string, { lids80: T[]; lids120: T[] }>();
  for (const item of items) {
    const parsed = plainLidIdentity(item);
    if (!parsed) continue;
    const key = `${item.userId}\0${parsed.colourKey}`;
    const slot = byUserColour.get(key) ?? { lids80: [], lids120: [] };
    (parsed.litres === "80" ? slot.lids80 : slot.lids120).push(item);
    byUserColour.set(key, slot);
  }

  const canonicalIdByItemId = new Map<string, string>();
  const hidden = new Set<string>();
  const replacement = new Map<string, T>();

  for (const slot of byUserColour.values()) {
    const lids120 = byAge(slot.lids120);
    const lids80 = byAge(slot.lids80);
    // A second 120L row of the same colour stays visible. Only 80L rows fold.
    for (const extra of lids120.slice(1)) canonicalIdByItemId.set(extra.id, extra.id);
    if (lids120.length === 0 && lids80.length === 0) continue;

    const canonical = lids120[0] ?? lids80[0];
    const aliases = lids120.length > 0 ? lids80 : lids80.slice(1);
    canonicalIdByItemId.set(canonical.id, canonical.id);
    for (const alias of aliases) {
      canonicalIdByItemId.set(alias.id, canonical.id);
      hidden.add(alias.id);
    }

    let shown = lids120.length === 0 ? promote80To120(canonical) : canonical;
    shown = withAliasDetails(shown, aliases);
    if (shown !== canonical) replacement.set(canonical.id, shown);
  }

  return {
    items: items
      .filter((item) => !hidden.has(item.id))
      .map((item) => replacement.get(item.id) ?? item),
    canonicalIdByItemId,
  };
}

export function findCanonical120Lid(
  items: readonly Item[],
  colourKey: string,
  userId?: string
): Item | undefined {
  return byAge(
    items.filter((item) => {
      if (userId !== undefined && item.userId !== userId) return false;
      const parsed = plainLidIdentity(item);
      return parsed?.litres === "120" && parsed.colourKey === colourKey;
    })
  )[0];
}

/** Item id a new count should be stored against. */
export function canonicalCountItemId(items: readonly Item[], itemId: string): string {
  return foldPlainLids(items).canonicalIdByItemId.get(itemId) ?? itemId;
}

/** Every stored item id whose counts belong on this lid line, including itself. */
export function entryItemIdsFor(items: readonly Item[], itemId: string): Set<string> {
  const fold = foldPlainLids(items);
  const canonical = fold.canonicalIdByItemId.get(itemId) ?? itemId;
  const ids = new Set<string>([itemId, canonical]);
  for (const [from, to] of fold.canonicalIdByItemId) {
    if (to === canonical) ids.add(from);
  }
  return ids;
}

type LidDraft = { name: string; sku: string; category: string; size: string };

/**
 * Creating an 80L plain lid does not add a second catalogue row. When the
 * 120L lid of that colour already exists, the caller keeps that row. Otherwise
 * the draft is stored under the 120L SKU.
 */
export function resolveNewLidItem<T extends LidDraft>(
  existing: readonly Item[],
  draft: T
): { item: Item } | { draft: T } {
  const parsed = plainLidIdentity(draft);
  if (!parsed || parsed.litres !== "80") return { draft };
  const canonical = findCanonical120Lid(existing, parsed.colourKey);
  if (canonical) return { item: canonical };
  return {
    draft: {
      ...draft,
      sku: canonicalSku(parsed.colour),
      size: rewriteLidSize(draft.size),
      name: rewriteLidName(draft.name),
    },
  };
}

/** Read-time view of a stocktake: one plain-lid line per colour, counts summed. */
export function foldStocktake<T extends Item>(
  items: readonly T[],
  entries: readonly CountEntry[]
): { items: T[]; entries: CountEntry[] } {
  const fold = foldPlainLids(items);
  return {
    items: fold.items,
    entries: entries.map((entry) => {
      const itemId = fold.canonicalIdByItemId.get(entry.itemId) ?? entry.itemId;
      return itemId === entry.itemId ? entry : { ...entry, itemId };
    }),
  };
}
