import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    include: ["scripts/**/*.test.ts", "packages/**/*.test.ts"],
    reporters: ["default"],
  },
});
