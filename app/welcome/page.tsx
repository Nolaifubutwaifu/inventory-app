"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Camera,
  ClipboardList,
  Download,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/Button";
import { markOnboarded, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Slide {
  title: string;
  subtitle: string;
  body: string;
  Icon: typeof Boxes;
  accent: string;
  ring: string;
}

const slides: Slide[] = [
  {
    title: "One catalog, many counts",
    subtitle: "Create each item once",
    body: "Add a product to your catalog with a photo, SKU, and category. You'll only do this once — every future stocktake just reuses it.",
    Icon: Boxes,
    accent: "from-blue-500 to-blue-700",
    ring: "ring-blue-500/30",
  },
  {
    title: "Count anywhere",
    subtitle: "Multiple locations, one total",
    body: "Walk the warehouse, enter how many you see and where. The app sums it up — no more rewriting the same SKU on different lines.",
    Icon: ClipboardList,
    accent: "from-emerald-500 to-emerald-700",
    ring: "ring-emerald-500/30",
  },
  {
    title: "Identify lookalikes",
    subtitle: "Optional AI scan",
    body: "If two items look almost identical, snap a photo and the app picks the closest match from your reference photos. Tap the blue camera button on the Count screen.",
    Icon: Camera,
    accent: "from-fuchsia-500 to-purple-700",
    ring: "ring-fuchsia-500/30",
  },
  {
    title: "Export when you're done",
    subtitle: "Spreadsheet, ready to send",
    body: "Tap Export to get a clean XLSX with a summary sheet and the full count history. Open it in Excel, Numbers, or Sheets.",
    Icon: Download,
    accent: "from-amber-500 to-orange-600",
    ring: "ring-amber-500/30",
  },
];

function WelcomeContent() {
  const router = useRouter();
  const search = useSearchParams();
  const replay = search.get("replay") === "1";
  const { userId, user, loading, refresh } = useAuth();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/auth/login");
    }
  }, [loading, userId, router]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersection ratio that is at least
        // half visible — avoids dot flicker mid-swipe.
        let best: { i: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.5) continue;
          const i = Number((entry.target as HTMLElement).dataset.slideIndex);
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { i, ratio: entry.intersectionRatio };
          }
        }
        if (best) setIndex(best.i);
      },
      { root, threshold: [0.5, 0.75, 1] }
    );
    slideRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  function scrollToSlide(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    el.scrollTo({ left: i * slideWidth, behavior: "smooth" });
  }

  async function finish() {
    if (user && !user.onboardedAt) {
      await markOnboarded(user.id);
      refresh();
    }
    router.replace("/");
  }

  function next() {
    if (index >= slides.length - 1) {
      finish();
    } else {
      scrollToSlide(index + 1);
    }
  }

  function back() {
    if (index > 0) scrollToSlide(index - 1);
  }

  const isLast = index === slides.length - 1;

  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
    >
      <div className="flex items-center justify-between px-4 py-4">
        {index > 0 ? (
          <button
            onClick={back}
            aria-label="Previous slide"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Sparkles className="h-4 w-4 text-primary" />
            {user?.businessName || "Welcome"}
          </div>
        )}
        {!replay && (
          <button
            onClick={finish}
            className="text-sm font-semibold text-muted hover:text-foreground"
          >
            Skip
          </button>
        )}
        {replay && (
          <button
            onClick={() => router.back()}
            className="text-sm font-semibold text-muted hover:text-foreground"
          >
            Close
          </button>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        <div className="flex h-full w-full">
          {slides.map((slide, i) => {
            const Icon = slide.Icon;
            return (
              <section
                key={i}
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
                data-slide-index={i}
                className="flex h-full w-full shrink-0 snap-center flex-col items-center justify-center gap-8 px-8"
                aria-hidden={i !== index}
              >
                <div
                  className={cn(
                    "flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-lg ring-8",
                    slide.accent,
                    slide.ring
                  )}
                >
                  <Icon className="h-14 w-14" strokeWidth={1.75} />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {slide.subtitle}
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight">
                    {slide.title}
                  </h2>
                  <p className="mx-auto max-w-xs text-balance text-sm leading-relaxed text-muted">
                    {slide.body}
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 px-6 pb-8" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}>
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted/40"
              )}
            />
          ))}
        </div>
        <Button onClick={next} size="lg" block>
          {isLast ? "Get started" : "Next"}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-dvh items-center justify-center text-muted"
          style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
        >
          Loading…
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
