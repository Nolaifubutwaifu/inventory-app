"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { formatDate } from "@/lib/utils";

export default function SessionsPage() {
  const sessions = useSessions();
  return (
    <>
      <PageHeader
        title="Sessions"
        back="/"
        right={
          <Link href="/sessions/new">
            <Button size="sm" variant="primary">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </Link>
        }
      />
      <div className="p-4">
        {sessions?.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="font-medium">No sessions yet</p>
            <p className="mt-1 text-sm text-muted">
              A session is one stocktake — start one to begin counting.
            </p>
            <Link href="/sessions/new" className="mt-4 inline-block">
              <Button>
                <Plus className="h-5 w-5" /> Start session
              </Button>
            </Link>
          </div>
        )}
        <ul className="space-y-2">
          {sessions?.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sessions/detail?id=${s.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {formatDate(s.createdAt)} ·{" "}
                    {s.status === "in_progress" ? "Active" : "Completed"}
                    {s.countedBy ? ` · ${s.countedBy}` : ""}
                  </p>
                </div>
                <span className="text-muted">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
