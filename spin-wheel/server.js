const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 5173);
const root = __dirname;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const resolved = path.resolve(root, clean || "index.html");
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  const filepath = safePath(req.url || "/");
  if (!filepath) {
    res.statusCode = 403;
    res.end("禁止访问");
    return;
  }

  fs.stat(filepath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end("未找到");
      return;
    }

    const ext = path.extname(filepath).toLowerCase();
    res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");

    fs.createReadStream(filepath).pipe(res);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`转盘已启动：http://localhost:${port}`);
  console.log("Android：同一 Wi‑Fi 下用手机打开电脑 IP 对应地址。");
});
