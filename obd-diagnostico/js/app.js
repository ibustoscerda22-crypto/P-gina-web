import { BleTransport, SerialTransport } from './transport.js';
import { SimTransport } from './simulator.js';
import { ELM327 } from './elm327.js';
import { PIDS, FAST_PIDS, SLOW_PIDS, GAUGE_PIDS, formatValue } from './pids.js';
import { describeDtc } from './dtc.js';
import { analyze, healthScore } from './analysis.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const state = {
  transport: null,
  elm: null,
  live: false,
  values: {},
  hist: {},
  scan: null,
  wakeLock: null,
};

/* ---------- Almacenamiento local (opcional) ---------- */
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* sin almacenamiento disponible */
    }
  },
};

/* ---------- Conexión ---------- */
function setStatus(text, cls) {
  const el = $('#status');
  el.textContent = text;
  el.className = 'pill ' + cls;
  el.title = text;
}

function showConnectMsg(text, ok = false) {
  const el = $('#connect-msg');
  el.textContent = text;
  el.className = 'msg' + (ok ? ' ok' : '');
  el.hidden = !text;
}

function setConnectButtons(disabled) {
  for (const id of ['#btn-ble', '#btn-serial', '#btn-demo']) $(id).disabled = disabled;
}

async function connect(kind) {
  showConnectMsg('');
  setConnectButtons(true);
  setStatus('Conectando…', 'busy');
  let t = null;
  try {
    t = kind === 'ble' ? new BleTransport() : kind === 'serial' ? new SerialTransport(+$('#baud').value) : new SimTransport();
    await t.connect();
    setStatus('Iniciando ELM327…', 'busy');
    const elm = new ELM327(t, logIO);
    await elm.init();
    t.onDisconnect = () => onLost('Se perdió la conexión con el adaptador.');
    state.transport = t;
    state.elm = elm;
    setStatus(`${t.name} · ${elm.protocol.replace('ISO 15765-4 ', '')}`, 'on');
    $('#connect').hidden = true;
    $('#app').hidden = false;
    $('#btn-disconnect').hidden = false;
    state.values = {};
    state.hist = {};
    buildGauges();
  } catch (e) {
    try {
      await t?.disconnect();
    } catch {
      /* ignore */
    }
    setStatus('Desconectado', 'off');
    if (e?.name === 'NotFoundError' || e?.name === 'AbortError') showConnectMsg('');
    else if (e?.name === 'NetworkError') showConnectMsg('No se pudo conectar por Bluetooth. Acerca el celular al adaptador y vuelve a intentar.');
    else showConnectMsg(e?.message || String(e));
  } finally {
    setConnectButtons(false);
  }
}

async function disconnect() {
  stopLive();
  const t = state.transport;
  state.transport = null;
  state.elm = null;
  try {
    await t?.disconnect();
  } catch {
    /* ignore */
  }
  setStatus('Desconectado', 'off');
  $('#app').hidden = true;
  $('#connect').hidden = false;
  $('#btn-disconnect').hidden = true;
}

function onLost(msg) {
  if (!state.elm) return;
  disconnect();
  showConnectMsg(msg);
}

/* ---------- Terminal ---------- */
const termLines = [];
function logIO(cmd, raw) {
  const resp = raw.replace(/\r+/g, '\n').replace(/\n+/g, '\n').trim();
  termLines.push(`<span class="tx">&gt; ${esc(cmd)}</span>\n${esc(resp)}`);
  if (termLines.length > 300) termLines.splice(0, termLines.length - 300);
  if (!$('[data-panel="term"]').hidden) renderTerm();
}
function renderTerm() {
  const el = $('#term-log');
  el.innerHTML = termLines.join('\n');
  el.scrollTop = el.scrollHeight;
}

/* ---------- Datos ---------- */
function record(pid, v) {
  if (v == null) return;
  state.values[pid] = v;
  const h = (state.hist[pid] ||= []);
  h.push({ t: Date.now(), v });
  if (h.length > 90) h.shift();
}

function availablePids(list) {
  const sup = state.elm?.supported;
  return list.filter((p) => !sup?.size || sup.has(p));
}

async function readPids(list) {
  for (const pid of list) {
    try {
      record(pid, await state.elm.readPid(pid));
    } catch (e) {
      if (!state.elm) throw e;
    }
  }
}

async function readBattery() {
  try {
    record('RV', await state.elm.batteryVoltage());
  } catch {
    /* algunos clones no soportan ATRV */
  }
}

/* ---------- Escaneo completo ---------- */
function progress(pct, text) {
  const el = $('#scan-progress');
  el.hidden = pct == null;
  el.querySelector('div').style.width = (pct || 0) + '%';
  el.querySelector('span').textContent = text || '';
}

