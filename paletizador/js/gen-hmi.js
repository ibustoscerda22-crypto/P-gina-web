/* Diseño del HMI: pantallas, tags, alarmas y guía de estilo (ISA-101 / High Performance HMI). */
window.PAL = window.PAL || {};

PAL.genHMI = (function () {
  function tagPath(ctx, s7, ab) { return ctx.cfg.plcBrand === "Siemens" ? `"DB_HMI".HMI.${s7}` : `HMI.${ab}`; }

  function tags(ctx) {
    const T = [];
    const add = (name, s7, ab, type, acc, desc) => T.push({ name, path: tagPath(ctx, s7, ab), type, acc, desc });
    const S = ctx.cfg.plcBrand === "Siemens";
    ["Reset", "Start", "Stop", "Hold", "Unhold", "Suspend", "Unsuspend", "Abort", "Clear"].forEach((c) =>
      add("Cmd_" + c, "Cmd." + c, "Cmd_" + c, "Bool", "W", `Comando PackML ${c} (pulso, el PLC lo borra)`));
    add("Cmd_ModeReq", "Cmd.ModeReq", "Cmd_ModeReq", S ? "Int" : "DINT", "RW", "Modo solicitado 1/2/3");
    add("Cmd_AckAlarms", "Cmd.AckAlarms", "Cmd_AckAlarms", "Bool", "W", "Reconocer alarmas");
    add("Cmd_RobotHome", "Cmd.RobotHome", "Cmd_RobotHome", "Bool", "W", "Robot a Home (modo Manual/Mantención)");
    add("Cmd_RobotGripTest", "Cmd.RobotGripTest", "Cmd_RobotGripTest", "Bool", "W", "Test de pinza");
    add("Cmd_RobotMaintPos", "Cmd.RobotMaintPos", "Cmd_RobotMaintPos", "Bool", "W", "Robot a posición de mantención");
    add("Cmd_ResetCounters", "Cmd.ResetCounters", "Cmd_ResetCounters", "Bool", "W", "Reset contadores");
    ctx.lay.pallets.forEach((p) => {
      add(`Cmd_ForcePalletDone${p.id}`, `Cmd.ForcePalletDone[${p.id}]`, `Cmd_ForcePalletDone[${p.id}]`, "Bool", "W", `Forzar palet ${p.id} completo`);
      add(`Sts_Layer${p.id}`, `Sts.Layer[${p.id}]`, `Sts_Layer[${p.id}]`, S ? "Int" : "DINT", "R", `Capa actual palet ${p.id}`);
      add(`Sts_Box${p.id}`, `Sts.BoxInLayer[${p.id}]`, `Sts_BoxInLayer[${p.id}]`, S ? "Int" : "DINT", "R", `Caja siguiente en capa, palet ${p.id}`);
      add(`Sts_PalletComplete${p.id}`, `Sts.PalletComplete[${p.id}]`, `Sts_PalletComplete[${p.id}]`, "Bool", "R", `Palet ${p.id} completo`);
      add(`Sts_PalletReady${p.id}`, `Sts.PalletReady[${p.id}]`, `Sts_PalletReady[${p.id}]`, "Bool", "R", `Palet ${p.id} listo`);
    });
    ctx.lay.infeeds.forEach((f) => add(`Sts_InfeedReady${f.id}`, `Sts.InfeedReady[${f.id}]`, `Sts_InfeedReady[${f.id}]`, "Bool", "R", `Producto en infeed ${f.id}`));
    add("Sts_State", "Sts.State", "Sts_State", S ? "Int" : "DINT", "R", "Estado PackML 0..17");
    add("Sts_Mode", "Sts.Mode", "Sts_Mode", S ? "Int" : "DINT", "R", "Modo PackML actual");
    add("Sts_ActivePallet", "Sts.ActivePallet", "Sts_ActivePallet", S ? "Int" : "DINT", "R", "Estación en llenado");
    add("Sts_RobotCommOK", "Sts.RobotCommOK", "Sts_RobotCommOK", "Bool", "R", "Comunicación robot OK");
    add("Sts_RobotBusy", "Sts.RobotBusy", "Sts_RobotBusy", "Bool", "R", "Robot ejecutando comando");
    add("Sts_RobotAtHome", "Sts.RobotAtHome", "Sts_RobotAtHome", "Bool", "R", "Robot en Home");
    add("Sts_RobotStep", "Sts.RobotStep", "Sts_RobotStep", S ? "Int" : "DINT", "R", "Paso del programa del robot");
    add("Sts_RobotError", "Sts.RobotError", "Sts_RobotError", S ? "Int" : "DINT", "R", "Código de error de comando");
    add("Sts_CycleTime", "Sts.CycleTime", "Sts_CycleTime", S ? "Int" : "DINT", "R", "Tiempo de ciclo [ms]");
    add("Sts_AlarmWord0", "Sts.AlarmWord[0]", "Sts_AlarmWord[0]", S ? "Word" : "DINT", "R", "Alarmas palabra 0");
    add("Sts_AlarmWord1", "Sts.AlarmWord[1]", "Sts_AlarmWord[1]", S ? "Word" : "DINT", "R", "Alarmas palabra 1");
    ["BoxL", "BoxW", "BoxH", "BoxWeight", "PerLayer", "Layers", "SpeedOvr", "ApproachZ", "ApproachXY", "TargetPallets", "ProductID"].forEach((r) =>
      add("Rcp_" + r, "Recipe." + r, "Rcp_" + r, S ? "Int" : "DINT", "RW", "Receta: " + r));
    add("Rcp_SlipSheet", "Recipe.SlipSheet", "Rcp_SlipSheet", "Bool", "RW", "Receta: lámina separadora");
    add("PT_ProdProcessedCount", "PackTags.Admin.ProdProcessedCount", "PT_ProdProcessedCount", "DInt", "R", "PackTags: cajas procesadas");
    add("PT_ProdDefectiveCount", "PackTags.Admin.ProdDefectiveCount", "PT_ProdDefectiveCount", "DInt", "R", "PackTags: rechazos/errores");
    add("PT_PalletCount", "PackTags.Admin.PalletCount", "PT_PalletCount", "DInt", "R", "Palets terminados");
    add("PT_StateCurrentTime", "PackTags.Admin.StateCurrentTime", "PT_StateCurrentTime", "DInt", "R", "Tiempo en estado actual [s]");
    return T;
  }

  function alarms(ctx) {
    const w0 = [
      ["Paro de emergencia activado", "Error"], ["Puerta del cerco abierta / seguridad no OK", "Error"],
      ["Falla de comunicación con el robot (bit de vida)", "Error"], ["Falla activa en el controlador del robot", "Error"],
      ["Robot no confirmó el comando (timeout Ack)", "Error"], ["Robot no terminó el comando (timeout)", "Error"],
      ["Producto no detectado o perdido en la herramienta", "Error"], ["Timeout esperando permiso de zona", "Warning"],
      ["Robot no está en modo automático/remoto", "Warning"], ["Celda suspendida: falta producto o palet", "Warning"],
      ["Error de aplicación del robot (ver código en pantalla Robot)", "Error"],
      ["Magazín de láminas separadoras vacío", "Warning"]
    ];
    const A = w0.map((a, i) => ({ id: i + 1, text: a[0], cls: a[1], word: 0, bit: i }));
    ctx.lay.pallets.forEach((p) => A.push({ id: 100 + p.id, text: `Palet ${p.id} completo: retirar`, cls: "Info", word: 1, bit: p.id - 1 }));
    return A;
  }

  function screens(ctx) {
    const { cfg, lay } = ctx;
    return [
      { id: "01", name: "Vista general", desc: `Layout de la celda: robot, ${lay.infeeds.length} infeed(s), ${lay.pallets.length} estación(es) de palet, estados de cada estación (vacío/llenando/completo), estado PackML y modo en la cabecera, contadores de producción.` },
      { id: "02", name: "Control PackML", desc: "Diagrama de estados PackML con el estado actual resaltado. Botones Start / Stop / Reset / Hold / Unhold / Suspend / Unsuspend / Abort / Clear habilitados sólo cuando la transición es válida. Selector de modo (Production / Maintenance / Manual)." },
      { id: "03", name: "Recetas", desc: `Producto: medidas, peso, cajas por capa, capas, lámina separadora, velocidad, alturas de aproximación, cantidad objetivo de palets. Vista previa del mosaico capa A/B. Nivel de usuario: Supervisor.` },
      { id: "04", name: "Estaciones de palet", desc: "Por estación: palet presente, capa y caja actual, % de llenado, botón Forzar completo, estado de zona de seguridad (cortina/escáner) y transportador." },
      { id: "05", name: "Robot", desc: `Estado ${cfg.robotBrand}: comunicación, modo auto, motores, programa, en Home, paso actual, último error, tiempo de ciclo. Tabla del handshake (CmdValid/Ack/Done, CmdID y eco). Botones manuales: Home, Test pinza, Posición mantención (sólo modo Manual/Mantención).` },
      { id: "06", name: "Alarmas", desc: "Alarmas activas e históricas con clase (Error / Warning / Info), hora, reconocimiento. Botón Reconocer." },
      { id: "07", name: "Seguridad", desc: "Estado de paros de emergencia, puertas, cortinas/escáneres, muting, reset de seguridad, zonas seguras del robot. Sólo lectura." },
      { id: "08", name: "Estadísticas / OEE", desc: "PackTags Admin: cajas procesadas, defectuosas, palets, tiempo por estado (Execute/Suspended/Held), cajas por minuto." },
      { id: "09", name: "Usuarios", desc: "Login. Niveles: Operador (comandos PackML), Supervisor (recetas, forzar palet), Mantención (modos, robot manual), Admin." }
    ];
  }

  function files(ctx) {
    const S = ctx.cfg.plcBrand === "Siemens";
    const T = tags(ctx), A = alarms(ctx);
    const csvTags = ["Nombre;Dirección PLC;Tipo;Acceso;Descripción"].concat(T.map((t) => `${t.name};${t.path};${t.type};${t.acc};${t.desc}`)).join("\r\n");
    const trig = (w) => tagPath(ctx, `Sts.AlarmWord[${w}]`, `Sts_AlarmWord[${w}]`);
    const csvAl = ["ID;Texto;Clase;Tag disparo;Bit"].concat(A.map((a) => `${a.id};${a.text};${a.cls};${trig(a.word)};${a.bit}`)).join("\r\n");
    const sc = screens(ctx).map((s) => `${s.id}  ${s.name}\n    ${s.desc}`).join("\n\n");
    const hmi = PAL.HMIS[ctx.cfg.plcBrand][ctx.cfg.hmiModel];
    const guide = `DISEÑO HMI — ${ctx.cfg.projectName}
Panel: ${ctx.cfg.hmiModel}   Software: ${hmi.sw}   Resolución: ${hmi.res}
Conexión: ${S ? "PROFINET / S7 (conexión HMI integrada en TIA Portal)" : "EtherNet/IP (CIP) — atajo/shortcut al controlador"}  IP HMI: ${ctx.cfg.ipHMI}

PANTALLAS
${sc}

ESTRUCTURA DE NAVEGACIÓN
  Cabecera fija: logo | nombre celda | ESTADO PackML (texto + color) | MODO | fecha/hora | usuario | campana de alarmas
  Pie fijo: botones 01..08 + Login. Siempre visibles los botones Stop y Reset.

GUÍA DE ESTILO (ISA-101 / High Performance HMI)
  - Fondo gris neutro (#E6E6E6 claro o #2B2B2B oscuro); equipos en gris, sin 3D ni degradados.
  - El color sólo indica anormalidad: rojo = alarma/error, ámbar = advertencia, azul = acción requerida
    del operador, verde sólo para "en producción" (Execute) en la cabecera.
  - Estados PackML en cabecera: Execute verde, Held/Suspended ámbar, Aborted/Stopped rojo/gris, Idle azul.
  - Botones de comando: deshabilitados (no ocultos) cuando la transición PackML no es válida.
  - Textos mínimos 14 px; valores numéricos con unidad; confirmación para Abort, Forzar palet y Reset contadores.

${S ? `IMPLEMENTACIÓN EN TIA PORTAL
  1. Agregar el panel (${ctx.cfg.hmiModel}) y crear la conexión HMI con el PLC.
  2. Variables HMI: arrastrar "DB_HMI" (acceso optimizado) o crear las variables de hmi_tags.csv.
  3. Avisos de bit (HMI alarms > Discrete alarms): usar hmi_alarms.csv; Tag disparo = Sts.AlarmWord[n], bit = columna Bit.
     Clases: Error (con acuse), Warning (sin acuse), Info.
  4. Para el diagrama PackML usar 17 rectángulos con animación de apariencia sobre Sts_State.
  5. Comandos: evento "Pulsar" -> ActivarBit (SetBit) del tag Cmd_*; el PLC los borra.` :
  `IMPLEMENTACIÓN EN ${hmi.sw.toUpperCase()}
  1. Crear la aplicación para ${ctx.cfg.hmiModel} y el atajo/shortcut al controlador (Logix).
  2. Tags: referenciar directamente los tags controller-scope (HMI.*) listados en hmi_tags.csv.
  3. Alarmas: Alarm Setup > Triggers con HMI.Sts_AlarmWord[n] (tipo Bit), mensajes de hmi_alarms.csv.
     ${hmi.sw.includes("View Designer") ? "En PanelView 5000 las alarmas se definen en el controlador (Logix Tag-Based Alarms) o como alarmas de HMI según versión." : ""}
  4. Diagrama PackML: objetos con animación de color sobre HMI.Sts_State.
  5. Botones momentáneos -> HMI.Cmd_*; el PLC los resetea.`}
`;
    return { "hmi/HMI_diseno.txt": guide, "hmi/hmi_tags.csv": csvTags, "hmi/hmi_alarms.csv": csvAl };
  }

  return { files, tags, alarms, screens };
})();
