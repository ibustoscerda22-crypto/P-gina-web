// Métricas estándar de monitoreo continuo (consenso internacional de tiempo en rango).

export const TZ = process.env.TZ_PANEL || process.env.TZ || "America/Santiago";

export function limits(env = process.env) {
  return {
    veryLow: Number(env.GLUCOSA_MUY_BAJO ?? 54),
    low: Number(env.GLUCOSA_BAJO ?? 70),
    high: Number(env.GLUCOSA_ALTO ?? 180),
    veryHigh: Number(env.GLUCOSA_MUY_ALTO ?? 250),
  };
}

export function dayKey(t, tz = TZ) {
  // "YYYY-MM-DD" en la zona horaria del usuario
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

export function summarize(readings, lim = limits()) {
  const v = readings.map((r) => r.mgdl);
  if (!v.length) return null;
  const n = v.length;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const pct = (fn) => Math.round((v.filter(fn).length / n) * 1000) / 10;
  return {
    lecturas: n,
    promedio: Math.round(mean),
    min: Math.min(...v),
    max: Math.max(...v),
    desviacion: Math.round(sd),
    cv: Math.round((sd / mean) * 1000) / 10, // estable si ≤ 36 %
    gmi: Math.round((3.31 + 0.02392 * mean) * 10) / 10, // HbA1c estimada
    muyBajo: pct((x) => x < lim.veryLow),
    bajo: pct((x) => x >= lim.veryLow && x < lim.low),
    enRango: pct((x) => x >= lim.low && x <= lim.high),
    alto: pct((x) => x > lim.high && x <= lim.veryHigh),
    muyAlto: pct((x) => x > lim.veryHigh),
  };
}

// Episodios por debajo del límite bajo que duran al menos 15 minutos.
export function lowEpisodes(readings, lim = limits()) {
  const out = [];
  let cur = null;
  for (const r of readings) {
    if (r.mgdl < lim.low) {
      if (!cur) cur = { inicio: r.t, fin: r.t, minimo: r.mgdl };
      cur.fin = r.t;
      cur.minimo = Math.min(cur.minimo, r.mgdl);
    } else if (cur) {
      // La duración se cuenta hasta la primera lectura ya recuperada
      if (r.t - cur.inicio >= 15 * 60_000 || cur.minimo < lim.veryLow) out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function byDay(readings, tz = TZ) {
  const days = new Map();
  for (const r of readings) {
    const k = dayKey(r.t, tz);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(r);
  }
  return [...days.entries()].map(([dia, rs]) => ({ dia, ...summarize(rs) }));
}

export function status(mgdl, lim = limits()) {
  if (mgdl < lim.veryLow) return "muy-bajo";
  if (mgdl < lim.low) return "bajo";
  if (mgdl <= lim.high) return "en-rango";
  if (mgdl <= lim.veryHigh) return "alto";
  return "muy-alto";
}
