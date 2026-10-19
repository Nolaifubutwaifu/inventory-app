"use client";

import { usePathname } from "next/navigation";
import { AuthGuard, shouldHideChrome } from "@/components/AuthGuard";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = shouldHideChrome(pathname);
  // The matrix count grid is built for tablets and uses the full width; it
  // sizes itself to the viewport, so it skips the bottom padding too.
  const fullWidth = pathname.startsWith("/count/matrix");

  return (
    <AuthGuard>
      <div
        className={
          fullWidth
            ? "flex min-h-dvh w-full flex-col"
            : "mx-auto flex min-h-dvh w-full max-w-xl flex-col"
        }
      >
        <main
          className={hideChrome ? "flex flex-1 flex-col" : fullWidth ? "flex-1" : "flex-1 pb-24"}
          style={hideChrome ? undefined : { paddingTop: "var(--safe-top)" }}
        >
          {children}
        </main>
        {!hideChrome && <BottomNav />}
      </div>
    </AuthGuard>
  );
}
