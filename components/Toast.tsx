"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "info" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex w-full max-w-xl flex-col items-center gap-2 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onClose={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toneStyles: Record<ToastTone, { wrap: string; Icon: typeof CheckCircle2 }> = {
  success: {
    wrap: "bg-success text-white",
    Icon: CheckCircle2,
  },
  info: {
    wrap: "bg-foreground text-background",
    Icon: Info,
  },
  error: {
    wrap: "bg-danger text-white",
    Icon: TriangleAlert,
  },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);
  const { wrap, Icon } = toneStyles[toast.tone];
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full items-center gap-3 rounded-2xl px-4 py-3 shadow-lg transition-all duration-200",
        wrap,
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-medium leading-tight">{toast.message}</p>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="-mr-1 flex h-7 w-7 items-center justify-center rounded-full opacity-80 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (msg) => {
        if (typeof console !== "undefined") console.log("[toast]", msg);
      },
    };
  }
  return ctx;
}
