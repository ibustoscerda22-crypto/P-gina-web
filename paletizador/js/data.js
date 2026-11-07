/* Catálogos de equipos. Los valores técnicos son nominales: verifícalos siempre con la ficha
   técnica vigente del fabricante antes de cerrar un diseño. */
window.PAL = window.PAL || {};

PAL.ROBOTS = {
  ABB: {
    name: "ABB",
    controllers: {
      "IRC5": { sw: "RobotWare 6.x", lang: "RAPID" },
      "OmniCore": { sw: "RobotWare 7.x", lang: "RAPID" }
    },
    safetyOption: "SafeMove (zonas cartesianas, velocidad segura, stand-still)",
    fieldbus: {
      PROFINET: "Opción PROFINET Device (dispositivo interno PN_Internal_Device)",
      "EtherNet/IP": "Opción EtherNet/IP Adapter (dispositivo interno EN_Internal_Device)"
    },
    safeBus: { PROFINET: "PROFIsafe (SafeMove + PROFIsafe F-Device)", "EtherNet/IP": "CIP Safety Adapter (SafeMove)" },
    models: {
      "IRB 460":          { payload: 110, reach: 2400, axes: 4, cph: 2190, mass: 925 },
      "IRB 660-180/3.15": { payload: 180, reach: 3150, axes: 4, cph: 2010, mass: 1750 },
      "IRB 660-250/3.15": { payload: 250, reach: 3150, axes: 4, cph: 1700, mass: 1750 },
      "IRB 760-450/3.18": { payload: 450, reach: 3180, axes: 4, cph: 1150, mass: 2300 },
      "IRB 4600-60/2.05": { payload: 60,  reach: 2050, axes: 6, cph: 1500, mass: 425 },
      "IRB 6700-150/3.20":{ payload: 150, reach: 3200, axes: 6, cph: 1100, mass: 1170 }
    }
  },
  FANUC: {
    name: "FANUC",
    controllers: {
      "R-30iB Plus": { sw: "V9.x", lang: "TP / KAREL" },
      "R-50iA": { sw: "V10.x", lang: "TP / KAREL" }
    },
    safetyOption: "DCS (Dual Check Safety): Position/Speed Check y Safe I/O",
    fieldbus: {
      PROFINET: "Opción PROFINET I/O (tarjeta dual: lado I-Device hacia el PLC)",
      "EtherNet/IP": "Opción EtherNet/IP Adapter (rack 89, slot 1)"
    },
    safeBus: { PROFINET: "PROFIsafe (DCS Safe I/O)", "EtherNet/IP": "CIP Safety (DCS Safe I/O)" },
    models: {
      "M-410iC/110":  { payload: 110, reach: 2403, axes: 4, cph: 2200, mass: 1030 },
      "M-410iC/185":  { payload: 185, reach: 3143, axes: 4, cph: 2000, mass: 1600 },
      "M-410iC/315":  { payload: 315, reach: 3143, axes: 4, cph: 1700, mass: 1600 },
      "M-410iC/500":  { payload: 500, reach: 3143, axes: 4, cph: 1300, mass: 2400 },
      "M-410iB/700":  { payload: 700, reach: 3143, axes: 4, cph: 1000, mass: 2700 },
      "R-2000iC/210F":{ payload: 210, reach: 2655, axes: 6, cph: 1000, mass: 1090 }
    }
  },
  KUKA: {
    name: "KUKA",
    controllers: {
      "KR C4": { sw: "KSS 8.6", lang: "KRL" },
      "KR C5": { sw: "KSS 8.7", lang: "KRL" }
    },
    safetyOption: "KUKA.SafeOperation (espacios de trabajo y velocidades seguras)",
    fieldbus: {
      PROFINET: "KUKA.ProfiNet (dispositivo), configurado en WorkVisual",
      "EtherNet/IP": "KUKA.EtherNet/IP (adapter), configurado en WorkVisual"
    },
    safeBus: { PROFINET: "PROFIsafe (KUKA.ProfiNet + SafeOperation)", "EtherNet/IP": "CIP Safety (KUKA.EtherNet/IP + SafeOperation)" },
    models: {
      "KR 40 PA":          { payload: 40,  reach: 2091, axes: 4, cph: 1800, mass: 700 },
      "KR 180 R3200 PA":   { payload: 180, reach: 3195, axes: 4, cph: 1700, mass: 1180 },
      "KR 240 R3200 PA":   { payload: 240, reach: 3195, axes: 4, cph: 1550, mass: 1190 },
      "KR 470-2 PA":       { payload: 470, reach: 3150, axes: 4, cph: 1200, mass: 2150 },
      "KR 700 PA":         { payload: 700, reach: 3320, axes: 4, cph: 1000, mass: 2850 },
      "KR 210 R2700-2":    { payload: 210, reach: 2701, axes: 6, cph: 1000, mass: 1069 }
    }
  }
};

