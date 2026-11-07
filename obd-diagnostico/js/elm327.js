// Protocolo ELM327: inicialización, lectura de PIDs, códigos de falla, VIN y monitores.
import { PIDS } from './pids.js';
import { decodeDtc } from './dtc.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const PROTOCOLS = {
  1: 'SAE J1850 PWM',
  2: 'SAE J1850 VPW',
  3: 'ISO 9141-2',
  4: 'ISO 14230-4 KWP (inicio lento)',
  5: 'ISO 14230-4 KWP (inicio rápido)',
  6: 'ISO 15765-4 CAN (11 bit, 500 kbps)',
  7: 'ISO 15765-4 CAN (29 bit, 500 kbps)',
  8: 'ISO 15765-4 CAN (11 bit, 250 kbps)',
  9: 'ISO 15765-4 CAN (29 bit, 250 kbps)',
  A: 'SAE J1939 CAN',
  B: 'CAN definido por usuario (B)',
  C: 'CAN definido por usuario (C)',
};

const ERROR_RE = /NODATA|UNABLETOCONNECT|CANERROR|BUSERROR|BUSBUSY|FBERROR|DATAERROR|STOPPED|BUFFERFULL|^\?$|^ERROR/;

const MONITORS_CONT = [
  ['Detección de fallo de encendido', 0],
  ['Sistema de combustible', 1],
  ['Componentes integrales', 2],
];
const MONITORS_SPARK = [
  'Catalizador',
  'Catalizador calefaccionado',
  'Sistema evaporativo (EVAP)',
  'Aire secundario',
  'Refrigerante del A/C',
  'Sensor de oxígeno',
  'Calefactor del sensor de oxígeno',
  'Sistema EGR / VVT',
];
const MONITORS_DIESEL = [
  'Catalizador NMHC',
  'Postratamiento NOx / SCR',
  '(reservado)',
  'Presión de sobrealimentación',
  '(reservado)',
  'Sensor de gases de escape',
  'Filtro de partículas (DPF)',
  'Sistema EGR / VVT',
];

export class ELM327 {
  constructor(transport, onIO) {
    this.t = transport;
    this.onIO = onIO;
    this.queue = Promise.resolve();
    this.supported = new Set();
    this.isCan = true;
    this.protocol = '';
    this.version = '';
  }

