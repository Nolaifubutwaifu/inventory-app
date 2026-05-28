import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
}

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    FieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, ...rest },
  ref
) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30",
          error && "border-danger focus:border-danger focus:ring-danger/30",
          className
        )}
        {...rest}
      />
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
    </label>
  );
});

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, className, ...rest }, ref) {
    return (
      <label className="flex flex-col gap-1.5">
        {label && (
          <span className="text-sm font-medium text-foreground">{label}</span>
        )}
        <textarea
          ref={ref}
          className={cn(
            "min-h-[88px] w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30",
            error && "border-danger focus:border-danger focus:ring-danger/30",
            className
          )}
          {...rest}
        />
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
      </label>
    );
  }
);
