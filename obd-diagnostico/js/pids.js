// Parámetros OBD-II (modo 01) que la app sabe interpretar.
// f recibe los bytes de datos (A, B, ...) y devuelve el valor en unidades métricas.

export const PIDS = {
  '04': { name: 'Carga del motor', unit: '%', dec: 0, n: 1, f: ([a]) => (a * 100) / 255, max: 100 },
  '05': { name: 'Temp. refrigerante', unit: '°C', dec: 0, n: 1, f: ([a]) => a - 40, max: 130 },
  '06': { name: 'Corrección corto plazo (STFT)', unit: '%', dec: 1, n: 1, f: ([a]) => ((a - 128) * 100) / 128 },
  '07': { name: 'Corrección largo plazo (LTFT)', unit: '%', dec: 1, n: 1, f: ([a]) => ((a - 128) * 100) / 128 },
  '0B': { name: 'Presión de admisión (MAP)', unit: 'kPa', dec: 0, n: 1, f: ([a]) => a },
  '0C': { name: 'RPM', unit: 'rpm', dec: 0, n: 2, f: ([a, b]) => (a * 256 + b) / 4, max: 7000 },
  '0D': { name: 'Velocidad', unit: 'km/h', dec: 0, n: 1, f: ([a]) => a, max: 200 },
  '0E': { name: 'Avance de encendido', unit: '°', dec: 1, n: 1, f: ([a]) => a / 2 - 64 },
  '0F': { name: 'Temp. aire de admisión', unit: '°C', dec: 0, n: 1, f: ([a]) => a - 40 },
  '10': { name: 'Flujo de aire (MAF)', unit: 'g/s', dec: 1, n: 2, f: ([a, b]) => (a * 256 + b) / 100 },
  '11': { name: 'Posición de mariposa', unit: '%', dec: 0, n: 1, f: ([a]) => (a * 100) / 255, max: 100 },
  '14': { name: 'Sensor O2 delantero (B1S1)', unit: 'V', dec: 2, n: 1, f: ([a]) => a / 200 },
  '15': { name: 'Sensor O2 trasero (B1S2)', unit: 'V', dec: 2, n: 1, f: ([a]) => a / 200 },
  '1F': { name: 'Tiempo desde el arranque', unit: 's', dec: 0, n: 2, f: ([a, b]) => a * 256 + b },
  '2F': { name: 'Nivel de combustible', unit: '%', dec: 0, n: 1, f: ([a]) => (a * 100) / 255, max: 100 },
  '33': { name: 'Presión barométrica', unit: 'kPa', dec: 0, n: 1, f: ([a]) => a },
  '42': { name: 'Voltaje módulo de control', unit: 'V', dec: 2, n: 2, f: ([a, b]) => (a * 256 + b) / 1000 },
  '46': { name: 'Temp. ambiente', unit: '°C', dec: 0, n: 1, f: ([a]) => a - 40 },
  '5C': { name: 'Temp. aceite', unit: '°C', dec: 0, n: 1, f: ([a]) => a - 40, max: 150 },
  // Pseudo-parámetro: voltaje de batería medido por el propio adaptador (comando ATRV).
  RV: { name: 'Batería', unit: 'V', dec: 1, max: 16 },
};

// Se leen en cada ciclo del modo "En vivo".
export const FAST_PIDS = ['0C', '0D', '04', '11'];
// Se leen cada pocos ciclos.
export const SLOW_PIDS = ['05', '06', '07', '0B', '0E', '0F', '10', '14', '15', '1F', '2F', '33', '42', '46', '5C'];
// Indicadores grandes en pantalla.
export const GAUGE_PIDS = ['0C', '0D', '05', 'RV', '04', '11'];

export function formatValue(pid, v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const def = PIDS[pid];
  return v.toFixed(def ? def.dec : 1);
}
