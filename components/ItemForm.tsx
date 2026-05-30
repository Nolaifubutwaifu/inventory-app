"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Scan, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input, Textarea } from "./Input";
import { ItemPhoto } from "./ItemPhoto";
import { ReferencePhotosField } from "./ReferencePhotosField";
import { BarcodeScanSheet } from "./BarcodeScanSheet";
import { createItem, deleteItem, updateItem } from "@/lib/repo";
import { fileToDataUrl } from "@/lib/utils";
import type { Item } from "@/lib/types";
import { useToast } from "./Toast";
import { useConfirm } from "./ConfirmDialog";

interface ItemFormProps {
  item?: Item;
}

export function ItemForm({ item }: ItemFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const isEdit = Boolean(item);
  const toast = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [category, setCategory] = useState(item?.category ?? "Bin");
  const [color, setColor] = useState(item?.color ?? "");
  const [size, setSize] = useState(item?.size ?? "");
  const [matchingLidSku, setMatchingLidSku] = useState(item?.matchingLidSku ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [photoUrl, setPhotoUrl] = useState(item?.photoUrl ?? "");
  const [barcode, setBarcode] = useState(item?.barcode ?? "");
  const [referencePhotos, setReferencePhotos] = useState<string[]>(
    item?.referencePhotos ?? []
  );
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPhotoUrl(dataUrl);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim(),
        category: category.trim() || "Item",
        color: color.trim(),
        size: size.trim(),
        matchingLidSku: matchingLidSku.trim() || undefined,
        notes: notes.trim() || undefined,
        photoUrl: photoUrl || undefined,
        barcode: barcode.trim() || undefined,
        referencePhotos: referencePhotos.length ? referencePhotos : undefined,
      };
      if (isEdit && item) {
        await updateItem(item.id, payload);
        toast.show("Item updated", "success");
        router.back();
      } else {
        await createItem(payload);
        toast.show("Item created", "success");
        router.replace("/items");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!item) return;
    const ok = await confirm({
      title: "Delete this item?",
      message:
        "This removes the item from the catalog AND all its count entries across every session. This can't be undone.",
      confirmLabel: "Delete item",
      destructive: true,
    });
    if (!ok) return;
    await deleteItem(item.id);
    toast.show("Item deleted", "info");
    router.replace("/items");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4 pb-44">
      <div className="flex items-center gap-4">
        <ItemPhoto src={photoUrl} size="lg" />
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {photoUrl ? "Change photo" : "Add photo"}
          </Button>
          {photoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPhotoUrl("")}
            >
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto}
          />
        </div>
      </div>

      <Input
        label="Item name"
        autoFocus={!isEdit}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="60L Storage Bin"
        required
      />
      <Input
        label="SKU"
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        placeholder="BIN-60-BLK"
        autoCapitalize="characters"
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="Black"
        />
        <Input
          label="Size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="60L"
        />
      </div>
      <Input
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Bin / Lid / …"
      />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Barcode"
            hint="Optional — used by the barcode scanner."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 4006381333931"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => setScanOpen(true)}
        >
          <Scan className="h-5 w-5" /> Scan
        </Button>
      </div>

      <Input
        label="Matching lid SKU"
        hint="Optional — link a bin to its matching lid."
        value={matchingLidSku}
        onChange={(e) => setMatchingLidSku(e.target.value)}
        placeholder="LID-60-BLK"
        autoCapitalize="characters"
      />
      <Textarea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Stacked near loading bay"
      />

      <ReferencePhotosField
        value={referencePhotos}
        onChange={setReferencePhotos}
      />

      <BarcodeScanSheet
        open={scanOpen}
        mode="capture"
        onClose={() => setScanOpen(false)}
        onResult={(r) => {
          if (r.kind === "captured") {
            setBarcode(r.code);
            toast.show(`Captured ${r.code}`, "success");
          }
          setScanOpen(false);
        }}
      />

      <div
        className="fixed inset-x-0 z-30 mx-auto w-full max-w-xl border-t border-border bg-surface/95 p-3 backdrop-blur"
        style={{ bottom: "calc(4rem + var(--safe-bottom))" }}
      >
        <div className="flex gap-2">
          {isEdit && (
            <Button type="button" variant="ghost" onClick={onDelete} size="lg">
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create item"}
          </Button>
        </div>
      </div>
    </form>
  );
}
