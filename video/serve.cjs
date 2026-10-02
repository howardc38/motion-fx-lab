// Local ES modules need an HTTP origin. Serve only this repository on loopback.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
async function serve() {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".wasm": "application/wasm",
    ".mp4": "video/mp4",
  };
  const server = http.createServer(async (req, res) => {
    try {
      if (new URL(req.url, "http://localhost").pathname === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }
      let file = path.resolve(
        ROOT,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const stat = await fs.promises.stat(file);
      if (stat.isDirectory()) file = path.join(file, "index.html");
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
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
module.exports = { serve, ROOT };
