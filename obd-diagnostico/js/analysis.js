// Interpreta los datos leídos y genera hallazgos en lenguaje simple.
// level: 'crit' (detenerse / revisar ya), 'warn' (revisar pronto), 'info', 'ok'.
import { describeDtc } from './dtc.js';

export function analyze({ values = {}, hist = {}, dtcs = null, status = null }) {
  const out = [];
  const add = (level, title, detail) => out.push({ level, title, detail });

  const rpm = values['0C'];
  const speed = values['0D'];
  const coolant = values['05'];
  const volt = values.RV ?? values['42'];
  const stft = values['06'];
  const ltft = values['07'];
  const runtime = values['1F'];
  const running = rpm != null && rpm > 300;

  // Luz check engine y códigos
  if (status?.mil) {
    add('warn', 'Luz de "check engine" encendida', `La computadora del motor informa ${status.count} código(s) activo(s).`);
  }
  if (dtcs) {
    const all = [...dtcs.stored.map((c) => [c, 'almacenado']), ...dtcs.pending.filter((c) => !dtcs.stored.includes(c)).map((c) => [c, 'pendiente'])];
    for (const [code, kind] of all) {
      const d = describeDtc(code);
      const level = d.severity === 'alta' ? 'crit' : kind === 'pendiente' || d.severity === 'baja' ? 'info' : 'warn';
      add(level, `${code}: ${d.description}`, kind === 'pendiente'
        ? 'Código pendiente: la ECU detectó el problema una vez; si se repite, encenderá la luz de check engine.'
        : d.causes.length ? `Causas frecuentes: ${d.causes.slice(0, 3).join('; ')}.` : `Familia: ${d.family}.`);
    }
    if (dtcs.stored.some((c) => /^P030[0-4]$/.test(c))) {
      add('crit', 'Fallo de encendido detectado', 'Evita acelerar fuerte o hacer viajes largos: el combustible sin quemar puede dañar el catalizador. Si la luz parpadea, detén el auto.');
    }
  }

  // Temperatura
  if (coolant != null) {
    if (coolant >= 112) add('crit', `Motor sobrecalentado (${coolant.toFixed(0)} °C)`, 'Detén el auto en un lugar seguro y apaga el motor. No abras la tapa del radiador en caliente. Revisa nivel de refrigerante y ventilador.');
    else if (coolant >= 105) add('warn', `Temperatura del motor alta (${coolant.toFixed(0)} °C)`, 'Lo normal es entre 85 y 100 °C. Revisa el nivel de refrigerante y que el ventilador encienda.');
    else if (running && runtime != null && runtime > 900 && coolant < 70) add('warn', `El motor no llega a temperatura (${coolant.toFixed(0)} °C tras ${Math.round(runtime / 60)} min)`, 'Posible termostato abierto o pegado. Aumenta el consumo y desgaste.');
  }

  // Batería / carga
  if (volt != null) {
    if (running) {
      if (volt > 15.2) add('crit', `Sobrecarga eléctrica (${volt.toFixed(1)} V)`, 'El regulador del alternador podría estar fallando. Puede dañar la batería y la electrónica.');
      else if (volt < 13.0) add('warn', `El alternador carga poco (${volt.toFixed(1)} V con motor en marcha)`, 'Con el motor encendido lo normal es 13,5 a 14,7 V. Revisa correa, alternador y bornes de la batería.');
    } else {
      if (volt < 11.8) add('crit', `Batería descargada (${volt.toFixed(1)} V)`, 'Con motor apagado una batería sana marca 12,4 a 12,8 V. Podrías quedar sin arranque.');
      else if (volt < 12.3) add('warn', `Batería baja (${volt.toFixed(1)} V)`, 'Con motor apagado una batería sana marca 12,4 a 12,8 V. Cárgala o hazla revisar.');
    }
  }

  // Mezcla aire/combustible
  if (running && stft != null && ltft != null) {
    const total = stft + ltft;
    if (total > 20) add('warn', `Mezcla pobre: la ECU agrega ${total.toFixed(0)} % de combustible`, 'Suele ser una fuga de vacío, sensor MAP/MAF sucio, filtro de combustible tapado o inyectores sucios.');
    else if (total > 12) add('info', `Mezcla algo pobre (corrección +${total.toFixed(0)} %)`, 'Aún dentro de lo tolerable; vigílalo. Lo ideal es estar entre −10 % y +10 %.');
    else if (total < -20) add('warn', `Mezcla rica: la ECU quita ${(-total).toFixed(0)} % de combustible`, 'Puede ser un inyector goteando, presión de combustible alta o un sensor de temperatura defectuoso.');
    else if (total < -12) add('info', `Mezcla algo rica (corrección ${total.toFixed(0)} %)`, 'Aún tolerable; vigílalo.');
  }

  // Ralentí
  if (running && speed === 0 && coolant != null && coolant > 75) {
    if (rpm > 1150) add('warn', `Ralentí alto (${rpm.toFixed(0)} rpm)`, 'Con el motor caliente lo normal es 700 a 900 rpm. Puede ser una fuga de vacío o la mariposa sucia.');
    else if (rpm < 550) add('warn', `Ralentí bajo o inestable (${rpm.toFixed(0)} rpm)`, 'Puede ser cuerpo de aceleración sucio, bujías o una fuga de vacío.');
  }

  // Sensor O2 delantero: con motor caliente debería oscilar entre ~0,1 y ~0,9 V.
  const o2 = (hist['14'] || []).slice(-20).map((p) => p.v);
  if (running && o2.length >= 10 && coolant != null && coolant > 75) {
    const span = Math.max(...o2) - Math.min(...o2);
    if (span < 0.25) add('info', 'El sensor de oxígeno delantero casi no varía', `Osciló solo ${span.toFixed(2)} V. Con el motor caliente debería ir de ~0,1 a ~0,9 V. Puede estar envejecido (pruébalo de nuevo tras manejar unos minutos).`);
  }

  // Monitores de preparación
  if (status?.monitors?.length) {
    const inc = status.monitors.filter((m) => !m.complete);
    if (inc.length) {
      add('info', `${inc.length} monitor(es) de emisiones incompleto(s)`, `${inc.map((m) => m.name).join(', ')}. Es normal tras borrar códigos o desconectar la batería; se completan manejando unos días en ciudad y carretera. Algunas plantas de revisión técnica rechazan el auto si hay monitores incompletos.`);
    }
  }

  if (!out.length) {
    add('ok', 'Sin anomalías en lo medido', 'No se encontraron códigos de falla ni valores fuera de rango.');
  }
  const order = { crit: 0, warn: 1, info: 2, ok: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

export function healthScore(findings) {
  let s = 100;
  for (const f of findings) s -= f.level === 'crit' ? 35 : f.level === 'warn' ? 15 : f.level === 'info' ? 4 : 0;
  return Math.max(0, s);
}
