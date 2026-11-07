/* Concepto de seguridad de la celda (orientativo; NO reemplaza la evaluación de riesgos formal). */
window.PAL = window.PAL || {};

PAL.genSafety = (function () {
  function concept(ctx) {
    const { cfg, lay, robotCat } = ctx;
    const plcSafe = PAL.PLCS[cfg.plcBrand].models[cfg.plcModel].safety;
    const bus = cfg.plcBrand === "Siemens" ? "PROFIsafe" : "CIP Safety";
    const tStop = cfg.robotStopTime + cfg.lcResponse + cfg.safetyPlcResponse;
    const dist = PAL.calc.safetyDistance(cfg.lcResolution, tStop);
    const manualPallet = cfg.palletSupply === "manual" || cfg.palletExit === "manual";

    const devices = [];
    devices.push({ q: 1, item: "Cerco perimetral de malla, altura mín. 2000 mm (ISO 14120 / ISO 13857)", note: `Perímetro aprox. ${Math.round(2 * ((lay.fence.x1 - lay.fence.x0) + (lay.fence.y1 - lay.fence.y0)) / 1000)} m` });
    devices.push({ q: cfg.doors, item: "Puerta de acceso con interruptor de seguridad con bloqueo (guard locking) y manilla de escape interior", note: "PL d, Cat. 3; desbloqueo sólo con robot detenido (stand-still)" });
    devices.push({ q: cfg.doors + 2, item: "Pulsadores de paro de emergencia (ISO 13850)", note: "Junto a cada puerta, en el tablero del operador y en cada estación de palet" });
    devices.push({ q: 1, item: "Pulsador de reset de seguridad fuera del cerco, con vista total a la celda", note: "Rearme manual (prevención de rearranque)" });
    if (cfg.lightCurtain) devices.push({ q: lay.pallets.length, item: `Cortina de luz Tipo 4, resolución ${cfg.lcResolution} mm${cfg.lcResolution > 40 ? " (multihaz)" : ""}, en la abertura de cada estación de palet`, note: manualPallet ? "Con muting por sensores (o por estado de zona segura del robot) para entrada/salida del palet" : "Muting por el paso del palet en el transportador" });
    if (cfg.scanner) devices.push({ q: lay.pallets.length, item: "Escáner láser de seguridad para detección de presencia en la zona de cambio de palet", note: "Campo de protección + campo de advertencia; impide el rearme con persona dentro" });
    if (cfg.robotSafe) devices.push({ q: 1, item: robotCat.safetyOption, note: "Zonas cartesianas seguras por estación: el robot no puede entrar a la estación con personas" });
    devices.push({ q: 1, item: plcSafe ? `${cfg.plcModel} (CPU de seguridad) con módulos F-DI/F-DQ` : "PLC/relé de seguridad dedicado (la CPU elegida NO es de seguridad)", note: plcSafe ? `Comunicación segura con el robot por ${bus}` : "Recomendado: elegir CPU F/GuardLogix o usar relé de seguridad programable" });
    devices.push({ q: 1, item: "Torre de luz verde/ámbar/rojo + bocina", note: "Señalización PackML" });

    const sf = [
      { id: "SF1", f: "Paro de emergencia", trig: "Cualquier pulsador de emergencia", react: "Paro categoría 1 del robot y categoría 0 de transportadores; PackML → Aborting", pl: "PL d, Cat. 3" },
      { id: "SF2", f: "Protección de acceso al cerco", trig: "Apertura de puerta (interruptor con bloqueo)", react: "Solicitud de apertura → robot termina ciclo y va a Home → stand-still seguro → desbloqueo; si se fuerza: paro cat. 1", pl: "PL d, Cat. 3" },
      { id: "SF3", f: "Protección de estación de palet", trig: cfg.lightCurtain ? "Interrupción de cortina de luz sin muting" : cfg.scanner ? "Detección del escáner" : "—", react: cfg.robotSafe ? "Se bloquea sólo la zona de esa estación (zona segura del robot); el robot sigue trabajando en las otras" : "Paro de protección del robot (cat. 1)", pl: "PL d, Cat. 3" },
      { id: "SF4", f: "Muting de paso de palet", trig: "Sensores de muting en secuencia + palet en transportador", react: "Puentea temporalmente SF3 sólo durante el paso del palet; lámpara de muting", pl: "PL d" },
      { id: "SF5", f: "Limitación de zonas del robot", trig: cfg.robotSafe ? robotCat.safetyOption : "No seleccionado", react: "Paro de protección si el TCP o la herramienta entra a una zona no permitida", pl: "PL d, Cat. 3" },
      { id: "SF6", f: "Velocidad reducida en modo manual (T1)", trig: "Selector de modo del robot", react: "≤ 250 mm/s con pulsador de habilitación de 3 posiciones", pl: "PL d (función del controlador)" },
      { id: "SF7", f: "Prevención de rearranque", trig: "Fin de cualquier paro de seguridad", react: "Requiere reset manual fuera del cerco + Reset/Start PackML", pl: "PL c/d" }
    ];

    const fio = [
      ["F-DI", "E-Stop canal A/B (en serie por zona)"], ["F-DI", "Puerta 1 cerrada y bloqueada (2 canales)"],
      ["F-DI", "Reset de seguridad"],
      ...lay.pallets.map((p) => ["F-DI", `Estación ${p.id}: ${cfg.lightCurtain ? "cortina OSSD1/OSSD2" : "escáner OSSD"}`]),
      ...(cfg.lightCurtain ? lay.pallets.map((p) => ["DI", `Estación ${p.id}: sensores de muting A/B`]) : []),
      ["F-DQ", "Solicitud de bloqueo / desbloqueo de puerta"],
      ["F-DQ", "Contactores de transportadores (2 canales, con realimentación EDM)"],
      ["F-COM", `${bus}: E-Stop / paro de protección al robot y estado de zonas seguras desde el robot`]
    ];
    return { devices, sf, fio, dist, tStop, plcSafe, bus };
  }

  function text(ctx) {
    const c = concept(ctx), cfg = ctx.cfg;
    return `CONCEPTO DE SEGURIDAD — ${cfg.projectName}
(Base para la evaluación de riesgos. Validar con ISO 12100, ISO 10218-2, ISO 13849-1/-2, ISO 13855, ISO 14120 y normativa local.)

NIVEL DE PRESTACIÓN REQUERIDO: PL d, Categoría 3 (valor habitual para celdas robotizadas según ISO 10218-2;
confirmar con el gráfico de riesgo de ISO 13849-1).

DISPOSITIVOS
${c.devices.map((d) => `  ${String(d.q).padStart(2)} x ${d.item}\n       ${d.note}`).join("\n")}

FUNCIONES DE SEGURIDAD
${c.sf.map((s) => `  ${s.id} ${s.f} [${s.pl}]\n       Disparo: ${s.trig}\n       Reacción: ${s.react}`).join("\n")}

DISTANCIA MÍNIMA DE SEGURIDAD (ISO 13855)  S = K·T + C
  T = paro robot ${cfg.robotStopTime} ms + cortina ${cfg.lcResponse} ms + PLC seguridad ${cfg.safetyPlcResponse} ms = ${c.tStop} ms
  Resolución ${cfg.lcResolution} mm → ${c.dist.type}: K = ${c.dist.K} mm/s, C = ${c.dist.C} mm
  S = ${c.dist.S} mm  (distancia mínima entre el plano de la cortina y el punto de peligro más cercano)
  El tiempo de paro del robot debe tomarse de la ficha del fabricante (paro cat. 1, carga y velocidad máximas)
  y verificarse con medición en la puesta en marcha.

E/S DE SEGURIDAD
${c.fio.map((f) => `  ${f[0].padEnd(5)} ${f[1]}`).join("\n")}

ZONAS SEGURAS DEL ROBOT (${ctx.robotCat.safetyOption})
${ctx.lay.pallets.map((p) => `  Zona ${p.id}: volumen sobre la estación de palet ${p.id} (palet + voladizo + 200 mm). Señal de "robot fuera de zona ${p.id}" (segura) → habilita muting/entrada de operador a esa estación.`).join("\n")}
  Herramienta modelada como cápsula/esfera que incluye la caja más grande.
  Limitar ejes 1 (rango) y velocidad máxima del TCP según evaluación.

NOTAS
  - Las señales "Permit"/"Out" del intercambio estándar son FUNCIONALES (anticolisión/lógica), NO de seguridad.
    La protección de personas se hace sólo con ${c.bus} / cableado seguro y las funciones de seguridad del robot.
  - ${c.plcSafe ? "La CPU seleccionada es de seguridad: programar el programa F (Safety) aparte del estándar." : "ATENCIÓN: la CPU seleccionada no es de seguridad."}
`;
  }

  return { concept, text };
})();
