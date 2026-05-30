"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type ItemsTab = "items" | "locations";

export function ItemsTabs({ current }: { current: ItemsTab }) {
  return (
    <div className="px-4 pt-2">
      <div className="inline-flex w-full rounded-xl bg-surface p-1">
        <Tab href="/items" active={current === "items"}>
          Items
        </Tab>
        <Tab href="/items/locations" active={current === "locations"}>
          Locations
        </Tab>
      </div>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition",
        active
          ? "bg-primary text-primary-fg shadow-sm"
          : "text-muted"
      )}
    >
      {children}
    </Link>
  );
}
