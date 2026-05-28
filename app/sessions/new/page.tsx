"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { createSession } from "@/lib/repo";

function defaultName() {
  const d = new Date();
  const month = d.toLocaleString(undefined, { month: "long" });
  return `${month} ${d.getFullYear()} Stocktake`;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [name, setName] = useState(defaultName());
  const [countedBy, setCountedBy] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const session = await createSession(name.trim() || defaultName(), countedBy.trim());
      router.replace(`/sessions/${session.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New Session" back="/sessions" />
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <Input
          label="Session name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. May Stocktake"
          required
        />
        <Input
          label="Counted by"
          value={countedBy}
          onChange={(e) => setCountedBy(e.target.value)}
          placeholder="Your name (optional)"
        />
        <div className="pt-2">
          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? "Creating…" : "Start session"}
          </Button>
        </div>
      </form>
    </>
  );
}
