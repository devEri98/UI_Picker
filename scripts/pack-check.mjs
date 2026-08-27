import { execFileSync } from "node:child_process";

const packageManagerScript = process.env.npm_execpath;

if (!packageManagerScript) {
  throw new Error("npm_execpath is required; run this check through pnpm.");
}

const expectedFiles = [
  "LICENSE",
  "dist/index.d.ts",
  "dist/index.d.ts.map",
  "dist/index.js",
  "dist/index.js.map",
  "package.json",
];

for (const packageName of [
  "@ui-target-picker/core",
  "@ui-target-picker/browser",
  "@ui-target-picker/angular",
]) {
  const output = execFileSync(
    process.execPath,
    [packageManagerScript, "--filter", packageName, "pack", "--dry-run", "--json"],
    { encoding: "utf8" },
  );
  const result = JSON.parse(output);
  const files = result.files.map(({ path }) => path).sort();

  if (JSON.stringify(files) !== JSON.stringify(expectedFiles)) {
    throw new Error(`${packageName} contains unexpected files: ${files.join(", ")}`);
  }
}

console.log("Package contents: OK");
