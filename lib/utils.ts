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

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
