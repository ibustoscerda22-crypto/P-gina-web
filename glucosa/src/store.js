// Guarda las lecturas en data/readings.json para tener historial de días y semanas
// (LibreLinkUp solo entrega las últimas 12 horas).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "readings.json");
const KEEP_DAYS = 180;

export class Store {
  constructor(file = process.env.GLUCOSA_DATA_FILE || DEFAULT_FILE) {
    this.file = file;
    this.readings = new Map(); // minuto -> lectura
    this.mtime = 0;
    this.load();
  }

  load() {
    try {
      const stat = fs.statSync(this.file);
      if (stat.mtimeMs === this.mtime) return;
      const arr = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this.readings = new Map(arr.map((r) => [Math.round(r.t / 60_000), r]));
      this.mtime = stat.mtimeMs;
    } catch (err) {
      if (err.code !== "ENOENT") console.error("No pude leer el historial:", err.message);
    }
  }

  // Devuelve cuántas lecturas nuevas se agregaron.
  add(list) {
    this.load(); // por si otro proceso (el MCP o el panel) escribió
    let added = 0;
    for (const r of list) {
      if (!r || !Number.isFinite(r.t) || !Number.isFinite(r.mgdl)) continue;
      const key = Math.round(r.t / 60_000);
      // Evita duplicar la misma lectura con segundos de diferencia
      if (this.readings.has(key) || this.readings.has(key - 1) || this.readings.has(key + 1)) continue;
      this.readings.set(key, { t: r.t, mgdl: r.mgdl, ...(r.trend ? { trend: r.trend } : {}) });
      added++;
    }
    if (added) this.save();
    return added;
  }

  save() {
    const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
    const arr = [...this.readings.values()].filter((r) => r.t >= cutoff).sort((a, b) => a.t - b.t);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(arr));
    fs.renameSync(tmp, this.file);
    this.mtime = fs.statSync(this.file).mtimeMs;
  }

  range(from, to = Date.now()) {
    this.load();
    return [...this.readings.values()].filter((r) => r.t >= from && r.t <= to).sort((a, b) => a.t - b.t);
  }

  latest() {
    this.load();
    let best = null;
    for (const r of this.readings.values()) if (!best || r.t > best.t) best = r;
    return best;
  }
}
