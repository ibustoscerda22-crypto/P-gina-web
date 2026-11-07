// Simulador de un ELM327 conectado a un auto, para probar la app sin el vehículo.
// Simula un motor con mezcla pobre (P0171) y un catalizador con código pendiente (P0420).

const SUPPORTED = ['01', '03', '04', '05', '06', '07', '0B', '0C', '0D', '0E', '0F', '11', '13', '14', '15', '1C', '1F', '20', '21', '2F', '33', '40', '42', '46'];
const VIN = '9BGKS48B0JG123456';

const h1 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase().padStart(2, '0');
const h2 = (n) => Math.max(0, Math.min(65535, Math.round(n))).toString(16).toUpperCase().padStart(4, '0');
const noise = (a) => (Math.random() - 0.5) * 2 * a;

function mask(base) {
  let m = 0;
  for (let i = 1; i <= 32; i++) {
    if (SUPPORTED.includes(h1(base + i))) m = (m | (1 << (32 - i))) >>> 0;
  }
  return m.toString(16).toUpperCase().padStart(8, '0');
}

export class SimTransport {
  constructor() {
    this.name = 'Simulador (modo demo)';
    this.isSim = true;
    this.onDisconnect = null;
  }

  async connect() {
    this.t0 = Date.now();
    this.stored = ['0171'];
    this.pending = ['0420'];
    this.cleared = false;
    this.clearedAt = 0;
  }

  async disconnect() {}

  engine() {
    const t = (Date.now() - this.t0) / 1000;
    const drive = t > 15 ? Math.max(0, Math.sin((t - 15) / 8)) : 0;
    const rpm = 790 + noise(25) + drive * 2200;
    const speed = drive * 70 + (drive > 0.05 ? noise(1) : 0);
    return {
      t,
      rpm,
      speed: Math.max(0, speed),
      coolant: Math.min(91, 52 + t * 0.9) + noise(0.5),
      load: 22 + drive * 45 + noise(2),
      throttle: 3 + drive * 35 + noise(1),
      stft: 9 + noise(3),
      ltft: 11 + noise(0.4),
      map: 32 + drive * 50 + noise(2),
      timing: 12 + drive * 18 + noise(1.5),
      iat: 31 + noise(0.5),
      o2a: 0.45 + 0.4 * Math.sin(t * 4.1) + noise(0.03),
      o2b: 0.62 + noise(0.02),
      volt: 14.15 + noise(0.08),
    };
  }

  async send(cmd) {
    await new Promise((r) => setTimeout(r, 25 + Math.random() * 20));
    return this.respond(cmd.trim().toUpperCase().replace(/\s+/g, '')) + '\r\r';
  }

  respond(c) {
    const e = this.engine();
    if (this.cleared && !this.pending.length && Date.now() - this.clearedAt > 25000) this.pending = ['0171'];

    if (c === 'ATZ') return '\r\rELM327 v1.5';
    if (c === 'ATI') return 'ELM327 v1.5 (demo)';
    if (c === 'ATRV') return e.volt.toFixed(1) + 'V';
    if (c === 'ATDPN') return 'A6';
    if (c === 'ATDP') return 'AUTO, ISO 15765-4 (CAN 11/500)';
    if (c.startsWith('AT')) return 'OK';

    switch (c) {
      case '0100':
        return '4100' + mask(0x00);
      case '0120':
        return '4120' + mask(0x20);
      case '0140':
        return '4140' + mask(0x40);
      case '0101': {
        const mil = this.stored.length ? 0x80 : 0;
        const A = mil | this.stored.length;
        const C = 0x65; // catalizador, EVAP, sensor O2, calefactor O2
        const D = this.cleared ? 0x65 : 0x05; // tras borrar, todo queda incompleto
        const B = this.cleared ? 0x07 | 0x20 : 0x07;
        return '4101' + h1(A) + h1(B) + h1(C) + h1(D);
      }
      case '0104':
        return '4104' + h1((e.load * 255) / 100);
      case '0105':
        return '4105' + h1(e.coolant + 40);
      case '0106':
        return '4106' + h1((e.stft * 128) / 100 + 128);
      case '0107':
        return '4107' + h1((e.ltft * 128) / 100 + 128);
      case '010B':
        return '410B' + h1(e.map);
      case '010C':
        return '410C' + h2(e.rpm * 4);
      case '010D':
        return '410D' + h1(e.speed);
      case '010E':
        return '410E' + h1((e.timing + 64) * 2);
      case '010F':
        return '410F' + h1(e.iat + 40);
      case '0111':
        return '4111' + h1((e.throttle * 255) / 100);
      case '0114':
        return '4114' + h1(e.o2a * 200) + '80';
      case '0115':
        return '4115' + h1(e.o2b * 200) + 'FF';
      case '011F':
        return '411F' + h2(e.t + 340);
      case '012F':
        return '412F' + h1((63 * 255) / 100);
      case '0133':
        return '4133' + h1(95);
      case '0142':
        return '4142' + h2((e.volt - 0.2) * 1000);
      case '0146':
        return '4146' + h1(22 + 40);
      case '03':
        return this.dtcFrame('43', this.stored);
      case '07':
        return this.dtcFrame('47', this.pending);
      case '0A':
        return this.dtcFrame('4A', this.cleared ? [] : this.stored);
      case '04':
        this.stored = [];
        this.pending = [];
        this.cleared = true;
        this.clearedAt = Date.now();
        return '44';
      case '0902': {
        const payload = '490201' + [...VIN].map((ch) => h1(ch.charCodeAt(0))).join('');
        const out = [h1(payload.length / 2).padStart(3, '0').slice(-3), '0:' + payload.slice(0, 12)];
        for (let i = 12, n = 1; i < payload.length; i += 14, n++) out.push(n.toString(16).toUpperCase() + ':' + payload.slice(i, i + 14));
        return out.join('\r');
      }
      default:
        return 'NO DATA';
    }
  }

  dtcFrame(prefix, codes) {
    return prefix + h1(codes.length) + codes.join('');
  }
}
