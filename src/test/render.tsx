import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Renderiza um componente dentro dos providers que o app usa na raiz
 * (`ToastProvider`). Todos os componentes "client" usam `useToast()`, então
 * sem o provider o render explode.
 */
export function renderComToast(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
