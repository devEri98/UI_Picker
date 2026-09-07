import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The playground loads the built ESM straight from `packages/*/dist` through an
// import map, so the server root is the workspace root and no bundler is
// involved. That also proves the published output runs unbundled.
const workspaceRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const entry = "/examples/playground/index.html";
const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}`).pathname);
  const target = path.join(workspaceRoot, pathname);
  const relative = path.relative(workspaceRoot, target);

  // Refuse anything that climbs out of the workspace.
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return target;
}

const server = createServer((request, response) => {
  const requestUrl = request.url ?? "/";

  // Redirect instead of serving the entry at "/", so the page's own relative
  // URLs resolve against its real directory.
  if (requestUrl === "/") {
    response.writeHead(302, { location: entry });
    response.end();
    return;
  }

  const filePath = resolveRequestPath(requestUrl);

  if (filePath === undefined) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  void stat(filePath)
    .then((stats) => {
      if (!stats.isFile()) {
        throw new Error("not a file");
      }
      response.writeHead(200, {
        "content-type": MIME_TYPES.get(path.extname(filePath)) ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(filePath).pipe(response);
    })
    .catch(() => {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Not found: ${request.url ?? ""}`);
    });
});

server.listen(port, host, () => {
  console.log(`UI Target Picker playground: http://${host}:${String(port)}${entry}`);
  console.log("Run `pnpm build` first: the page loads packages/*/dist directly.");
});
