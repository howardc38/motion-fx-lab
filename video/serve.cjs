// Loopback-only HTTP for repository demos or an explicitly selected project.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
async function serve({ projectRoot = process.env.FX_PROJECT_ROOT || ROOT, port = 0 } = {}) {
  projectRoot = fs.realpathSync(path.resolve(projectRoot));
  const external = projectRoot !== ROOT;
  const types = {
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
    ".vtt": "text/vtt",
  };
  const server = http.createServer(async (req, res) => {
    try {
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
      const stat = await fs.promises.stat(file);
      if (stat.isDirectory()) file = path.join(file, "index.html");
      if (!inside(root, await fs.promises.realpath(file))) { res.writeHead(403).end(); return; }
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      const stream = fs.createReadStream(file);
      stream.on("error", () => {
        if (!res.headersSent) res.writeHead(404);
        res.end();
      });
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(404).end();
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
module.exports = { serve, ROOT, inside };
if (require.main === module) {
  serve({ port: Number(process.argv[2] || 8000) }).then(server => {
    console.log(server.origin);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
