import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      "e2e/**",
      "**/node_modules/**",
      "**/dist/**",
      // Exclude Massive integration-heavy tests by default; run them separately when needed
      "src/lib/massive/**/__tests__/**",
      "src/lib/massive/tests/**",
      // Temporarily exclude integration tests with mocking issues (need refactor)
      "src/__tests__/monitoring-integration.test.ts",
      "src/services/__tests__/monitoring.test.ts",
      "src/lib/data-provider/__tests__/hybrid-provider.test.ts",
      "src/hooks/__tests__/useOptionsChain.test.tsx",
      // Re-enabled for TP/SL flow verification: 'src/lib/riskEngine/**/__tests__/**'
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "server/dist/**",
        "e2e/**",
        "**/*.config.*",
        "**/*.d.ts",
        "**/types/**",
        "**/__tests__/**",
        "**/test/**",
        "src/lib/massive/**", // Integration-heavy, tested separately
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
