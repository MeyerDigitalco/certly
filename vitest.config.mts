import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Authored as .mts because Vite now loads config files natively and warns
 * when a .ts config uses ESM syntax. That also rules out __dirname, so the
 * src alias is resolved from import.meta.url instead.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
