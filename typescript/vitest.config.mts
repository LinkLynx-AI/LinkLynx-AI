import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const isCoverageCheck = process.env.COVERAGE_CHECK === "1";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**/*.{ts,tsx}",
        "src/**/*.d.ts",
        "src/shared/styles/**",
        "src/app/**",
      ],
      thresholds: isCoverageCheck
        ? {
            lines: 80,
            functions: 80,
            statements: 80,
            branches: 70,
            "src/shared/**/*.{ts,tsx}": {
              lines: 80,
              functions: 80,
              statements: 80,
              branches: 70,
            },
            "src/{entities,features,widgets}/**/*.{ts,tsx}": {
              lines: 80,
              functions: 80,
              statements: 80,
              branches: 70,
            },
          }
        : undefined,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
