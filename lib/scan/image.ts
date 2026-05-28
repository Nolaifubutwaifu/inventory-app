export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

export async function compressDataUrl(
  dataUrl: string,
  opts: CompressOptions = {}
): Promise<string> {
  const { maxEdge = 1024, quality = 0.78, mimeType = "image/jpeg" } = opts;
  const blob = await dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  (ctx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D).drawImage(
    bitmap,
    0,
    0,
    w,
    h
  );
  bitmap.close();

  if (canvas instanceof OffscreenCanvas) {
    const out = await canvas.convertToBlob({ type: mimeType, quality });
    return await blobToDataUrl(out);
  }
  return (canvas as HTMLCanvasElement).toDataURL(mimeType, quality);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function fileToCompressedDataUrl(
  file: File,
  opts?: CompressOptions
): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return await compressDataUrl(raw, opts);
}
