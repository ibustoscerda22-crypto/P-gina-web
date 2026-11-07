/* Documentos: comunicación, workobjects, guía de implementación paso a paso y lista de materiales. */
window.PAL = window.PAL || {};

PAL.genDocs = (function () {
  const f1 = (v) => Number(v).toFixed(1);

  function interfaceCSV(ctx) {
    const { cfg } = ctx, I = PAL.iface;
    const rows = ["Sentido;Byte;Bit;Tipo;Nombre;Unidad;Descripción;Dirección PLC;Señal robot;Mapeo robot"];
    const add = (dir, s, toRob) => {
      const r = I.robotAddr(cfg.robotBrand, toRob, s, cfg);
      rows.push([dir, s.byte, s.bit == null ? "" : s.bit, s.type, s.name, s.unit || "", s.desc, I.plcAddr(cfg.plcBrand, toRob, s, cfg), r.name, r.map].join(";"));
    };
    I.PLC_TO_ROBOT.forEach((s) => add("PLC→Robot", s, true));
    I.ROBOT_TO_PLC.forEach((s) => add("Robot→PLC", s, false));
    return rows.join("\r\n");
  }

  function comm(ctx) {
    const { cfg } = ctx;
    const rb = PAL.ROBOTS[cfg.robotBrand];
    const S = cfg.plcBrand === "Siemens";
    const pn = cfg.protocol === "PROFINET";
    const mismatch = (S && !pn) || (!S && pn);
    const robotSteps = {
      ABB: pn
        ? `  1. Opción ${rb.fieldbus.PROFINET}. En RobotStudio: Controlador > Configuración > I/O System > Industrial Network "PROFINET":
     IP ${cfg.ipRobot}, Station name "${cfg.pnRobot}". Dispositivo PN_Internal_Device con 64 bytes de entrada y 64 de salida.
  2. Cargar EIO_PLC.cfg (Configuración > Cargar parámetros > "Cargar parámetros y reemplazar duplicados").
  3. Reiniciar el controlador (reinicio normal).`
        : `  1. Opción ${rb.fieldbus["EtherNet/IP"]}. En RobotStudio: I/O System > Industrial Network "EtherNetIP": IP ${cfg.ipRobot}.
     Dispositivo EN_Internal_Device con 64 bytes de entrada y 64 de salida.
  2. Cargar EIO_PLC.cfg y reiniciar.`,
      FANUC: pn
        ? `  1. Opción ${rb.fieldbus.PROFINET}. MENU > SETUP > PROFINET(M): canal I-Device, IP ${cfg.ipRobot}, nombre "${cfg.pnRobot}".
     Configurar 64 bytes IN / 64 bytes OUT en el slot del I-Device.
  2. MENU > I/O > Digital > Config: DI[1-512] y DO[1-512] → rack/slot del I-Device PROFINET, start 1.
  3. MENU > I/O > Group > Config: GI[1..${PAL.iface.PLC_TO_ROBOT.filter((x) => x.type === "UINT").length}] y GO[1..${PAL.iface.ROBOT_TO_PLC.filter((x) => x.type === "UINT").length}] de 16 puntos (ver columna "Mapeo robot" del CSV).
  4. Reiniciar en frío (Cold start).`
        : `  1. Opción ${rb.fieldbus["EtherNet/IP"]}. MENU > SETUP > Host Comm > TCP/IP: IP ${cfg.ipRobot}.
     MENU > I/O > EtherNet/IP: adapter slot 1, 32 palabras IN / 32 palabras OUT.
  2. MENU > I/O > Digital > Config: DI[1-512] y DO[1-512] → Rack 89, Slot 1, Start 1.
  3. MENU > I/O > Group > Config: GI/GO de 16 puntos (ver columna "Mapeo robot" del CSV), Rack 89 Slot 1.
  4. Reiniciar en frío.`,
      KUKA: pn
        ? `  1. Opción ${rb.fieldbus.PROFINET}. En WorkVisual: Configuración de bus > PROFINET > Dispositivo, IP ${cfg.ipRobot}, nombre "${cfg.pnRobot}",
     64 bytes IN / 64 bytes OUT.
  2. Mapeo de E/S: $IN[${cfg.kukaIOOffset}..${cfg.kukaIOOffset + 511}] ↔ entradas del dispositivo, $OUT[${cfg.kukaIOOffset}..${cfg.kukaIOOffset + 511}] ↔ salidas.
  3. Pegar las declaraciones SIGNAL en $config.dat (config_dat_y_sps.txt), instalar el proyecto en el controlador (Desplegar).`
        : `  1. Opción ${rb.fieldbus["EtherNet/IP"]}. En WorkVisual: EtherNet/IP adapter, IP ${cfg.ipRobot}, 64 bytes IN / 64 bytes OUT.
  2. Mapeo $IN/$OUT desde ${cfg.kukaIOOffset}. Pegar SIGNAL en $config.dat y desplegar.`
    };
    const plcSteps = S
      ? `  1. TIA Portal: Opciones > Gestionar archivos de descripción de dispositivos (GSD) → instalar el GSDML del ${cfg.robotBrand} (${cfg.robotCtrl}).
  2. Vista de redes: arrastrar el robot, asignarlo al PLC (IO-Controller), IP ${cfg.ipRobot}, nombre "${cfg.pnRobot}".
  3. Módulos del dispositivo: 64 bytes de entrada en %I${cfg.plcInStart} y 64 bytes de salida en %Q${cfg.plcOutStart}.
  4. Tiempo de actualización 4–8 ms, tiempo de vigilancia 3x. Asignar el nombre de dispositivo online.
  5. Crear los tags "Robot_In" (typeRobotIn, %I${cfg.plcInStart}.0) y "Robot_Out" (typeRobotOut, %Q${cfg.plcOutStart}.0).`
      : `  1. Studio 5000: I/O Configuration > Ethernet > New Module → EDS del ${cfg.robotBrand} (o Generic Ethernet Module, Data-INT).
  2. Nombre "Robot", IP ${cfg.ipRobot}, 32 INT entrada / 32 INT salida, RPI 10 ms.
  3. Importar Tags_y_Alias.CSV (Tools > Import > Tags and Logic Comments). Los alias RobO_/RobI_ apuntan a Robot:O/I.Data[].`;
    return `COMUNICACIÓN PLC (MAESTRO) ↔ ROBOT (ESCLAVO) — ${cfg.projectName}

PROTOCOLO: ${cfg.protocol}${mismatch ? "   ⚠ ATENCIÓN: el protocolo no es el nativo del PLC elegido; requerirá gateway (p. ej. PN/EIP) o cambio de protocolo." : ""}
Seguridad por bus: ${rb.safeBus[cfg.protocol]}

PLAN DE RED (subred ${cfg.ipPLC.split(".").slice(0, 3).join(".")}.0/24)
  PLC    ${cfg.ipPLC.padEnd(16)} ${S ? `nombre PN "${cfg.pnPLC}"` : ""}
  HMI    ${cfg.ipHMI.padEnd(16)}
  Robot  ${cfg.ipRobot.padEnd(16)} ${pn ? `nombre PN "${cfg.pnRobot}"` : ""}
  Switch gestionado industrial (recomendado con soporte ${pn ? "PROFINET/LLDP" : "IGMP snooping / QoS para EtherNet/IP"}).

TAMAÑO DEL INTERCAMBIO: 64 bytes PLC→Robot, 64 bytes Robot→PLC.
  Bytes 0..3: bits de control/estado. Desde el byte 4: palabras de 16 bits (UINT).
  Orden de bytes: little-endian en el cable. ${S ? "El PLC Siemens aplica SWAP en FC_ToRobWord/FC_FromRobWord (SwapBytes := TRUE). Si al probar los valores llegan 'cruzados' (p. ej. 256 en vez de 1), poner SwapBytes := FALSE." : "Allen-Bradley ya es little-endian: no se intercambian bytes."}
  Coordenadas: siempre positivas, 0.1 mm, en el frame del palet (origen en la esquina). Rotación en 0.1°.

HANDSHAKE DE COMANDO (PLC maestro)
  1. PLC escribe CmdCode, estaciones, X/Y/Z/Rz…, incrementa CmdID y pone CmdValid = 1.
  2. Robot copia los datos, pone CmdDone = 0, escribe CmdIDEcho = CmdID y pone CmdAck = 1.
  3. PLC ve CmdAck con eco correcto → CmdValid = 0 (timeout 3 s → error 100).
  4. Robot ve CmdValid = 0 → CmdAck = 0 y ejecuta el movimiento.
  5. Robot termina → Status/ErrorCode y CmdDone = 1. PLC lo registra (timeout 60 s → error 101).
  Bit de vida: el PLC conmuta PLC_LifeBit cada 500 ms; el robot devuelve el valor invertido en Rob_LifeBit.
  Si ambos son iguales más de 2 s → falla de comunicación → PackML Aborting.

ZONAS (interbloqueo funcional)
  Antes de entrar a una estación el robot espera PermitPalletN / PermitInfeedN y baja OutPalletN / OutInfeedN.
  Al salir la vuelve a subir. El PLC no mueve un transportador ni libera una estación si el robot no está fuera.

CONFIGURACIÓN EN EL ROBOT (${cfg.robotBrand} ${cfg.robotCtrl})
${robotSteps[cfg.robotBrand]}

CONFIGURACIÓN EN EL PLC (${cfg.plcBrand})
${plcSteps}

CÓDIGOS DE ERROR DEL ROBOT (ErrorCode)
${PAL.iface.ROBOT_ERRORS.map((e) => `  ${String(e[0]).padStart(3)}  ${e[1]}`).join("\n")}
  100  (PLC) Timeout esperando Ack
  101  (PLC) Timeout esperando Done / comunicación perdida
`;
  }

  function wobjDoc(ctx) {
    const { cfg, lay } = ctx;
    const b = cfg.robotBrand;
    const name = { ABB: "workobject (wobjdata)", FANUC: "User Frame (UFRAME)", KUKA: "BASE" }[b];
    const proc = {
      ABB: `  FlexPendant: Programar > Datos > wobjdata > wobjPalletN > Definir… > Método "3 puntos" (Usuario):
    X1 = origen, X2 = punto sobre el eje +X, Y1 = punto sobre el eje +Y. Modificar posición en cada punto con el TCP
    calibrado (tGripper con puntero). Revisar el error medio mostrado (< 1 mm).`,
      FANUC: `  MENU > SETUP > Frames > User Frame > [OTHER] Three Point:
    Orient Origin Point = origen, X Direction Point = sobre +X, Y Direction Point = sobre +Y (SHIFT+RECORD en cada uno).
    Usar UTOOL con puntero calibrado.`,
      KUKA: `  Puesta en servicio > Medición > Base > 3 puntos: origen, punto en +X, punto en el plano XY (+Y).
    Seleccionar la herramienta del puntero calibrado. Registrar en BASE_DATA[n].`
    };
    const rows = lay.pallets.map((p) => ({ n: `Palet ${p.id}`, idx: b === "ABB" ? `wobjPallet${p.id}` : b === "FANUC" ? `UFRAME[${p.id}]` : `BASE_DATA[${p.id}]`, f: p.frame }))
      .concat(lay.infeeds.map((f) => ({ n: `Infeed ${f.id}`, idx: b === "ABB" ? `wobjInfeed${f.id}` : b === "FANUC" ? `UFRAME[${4 + f.id}]` : `BASE_DATA[${4 + f.id}]`, f: f.frame })));
    const fmt = (r) => {
      const q = PAL.calc.quatZ(r.f.rz);
      const o = b === "ABB" ? `q=[${q.join(", ")}]` : b === "FANUC" ? `W=0 P=0 R=${r.f.rz}` : `A=${r.f.rz} B=0 C=0`;
      return `  ${r.n.padEnd(10)} ${r.idx.padEnd(14)} X=${f1(r.f.x).padStart(8)}  Y=${f1(r.f.y).padStart(8)}  Z=${f1(r.f.z).padStart(7)}  ${o}`;
    };
    return `CALIBRACIÓN DE ${name.toUpperCase()} — ${cfg.projectName}

DEFINICIÓN DE LOS FRAMES
  Palet:  origen en la esquina del palet más cercana al robot a la izquierda (vista desde el robot),
          X a lo largo del largo del palet (${cfg.palletL} mm), Y alejándose del robot (ancho ${cfg.palletW} mm),
          Z hacia arriba, en la cara superior del palet vacío.
  Infeed: origen en el tope final del transportador, esquina de la guía lateral,
          X en el sentido del flujo (hacia el robot), Y hacia la guía opuesta, Z sobre la superficie de transporte.
  Las posiciones del mosaico se envían desde el PLC en estos frames: si el frame está bien calibrado,
  el mosaico completo queda bien sin reenseñar ningún punto.

VALORES NOMINALES (del layout generado; base del robot = origen, Z = 0 en la brida de la base)
  Altura pedestal ${cfg.pedestalH} mm, transportador de palets ${cfg.outfeedH} mm, palet ${cfg.palletH} mm, infeed ${cfg.infeedH} mm.
${rows.map(fmt).join("\n")}

PROCEDIMIENTO DE CALIBRACIÓN (3 puntos)
  0. Calibrar primero el TCP de un puntero (método 4 puntos, error < 0.5 mm) o usar el TCP de la herramienta.
  1. Poner un palet patrón vacío en la estación, centrado contra los topes/guías.
  2. Enseñar los 3 puntos:
       P1 = esquina de origen, P2 = mismo borde a ≥ 800 mm sobre +X, P3 = punto sobre el borde +Y (≥ 600 mm).
${proc[b]}
  3. Ingresar P1, P2, P3 en la calculadora de la pestaña "Workobjects" para comparar con el nominal:
     desviación de posición > 20 mm o inclinación > 0.5° indica error de montaje o de enseñanza.
  4. Prueba: mover el robot en el frame a X=0,Y=0,Z=50 y X=${cfg.palletL},Y=${cfg.palletW},Z=50 con velocidad baja y verificar las esquinas.
  5. Repetir para cada estación e infeed. Guardar respaldo del controlador.
`;
  }

  function guide(ctx) {
    const { cfg } = ctx;
    const S = cfg.plcBrand === "Siemens";
    const b = cfg.robotBrand;
    const robSW = { ABB: "RobotStudio", FANUC: "ROBOGUIDE / TP", KUKA: "WorkVisual + KUKA smartPAD" }[b];
    const robImport = {
      ABB: `   - Copiar PalletPLC.mod al controlador (RobotStudio > Controlador > RAPID > T_ROB1 > Cargar módulo).
   - Definir main como rutina de entrada (PalletPLC:main). Enseñar jHome y pSafeTop.
   - Medir TCP de tGripper y ejecutar LoadIdentify (o ingresar masa/CDG reales).`,
      FANUC: `   - Cargar los .LS (requiere opción ASCII Upload o convertirlos a .TP con ROBOGUIDE).
   - Enseñar PR[1] Home, PR[2] SafeTop y PR[10] (orientación de referencia herramienta hacia abajo).
   - Configurar PAYLOAD[1] y PAYLOAD[2]; UTOOL[1] del TCP; marcos UFRAME[1..8] (FRAMES_Y_SETUP.txt).
   - Selección de programa remota (RSR/PNS o Style) para que el PLC arranque PAL_MAIN, o arranque por UOP.`,
      KUKA: `   - Copiar PalMain.src/.dat a R1\\Program, pegar SIGNALs en $config.dat.
   - Cargar BASE_DATA[1..8], TOOL_DATA[1..2] y LOAD_DATA[1..2]. Enseñar xHome y xSafeTop.
   - Automático externo: programa CELL.src llama a PalMain() (o configurar PGNO).`
    };
    return `GUÍA DE IMPLEMENTACIÓN — ${cfg.projectName}
Robot ${b} ${cfg.robotModel} (${cfg.robotCtrl}) · PLC ${cfg.plcBrand} ${cfg.plcModel} · HMI ${cfg.hmiModel}

FASE 1 — INGENIERÍA
  1. Revisar el layout en CAD a escala (layout.svg): alcance, interferencias, accesos de grúa horquilla.
  2. Confirmar con el fabricante: carga útil con inercias (diagrama de carga), tiempo de ciclo y tiempo de paro.
  3. Evaluación de riesgos (ISO 12100) y concepto de seguridad (seguridad/concepto_seguridad.txt).
  4. Lista de E/S (plc/io_list.csv) y plan de red (comunicacion/comunicacion.txt).

FASE 2 — ROBOT (${robSW})
${robImport[b]}
   - Configurar el bus (comunicacion/comunicacion.txt, sección robot).
   - Configurar las funciones de seguridad (${PAL.ROBOTS[b].safetyOption}).
   - Simular el ciclo completo en ${b === "ABB" ? "RobotStudio" : b === "FANUC" ? "ROBOGUIDE PalletPRO/HandlingPRO" : "KUKA.Sim"} con el mosaico generado.

FASE 3 — PLC (${S ? "TIA Portal" : "Studio 5000"})
${S ? `   1. Crear el proyecto con ${cfg.plcModel}, agregar el robot por GSDML y el HMI.
   2. Crear tags Robot_In / Robot_Out (ver 04_Main.scl).
   3. Fuentes externas > Agregar archivo: 01_Types.udt, 02_Blocks.scl, 03_DataBlocks.db, 04_Main.scl
      → clic derecho > "Generar bloques desde la fuente", en ese orden.
   4. Compilar, revisar direcciones de E/S físicas en OB1 y cargar.` :
   `   1. Crear el proyecto con ${cfg.plcModel}, módulo "Robot" en I/O Configuration y tarjetas de E/S locales.
   2. Crear las UDT (UDTs_y_modulo_robot.txt) e importar Tags_y_Alias.CSV.
   3. Crear el programa "Palletizer" con rutinas ST: copiar R00..R60 (R00_Main como Main Routine).
   4. Verificar (Verify Controller) y descargar.`}

FASE 4 — HMI
   - Seguir hmi/HMI_diseno.txt. Importar tags (hmi_tags.csv) y alarmas (hmi_alarms.csv).

FASE 5 — PUESTA EN MARCHA
   1. Prueba de E/S punto a punto y de comunicación (bit de vida, eco CmdID).
   2. Validación de funciones de seguridad (todas las SF, con registro).
   3. Calibración de frames (seguridad/… y workobjects.txt) y TCP.
   4. Ciclo en vacío (DryRun) a 10 % → 50 % → 100 %.
   5. Ciclo con producto: un palet completo por estación, verificar mosaico, voladizo y estabilidad.
   6. Medir tiempo de ciclo real vs requerido (${ctx.checks.cyclesH} ciclos/h).
   7. Capacitación y entrega: respaldos de robot, PLC y HMI.
`;
  }

  function bom(ctx) {
    const { cfg, lay } = ctx;
    const rows = [
      ["Robot", 1, `${cfg.robotBrand} ${cfg.robotModel}`, `Controlador ${cfg.robotCtrl}`],
      ["Opción de bus robot", 1, PAL.ROBOTS[cfg.robotBrand].fieldbus[cfg.protocol], ""],
      ["Opción de seguridad robot", cfg.robotSafe ? 1 : 0, PAL.ROBOTS[cfg.robotBrand].safetyOption, PAL.ROBOTS[cfg.robotBrand].safeBus[cfg.protocol]],
      ["Pedestal robot", cfg.pedestalH > 0 ? 1 : 0, `Altura ${cfg.pedestalH} mm`, "Anclaje químico según cargas del fabricante"],
      ["Herramienta", 1, PAL.GRIPPERS[cfg.gripper].name, PAL.GRIPPERS[cfg.gripper].note],
      ["PLC", 1, `${cfg.plcBrand} ${cfg.plcModel}`, PAL.PLCS[cfg.plcBrand].software],
      ["HMI", 1, cfg.hmiModel, PAL.HMIS[cfg.plcBrand][cfg.hmiModel].sw],
      ["Switch industrial", 1, "Gestionado, 8 puertos", cfg.protocol],
      ["Transportador infeed", lay.infeeds.length, PAL.ARRIVAL[cfg.arrival], `${cfg.rate} cajas/min c/u, tope + fotocélula de toma`],
      ["Estación de palet", lay.pallets.length, cfg.palletExit === "conveyor" ? "Transportador de rodillos para palet con centrador" : "Estación fija con topes/centradores", `Altura ${cfg.outfeedH} mm`],
      ["Dispensador de palets", cfg.palletSupply === "conveyor" ? 1 : 0, "Magazín automático de palets vacíos", ""],
      ["Dispensador láminas", cfg.slipSheet ? 1 : 0, "Magazín de láminas separadoras", ""]
    ];
    PAL.genSafety.concept(ctx).devices.forEach((d) => rows.push(["Seguridad", d.q, d.item, d.note]));
    return ["Grupo;Cantidad;Ítem;Nota"].concat(rows.filter((r) => r[1] > 0).map((r) => r.join(";"))).join("\r\n");
  }

  return { interfaceCSV, comm, wobjDoc, guide, bom };
})();
