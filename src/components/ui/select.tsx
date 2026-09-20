import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  helperText,
  options,
  placeholder,
  className,
  id: idProp,
  ...props
}: SelectProps) {
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
      <select
        id={id}
        className={cn(
          "h-8 w-full appearance-none rounded-md border bg-surface px-3 text-body text-fg",
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
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
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
