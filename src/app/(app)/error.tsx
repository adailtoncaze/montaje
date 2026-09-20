"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Error boundary do grupo (app): exibe uma mensagem amigável quando uma
 * página falha no servidor (consulta, rede, etc.) e permite tentar de novo.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-danger-bg text-danger-fg">
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="text-title font-semibold text-fg">Ops, algo deu errado</h2>
      <p className="max-w-sm text-body text-fg-3">
        Não foi possível carregar esta página. Tente novamente; se o problema
        persistir, verifique sua conexão e tente mais tarde.
      </p>
      <Button variant="primary" onClick={reset}>
        Tentar novamente
      </Button>
      {process.env.NODE_ENV === "development" && (
        <pre className="max-w-full overflow-auto rounded-md border border-stroke bg-surface-subtle p-3 text-caption text-danger-fg">
          {error.message}
        </pre>
      )}
    </div>
  );
}