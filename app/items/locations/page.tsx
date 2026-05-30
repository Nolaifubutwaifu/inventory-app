"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ItemsTabs } from "@/components/ItemsTabs";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { useLocationTemplates } from "@/lib/hooks";
import {
  createLocationTemplate,
  deleteLocationTemplate,
  updateLocationTemplate,
} from "@/lib/repo";
import type { LocationTemplate } from "@/lib/types";

export default function LocationsPage() {
  const templates = useLocationTemplates();
  const toast = useToast();
  const confirm = useConfirm();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    try {
      await createLocationTemplate(label);
      setNewLabel("");
      toast.show("Template added", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't add", "error");
    }
  }

  async function onDelete(t: LocationTemplate) {
    const ok = await confirm({
      title: `Remove "${t.label}"?`,
      message:
        "This only removes the chip — existing count entries that used this location are unaffected.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    await deleteLocationTemplate(t.id);
    toast.show("Template removed", "info");
  }

  return (
    <>
      <PageHeader title="Items" back="/" />
      <ItemsTabs current="locations" />

      <div className="space-y-4 p-4 pt-3 pb-32">
        <p className="text-sm text-muted">
          These show as quick-pick chips on the count screen, so you can tap{" "}
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-foreground">
            Aisle
          </span>{" "}
          and then just type the number.
        </p>

        <form onSubmit={onAdd} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Add a template"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Aisle, Shelf, Bay, Van…"
              autoCapitalize="words"
            />
          </div>
          <Button type="submit" size="lg" disabled={!newLabel.trim()}>
            <Plus className="h-5 w-5" /> Add
          </Button>
        </form>

        {templates && templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="mt-3 font-semibold">No templates yet</p>
            <p className="mt-1 text-sm text-muted">
              Add a few labels above — they'll appear as quick chips when
              counting.
            </p>
          </div>
        )}

        {templates && templates.length > 0 && (
          <ul className="space-y-2">
            {templates.map((t) =>
              editingId === t.id ? (
                <EditRow
                  key={t.id}
                  template={t}
                  onCancel={() => setEditingId(null)}
                  onSave={async (label) => {
                    try {
                      await updateLocationTemplate(t.id, label);
                      setEditingId(null);
                      toast.show("Renamed", "success");
                    } catch (err) {
                      toast.show(
                        err instanceof Error ? err.message : "Couldn't save",
                        "error"
                      );
                    }
                  }}
                />
              ) : (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {t.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingId(t.id)}
                    aria-label={`Rename ${t.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    aria-label={`Remove ${t.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-danger hover:bg-surface-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </>
  );
}

function EditRow({
  template,
  onSave,
  onCancel,
}: {
  template: LocationTemplate;
  onSave: (label: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(template.label);
  return (
    <li className="rounded-xl border border-primary bg-surface p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSave(value);
        }}
        className="flex items-center gap-2"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
        />
        <Button type="submit" size="sm" disabled={!value.trim()}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </form>
    </li>
  );
}
