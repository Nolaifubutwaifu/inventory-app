"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted">
        The app hit an unexpected error. Your data is safe — it lives on this
        device. Try reloading; if it keeps happening, fully quit the app and
        reopen it.
      </p>
      {error.digest && (
        <p className="mt-3 text-[11px] text-muted">Ref: {error.digest}</p>
      )}
      <button
        onClick={() => reset()}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-fg shadow-sm active:opacity-90"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
