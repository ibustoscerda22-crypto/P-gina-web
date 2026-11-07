// Transportes hacia el adaptador ELM327.
// Todos exponen: connect(), send(cmd, timeoutMs) -> Promise<string>, disconnect(), name, onDisconnect.

const enc = new TextEncoder();

// Lee la respuesta del ELM327 hasta el prompt ">".
class PromptReader {
  constructor() {
    this.buf = '';
    this.waiter = null;
    this.decoder = new TextDecoder();
  }
  pushBytes(bytes) {
    this.push(this.decoder.decode(bytes, { stream: true }));
  }
  push(text) {
    this.buf += text;
    const i = this.buf.indexOf('>');
    if (this.waiter && i !== -1) {
      const out = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 1);
      const w = this.waiter;
      this.waiter = null;
      clearTimeout(w.timer);
      w.resolve(out);
    }
  }
  wait(timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        const partial = this.buf.trim();
        this.buf = '';
        reject(new Error('El adaptador no respondió a tiempo' + (partial ? ` (recibido: ${partial})` : '')));
      }, timeout);
      this.waiter = { resolve, reject, timer };
      this.push('');
    });
  }
  cancel(err) {
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter.reject(err);
      this.waiter = null;
    }
  }
  reset() {
    this.buf = '';
  }
}

// Servicios BLE usados por los adaptadores ELM327 más comunes
// (Vgate iCar Pro BLE, Veepeak BLE, vLinker, OBDLink CX, clones "OBDII").
const BLE_SERVICES = [
  0xfff0,
  0xffe0,
  0x18f0,
  0xffe5,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fff0-0000-1000-8000-00805f9b34fb',
];

export class BleTransport {
  static supported() {
    return 'bluetooth' in navigator;
  }

  constructor() {
    this.reader = new PromptReader();
    this.name = 'Adaptador Bluetooth';
    this.onDisconnect = null;
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_SERVICES,
    });
    this.name = this.device.name || this.name;
    this.device.addEventListener('gattserverdisconnected', () => {
      this.reader.cancel(new Error('Bluetooth desconectado'));
      if (!this.closing) this.onDisconnect?.();
    });
    const server = await this.device.gatt.connect();
    const services = await server.getPrimaryServices();
    let rx = null;
    let tx = null;
    for (const service of services) {
      let chars;
      try {
        chars = await service.getCharacteristics();
      } catch {
        continue;
      }
      const n = chars.find((c) => c.properties.notify || c.properties.indicate);
      const w = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (n && w) {
        rx = n;
        tx = w;
        break;
      }
    }
    if (!rx || !tx) {
      server.disconnect();
      throw new Error(
        'Ese dispositivo no parece ser un adaptador OBD Bluetooth LE compatible. ' +
          'Los adaptadores Bluetooth "clásicos" (la mayoría de los ELM327 azules baratos) no funcionan en el navegador del celular.'
      );
    }
    this.rx = rx;
    this.tx = tx;
    await rx.startNotifications();
    rx.addEventListener('characteristicvaluechanged', (e) => {
      const v = e.target.value;
      this.reader.pushBytes(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    });
  }

  async send(cmd, timeout = 3000) {
    this.reader.reset();
    const pending = this.reader.wait(timeout);
    const data = enc.encode(cmd + '\r');
    try {
      for (let i = 0; i < data.length; i += 20) {
        const chunk = data.slice(i, i + 20);
        if (this.tx.properties.writeWithoutResponse) await this.tx.writeValueWithoutResponse(chunk);
        else await this.tx.writeValueWithResponse(chunk);
      }
    } catch (e) {
      this.reader.cancel(e);
      pending.catch(() => {});
      throw e;
    }
    return pending;
  }

  async disconnect() {
    this.closing = true;
    try {
      this.device?.gatt?.disconnect();
    } catch {
      /* ya desconectado */
    }
  }
}

export class SerialTransport {
  static supported() {
    return 'serial' in navigator;
  }

  constructor(baudRate = 38400) {
    this.baudRate = baudRate;
    this.reader = new PromptReader();
    this.name = 'Adaptador USB/Serial';
    this.onDisconnect = null;
  }

  async connect() {
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: this.baudRate });
    const info = this.port.getInfo?.() || {};
    if (info.usbVendorId) this.name = `Adaptador USB (${info.usbVendorId.toString(16)}:${(info.usbProductId || 0).toString(16)})`;
    this.writer = this.port.writable.getWriter();
    this.readLoop();
  }

  async readLoop() {
    while (this.port?.readable && !this.closing) {
      this.rd = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.rd.read();
          if (done) break;
          if (value) this.reader.pushBytes(value);
        }
      } catch {
        /* error de lectura: se sale del ciclo */
        break;
      } finally {
        try {
          this.rd.releaseLock();
        } catch {
          /* ignore */
        }
      }
    }
    if (!this.closing) {
      this.reader.cancel(new Error('Puerto serie desconectado'));
      this.onDisconnect?.();
    }
  }

  async send(cmd, timeout = 3000) {
    this.reader.reset();
    const pending = this.reader.wait(timeout);
    try {
      await this.writer.write(enc.encode(cmd + '\r'));
    } catch (e) {
      this.reader.cancel(e);
      pending.catch(() => {});
      throw e;
    }
    return pending;
  }

  async disconnect() {
    this.closing = true;
    try {
      await this.rd?.cancel();
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
  }
}