  // Envía un comando; los comandos se encolan para no mezclarse.
  cmd(c, timeout = 3000) {
    const run = async () => {
      try {
        const raw = await this.t.send(c, timeout);
        this.onIO?.(c, raw);
        return raw;
      } catch (e) {
        this.onIO?.(c, `[${e.message}]`);
        throw e;
      }
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  // Limpia la respuesta: una entrada por línea, sin espacios, sin eco ni "SEARCHING...".
  lines(raw, c) {
    const echo = c.replace(/\s+/g, '').toUpperCase();
    return raw
      .split(/[\r\n]+/)
      .map((l) => l.replace(/\s+/g, '').toUpperCase())
      .filter((l) => l && l !== echo && !l.startsWith('SEARCHING') && !l.startsWith('BUSINIT'));
  }

  async query(c, timeout) {
    return this.lines(await this.cmd(c, timeout), c);
  }

  async init() {
    try {
      await this.cmd('ATZ', 5000);
    } catch {
      // Algunos clones no devuelven el prompt tras el reinicio; seguimos igual.
      await sleep(800);
    }
    await sleep(300);
    for (const c of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP0']) {
      await this.cmd(c, 2000);
    }
    this.version = (await this.query('ATI')).join(' ') || 'ELM327';

    // 0100 obliga al adaptador a buscar el protocolo del auto (puede tardar).
    const first = await this.query('0100', 15000);
    const ok = first.find((l) => l.startsWith('4100'));
    if (!ok) {
      const err = first.join(' ');
      if (/UNABLETOCONNECT|NODATA/.test(err)) {
        throw new Error('El adaptador responde pero no logra comunicarse con el auto. Pon la llave en contacto (o enciende el motor) y vuelve a intentar.');
      }
      throw new Error(`Respuesta inesperada del adaptador: ${err || '(vacía)'}`);
    }
    const dpn = (await this.query('ATDPN')).join('').replace(/^A/, '');
    this.protocolId = dpn;
    this.protocol = PROTOCOLS[dpn] || `Protocolo ${dpn}`;
    this.isCan = /^[6-9A-C]$/.test(dpn);
    await this.loadSupported(first);
  }

  async loadSupported(firstLines) {
    this.supported = new Set();
    let base = 0;
    let lines = firstLines;
    while (base <= 0xa0) {
      const prefix = '41' + hex2(base);
      const line = lines?.find((l) => l.startsWith(prefix));
      if (!line) break;
      const mask = parseInt(line.slice(4, 12), 16) >>> 0;
      for (let i = 1; i <= 32; i++) {
        if (mask & (1 << (32 - i))) this.supported.add(hex2(base + i));
      }
      if (!this.supported.has(hex2(base + 0x20))) break;
      base += 0x20;
      lines = await this.query('01' + hex2(base));
    }
  }

  bytesOf(line, skip) {
    return (line.slice(skip).match(/[0-9A-F]{2}/g) || []).map((h) => parseInt(h, 16));
  }

  async readPid(pid) {
    const def = PIDS[pid];
    if (!def?.f) return null;
    const lines = await this.query('01' + pid);
    const line = lines.find((l) => l.startsWith('41' + pid));
    if (!line) return null;
    const bytes = this.bytesOf(line, 4);
    if (bytes.length < def.n) return null;
    const v = def.f(bytes);
    return Number.isFinite(v) ? v : null;
  }

  async batteryVoltage() {
    const lines = await this.query('ATRV');
    const m = lines.join('').match(/(\d+(?:\.\d+)?)V?/);
    return m ? parseFloat(m[1]) : null;
  }

  // mode: '03' almacenados, '07' pendientes, '0A' permanentes
  async readDtcs(mode) {
    const prefix = (0x40 + parseInt(mode, 16)).toString(16).toUpperCase();
    const lines = await this.query(mode, 6000);
    if (lines.some((l) => ERROR_RE.test(l))) return [];

    // Arma los mensajes (en CAN largo vienen como "0:...", "1:...").
    const msgs = [];
    for (const l of lines) {
      if (/^[0-9A-F]{3}$/.test(l)) continue; // largo total del mensaje multi-trama
      const m = l.match(/^([0-9A-F]):(.*)$/);
      if (m) {
        if ((m[1] === '0' && m[2].startsWith(prefix)) || !msgs.length) msgs.push(m[2]);
        else msgs[msgs.length - 1] += m[2];
      } else {
        msgs.push(l);
      }
    }

    const codes = new Set();
    for (const msg of msgs) {
      if (!msg.startsWith(prefix)) continue;
      let data = msg.slice(2);
      if (this.isCan) {
        const count = parseInt(data.slice(0, 2), 16) || 0;
        data = data.slice(2, 2 + count * 4);
      }
      for (let i = 0; i + 4 <= data.length; i += 4) {
        const h = data.slice(i, i + 4);
        if (h !== '0000') codes.add(decodeDtc(h));
      }
    }
    return [...codes];
  }

  async clearDtcs() {
    const lines = await this.query('04', 8000);
    return lines.some((l) => l.startsWith('44'));
  }

  async readVin() {
    const lines = await this.query('0902', 6000);
    if (lines.some((l) => ERROR_RE.test(l))) return null;
    let hex = '';
    for (let l of lines) {
      if (/^[0-9A-F]{3}$/.test(l)) continue;
      l = l.replace(/^[0-9A-F]:/, '');
      if (l.startsWith('4902')) l = l.slice(6); // 49 02 + contador/secuencia
      hex += l;
    }
    const text = (hex.match(/[0-9A-F]{2}/g) || [])
      .map((h) => String.fromCharCode(parseInt(h, 16)))
      .join('')
      .replace(/[^A-HJ-NPR-Z0-9]/g, '');
    return text.length >= 17 ? text.slice(-17) : null;
  }

  // Modo 01 PID 01: luz MIL, cantidad de códigos y monitores de preparación.
  async readStatus() {
    const lines = await this.query('0101');
    const line = lines.find((l) => l.startsWith('4101'));
    if (!line) return null;
    const [A, B, C, D] = this.bytesOf(line, 4);
    const diesel = !!(B & 0x08);
    const monitors = [];
    for (const [name, bit] of MONITORS_CONT) {
      if (B & (1 << bit)) monitors.push({ name, complete: !(B & (1 << (bit + 4))) });
    }
    const names = diesel ? MONITORS_DIESEL : MONITORS_SPARK;
    for (let bit = 0; bit < 8; bit++) {
      if (C & (1 << bit)) monitors.push({ name: names[bit], complete: !(D & (1 << bit)) });
    }
    return { mil: !!(A & 0x80), count: A & 0x7f, diesel, monitors };
  }
}

function hex2(n) {
  return n.toString(16).toUpperCase().padStart(2, '0');
}
