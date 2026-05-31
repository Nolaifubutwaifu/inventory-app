"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/privacy", "/support"];
const ONBOARDING_PATH = "/welcome";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const isPublic = isPublicPath(pathname);
    const isOnboarding = pathname === ONBOARDING_PATH;

    if (!userId) {
      if (!isPublic) {
        router.replace("/auth/login");
      }
      return;
    }

    if (isPublic) {
      // Login / register bounces signed-in users away. The legal pages
      // (privacy / support) are linked from the App Store listing, so we
      // leave them reachable even when signed in.
      const isLegal = pathname === "/privacy" || pathname === "/support";
      if (isLegal) return;
      router.replace(user && !user.onboardedAt ? ONBOARDING_PATH : "/");
      return;
    }

    if (user && !user.onboardedAt && !isOnboarding) {
      router.replace(ONBOARDING_PATH);
    }
  }, [loading, userId, user, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isPublic = isPublicPath(pathname);
  const isOnboarding = pathname === ONBOARDING_PATH;

  // Avoid rendering protected content during the redirect frame.
  if (!userId && !isPublic) return null;
  if (userId && user && !user.onboardedAt && !isOnboarding && !isPublic) return null;

  return <>{children}</>;
}

export function shouldHideChrome(pathname: string): boolean {
  return isPublicPath(pathname) || pathname === ONBOARDING_PATH;
}
