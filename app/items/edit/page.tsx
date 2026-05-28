"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ItemForm } from "@/components/ItemForm";
import { useItem } from "@/lib/hooks";

export default function EditItemPage() {
  return (
    <Suspense fallback={<PageHeader title="Item" back="/items" />}>
      <EditItemInner />
    </Suspense>
  );
}

function EditItemInner() {
  const id = useSearchParams().get("id") ?? "";
  const item = useItem(id);

  if (!item) {
    return (
      <>
        <PageHeader title="Item" back="/items" />
        <div className="p-4 text-muted">Loading…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit Item" back="/items" subtitle={item.sku} />
      <ItemForm item={item} />
    </>
  );
}
