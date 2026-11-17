import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.tsx"], testTimeout: 60000, include: ["tests/**/*.test.tsx"] },
});
