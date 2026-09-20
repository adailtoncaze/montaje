import type { ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Wrapper genérico de campo de formulário.
 * Use quando precisar de controle total sobre o input,
 * ou use os componentes Input/Select/Textarea que já incluem label e error.
 */
export function FormField({
  label,
  error,
  required,
  htmlFor,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="text-caption font-semibold text-fg-2"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger-fg" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="text-caption text-danger-fg"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
