"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Largura máxima. Padrão: max-w-lg */
  maxWidth?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "max-w-lg",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const handleCancel = useCallback(
    (e: React.SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      className={cn(
        "w-full overflow-y-auto rounded-lg border border-stroke bg-surface p-0 shadow-dialog",
        maxWidth,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stroke px-5 py-4">
        <h2 className="text-subtitle font-semibold text-fg">{title}</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-fg-3 transition-colors hover:bg-surface-subtle hover:text-fg"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 text-body text-fg">{children}</div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center justify-end gap-2 border-t border-stroke px-5 py-3">
          {actions}
        </div>
      )}
    </dialog>
  );
}

/** Dialog de confirmação rápido. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="subtle" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "primary" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={
              variant === "danger"
                ? "border-danger-fg bg-danger-fg text-white hover:bg-danger-fg/90"
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-fg-3">{message}</p>
    </Dialog>
  );
}
