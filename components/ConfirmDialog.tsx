"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./Button";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface InternalState extends ConfirmOptions {
  open: boolean;
  resolver?: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InternalState>({ open: false, title: "" });
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, ...opts, resolver: resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      state.resolver?.(result);
      setState((s) => ({ ...s, open: false, resolver: undefined }));
    },
    [state]
  );

  useEffect(() => {
    if (!state.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open, close]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl animate-[slideUp_0.18s_ease-out]"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <h2 className="text-lg font-semibold">{state.title}</h2>
            {state.message && (
              <p className="mt-2 text-sm text-muted">{state.message}</p>
            )}
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" size="lg" block onClick={() => close(false)}>
                {state.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={state.destructive ? "danger" : "primary"}
                size="lg"
                block
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return async (opts) => window.confirm(opts.title);
  }
  return ctx.confirm;
}
