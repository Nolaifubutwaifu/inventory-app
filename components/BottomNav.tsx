"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Download, Home, ListChecks, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/count",
    label: "Count",
    icon: ListChecks,
    match: (p: string) => p.startsWith("/count"),
  },
  {
    href: "/items",
    label: "Items",
    icon: Boxes,
    match: (p: string) => p.startsWith("/items"),
  },
  {
    href: "/export",
    label: "Export",
    icon: Download,
    match: (p: string) => p.startsWith("/export"),
  },
  {
    href: "/account",
    label: "Account",
    icon: User,
    match: (p: string) => p.startsWith("/account"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-xl border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
