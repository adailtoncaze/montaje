import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Ambiente de teste: jsdom não implementa estas APIs usadas pelo jsPDF,
 * pelo download de arquivos e pelos componentes (jsPDF só roda no navegador).
 */
if (typeof window !== "undefined") {
  if (!("matchMedia" in window)) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => "blob:mock");
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }

  // jsdom não implementa <canvas>.getContext — usado por jsPDF e pela
  // rasterização da logo. Devolve um stub mínimo para não explodir.
  if (!HTMLCanvasElement.prototype.getContext) {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  }

  // jsdom não implementa a API modal de <dialog> (usada por `Dialog`/`ConfirmDialog`).
  if (typeof HTMLDialogElement !== "undefined") {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.open = true;
      };
    }
    if (!HTMLDialogElement.prototype.show) {
      HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
        this.open = true;
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event("close"));
      };
    }
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
