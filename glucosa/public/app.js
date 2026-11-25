const $ = (s) => document.querySelector(s);
const LABELS = { "muy-bajo": "Muy bajo", bajo: "Bajo", "en-rango": "En rango", alto: "Alto", "muy-alto": "Muy alto" };
const COLORS = ["muy-bajo", "bajo", "en-rango", "alto", "muy-alto"];
let cfg = { limites: { veryLow: 54, low: 70, high: 180, veryHigh: 250 }, zonaHoraria: undefined };
let hours = Number(localStorageGet("horas")) || 24;
let current = null;

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

async function api(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const fmt = (t, opts) => new Date(t).toLocaleString("es-CL", { timeZone: cfg.zonaHoraria, ...opts });
const hhmm = (t) => fmt(t, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hourOf = (t) => Number(fmt(t, { hour: "2-digit", hourCycle: "h23" }));

// ---------- Lectura actual ----------
function renderNow(d) {
  if (!d || d.mgdl == null) {
    $("#label").textContent = d?.error ? "Sin conexión" : "Esperando datos…";
    showError(d?.error);
    return;
  }
  current = d;
  $("#hero").dataset.estado = d.estado;
  $("#value").textContent = d.mgdl;
  $("#arrow").textContent = d.tendencia?.arrow ?? "";
  $("#label").textContent = LABELS[d.estado] + (d.tendencia ? ` · ${d.tendencia.label}` : "");
  document.title = `${d.mgdl}${d.tendencia?.arrow ?? ""} · Mi Glucosa`;
  showError(d.error);
  tickAgo();
  maybeNotify(d);
}

function tickAgo() {
  if (!current) return;
  const min = Math.round((Date.now() - current.t) / 60000);
  $("#ago").textContent = min < 1 ? "ahora" : `hace ${min} min (${hhmm(current.t)})`;
  $("#hero").classList.toggle("stale", min > 15);
}

function showError(msg) {
  $("#error").hidden = !msg;
  $("#error").textContent = msg ? `⚠ ${msg}` : "";
}

// ---------- Gráfico ----------
async function renderChart() {
  const data = await api(`/api/history?hours=${hours}`);
  const el = $("#chart");
  const W = el.clientWidth || 600, H = el.clientHeight || 220;
  const P = { l: 34, r: 8, t: 8, b: 22 };
  const now = Date.now(), from = now - hours * 3600000;
  const L = cfg.limites;
  const yMax = Math.max(300, ...data.map((d) => d.mgdl + 20));
  const yMin = 40;
  const x = (t) => P.l + ((t - from) / (now - from)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - P.t - P.b);

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de glucosa de las últimas ${hours} horas">`;
  svg += `<rect class="band" x="${P.l}" y="${y(L.high)}" width="${W - P.l - P.r}" height="${y(L.low) - y(L.high)}"/>`;
  for (const v of [L.low, L.high]) svg += `<line class="limit" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/>`;
  for (const v of [L.veryLow, L.low, L.high, L.veryHigh]) svg += `<text class="axis" x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;

  const stepH = hours <= 6 ? 1 : hours <= 12 ? 2 : 4;
  const first = new Date(from); first.setMinutes(0, 0, 0);
  for (let t = first.getTime() + 3600000; t <= now; t += 3600000) {
    if (hourOf(t) % stepH) continue;
    svg += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${P.t}" y2="${H - P.b}" opacity=".5"/>`;
    svg += `<text class="axis" x="${x(t)}" y="${H - 6}" text-anchor="middle">${String(hourOf(t)).padStart(2, "0")}h</text>`;
  }

  if (data.length) {
    // Corta la línea donde faltan datos (> 30 min sin lecturas)
    let d = "";
    data.forEach((p, i) => {
      const gap = i === 0 || p.t - data[i - 1].t > 30 * 60000;
      d += `${gap ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.mgdl).toFixed(1)}`;
    });
    svg += `<path class="line" d="${d}"/>`;
    const r = data.length > 150 ? 1.6 : 2.6;
    for (const p of data) svg += `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.mgdl).toFixed(1)}" r="${r}" fill="var(--${stateOf(p.mgdl)})"/>`;
    const last = data.at(-1);
    svg += `<circle cx="${x(last.t)}" cy="${y(last.mgdl)}" r="5" fill="var(--${stateOf(last.mgdl)})" stroke="var(--card)" stroke-width="2"/>`;
  } else {
    svg += `<text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">Sin lecturas en este periodo</text>`;
  }
  el.innerHTML = svg + "</svg>";
}

function stateOf(v) {
  const L = cfg.limites;
  return v < L.veryLow ? "muy-bajo" : v < L.low ? "bajo" : v <= L.high ? "en-rango" : v <= L.veryHigh ? "alto" : "muy-alto";
}

// ---------- Resúmenes ----------
const stat = (value, label) => `<div class="stat"><b>${value ?? "–"}</b><small>${label}</small></div>`;

async function renderToday() {
  const { resumen: s, hipoglucemias } = await api("/api/today");
  if (!s) {
    $("#today").innerHTML = `<p class="fine">Aún no hay lecturas de hoy.</p>`;
    return;
  }
  const parts = [s.muyBajo, s.bajo, s.enRango, s.alto, s.muyAlto];
  $("#tir").innerHTML = parts.map((p, i) => `<span style="width:${p}%;background:var(--${COLORS[i]})" title="${LABELS[COLORS[i]]} ${p}%"></span>`).join("");
  $("#tir-legend").innerHTML = parts.map((p, i) => `<span><i style="background:var(--${COLORS[i]})"></i>${LABELS[COLORS[i]]} ${p}%</span>`).join("");
  $("#today").innerHTML =
    stat(`${s.enRango}%`, "tiempo en rango") + stat(s.promedio, "promedio") + stat(`${s.min}–${s.max}`, "mín–máx") + stat(`${s.cv}%`, "variabilidad (CV)");
  $("#hypos").innerHTML = hipoglucemias.length
    ? hipoglucemias.map((h) => `<div class="hypo">● Bajo de ${hhmm(h.inicio)} a ${hhmm(h.fin)} (mín. ${h.minimo})</div>`).join("")
    : `<div class="fine">Sin hipoglucemias hoy.</div>`;
}

async function renderDays() {
  const { dias, periodo: p } = await api("/api/days?days=14");
  $("#period").innerHTML = p
    ? stat(`${p.enRango}%`, "tiempo en rango") + stat(p.promedio, "promedio") + stat(`${p.gmi}%`, "HbA1c estimada (GMI)") + stat(`${p.cv}%`, "variabilidad (CV)")
    : `<p class="fine">El historial se va armando mientras el panel está encendido.</p>`;
  const cls = (v, good, bad, higherIsBetter) => (higherIsBetter ? (v >= good ? "good" : v < bad ? "bad" : "warn") : v <= good ? "good" : v > bad ? "bad" : "warn");
  $("#days tbody").innerHTML = dias
    .map((d) => {
      const dia = new Date(`${d.dia}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
      const bajo = Math.round((d.bajo + d.muyBajo) * 10) / 10;
      const alto = Math.round((d.alto + d.muyAlto) * 10) / 10;
      return `<tr><td>${dia}</td><td>${d.promedio}</td><td class="${cls(d.enRango, 70, 50, true)}">${d.enRango}%</td>
        <td class="${cls(bajo, 4, 8)}">${bajo}%</td><td class="${cls(alto, 25, 40)}">${alto}%</td><td>${d.min}–${d.max}</td></tr>`;
    })
    .join("");
}

// ---------- Avisos ----------
let lastAlert = { estado: null, t: 0 };
async function maybeNotify(d) {
  if (localStorageGet("avisos") !== "1" || Notification.permission !== "granted" || d.desactualizada) return;
  if (!["muy-bajo", "bajo", "alto", "muy-alto"].includes(d.estado)) return (lastAlert = { estado: null, t: 0 });
  const urgent = d.estado === "muy-bajo";
  const repeatMs = urgent ? 5 * 60000 : 20 * 60000;
  if (lastAlert.estado === d.estado && Date.now() - lastAlert.t < repeatMs) return;
  lastAlert = { estado: d.estado, t: Date.now() };
  const reg = await navigator.serviceWorker?.ready;
  const title = `${LABELS[d.estado]}: ${d.mgdl} mg/dL ${d.tendencia?.arrow ?? ""}`;
  const opts = { body: d.tendencia?.label ?? "", tag: "glucosa", renotify: true, requireInteraction: urgent, icon: "icon.svg" };
  reg ? reg.showNotification(title, opts) : new Notification(title, opts);
}

$("#notify").checked = localStorageGet("avisos") === "1" && "Notification" in window && Notification.permission === "granted";
$("#notify").addEventListener("change", async (e) => {
  if (e.target.checked) {
    if (!("Notification" in window)) return alert("Este navegador no permite avisos.");
    const p = await Notification.requestPermission();
    e.target.checked = p === "granted";
  }
  localStorageSet("avisos", e.target.checked ? "1" : "0");
});

// ---------- Arranque ----------
document.querySelectorAll("#range button").forEach((b) => {
  b.classList.toggle("on", Number(b.dataset.h) === hours);
  b.addEventListener("click", () => {
    hours = Number(b.dataset.h);
    localStorageSet("horas", hours);
    document.querySelectorAll("#range button").forEach((x) => x.classList.toggle("on", x === b));
    renderChart();
  });
});

function refreshAll() {
  renderChart().catch(console.error);
  renderToday().catch(console.error);
  renderDays().catch(console.error);
}

function connect() {
  const es = new EventSource("/api/stream");
  es.onmessage = (e) => {
    renderNow(JSON.parse(e.data));
    refreshAll();
  };
  es.onerror = () => showError("Reconectando con el servidor…");
  es.onopen = () => showError(null);
}

(async () => {
  try { cfg = await api("/api/config"); } catch {}
  try { renderNow(await api("/api/now")); } catch {}
  refreshAll();
  connect();
  setInterval(tickAgo, 15000);
  window.addEventListener("resize", () => renderChart().catch(() => {}));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && refreshAll());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
