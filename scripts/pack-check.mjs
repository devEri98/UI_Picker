import { execFileSync } from "node:child_process";

const packageManagerScript = process.env.npm_execpath;

if (!packageManagerScript) {
  throw new Error("npm_execpath is required; run this check through pnpm.");
}

const requiredFiles = [
  "LICENSE",
  "dist/index.d.ts",
  "dist/index.d.ts.map",
  "dist/index.js",
  "dist/index.js.map",
  "package.json",
];

// Anything else in the tarball must be a build artefact of the same shape.
const allowedExtraPattern = /^dist\/[^\s]+\.(?:js|js\.map|d\.ts|d\.ts\.map)$/u;

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

  const missing = requiredFiles.filter((file) => !files.includes(file));
  if (missing.length > 0) {
    throw new Error(`${packageName} is missing: ${missing.join(", ")}`);
  }

  const unexpected = files.filter(
    (file) => !requiredFiles.includes(file) && !allowedExtraPattern.test(file),
  );
  if (unexpected.length > 0) {
    throw new Error(`${packageName} contains unexpected files: ${unexpected.join(", ")}`);
  }
}

console.log("Package contents: OK");
