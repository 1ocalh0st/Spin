const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 5173);
const root = __dirname;

const NETEASE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const NETEASE_REFERER = "https://music.163.com/";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function safePath(urlPath) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(urlPath || "").split("?")[0]);
  } catch {
    return null;
  }

  const clean = decoded.replace(/^\/+/, "");
  const resolved = path.resolve(root, clean || "index.html");
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}

function intParam(url, name, fallback, { min = 0, max = 1e9 } = {}) {
  const raw = url.searchParams.get(name);
  if (raw == null || raw === "") return fallback;
  if (!/^[0-9]+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function idsParam(url, name) {
  const raw = String(url.searchParams.get(name) ?? "").trim();
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  if (parts.length > 100) return null;
  if (!parts.every((s) => /^[0-9]+$/.test(s))) return null;
  return parts;
}

async function fetchText(upstreamUrl, headers) {
  if (typeof fetch === "function") {
    const resp = await fetch(upstreamUrl, { headers });
    const text = await resp.text();
    return { status: resp.status, text };
  }

  return new Promise((resolve, reject) => {
    const req = https.request(upstreamUrl, { method: "GET", headers }, (resp) => {
      const chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: resp.statusCode || 500, text });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function proxyJson(res, upstreamUrl) {
  try {
    const { status, text } = await fetchText(upstreamUrl, {
      Accept: "application/json",
      "User-Agent": NETEASE_UA,
      Referer: NETEASE_REFERER,
    });
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(text);
  } catch (err) {
    json(res, 502, { ok: false, message: "upstream fetch failed", error: String(err?.message || err) });
  }
}

function handleNeteaseApi(req, res, url) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end("");
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { ok: false, message: "Method Not Allowed" });
    return;
  }

  if (url.pathname === "/api/netease/user/playlists") {
    const uid = intParam(url, "uid", null, { min: 1, max: 9e18 });
    const offset = intParam(url, "offset", 0, { min: 0, max: 10000 });
    const limit = intParam(url, "limit", 50, { min: 1, max: 200 });
    if (uid == null) return json(res, 400, { ok: false, message: "invalid uid" });

    const upstream = new URL("https://music.163.com/api/user/playlist/");
    upstream.searchParams.set("offset", String(offset));
    upstream.searchParams.set("limit", String(limit));
    upstream.searchParams.set("uid", String(uid));
    proxyJson(res, upstream.toString());
    return;
  }

  if (url.pathname === "/api/netease/playlist/detail") {
    const id = intParam(url, "id", null, { min: 1, max: 9e18 });
    if (id == null) return json(res, 400, { ok: false, message: "invalid id" });

    const upstream = new URL("https://music.163.com/api/v6/playlist/detail");
    upstream.searchParams.set("id", String(id));
    proxyJson(res, upstream.toString());
    return;
  }

  if (url.pathname === "/api/netease/song/url") {
    const ids = idsParam(url, "ids");
    const br = intParam(url, "br", 320000, { min: 64000, max: 999000 });
    if (!ids) return json(res, 400, { ok: false, message: "invalid ids" });

    const upstream = new URL("https://music.163.com/api/song/enhance/player/url");
    upstream.searchParams.set("ids", `[${ids.join(",")}]`);
    upstream.searchParams.set("br", String(br));
    proxyJson(res, upstream.toString());
    return;
  }

  if (url.pathname === "/api/netease/song/detail") {
    const ids = idsParam(url, "ids");
    if (!ids) return json(res, 400, { ok: false, message: "invalid ids" });

    const upstream = new URL("https://music.163.com/api/song/detail");
    upstream.searchParams.set("ids", `[${ids.join(",")}]`);
    proxyJson(res, upstream.toString());
    return;
  }

  json(res, 404, { ok: false, message: "not found" });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/netease/")) {
    handleNeteaseApi(req, res, url);
    return;
  }

  const filepath = safePath(url.pathname);
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
  console.log("Android：同一 Wi-Fi 下用手机打开电脑 IP 对应地址。");
});
