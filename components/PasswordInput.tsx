"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  hint?: string;
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { label, hint, error, className, id, ...rest },
    ref
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            className={cn(
              "h-12 w-full rounded-xl border border-border bg-surface pl-4 pr-12 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30",
              error && "border-danger focus:border-danger focus:ring-danger/30",
              className
            )}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:text-foreground"
          >
            {visible ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {(hint || error) && (
          <span
            className={cn(
              "text-xs",
              error ? "text-danger" : "text-muted"
            )}
          >
            {error || hint}
          </span>
        )}
      </div>
    );
  }
);
