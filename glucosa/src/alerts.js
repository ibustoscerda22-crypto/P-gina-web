// Avisos al celular con ntfy (https://ntfy.sh): app gratuita para iPhone y Android.
// El PC envía el aviso; llega aunque el celular esté bloqueado y el panel cerrado.

const MIN = 60_000;

export class Alerter {
  constructor(env = process.env) {
    this.topic = (env.NTFY_TEMA || "").trim();
    this.server = (env.NTFY_SERVIDOR || "https://ntfy.sh").replace(/\/$/, "");
    this.low = Number(env.ALERTA_BAJO || 50);
    this.high = Number(env.ALERTA_ALTO || 250);
    this.repeatLow = Number(env.ALERTA_REPETIR_BAJO_MIN || 10) * MIN;
    this.repeatHigh = Number(env.ALERTA_REPETIR_ALTO_MIN || 30) * MIN;
    this.staleMin = Number(env.ALERTA_SIN_DATOS_MIN || 30); // 0 = desactivado
    this.state = { kind: "normal", sentAt: 0 };
  }

  get enabled() {
    return Boolean(this.topic);
  }

  classify(now) {
    if (!now || now.mgdl == null) return "normal";
    if (this.staleMin && now.haceMinutos >= this.staleMin) return "sin-datos";
    if (now.mgdl < this.low) return "bajo";
    if (now.mgdl > this.high) return "alto";
    return "normal";
  }

  // Devuelve el aviso enviado (o null). `clock` permite probarlo.
  async check(now, clock = Date.now()) {
    if (!this.enabled) return null;
    const kind = this.classify(now);
    const prev = this.state;
    const arrow = now?.tendencia?.arrow ? ` ${now.tendencia.arrow}` : "";
    const trend = now?.tendencia?.label ? `, ${now.tendencia.label}` : "";
    let msg = null;

    if (kind === "normal") {
      if (prev.kind === "bajo" || prev.kind === "alto") {
        msg = { title: `De vuelta en rango: ${now.mgdl} mg/dL${arrow}`, message: "La glucosa volvió a valores normales.", priority: 3, tags: ["white_check_mark"] };
      }
      this.state = { kind, sentAt: 0 };
      return msg ? this.send(msg) : null;
    }

    const repeat = kind === "bajo" ? this.repeatLow : kind === "alto" ? this.repeatHigh : 60 * MIN;
    if (kind === prev.kind && clock - prev.sentAt < repeat) return null;

    if (kind === "bajo") {
      msg = { title: `GLUCOSA BAJA: ${now.mgdl} mg/dL${arrow}`, message: `Por debajo de ${this.low}${trend}. Revisa y trata la hipoglucemia.`, priority: 5, tags: ["rotating_light"] };
    } else if (kind === "alto") {
      msg = { title: `Glucosa alta: ${now.mgdl} mg/dL${arrow}`, message: `Por encima de ${this.high}${trend}.`, priority: 4, tags: ["warning"] };
    } else {
      msg = { title: "Sin datos del sensor", message: `No llegan lecturas hace ${now.haceMinutos} minutos. Revisa el sensor, el celular o el panel.`, priority: 3, tags: ["grey_question"] };
    }
    this.state = { kind, sentAt: clock };
    return this.send(msg);
  }

  async send({ title, message, priority = 3, tags = [] }) {
    const res = await fetch(this.server, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: this.topic, title, message, priority, tags }),
    });
    if (!res.ok) throw new Error(`ntfy respondió HTTP ${res.status}`);
    return { title, message, priority };
  }
}
