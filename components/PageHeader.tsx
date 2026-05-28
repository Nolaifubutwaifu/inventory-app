"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: string | true;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, back, right }: PageHeaderProps) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
      {back !== undefined && (
        <button
          aria-label="Back"
          onClick={() => {
            if (back === true) router.back();
          }}
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          {back === true ? (
            <ChevronLeft className="h-6 w-6" />
          ) : (
            <Link href={back} className="flex h-10 w-10 items-center justify-center">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          )}
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
