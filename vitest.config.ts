import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Sem plugin externo: o Vite (que o Vitest usa) transpila .tsx via esbuild —
// só precisamos do runtime JSX automático, já que o tsconfig do Next usa
// `jsx: "preserve"` e não queremos depender de `React` no escopo dos testes.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      include: [
        "src/lib/**/*.ts",
        "src/components/**/*.tsx",
        "src/components/**/*.ts",
      ],
      exclude: [
        "src/lib/logo-svg.ts",
        "src/lib/supabase/**",
        "src/lib/actions/**",
        "**/*.test.*",
      ],
    },
  },
});
