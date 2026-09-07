import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Tests run before the workspace is built in CI, so package specifiers resolve
// to the TypeScript sources instead of the published `dist` entrypoints.
function sourceEntry(packageName: string): string {
  return fileURLToPath(new URL(`./packages/${packageName}/src/index.ts`, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@ui-target-picker/core": sourceEntry("core"),
      "@ui-target-picker/browser": sourceEntry("browser"),
      "@ui-target-picker/angular": sourceEntry("angular"),
    },
  },
  test: {
    coverage: {
      enabled: false,
    },
    include: ["scripts/**/*.test.ts", "packages/**/*.test.ts"],
    reporters: ["default"],
  },
});
