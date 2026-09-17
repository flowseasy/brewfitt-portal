// Serves a static export the way static hosting (Catalyst Web Client Hosting) would.
// Usage: node scripts/serve-out.mjs [port] [dir]
// `npm run build` exports to out/; `npm run build:check` exports to .next-build/.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] ?? 4173);
const root = join(process.cwd(), process.argv[3] ?? "out");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

async function resolve(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [join(root, safe), join(root, safe, "index.html"), join(root, `${safe}.html`)];
  for (const file of candidates) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const file = (await resolve(url.pathname)) ?? join(root, "404.html");
  const body = await readFile(file).catch(() => null);
  if (!body) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(file.endsWith("404.html") && !url.pathname.endsWith("404.html") ? 404 : 200, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
  });
  res.end(body);
}).listen(port, () => console.log(`Serving out/ on http://localhost:${port}`));
