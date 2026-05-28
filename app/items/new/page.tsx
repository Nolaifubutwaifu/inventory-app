"use client";

import { PageHeader } from "@/components/PageHeader";
import { ItemForm } from "@/components/ItemForm";

export default function NewItemPage() {
  return (
    <>
      <PageHeader title="New Item" back="/items" />
      <ItemForm />
    </>
  );
}
