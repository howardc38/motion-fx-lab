// Loopback-only HTTP for repository demos or an explicitly selected project.
// GET and HEAD only. Single byte ranges are answered with 206 so <video> can seek and Safari
// will play MP4 at all; a request for several ranges gets the whole file (200), and a range
// that starts past the end gets 416.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  // Chromium will not decode an <img> or Image() SVG served as octet-stream.
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".vtt": "text/vtt",
};
// One "bytes=" range against a file of `size` bytes (RFC 9110 §14.1.2):
//   undefined     no usable Range header, or several ranges: send the whole file
//   null          unsatisfiable: 416
//   {start, end}  inclusive byte offsets: 206
function byteRange(header, size) {
  if (typeof header !== "string") return undefined;
  const spec = header.trim();
  if (!/^bytes=/i.test(spec)) return undefined;
  if (spec.includes(",")) return undefined;
  const m = /^bytes=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(spec);
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    // Suffix: the last N bytes.
    const n = Number(m[2]);
    if (n === 0 || size === 0) return null;
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(m[1]);
  const last = m[2] === "" ? size - 1 : Number(m[2]);
  if (start >= size || last < start) return null;
  return { start, end: Math.min(last, size - 1) };
}
async function serve({ projectRoot = process.env.FX_PROJECT_ROOT || ROOT, port = 0 } = {}) {
  projectRoot = fs.realpathSync(path.resolve(projectRoot));
  const external = projectRoot !== ROOT;
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD" }).end();
        return;
      }
      if (new URL(req.url, "http://localhost").pathname === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }
      let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname.split('/').some(part => part.startsWith('.') || part === 'node_modules')) {
        res.writeHead(403).end();
        return;
      }
      let root = projectRoot;
      if (external && (pathname === '/_fxlab' || pathname.startsWith('/_fxlab/'))) {
        root = ROOT;
        pathname = pathname.slice('/_fxlab'.length) || '/';
      }
      let file = path.resolve(root, '.' + pathname);
      // Existing authored pages keep their /fx, /video and /assets imports.
      // Project assets take precedence; shared files are a read-only fallback.
      if (external && root === projectRoot && !fs.existsSync(file) && /^\/(fx|video|assets)\//.test(pathname)) {
        root = ROOT;
        file = path.resolve(root, '.' + pathname);
      }
      if (!inside(root, file) || !inside(root, await fs.promises.realpath(file))) {
        res.writeHead(403).end();
        return;
      }
      let stat = await fs.promises.stat(file);
      if (stat.isDirectory()) {
        file = path.join(file, "index.html");
        stat = await fs.promises.stat(file);
      }
      if (!inside(root, await fs.promises.realpath(file))) { res.writeHead(403).end(); return; }
      if (!stat.isFile()) { res.writeHead(404).end(); return; }
      const size = stat.size;
      const range = byteRange(req.headers.range, size);
      const headers = { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Accept-Ranges": "bytes" };
      if (range === null) {
        res.writeHead(416, { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" }).end();
        return;
      }
      const { start, end } = range || { start: 0, end: size - 1 };
      headers["Content-Length"] = end - start + 1;
      if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === "HEAD" || size === 0) { res.end(); return; }
      const stream = fs.createReadStream(file, { start, end });
      // Headers are already sent, so a read that fails now can only cut the response short.
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch {
      if (res.headersSent) res.destroy();
      else res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    urlFor(file) {
      const absolute = fs.realpathSync(path.resolve(file));
      const root = inside(projectRoot, absolute) ? projectRoot : ROOT;
      if (!inside(root, absolute)) throw new Error('Page is outside the selected project and effect library');
      const prefix = external && root === ROOT ? '/_fxlab' : '';
      return origin + prefix + '/' + path.relative(root, absolute).split(path.sep).map(encodeURIComponent).join('/');
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
module.exports = { serve, ROOT, inside, byteRange };
if (require.main === module) {
  serve({ port: Number(process.argv[2] || 8000) }).then(server => {
    console.log(server.origin);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
