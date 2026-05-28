"use client";

import { usePathname } from "next/navigation";
import { AuthGuard, shouldHideChrome } from "@/components/AuthGuard";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = shouldHideChrome(pathname);

  return (
    <AuthGuard>
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
        <main
          className={hideChrome ? "flex flex-1 flex-col" : "flex-1 pb-24"}
          style={hideChrome ? undefined : { paddingTop: "var(--safe-top)" }}
        >
          {children}
        </main>
        {!hideChrome && <BottomNav />}
      </div>
    </AuthGuard>
  );
}
