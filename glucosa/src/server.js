// Panel web: consulta LibreLinkUp cada minuto, guarda el historial
// y empuja cada lectura nueva al navegador al instante (Server-Sent Events).

import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Monitor } from "./monitor.js";
import { summarize, byDay, lowEpisodes, dayKey, TZ } from "./stats.js";

const PORT = Number(process.env.PORT || 3100);
const POLL_MS = Math.max(60, Number(process.env.POLL_SECONDS || 60)) * 1000;
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "";

// "npm run demo" usa datos falsos (funciona igual en Windows, Mac y Linux)
if (process.argv.includes("--demo")) process.env.LIBRE_MOCK = "1";

const monitor = new Monitor();
const app = express();
const clients = new Set();

// Protege el panel con contraseña si PANEL_PASSWORD está definida (usuario: cualquiera).
if (PANEL_PASSWORD) {
  app.use((req, res, next) => {
    const [, b64 = ""] = (req.headers.authorization || "").split(" ");
    const pass = Buffer.from(b64, "base64").toString().split(":").slice(1).join(":");
    const a = Buffer.from(pass);
    const b = Buffer.from(PANEL_PASSWORD);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
    res.set("WWW-Authenticate", 'Basic realm="Glucosa"').status(401).send("Contraseña requerida");
  });
}

app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public")));

app.get("/api/config", (_req, res) => res.json({ limites: monitor.lim, zonaHoraria: TZ, pollSegundos: POLL_MS / 1000 }));

app.get("/api/now", (_req, res) => res.json(monitor.now() ?? { error: monitor.lastError ?? "Sin datos todavía" }));

app.get("/api/history", (req, res) => {
  const hours = Math.min(24 * 14, Math.max(1, Number(req.query.hours) || 24));
  res.json(monitor.store.range(Date.now() - hours * 3_600_000).map(({ t, mgdl }) => ({ t, mgdl })));
});

app.get("/api/today", (_req, res) => {
  const today = dayKey(Date.now());
  const rs = monitor.store.range(Date.now() - 26 * 3_600_000).filter((r) => dayKey(r.t) === today);
  res.json({ dia: today, resumen: summarize(rs, monitor.lim), hipoglucemias: lowEpisodes(rs, monitor.lim) });
});

app.get("/api/days", (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
  const rs = monitor.store.range(Date.now() - days * 86_400_000);
  res.json({ dias: byDay(rs).reverse(), periodo: summarize(rs, monitor.lim) });
});

app.get("/api/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const now = monitor.now();
  if (now) res.write(`data: ${JSON.stringify(now)}\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(msg);
}

let lastT = 0;
async function poll() {
  try {
    const now = await monitor.refresh();
    if (now && now.t !== lastT) {
      lastT = now.t;
      broadcast(now);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}]`, err.message);
    broadcast({ ...(monitor.now() ?? {}), error: err.message });
  }
}

app.listen(PORT, () => {
  const mode = process.env.LIBRE_MOCK === "1" ? " (modo demo, datos falsos)" : "";
  console.log(`Panel de glucosa en http://localhost:${PORT}${mode}`);
  poll();
  setInterval(poll, POLL_MS);
});
