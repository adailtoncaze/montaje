import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({
  label,
  error,
  helperText,
  className,
  id: idProp,
  ...props
}: TextareaProps) {
  const id = idProp ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="text-caption font-semibold text-fg-2"
        >
          {label}
          {props.required && (
            <span className="ml-0.5 text-danger-fg" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          "min-h-20 w-full rounded-md border bg-surface px-3 py-2 text-body text-fg",
          "placeholder:text-fg-4",
          "transition-colors duration-100 ease-fluent",
          "focus-visible:border-brand focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:border-stroke disabled:bg-surface-subtle disabled:text-fg-disabled",
          error
            ? "border-danger-fg focus-visible:border-danger-fg"
            : "border-stroke-strong",
          className,
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${id}-error` : helperText ? `${id}-helper` : undefined
        }
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-caption text-danger-fg" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-caption text-fg-4">
          {helperText}
        </p>
      )}
    </div>
  );
}
