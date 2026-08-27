import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly name: string;
  readonly private: boolean;
  readonly type: string;
  readonly sideEffects: boolean;
  readonly exports: Record<string, unknown>;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

const workspaceRoot = path.resolve(import.meta.dirname, "..");

async function readManifest(packageName: string): Promise<PackageManifest> {
  const manifestPath = path.join(workspaceRoot, "packages", packageName, "package.json");
  return JSON.parse(await readFile(manifestPath, "utf8")) as PackageManifest;
}

describe("workspace package contract", () => {
  it.each([
    ["core", "@ui-target-picker/core"],
    ["browser", "@ui-target-picker/browser"],
    ["angular", "@ui-target-picker/angular"],
  ])("keeps %s private and ESM-only", async (directory, expectedName) => {
    const manifest = await readManifest(directory);

    expect(manifest).toMatchObject({
      name: expectedName,
      private: true,
      type: "module",
      sideEffects: false,
    });
    expect(manifest.exports).toHaveProperty(".");
  });

  it("enforces angular -> browser -> core dependencies", async () => {
    const core = await readManifest("core");
    const browser = await readManifest("browser");
    const angular = await readManifest("angular");

    expect(core.dependencies).toBeUndefined();
    expect(browser.dependencies).toEqual({
      "@ui-target-picker/core": "workspace:^",
    });
    expect(angular.dependencies).toEqual({
      "@ui-target-picker/browser": "workspace:^",
    });
    expect(angular.peerDependencies).toEqual({
      "@angular/core": "^22.0.0",
    });
  });
});