async function runScan() {
  const elm = state.elm;
  if (!elm) return;
  const btn = $('#btn-scan');
  btn.disabled = true;
  try {
    progress(5, 'Leyendo luz de check engine y monitores…');
    const status = await elm.readStatus();
    progress(15, 'Leyendo VIN…');
    const vin = await elm.readVin().catch(() => null);
    progress(25, 'Leyendo códigos almacenados…');
    const stored = await elm.readDtcs('03');
    progress(35, 'Leyendo códigos pendientes…');
    const pending = await elm.readDtcs('07').catch(() => []);
    progress(45, 'Leyendo códigos permanentes…');
    const permanent = await elm.readDtcs('0A').catch(() => []);

    const pids = availablePids([...FAST_PIDS, ...SLOW_PIDS]);
    const rounds = 4;
    for (let r = 0; r < rounds; r++) {
      progress(50 + (r / rounds) * 45, `Midiendo sensores (${r + 1}/${rounds})…`);
      await readPids(r === 0 ? pids : ['0C', '0D', '06', '07', '14'].filter((p) => pids.includes(p)));
      await readBattery();
    }

    const dtcs = { stored, pending, permanent };
    const findings = analyze({ values: state.values, hist: state.hist, dtcs, status });
    state.scan = {
      date: new Date().toISOString(),
      vehicle: $('#vehicle').value,
      vin,
      protocol: elm.protocol,
      adapter: `${state.transport.name} · ${elm.version}`,
      status,
      dtcs,
      values: { ...state.values },
      findings,
      score: healthScore(findings),
    };
    progress(100, 'Listo');
    renderScan(state.scan);
    saveHistory(state.scan);
    setTimeout(() => progress(null), 800);
  } catch (e) {
    progress(null);
    alert('No se pudo completar el escaneo: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

function findingHTML(f) {
  const labels = { crit: 'Crítico', warn: 'Atención', info: 'Información', ok: 'Bien' };
  return `<li class="${f.level}"><span class="lvl">${labels[f.level]}</span><b>${esc(f.title)}</b><p>${esc(f.detail)}</p></li>`;
}

function paramsHTML(values) {
  const order = ['RV', ...FAST_PIDS, ...SLOW_PIDS];
  return order
    .filter((p) => values[p] != null)
    .map((p) => `<tr><td>${esc(PIDS[p].name)}</td><td>${formatValue(p, values[p])} ${esc(PIDS[p].unit)}</td></tr>`)
    .join('') || '<tr><td class="muted">Sin datos</td><td></td></tr>';
}

function renderScan(s) {
  $('#scan-result').hidden = false;
  const score = $('#score');
  score.querySelector('span').textContent = s.score;
  score.className = 'score' + (s.score < 50 ? ' crit' : s.score < 80 ? ' warn' : '');
  $('#r-mil').textContent = s.status ? (s.status.mil ? `Encendida (${s.status.count})` : 'Apagada') : 'Sin dato';
  $('#r-vin').textContent = s.vin || 'No disponible';
  $('#r-proto').textContent = s.protocol;
  $('#r-date').textContent = new Date(s.date).toLocaleString('es');
  $('#findings').innerHTML = s.findings.map(findingHTML).join('');

  const groups = [
    ['Almacenados', s.dtcs.stored],
    ['Pendientes', s.dtcs.pending],
    ['Permanentes', s.dtcs.permanent],
  ];
  const total = groups.reduce((n, [, l]) => n + l.length, 0);
  $('#dtc-list').innerHTML = total
    ? groups
        .filter(([, l]) => l.length)
        .map(([title, list]) => `<div class="dtc-group"><h3>${title}</h3>${list.map(dtcHTML).join('')}</div>`)
        .join('')
    : '<p class="muted">No hay códigos de falla. 👍</p>';
  $('#btn-clear').hidden = !state.elm || (!s.dtcs.stored.length && !s.dtcs.pending.length);

  const mons = s.status?.monitors || [];
  $('#monitors').innerHTML = mons.length
    ? mons.map((m) => `<li><span>${esc(m.name)}</span><span class="st ${m.complete ? 'done' : 'todo'}">${m.complete ? 'Completo' : 'Incompleto'}</span></li>`).join('')
    : '<li class="muted">El auto no informó monitores.</li>';
  $('#scan-params').innerHTML = paramsHTML(s.values);
}

function dtcHTML(code) {
  const d = describeDtc(code);
  const causes = d.causes.length ? `<p>Causas frecuentes:</p><ul>${d.causes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '';
  return `<details class="dtc"><summary><span class="code">${code}</span><span class="desc">${esc(d.description)}</span><span class="sev ${d.severity}">${d.severity}</span></summary>
    <div class="body"><p>Sistema: ${esc(d.family)}</p>${causes}</div></details>`;
}

async function clearCodes() {
  if (!state.elm) return;
  const ok = confirm(
    '¿Borrar los códigos de falla?\n\n• Se apagará la luz de check engine, pero la falla NO se repara.\n• Los monitores de emisiones quedarán incompletos (puede afectar la revisión técnica).\n\nHazlo con el motor apagado y la llave en contacto.'
  );
  if (!ok) return;
  try {
    const done = await state.elm.clearDtcs();
    alert(done ? 'Códigos borrados. Vuelve a escanear para confirmar.' : 'El auto no confirmó el borrado. Intenta con el motor apagado y la llave en contacto.');
    if (done) runScan();
  } catch (e) {
    alert('Error al borrar: ' + e.message);
  }
}

/* ---------- Informe ---------- */
function reportText(s) {
  const L = [];
  const line = (t = '') => L.push(t);
  line('INFORME DE DIAGNÓSTICO OBD-II');
  line('='.repeat(32));
  line(`Vehículo:  ${s.vehicle}`);
  line(`Fecha:     ${new Date(s.date).toLocaleString('es')}`);
  line(`VIN:       ${s.vin || 'No disponible'}`);
  line(`Adaptador: ${s.adapter}`);
  line(`Protocolo: ${s.protocol}`);
  line(`Check engine: ${s.status ? (s.status.mil ? `ENCENDIDA (${s.status.count} código/s)` : 'apagada') : 'sin dato'}`);
  line(`Puntaje de salud: ${s.score}/100`);
  for (const [title, list] of [['CÓDIGOS ALMACENADOS', s.dtcs.stored], ['CÓDIGOS PENDIENTES', s.dtcs.pending], ['CÓDIGOS PERMANENTES', s.dtcs.permanent]]) {
    line();
    line(title);
    if (!list.length) line('  Ninguno');
    for (const c of list) {
      const d = describeDtc(c);
      line(`  ${c} — ${d.description} (severidad ${d.severity})`);
      if (d.causes.length) line(`     Causas frecuentes: ${d.causes.join('; ')}`);
    }
  }
  line();
  line('HALLAZGOS');
  for (const f of s.findings) line(`  [${{ crit: 'CRÍTICO', warn: 'ATENCIÓN', info: 'INFO', ok: 'OK' }[f.level]}] ${f.title}\n     ${f.detail}`);
  if (s.status?.monitors?.length) {
    line();
    line('MONITORES DE EMISIONES');
    for (const m of s.status.monitors) line(`  ${m.complete ? '✔' : '✘'} ${m.name}: ${m.complete ? 'completo' : 'incompleto'}`);
  }
  line();
  line('PARÁMETROS');
  for (const p of ['RV', ...FAST_PIDS, ...SLOW_PIDS]) {
    if (s.values[p] != null) line(`  ${PIDS[p].name}: ${formatValue(p, s.values[p])} ${PIDS[p].unit}`);
  }
  line();
  line('Informe orientativo generado por OBD Diagnóstico. Confirma cualquier reparación con un mecánico.');
  return L.join('\n');
}

function downloadReport() {
  if (!state.scan) return;
  const blob = new Blob([reportText(state.scan)], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diagnostico-${state.scan.date.slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function shareReport() {
  if (!state.scan) return;
  try {
    await navigator.share({ title: 'Diagnóstico ' + state.scan.vehicle, text: reportText(state.scan) });
  } catch {
    /* cancelado */
  }
}

/* ---------- Historial ---------- */
function saveHistory(scan) {
  const h = store.get('obd.history', []);
  h.unshift(scan);
  store.set('obd.history', h.slice(0, 15));
  renderHistory();
}

function renderHistory() {
  const h = store.get('obd.history', []);
  const el = $('#history');
  if (!h.length) return;
  el.innerHTML = h
    .map((s, i) => {
      const codes = [...new Set([...s.dtcs.stored, ...s.dtcs.pending])];
      return `<li data-i="${i}"><span><b>${codes.length ? esc(codes.join(', ')) : 'Sin códigos'}</b><br><span class="when">${esc(new Date(s.date).toLocaleString('es'))} · ${esc(s.vehicle || '')}</span></span><span>${s.score}/100</span></li>`;
    })
    .join('');
}

/* ---------- En vivo ---------- */
function buildGauges() {
  $('#gauges').innerHTML = GAUGE_PIDS.filter((p) => p === 'RV' || availablePids([p]).length)
    .map((p) => `<div class="gauge" data-pid="${p}"><div class="label">${esc(PIDS[p].name)}</div><div class="val">—<small>${esc(PIDS[p].unit)}</small></div><svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points=""/></svg></div>`)
    .join('');
}

function gaugeLevel(pid, v) {
  if (pid === '05') return v >= 112 ? 'crit' : v >= 105 ? 'warn' : '';
  if (pid === 'RV') {
    const running = (state.values['0C'] || 0) > 300;
    if (running) return v > 15.2 ? 'crit' : v < 13 ? 'warn' : '';
    return v < 11.8 ? 'crit' : v < 12.3 ? 'warn' : '';
  }
  if (pid === '0C') return v > 6200 ? 'warn' : '';
  return '';
}

function renderLive() {
  for (const g of document.querySelectorAll('.gauge')) {
    const pid = g.dataset.pid;
    const v = state.values[pid];
    g.querySelector('.val').innerHTML = `${formatValue(pid, v)}<small>${esc(PIDS[pid].unit)}</small>`;
    g.className = 'gauge ' + (v != null ? gaugeLevel(pid, v) : '');
    const h = state.hist[pid] || [];
    if (h.length > 1) {
      const vals = h.map((p) => p.v);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = max - min || 1;
      g.querySelector('polyline').setAttribute(
        'points',
        vals.map((v, i) => `${((i / (vals.length - 1)) * 100).toFixed(1)},${(28 - ((v - min) / span) * 26).toFixed(1)}`).join(' ')
      );
    }
  }
  $('#live-params').innerHTML = paramsHTML(state.values);
  $('#live-findings').innerHTML = analyze({ values: state.values, hist: state.hist }).map(findingHTML).join('');
}

async function startLive() {
  if (state.live || !state.elm) return;
  state.live = true;
  $('#btn-live').textContent = 'Pausar';
  try {
    state.wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* no disponible */
  }
  const fast = availablePids(FAST_PIDS);
  const slow = availablePids(SLOW_PIDS);
  let cycle = 0;
  let errors = 0;
  while (state.live && state.elm) {
    try {
      await readPids(cycle % 4 === 0 ? [...fast, ...slow] : fast);
      if (cycle % 4 === 0) await readBattery();
      errors = 0;
    } catch {
      if (++errors >= 3) {
        stopLive();
        alert('El adaptador dejó de responder.');
        break;
      }
    }
    renderLive();
    cycle++;
    await sleep(state.transport?.isSim ? 300 : 50);
  }
}

function stopLive() {
  state.live = false;
  $('#btn-live').textContent = 'Iniciar';
  try {
    state.wakeLock?.release();
  } catch {
    /* ignore */
  }
  state.wakeLock = null;
}

/* ---------- Pestañas ---------- */
function showTab(name) {
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
  if (name === 'term') renderTerm();
  if (name !== 'live') stopLive();
}

/* ---------- Inicio ---------- */
function init() {
  const ble = BleTransport.supported();
  const serial = SerialTransport.supported();
  $('#btn-ble').disabled = !ble;
  $('#btn-serial').disabled = !serial;
  const notes = [];
  if (!window.isSecureContext) notes.push('Abre la app con https:// (o localhost): el navegador bloquea Bluetooth y USB en páginas sin cifrar.');
  else if (!ble && !serial) notes.push('Este navegador no permite Bluetooth ni USB. Usa Chrome en Android o Chrome/Edge en un computador. En iPhone, usa el navegador Bluefy.');
  else if (!ble) notes.push('Bluetooth no está disponible en este navegador; puedes usar USB / Serie.');
  else if (!serial) notes.push('En el celular usa un adaptador Bluetooth LE (4.0). Los adaptadores Bluetooth clásicos y Wi-Fi no funcionan desde el navegador.');
  $('#compat').textContent = notes.join(' ');

  $('#btn-ble').onclick = () => connect('ble');
  $('#btn-serial').onclick = () => connect('serial');
  $('#btn-demo').onclick = () => connect('demo');
  $('#btn-disconnect').onclick = disconnect;
  $('#btn-scan').onclick = runScan;
  $('#btn-clear').onclick = clearCodes;
  $('#btn-download').onclick = downloadReport;
  $('#btn-share').hidden = !navigator.share;
  $('#btn-share').onclick = shareReport;
  $('#btn-live').onclick = () => (state.live ? stopLive() : startLive());
  for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => showTab(b.dataset.tab);

  $('#term-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = $('#term-input');
    const c = input.value.trim().toUpperCase();
    if (!c || !state.elm) return;
    input.value = '';
    try {
      await state.elm.cmd(c, 6000);
    } catch {
      /* el error ya queda en el registro */
    }
  };

  $('#history').onclick = (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    const s = store.get('obd.history', [])[+li.dataset.i];
    if (s) {
      state.scan = s;
      renderScan(s);
      $('#btn-clear').hidden = true;
      $('#scan-result').scrollIntoView({ behavior: 'smooth' });
    }
  };

  const vehicle = $('#vehicle');
  vehicle.value = store.get('obd.vehicle', vehicle.value);
  vehicle.onchange = () => store.set('obd.vehicle', vehicle.value);

  renderHistory();

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
