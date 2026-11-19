// Yerel test sunucusu: `GEMINI_API_KEY=... npm run dev` → http://localhost:3000
// (Canlıda Vercel kullanılır; bu dosya sadece bilgisayarında denemek için.)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import tarif from "./api/tarif.js";
import resim from "./api/resim.js";

const PORT = process.env.PORT || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };

http.createServer(async (req, res) => {
  const api = req.url.startsWith("/api/tarif") ? tarif : req.url.startsWith("/api/resim") ? resim : null;
  if (api) {
    req.query = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); };
    return api(req, res);
  }
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(process.cwd(), path === "/" ? "index.html" : path);
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("Bulunamadı");
  }
}).listen(PORT, () => console.log(`Dolapta Ne Var? → http://localhost:${PORT}`));
