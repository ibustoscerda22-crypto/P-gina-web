/* Mapa de intercambio cíclico PLC (maestro) <-> Robot (esclavo).
   64 bytes en cada sentido. Bytes 0..3 = bits; desde el byte 4 = palabras UINT de 16 bits.
   Todas las palabras viajan en little-endian (byte bajo primero). El PLC Siemens (big-endian)
   intercambia bytes con SWAP() antes de enviar / después de recibir; Allen-Bradley ya es little-endian.
   Coordenadas siempre positivas en el frame de palet/infeed -> no hacen falta enteros con signo
   (los GI de FANUC son de 16 bits sin signo). */
window.PAL = window.PAL || {};

PAL.iface = (function () {
  const bits = (byte, names) => names.map((n, b) => (n ? { byte, bit: b, type: "BOOL", name: n[0], desc: n[1] } : null)).filter(Boolean);
  const word = (byte, name, desc, unit) => ({ byte, type: "UINT", name, desc, unit: unit || "" });

  const PLC_TO_ROBOT = [].concat(
    bits(0, [
      ["PLC_LifeBit", "Bit de vida del PLC (conmuta cada 500 ms)"],
      ["MotorsOn", "Solicitud de motores/servos ON"],
      ["ProgStart", "Arranque/continuación del programa (flanco)"],
      ["ProgStop", "Parada de ciclo controlada"],
      ["ResetFault", "Reset de fallas del robot"],
      ["Hold", "Pausa (PackML Holding/Suspending): terminar movimiento y esperar"],
      ["GoHome", "Ir a posición de reposo (Home)"],
      ["CmdValid", "Nuevo comando válido en las palabras de comando"]
    ]),
    bits(1, [
      ["PermitPallet1", "Permiso entrar zona palet 1"], ["PermitPallet2", "Permiso entrar zona palet 2"],
      ["PermitPallet3", "Permiso entrar zona palet 3"], ["PermitPallet4", "Permiso entrar zona palet 4"],
      ["PermitInfeed1", "Permiso entrar zona infeed 1"], ["PermitInfeed2", "Permiso entrar zona infeed 2"],
      ["PermitInfeed3", "Permiso entrar zona infeed 3"], ["PermitInfeed4", "Permiso entrar zona infeed 4"]
    ]),
    bits(2, [
      ["InfeedReady1", "Producto en posición de toma, infeed 1"], ["InfeedReady2", "Producto listo infeed 2"],
      ["InfeedReady3", "Producto listo infeed 3"], ["InfeedReady4", "Producto listo infeed 4"],
      ["PalletReady1", "Palet vacío/en curso posicionado, estación 1"], ["PalletReady2", "Palet listo estación 2"],
      ["PalletReady3", "Palet listo estación 3"], ["PalletReady4", "Palet listo estación 4"]
    ]),
    bits(3, [
      ["SlipSheetReady", "Lámina separadora disponible"], ["DryRun", "Ciclo en vacío (sin producto)"],
      ["MaintMode", "Modo PackML Maintenance"], ["ManualMode", "Modo PackML Manual"]
    ]),
    [
      word(4, "CmdID", "Identificador del comando (1..32767, incrementa)"),
      word(6, "CmdCode", "1=Pick&Place 2=Home 3=Lámina separadora 4=Pos. mantención 5=Test pinza"),
      word(8, "PickStation", "Infeed de toma (1..4)"),
      word(10, "PlaceStation", "Estación de palet destino (1..4)"),
      word(12, "Layer", "Capa (1..n)"),
      word(14, "BoxIndex", "Índice de caja dentro de la capa"),
      word(16, "PosX", "X destino en frame del palet", "0.1 mm"),
      word(18, "PosY", "Y destino en frame del palet", "0.1 mm"),
      word(20, "PosZ", "Z destino (cara superior de la caja)", "0.1 mm"),
      word(22, "PosRz", "Rotación de la caja (0..359.9)", "0.1°"),
      word(24, "ApproachZ", "Altura de aproximación sobre el destino", "mm"),
      word(26, "ApproachXY", "Desplazamiento de aproximación diagonal (−X, −Y del frame)", "mm"),
      word(28, "SpeedOvr", "Override de velocidad", "%"),
      word(30, "ProductID", "Receta / producto activo"),
      word(32, "BoxL", "Largo de caja", "mm"),
      word(34, "BoxW", "Ancho de caja", "mm"),
      word(36, "BoxH", "Alto de caja", "mm"),
      word(38, "BoxWeight", "Peso de caja", "0.1 kg"),
      word(40, "GripZones", "Máscara de zonas de vacío / dedos")
    ]
  );

  const ROBOT_TO_PLC = [].concat(
    bits(0, [
      ["Rob_LifeBit", "Bit de vida robot (eco invertido del PLC_LifeBit)"],
      ["MotorsOnState", "Motores/servos energizados"],
      ["ProgRunning", "Programa en ejecución"],
      ["AutoMode", "Robot en modo Automático/Remoto"],
      ["FaultActive", "Falla activa en el controlador"],
      ["AtHome", "Robot en Home (zona segura)"],
      ["CmdAck", "Comando recibido (eco en CmdIDEcho)"],
      ["CmdDone", "Comando terminado"]
    ]),
    bits(1, [
      ["OutPallet1", "Robot fuera de zona palet 1"], ["OutPallet2", "Robot fuera de zona palet 2"],
      ["OutPallet3", "Robot fuera de zona palet 3"], ["OutPallet4", "Robot fuera de zona palet 4"],
      ["OutInfeed1", "Robot fuera de zona infeed 1"], ["OutInfeed2", "Robot fuera de zona infeed 2"],
      ["OutInfeed3", "Robot fuera de zona infeed 3"], ["OutInfeed4", "Robot fuera de zona infeed 4"]
    ]),
    bits(2, [
      ["GripClosed", "Pinza cerrada / vacío OK"], ["PartPresent", "Producto detectado en la herramienta"],
      ["GripOpen", "Pinza abierta / vacío liberado"], ["CycleOn", "Ejecutando un comando"],
      ["HeldState", "Robot detenido por Hold"], ["EStopActive", "Paro de emergencia activo en robot"],
      ["SafetyOK", "Circuito de seguridad del robot OK"], ["ReadyForCmd", "Listo para recibir comando"]
    ]),
    [
      word(4, "CmdIDEcho", "Eco del CmdID recibido"),
      word(6, "Status", "0=Idle 1=Ocupado 2=Terminado 3=Error"),
      word(8, "ErrorCode", "Código de error de aplicación"),
      word(10, "Step", "Paso actual de la secuencia"),
      word(12, "CycleTime", "Último tiempo de ciclo", "ms"),
      word(14, "BoxesDone", "Cajas colocadas (contador robot)"),
      word(16, "OvrActual", "Override real", "%")
    ]
  );

  const ROBOT_ERRORS = [
    [1, "Comando desconocido"], [2, "Estación de toma fuera de rango"], [3, "Estación de palet fuera de rango"],
    [4, "Producto no detectado tras tomar (vacío/pinza)"], [5, "Producto perdido durante el traslado"],
    [6, "Timeout esperando permiso de zona"], [7, "Coordenada fuera del área del palet"], [8, "Timeout pinza"]
  ];

  /* Dirección física según marca/protocolo */
  function robotAddr(brand, dirToRobot, s, cfg) {
    const bitNo = s.byte * 8 + (s.bit || 0);
    if (brand === "ABB") {
      const pref = dirToRobot ? (s.type === "BOOL" ? "di" : "gi") : (s.type === "BOOL" ? "do" : "go");
      const map = s.type === "BOOL" ? `${bitNo}` : `${bitNo}-${bitNo + 15}`;
      return { name: pref + s.name, map };
    }
    if (brand === "FANUC") {
      if (s.type === "BOOL") return { name: (dirToRobot ? "DI[" : "DO[") + (bitNo + 1) + "]", map: "" };
      const n = dirToRobot ? PLC_TO_ROBOT.filter((x) => x.type === "UINT").indexOf(s) + 1 : ROBOT_TO_PLC.filter((x) => x.type === "UINT").indexOf(s) + 1;
      return { name: (dirToRobot ? "GI[" : "GO[") + n + "]", map: `start ${bitNo + 1}, 16 pts` };
    }
    // KUKA
    const base = cfg.kukaIOOffset;
    if (s.type === "BOOL") return { name: (dirToRobot ? "$IN[" : "$OUT[") + (base + bitNo) + "]", map: "" };
    return { name: (dirToRobot ? "$IN[" : "$OUT[") + (base + bitNo) + "..." + (base + bitNo + 15) + "]", map: "SIGNAL" };
  }

  function plcAddr(plc, dirToRobot, s, cfg) {
    if (plc === "Siemens") {
      const start = dirToRobot ? cfg.plcOutStart : cfg.plcInStart;
      const area = dirToRobot ? "Q" : "I";
      return s.type === "BOOL" ? `%${area}${start + s.byte}.${s.bit}` : `%${area}W${start + s.byte}`;
    }
    const tag = dirToRobot ? "Robot:O.Data" : "Robot:I.Data";
    const w = Math.floor(s.byte / 2);
    return s.type === "BOOL" ? `${tag}[${w}].${(s.byte % 2) * 8 + s.bit}` : `${tag}[${w}]`;
  }

  return { PLC_TO_ROBOT, ROBOT_TO_PLC, ROBOT_ERRORS, robotAddr, plcAddr, SIZE: 64 };
})();
