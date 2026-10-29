// ZIP mínimo sin compresión (método "store") para descargar todos los archivos de una celda juntos.

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** archivos: {nombre: texto}. Devuelve un Uint8Array con el .zip. */
export function crearZip(archivos) {
  const enc = new TextEncoder();
  const entradas = Object.entries(archivos).map(([n, t]) => ({ nombre: enc.encode(n), datos: enc.encode(t) }));
  const total = entradas.reduce((s, e) => s + 30 + e.nombre.length + e.datos.length + 46 + e.nombre.length, 22);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  const FECHA = (1 << 5) | 1; // 1980-01-01
  let p = 0;
  const u16 = (x) => { v.setUint16(p, x, true); p += 2; };
  const u32 = (x) => { v.setUint32(p, x, true); p += 4; };
  for (const e of entradas) {
    e.crc = crc32(e.datos);
    e.offset = p;
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(0); u16(FECHA);
    u32(e.crc); u32(e.datos.length); u32(e.datos.length); u16(e.nombre.length); u16(0);
    out.set(e.nombre, p); p += e.nombre.length;
    out.set(e.datos, p); p += e.datos.length;
  }
  const inicioCD = p;
  for (const e of entradas) {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(0); u16(FECHA);
    u32(e.crc); u32(e.datos.length); u32(e.datos.length); u16(e.nombre.length);
    u16(0); u16(0); u16(0); u16(0); u32(0); u32(e.offset);
    out.set(e.nombre, p); p += e.nombre.length;
  }
  const tamCD = p - inicioCD;
  u32(0x06054b50); u16(0); u16(0); u16(entradas.length); u16(entradas.length); u32(tamCD); u32(inicioCD); u16(0);
  return out;
}
