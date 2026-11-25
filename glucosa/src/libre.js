// Cliente para la API (no oficial) de LibreLinkUp.
// Abbott no publica esta API: los headers y la versión pueden cambiar sin aviso.
// Si deja de funcionar, lo primero es subir LIBRE_VERSION en el .env.

import crypto from "node:crypto";

const DEFAULT_BASE = "https://api.libreview.io";

export const TRENDS = {
  1: { arrow: "↓↓", label: "bajando rápido" },
  2: { arrow: "↓", label: "bajando" },
  3: { arrow: "→", label: "estable" },
  4: { arrow: "↑", label: "subiendo" },
  5: { arrow: "↑↑", label: "subiendo rápido" },
};

// LibreLinkUp entrega fechas como "11/25/2026 4:25:31 PM".
// FactoryTimestamp viene en UTC; Timestamp, en la hora local del sensor.
export function parseLibreDate(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/i.exec(str?.trim() ?? "");
  if (!m) return new Date(str);
  let [, mo, d, y, h, mi, s, ap] = m;
  h = Number(h) % 12 + (ap.toUpperCase() === "PM" ? 12 : 0);
  return new Date(Date.UTC(+y, mo - 1, +d, h, +mi, +s));
}

export function toReading(m) {
  const t = parseLibreDate(m.FactoryTimestamp ?? m.Timestamp).getTime();
  return { t, mgdl: m.ValueInMgPerDl, trend: m.TrendArrow ?? null };
}

export class LibreLinkUpClient {
  constructor({ email, password, region, version = "4.16.0", baseUrl } = {}) {
    if (!email || !password) {
      throw new Error("Faltan LIBRE_EMAIL y LIBRE_PASSWORD (la cuenta de LibreLinkUp).");
    }
    this.email = email;
    this.password = password;
    this.version = version;
    this.regionUrl = baseUrl ? (r) => `${baseUrl}/${r}` : (r) => `https://api-${r}.libreview.io`;
    this.base = baseUrl ?? (region ? this.regionUrl(region) : DEFAULT_BASE);
    this.auth = null; // { token, accountId, expires }
    this.patientId = null;
  }

  headers(extra = {}) {
    return {
      "accept-encoding": "gzip",
      "cache-control": "no-cache",
      connection: "Keep-Alive",
      "content-type": "application/json",
      product: "llu.android",
      version: this.version,
      ...extra,
    };
  }

  async login() {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${this.base}/llu/auth/login`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ email: this.email, password: this.password }),
      });
      const body = await res.json().catch(() => ({}));

      if (body?.data?.redirect && body.data.region) {
        this.base = this.regionUrl(body.data.region);
        continue; // la cuenta vive en otra región: reintentar ahí
      }
      if (body.status === 2) throw new Error("LibreLinkUp: correo o contraseña incorrectos.");
      if (body.status === 4) {
        throw new Error(
          "LibreLinkUp pide aceptar términos o confirmar algo. Abre la app LibreLinkUp, inicia sesión y acepta lo que aparezca."
        );
      }
      if (res.status === 403 || body?.data?.minimumVersion) {
        throw new Error(
          `LibreLinkUp rechazó la versión ${this.version}. Sube LIBRE_VERSION en el .env (mínimo pedido: ${body?.data?.minimumVersion ?? "desconocido"}).`
        );
      }
      const ticket = body?.data?.authTicket;
      const userId = body?.data?.user?.id;
      if (!ticket?.token || !userId) {
        throw new Error(`LibreLinkUp: respuesta de login inesperada (HTTP ${res.status}).`);
      }
      this.auth = {
        token: ticket.token,
        accountId: crypto.createHash("sha256").update(userId).digest("hex"),
        expires: (ticket.expires ?? 0) * 1000,
      };
      return;
    }
    throw new Error("LibreLinkUp: demasiadas redirecciones de región.");
  }

  async get(path, retry = true) {
    if (!this.auth || (this.auth.expires && Date.now() > this.auth.expires - 60_000)) {
      await this.login();
    }
    const res = await fetch(`${this.base}${path}`, {
      headers: this.headers({
        authorization: `Bearer ${this.auth.token}`,
        "account-id": this.auth.accountId,
      }),
    });
    if (res.status === 401 && retry) {
      this.auth = null;
      return this.get(path, false);
    }
    if (res.status === 429) throw new Error("LibreLinkUp: demasiadas consultas, espera unos minutos.");
    if (!res.ok) throw new Error(`LibreLinkUp: HTTP ${res.status} en ${path}`);
    const body = await res.json();
    return body.data;
  }

  async getPatientId() {
    if (this.patientId) return this.patientId;
    const conns = await this.get("/llu/connections");
    if (!conns?.length) {
      throw new Error(
        "Esta cuenta de LibreLinkUp no sigue a nadie. En la app FreeStyle Libre ve a Aplicaciones conectadas → LibreLinkUp e invita a este correo."
      );
    }
    this.patientId = conns[0].patientId;
    return this.patientId;
  }

  // Lectura actual + últimas ~12 h (una lectura cada 15 min aprox.).
  async fetchGraph() {
    const pid = await this.getPatientId();
    const data = await this.get(`/llu/connections/${pid}/graph`);
    const current = data?.connection?.glucoseMeasurement;
    return {
      current: current ? toReading(current) : null,
      history: (data?.graphData ?? []).map(toReading),
    };
  }
}

// Datos falsos para probar el panel sin cuenta (LIBRE_MOCK=1).
export class MockClient {
  value(t) {
    const h = t / 3_600_000;
    return Math.round(120 + 45 * Math.sin(h / 1.7) + 25 * Math.sin(h / 0.45) + 8 * Math.sin(h * 3.1));
  }
  async fetchGraph() {
    const now = Date.now();
    const step = 15 * 60_000;
    const history = [];
    for (let t = now - 12 * 3_600_000; t < now - step; t += step) {
      const tt = Math.floor(t / step) * step;
      history.push({ t: tt, mgdl: this.value(tt), trend: null });
    }
    const t = Math.floor(now / 60_000) * 60_000;
    const delta = this.value(t) - this.value(t - 15 * 60_000);
    const trend = delta > 20 ? 5 : delta > 8 ? 4 : delta < -20 ? 1 : delta < -8 ? 2 : 3;
    return { current: { t, mgdl: this.value(t), trend }, history };
  }
}

export function createClient(env = process.env) {
  if (env.LIBRE_MOCK === "1") return new MockClient();
  return new LibreLinkUpClient({
    email: env.LIBRE_EMAIL,
    password: env.LIBRE_PASSWORD,
    region: env.LIBRE_REGION || undefined,
    version: env.LIBRE_VERSION || undefined,
  });
}