PAL.PLCS = {
  Siemens: {
    name: "Siemens",
    software: "TIA Portal V19 / V20",
    lang: "SCL (fuentes externas .scl importables)",
    nativeBus: "PROFINET",
    safeBus: "PROFIsafe",
    models: {
      "S7-1500 CPU 1515-2 PN": { safety: false },
      "S7-1500F CPU 1516F-3 PN/DP": { safety: true },
      "S7-1500F CPU 1515F-2 PN": { safety: true },
      "S7-1200 G2 CPU 1214FC": { safety: true },
      "ET 200SP CPU 1512SP F-1 PN": { safety: true }
    }
  },
  "Allen-Bradley": {
    name: "Allen-Bradley (Rockwell)",
    software: "Studio 5000 Logix Designer v33+",
    lang: "Structured Text (rutinas ST)",
    nativeBus: "EtherNet/IP",
    safeBus: "CIP Safety",
    models: {
      "ControlLogix 5580 (1756-L83E)": { safety: false },
      "GuardLogix 5580 (1756-L83ES)": { safety: true },
      "CompactLogix 5380 (5069-L330ER)": { safety: false },
      "Compact GuardLogix 5380 (5069-L330ERS2)": { safety: true },
      "CompactLogix 5480 (5069-L46ERMW)": { safety: false }
    }
  }
};

PAL.HMIS = {
  Siemens: {
    "WinCC Unified MTP1200 (12\")": { sw: "WinCC Unified (TIA Portal)", res: "1280x800" },
    "WinCC Unified MTP1500 (15\")": { sw: "WinCC Unified (TIA Portal)", res: "1280x800" },
    "TP1200 Comfort (12\")": { sw: "WinCC Comfort/Advanced (TIA Portal)", res: "1280x800" },
    "KTP700 Basic (7\")": { sw: "WinCC Basic (TIA Portal)", res: "800x480" }
  },
  "Allen-Bradley": {
    "PanelView 5510 (12\")": { sw: "Studio 5000 View Designer", res: "1280x800" },
    "PanelView Plus 7 Perf. (12\")": { sw: "FactoryTalk View ME", res: "1280x800" },
    "FactoryTalk Optix Panel (15\")": { sw: "FactoryTalk Optix Studio", res: "1280x800" },
    "PanelView 5310 (7\")": { sw: "Studio 5000 View Designer", res: "800x480" }
  }
};

PAL.PALLETS = {
  "EUR 1200x800": { L: 1200, W: 800, H: 144 },
  "ISO 1200x1000 (Chile/industrial)": { L: 1200, W: 1000, H: 150 },
  "GMA 48x40 in (1219x1016)": { L: 1219, W: 1016, H: 140 },
  "Media EUR 800x600": { L: 800, W: 600, H: 144 },
  "Personalizado": { L: 1200, W: 1000, H: 150 }
};

PAL.GRIPPERS = {
  vacio: { name: "Vacío (ventosas / espuma)", mass: 35, note: "Cajas de cartón con tapa plana. Requiere generador de vacío o soplante y vacuostato." },
  pinza: { name: "Pinza de garras (clamp)", mass: 60, note: "Cajas sin tapa rígida, bultos. Cilindros neumáticos con sensores de posición." },
  horquilla: { name: "Horquilla / dedos (fork)", mass: 85, note: "Sacos y bultos pesados. Dedos bajo el producto + prensor superior." }
};

PAL.ARRIVAL = {
  rodillos: "Transportador de rodillos motorizados (MDR 24 V) con acumulación sin presión",
  banda: "Transportador de banda con tope neumático y guías laterales",
  cadena: "Transportador de cadena / tablillas (bultos pesados, sacos)"
};

PAL.PALLET_SUPPLY = {
  manual: "Manual con grúa horquilla (estación con cortina de luz / escáner)",
  conveyor: "Transportador de palets desde magazín dispensador automático"
};

PAL.PALLET_EXIT = {
  manual: "Retiro manual con grúa horquilla",
  conveyor: "Transportador de salida hacia envolvedora / almacén"
};

PAL.PACKML = {
  states: {
    0: "Undefined", 1: "Clearing", 2: "Stopped", 3: "Starting", 4: "Idle", 5: "Suspended",
    6: "Execute", 7: "Stopping", 8: "Aborting", 9: "Aborted", 10: "Holding", 11: "Held",
    12: "Unholding", 13: "Suspending", 14: "Unsuspending", 15: "Resetting", 16: "Completing", 17: "Complete"
  },
  commands: { 0: "Undefined", 1: "Reset", 2: "Start", 3: "Stop", 4: "Hold", 5: "Unhold", 6: "Suspend", 7: "Unsuspend", 8: "Abort", 9: "Clear" },
  modes: { 1: "Production", 2: "Maintenance", 3: "Manual" },
  /* Transiciones por comando y por estado completado (SC) según ISA-TR88.00.02 */
  onCommand: {
    Reset:     { 2: 15, 17: 15 },
    Start:     { 4: 3 },
    Stop:      { 4: 7, 3: 7, 6: 7, 5: 7, 13: 7, 14: 7, 10: 7, 11: 7, 12: 7, 16: 7, 17: 7, 15: 7 },
    Hold:      { 6: 10, 5: 10, 13: 10, 14: 10 },
    Unhold:    { 11: 12 },
    Suspend:   { 6: 13 },
    Unsuspend: { 5: 14 },
    Abort:     { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 8, 7: 8, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8, 16: 8, 17: 8 },
    Clear:     { 9: 1 }
  },
  onComplete: { 1: 2, 3: 6, 7: 2, 8: 9, 10: 11, 12: 6, 13: 5, 14: 6, 15: 4, 16: 17, 6: 16 }
};
