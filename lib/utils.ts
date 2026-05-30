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

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
