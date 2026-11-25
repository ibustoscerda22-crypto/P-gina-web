// Une el cliente de LibreLinkUp con el historial local.
// Lo usan tanto el panel como el servidor MCP.

import { createClient, TRENDS } from "./libre.js";
import { Store } from "./store.js";
import { limits, status } from "./stats.js";

export class Monitor {
  constructor(env = process.env) {
    this.client = createClient(env);
    this.store = new Store();
    this.lim = limits(env);
    this.current = null;
    this.lastFetch = 0;
    this.lastError = null;
  }

  async refresh() {
    try {
      const { current, history } = await this.client.fetchGraph();
      this.store.add([...history, current]);
      if (current) this.current = current;
      this.lastFetch = Date.now();
      this.lastError = null;
    } catch (err) {
      this.lastError = err.message;
      throw err;
    }
    return this.now();
  }

  // Usa la última lectura si tiene menos de `maxAgeMs`; si no, consulta LibreLinkUp.
  async getNow(maxAgeMs = 60_000) {
    if (!this.current || Date.now() - this.lastFetch > maxAgeMs) await this.refresh();
    return this.now();
  }

  now() {
    const r = this.current ?? this.store.latest();
    if (!r) return null;
    const ageMin = Math.round((Date.now() - r.t) / 60_000);
    return {
      mgdl: r.mgdl,
      hora: new Date(r.t).toISOString(),
      t: r.t,
      haceMinutos: ageMin,
      desactualizada: ageMin > 15,
      tendencia: r.trend ? TRENDS[r.trend] : null,
      estado: status(r.mgdl, this.lim),
      error: this.lastError,
    };
  }
}
