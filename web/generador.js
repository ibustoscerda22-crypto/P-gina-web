// Generador de celdas de paletizado para ABB RobotStudio.
// Módulo ES sin dependencias: lo usan la página web (web/index.html) y la línea de
// comandos (generador/generar.mjs).
//
// Convenciones:
//  - Unidades en mm y grados.
//  - El marco mundo de la estación coincide con la base del robot (0,0,0).
//    El suelo queda en z = -robot.base_z_mm (base_z_mm > 0 = robot sobre pedestal).
//  - Coordenadas locales del pallet: X a lo largo de "largo_mm", Y a lo largo de "ancho_mm",
//    origen en una esquina del pallet a nivel de suelo.

export const ROBOTS = {
  "IRB 460-110/2.4": { alcance_mm: 2403, carga_max_kg: 110 },
  "IRB 660-180/3.15": { alcance_mm: 3150, carga_max_kg: 180 },
  "IRB 660-250/3.15": { alcance_mm: 3150, carga_max_kg: 250 },
  "IRB 760-450/3.18": { alcance_mm: 3180, carga_max_kg: 450 },
  "IRB 4600-60/2.05": { alcance_mm: 2050, carga_max_kg: 60 },
};

export const PALLETS = {
  europeo: { largo_mm: 1200, ancho_mm: 800, alto_mm: 144 },
  americano: { largo_mm: 1219, ancho_mm: 1016, alto_mm: 140 },
  industrial: { largo_mm: 1200, ancho_mm: 1000, alto_mm: 144 },
};

const ORIENTACIONES = [0, 90]; // 0: largo de la caja a lo largo de X local; 90: a lo largo de Y local

// ------------------------------------------------------------------ especificación

/** Especificación con valores por defecto (la celda de ejemplo). */
export function specPorDefecto() {
  return {
    nombre: "irb460_cajas400x300_8capas",
    descripcion: "Robot IRB 460, conveyor 2000x600 a 800 mm, cajas 400x300x250, pallet europeo 1200x800, 8 capas, mosaico alternado",
    robot: { modelo: "IRB 460-110/2.4", alcance_mm: 2403, carga_max_kg: 110, base_z_mm: 0 },
    conveyor: { largo_mm: 2000, ancho_mm: 600, altura_mm: 800, fin_xy_mm: [1000, 1200], direccion_deg: 0 },
    caja: { largo_mm: 400, ancho_mm: 300, alto_mm: 250, masa_kg: 15 },
    pallet: { largo_mm: 1200, ancho_mm: 800, alto_mm: 144, centro_xy_mm: [1350, 0], rotacion_deg: 90 },
    capas: 8,
    mosaico: "alternado",
    garra: { largo_tcp_mm: 250, masa_kg: 40 },
    movimiento: { aproximacion_mm: 300, vel_rapida: "v2000", vel_aprox: "v1000", vel_lenta: "v300" },
  };
}

/**
 * Coloca pallet y conveyor según el alcance del robot:
 * pallet delante (+X) girado 90° con el lado largo de frente al robot, centro a ~56 % del alcance;
 * conveyor a un lado (+Y) a 300 mm del pallet, avanzando hacia +X, con el pick a ~60 % del alcance.
 */
export function layoutAutomatico(spec) {
  const R = spec.robot.alcance_mm;
  const p = spec.pallet, cv = spec.conveyor, caja = spec.caja;
  const r50 = (v) => Math.round(v / 50) * 50;
  p.rotacion_deg = 90;
  p.centro_xy_mm = [r50(0.56 * R), 0];
  cv.direccion_deg = 0;
  const y = p.largo_mm / 2 + 300 + cv.ancho_mm / 2;
  const rPick = 0.6 * R;
  const xPick = rPick > y ? Math.sqrt(rPick * rPick - y * y) : 0;
  cv.fin_xy_mm = [r50(xPick + caja.largo_mm / 2), y];
  return spec;
}

/**
 * Interpreta una descripción en palabras y devuelve los campos que reconoce.
 * Ej.: "Robot IRB 460, conveyor de 2000×600 mm a 800 mm de altura, cajas de 400×300×250 mm,
 *       pallet europeo 1200×800, 8 capas, mosaico alternado"
 */
export function interpretarTexto(texto) {
  const t = texto.toLowerCase().replace(/,(?=\d)/g, ".").replace(/×|\*/g, "x");
  const num = "(\\d+(?:\\.\\d+)?)";
  const dim2 = `${num}\\s*(?:mm)?\\s*x\\s*${num}`;
  const r = {};
  const enc = [];

  const mr = t.match(/irb\s*-?\s*(\d{3,4})/);
  if (mr) {
    const m = Object.keys(ROBOTS).find((k) => k.startsWith(`IRB ${mr[1]}`));
    r.robot = m || `IRB ${mr[1]}`;
    enc.push(`robot ${r.robot}${m ? "" : " (modelo sin datos de alcance)"}`);
  }
  const mc = t.match(new RegExp(`(?:conveyor|cinta|transportador)[^0-9]{0,40}${dim2}(?:\\s*mm)?([^0-9]{0,30}${num})?`));
  if (mc) {
    r.conveyor = { largo_mm: +mc[1], ancho_mm: +mc[2] };
    if (mc[4] && /(\ba\b|altura|alto)/.test(mc[3])) r.conveyor.altura_mm = +mc[4];
    enc.push("conveyor");
  }
  const malt = t.match(new RegExp(`(?:altura|alto)[^0-9]{0,15}${num}\\s*mm[^.;]{0,30}(?:conveyor|cinta)`));
  if (malt && !(r.conveyor && r.conveyor.altura_mm)) (r.conveyor ||= {}).altura_mm = +malt[1];
  const mb = t.match(new RegExp(`caja[s]?[^0-9]{0,20}${dim2}\\s*(?:mm)?\\s*x\\s*${num}`));
  if (mb) { r.caja = { largo_mm: Math.max(+mb[1], +mb[2]), ancho_mm: Math.min(+mb[1], +mb[2]), alto_mm: +mb[3] }; enc.push("caja"); }
  const mkg = t.match(new RegExp(`caja[s]?[^.;]{0,60}?${num}\\s*kg`)) || t.match(new RegExp(`${num}\\s*kg[^.;]{0,20}caja`));
  if (mkg) (r.caja ||= {}).masa_kg = +mkg[1];
  for (const [nombre, dims] of Object.entries(PALLETS)) {
    if (t.includes(nombre)) { r.pallet = { ...dims }; enc.push(`pallet ${nombre}`); }
  }
  const mp = t.match(new RegExp(`pallet[^0-9]{0,25}${dim2}`));
  if (mp) {
    r.pallet = { ...(r.pallet || {}), largo_mm: Math.max(+mp[1], +mp[2]), ancho_mm: Math.min(+mp[1], +mp[2]) };
    if (!enc.some((e) => e.startsWith("pallet"))) enc.push("pallet");
  }
  const mcap = t.match(/(\d+)\s*(?:capas?|caps|niveles|alturas)\b/);
  if (mcap) { r.capas = +mcap[1]; enc.push("capas"); }
  if (/columna|sin trabar|apilad[oa] recto/.test(t)) { r.mosaico = "columnas"; enc.push("mosaico columnas"); }
  else if (/alternad|trabad|cruzad/.test(t)) { r.mosaico = "alternado"; enc.push("mosaico alternado"); }
  const mped = t.match(new RegExp(`pedestal[^0-9]{0,20}${num}`));
  if (mped) { r.base_z_mm = +mped[1]; enc.push("pedestal"); }
  return { campos: r, encontrados: enc };
}

/** Aplica los campos interpretados sobre una especificación. */
export function aplicarCampos(spec, c) {
  if (c.robot) {
    spec.robot.modelo = c.robot;
    if (ROBOTS[c.robot]) Object.assign(spec.robot, ROBOTS[c.robot]);
  }
  if (c.base_z_mm != null) spec.robot.base_z_mm = c.base_z_mm;
  if (c.conveyor) Object.assign(spec.conveyor, c.conveyor);
  if (c.caja) Object.assign(spec.caja, c.caja);
  if (c.pallet) Object.assign(spec.pallet, c.pallet);
  if (c.capas) spec.capas = c.capas;
  if (c.mosaico) spec.mosaico = c.mosaico;
  return spec;
}

export function nombreCelda(spec) {
  const m = spec.robot.modelo.match(/IRB\s*(\d+)/i);
  const c = spec.caja;
  return `irb${m ? m[1] : "x"}_cajas${c.largo_mm}x${c.ancho_mm}_${spec.capas}capas`;
}

// ------------------------------------------------------------------ mosaico

function dims(caja, o) {
  return o === 0 ? [caja.largo_mm, caja.ancho_mm] : [caja.ancho_mm, caja.largo_mm];
}

function bloque(x0, y0, nx, ny, bx, by, o) {
  const out = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) out.push([x0 + (i + 0.5) * bx, y0 + (j + 0.5) * by, bx, by, o]);
  return out;
}

const fl = Math.floor;

function patronesCandidatos(PL, PW, caja) {
  const cands = [];
  for (const o of ORIENTACIONES) {
    const [bx, by] = dims(caja, o);
    const nx = fl(PL / bx), ny = fl(PW / by);
    if (nx && ny) cands.push(["rejilla", bloque((PL - nx * bx) / 2, (PW - ny * by) / 2, nx, ny, bx, by, o)]);
  }
  for (const o1 of ORIENTACIONES) {
    const o2 = 90 - o1;
    const [b1x, b1y] = dims(caja, o1);
    const [b2x, b2y] = dims(caja, o2);
    // división a lo largo de Y: franja inferior con o1, franja superior con o2
    for (let k1 = 1; k1 <= fl(PW / b1y); k1++) {
      const n1x = fl(PL / b1x);
      const n2x = fl(PL / b2x), n2y = fl((PW - k1 * b1y) / b2y);
      if (n1x && n2x && n2y) {
        const alto = k1 * b1y + n2y * b2y;
        const y0 = (PW - alto) / 2;
        cands.push(["bloques_y", [
          ...bloque((PL - n1x * b1x) / 2, y0, n1x, k1, b1x, b1y, o1),
          ...bloque((PL - n2x * b2x) / 2, y0 + k1 * b1y, n2x, n2y, b2x, b2y, o2)]]);
      }
    }
    // división a lo largo de X: franja izquierda con o1, franja derecha con o2
    for (let k1 = 1; k1 <= fl(PL / b1x); k1++) {
      const n1y = fl(PW / b1y);
      const n2x = fl((PL - k1 * b1x) / b2x), n2y = fl(PW / b2y);
      if (n1y && n2x && n2y) {
        const ancho = k1 * b1x + n2x * b2x;
        const x0 = (PL - ancho) / 2;
        cands.push(["bloques_x", [
          ...bloque(x0, (PW - n1y * b1y) / 2, k1, n1y, b1x, b1y, o1),
          ...bloque(x0 + k1 * b1x, (PW - n2y * b2y) / 2, n2x, n2y, b2x, b2y, o2)]]);
      }
    }
  }
  return cands;
}

const firma = (rects) =>
  rects.map(([x, y, , , o]) => `${x.toFixed(1)},${y.toFixed(1)},${o}`).sort().join(";");

const transformar = (rects, PL, PW, ex, ey) =>
  rects.map(([x, y, bx, by, o]) => [ex ? PL - x : x, ey ? PW - y : y, bx, by, o]);

function equivalentes(a, b, PL, PW) {
  const fb = firma(b);
  for (const ex of [false, true])
    for (const ey of [false, true]) if (firma(transformar(a, PL, PW, ex, ey)) === fb) return true;
  return false;
}

function elegirMosaico(spec) {
  const { pallet: p, caja } = spec;
  const PL = p.largo_mm, PW = p.ancho_mm;
  const cands = patronesCandidatos(PL, PW, caja);
  if (!cands.length) throw new Error("La caja no cabe en el pallet.");
  // A: máximo de cajas; a igualdad, rejilla primero (orden estable)
  cands.sort((a, b) => (b[1].length - a[1].length) || ((a[0] !== "rejilla") - (b[0] !== "rejilla")));
  const A = cands[0][1];
  const notas = [];
  const capas = [];
  const modo = spec.mosaico || "alternado";
  let B = null;
  if (modo === "alternado") {
    const distintos = cands.filter((c) => !equivalentes(A, c[1], PL, PW));
    if (distintos.length) {
      B = distintos[0][1];
      if (B.length < A.length)
        notas.push(
          `Con estas medidas la capa completa (${A.length} cajas) solo admite una disposición; ` +
          `para trabar capas se alternan capas de ${A.length} y de ${B.length} cajas. ` +
          `Usa "mosaico": "columnas" para ${A.length} cajas en todas las capas (sin trabado).`);
    } else {
      notas.push("No existe un mosaico alternativo; se usa el mismo en todas las capas.");
    }
  }
  for (let k = 0; k < spec.capas; k++) {
    if (B === null || k % 2 === 0) capas.push(["A", A]);
    else if (fl(k / 2) % 2 === 0) capas.push(["B", B]);
    else capas.push(["B'", transformar(B, PL, PW, true, true)]); // B girada 180°
  }
  return { capas, notas };
}

// ------------------------------------------------------------------ geometría

function rot2(x, y, deg) {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  return [x * c - y * s, x * s + y * c];
}

function wrap180(a) {
  a = ((((a + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
}

const quatZ = (deg) => {
  const h = (deg * Math.PI) / 360;
  return [Math.cos(h), 0, 0, Math.sin(h)];
};

export function calcular(spec) {
  const { pallet: p, conveyor: cv, caja, robot, garra, movimiento: mov } = spec;
  const baseZ = robot.base_z_mm || 0;
  const suelo = -baseZ;
  const PL = p.largo_mm, PW = p.ancho_mm, PH = p.alto_mm;
  const [cx, cy] = p.centro_xy_mm;
  const prot = p.rotacion_deg, cdir = cv.direccion_deg;
  for (const [n, a] of [["pallet.rotacion_deg", prot], ["conveyor.direccion_deg", cdir]])
    if (a % 90) throw new Error(`${n} debe ser múltiplo de 90° (la geometría se crea alineada a ejes).`);

  const palletAMundo = (x, y) => {
    const [dx, dy] = rot2(x - PL / 2, y - PW / 2, prot);
    return [cx + dx, cy + dy];
  };
  const esquina = palletAMundo(0, 0);
  const { capas, notas } = elegirMosaico(spec);

  // pick: caja apoyada contra el tope al final del conveyor, largo a lo largo de la cinta
  const [ex, ey] = cv.fin_xy_mm;
  const [ux, uy] = rot2(1, 0, cdir);
  const pickXY = [ex - (ux * caja.largo_mm) / 2, ey - (uy * caja.largo_mm) / 2];

  const places = [];
  capas.forEach(([patron, rects], k) => {
    const zTcp = PH + (k + 1) * caja.alto_mm; // en wPallet (origen a nivel de suelo)
    const capa = rects.map(([x, y, bx, by, o]) => {
      const [wx, wy] = palletAMundo(x, y);
      // ángulo de la garra: el equivalente (±180°) más cercano al de pick
      let dif = wrap180(prot + o - cdir);
      if (dif > 90) dif -= 180;
      else if (dif < -90) dif += 180;
      const theta = wrap180(cdir + dif - prot);
      return { capa: k + 1, patron, x, y, z: zTcp, theta, o, bx, by, wx, wy, wz: zTcp + suelo, r: Math.hypot(wx, wy) };
    });
    capa.sort((a, b) => b.r - a.r); // primero las más lejanas al robot
    places.push(...capa);
  });

  // verificaciones aproximadas
  const adv = [...notas];
  const alcance = robot.alcance_mm;
  const rPick = Math.hypot(...pickXY);
  const rMax = Math.max(...places.map((c) => c.r), rPick);
  const rMin = Math.min(...places.map((c) => c.r), rPick);
  const zTcpMax = Math.max(...places.map((c) => c.wz));
  const zBridaMax = zTcpMax + mov.aproximacion_mm + garra.largo_tcp_mm;
  if (rMax > alcance - 100)
    adv.push(`Distancia horizontal máxima ${rMax.toFixed(0)} mm cerca o fuera del alcance (${alcance} mm).`);
  if (rMin < 700) adv.push(`Hay un punto a solo ${rMin.toFixed(0)} mm de la base: riesgo de colisión con el robot.`);
  const carga = garra.masa_kg + caja.masa_kg;
  if (carga > robot.carga_max_kg)
    adv.push(`Carga ${carga} kg (garra + caja) supera la capacidad de ${robot.carga_max_kg} kg.`);
  adv.push(
    `La brida debe subir hasta ${zBridaMax.toFixed(0)} mm sobre la base del robot (última capa + aproximación). ` +
    "Comprueba la alcanzabilidad de la última capa en RobotStudio; si no llega, sube base_z_mm " +
    "(pedestal) o reduce capas / aproximación.");

  return {
    spec, capas, places, esquina, suelo, pickXY,
    checks: { rMax, rMin, rPick, zTcpMax, zBridaMax, carga },
    advertencias: adv,
  };
}

// ------------------------------------------------------------------ RAPID

/** RAPID solo admite ISO-8859-1 de forma fiable: quitar tildes y eñes. */
export const asciiRapid = (s) => s.normalize("NFKD").replace(/[^\x00-\x7f]/g, "");

const trim0 = (s) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
export const f = (v) => (Math.abs(v) > 1e-9 ? trim0(v.toFixed(1)) : "0");
const fq = (v) => (Math.abs(v) > 1e-9 ? trim0(v.toFixed(6)) : "0");

export function generarRapid(d) {
  const s = d.spec;
  const { caja, garra, movimiento: mov, conveyor: cv, pallet: p } = s;
  const places = d.places;
  const n = places.length;
  const q = (v) => v.map(fq).join(",");
  const [ex, ey] = d.esquina;
  const [px, py] = d.pickXY;
  const zc = cv.altura_mm + d.suelo;
  const filas = [];
  let capaActual = null;
  places.forEach((c, i) => {
    if (c.capa !== capaActual) {
      capaActual = c.capa;
      filas.push(`    ! capa ${c.capa} (mosaico ${c.patron})`);
    }
    filas.push(`    [${f(c.x)},${f(c.y)},${f(c.z)},${f(c.theta)}]${i < n - 1 ? "," : ""}`);
  });
  const porCapa = Array.from({ length: s.capas }, (_, k) => places.filter((c) => c.capa === k + 1).length).join(", ");
  return asciiRapid(`MODULE MPaletizado
    !***********************************************************
    ! Celda: ${s.nombre}
    ! ${s.descripcion || ""}
    ! Robot: ${s.robot.modelo}
    ! Generado por el generador de paletizado - no editar a mano,
    ! cambia la celda y vuelve a generar.
    !
    ! Cajas por capa: ${porCapa}  (total ${n})
    ! Señales necesarias (EIO_paletizado.cfg):
    !   doNewBox  -> crea una caja nueva en el conveyor (Smart Component Source)
    !   doVacuum  -> 1 = coge la caja (Attacher), 0 = la suelta (Detacher)
    !***********************************************************

    ! Garra de vacío: TCP en la cara de las ventosas, Z hacia abajo
    PERS tooldata tGarra := [TRUE,[[0,0,${f(garra.largo_tcp_mm)}],[1,0,0,0]],[${f(garra.masa_kg)},[0,0,${f(garra.largo_tcp_mm / 2)}],[1,0,0,0],0,0,0]];
    ! Carga de una caja, centro de gravedad en el centro de la caja (bajo el TCP)
    PERS loaddata lCaja := [${f(caja.masa_kg)},[0,0,${f(caja.alto_mm / 2)}],[1,0,0,0],0,0,0];

    ! Pallet: origen en la esquina del pallet a nivel de suelo
    TASK PERS wobjdata wPallet := [FALSE,TRUE,"",[[${f(ex)},${f(ey)},${f(d.suelo)}],[${q(quatZ(p.rotacion_deg))}]],[[0,0,0],[1,0,0,0]]];
    ! Conveyor: origen en el punto de pick sobre la cinta, X en el sentido de avance
    TASK PERS wobjdata wConveyor := [FALSE,TRUE,"",[[${f(px)},${f(py)},${f(zc)}],[${q(quatZ(cv.direccion_deg))}]],[[0,0,0],[1,0,0,0]]];

    CONST jointtarget jHome := [[0,0,0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    ! Pick: TCP en la cara superior de la caja
    CONST robtarget pPick := [[0,0,${f(caja.alto_mm)}],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    ! Plantilla de place; la posición y el giro se rellenan desde nPlace
    CONST robtarget pPlaceBase := [[0,0,0],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];

    CONST num nAprox := ${f(mov.aproximacion_mm)};
    CONST num nTotal := ${n};
    ! Posiciones de place en wPallet: [x, y, z TCP, giro garra en grados]
    CONST num nPlace{${n},4} := [
${filas.join("\n")}
    ];

    PROC main()
        ConfJ\\Off;
        ConfL\\Off;
        Reset doVacuum;
        GripLoad load0;
        MoveAbsJ jHome\\NoEOffs, ${mov.vel_rapida}, z50, tGarra;
        FOR i FROM 1 TO nTotal DO
            CogerCaja;
            DejarCaja i;
        ENDFOR
        MoveAbsJ jHome\\NoEOffs, ${mov.vel_rapida}, z50, tGarra;
        TPWrite "Pallet completo: " \\Num:=nTotal;
    ENDPROC

    PROC CogerCaja()
        PulseDO\\PLength:=0.2, doNewBox;
        MoveJ Offs(pPick,0,0,nAprox), ${mov.vel_rapida}, z50, tGarra\\WObj:=wConveyor;
        MoveL pPick, ${mov.vel_lenta}, fine, tGarra\\WObj:=wConveyor;
        Set doVacuum;
        GripLoad lCaja;
        WaitTime 0.2;
        MoveL Offs(pPick,0,0,nAprox), ${mov.vel_aprox}, z50, tGarra\\WObj:=wConveyor;
    ENDPROC

    PROC DejarCaja(num idx)
        VAR robtarget pT;
        pT := pPlaceBase;
        pT.trans := [nPlace{idx,1}, nPlace{idx,2}, nPlace{idx,3}];
        pT.rot := OrientZYX(nPlace{idx,4}, 0, 180);
        MoveJ Offs(pT,0,0,nAprox), ${mov.vel_rapida}, z50, tGarra\\WObj:=wPallet;
        MoveL pT, ${mov.vel_lenta}, fine, tGarra\\WObj:=wPallet;
        Reset doVacuum;
        GripLoad load0;
        WaitTime 0.2;
        MoveL Offs(pT,0,0,nAprox), ${mov.vel_aprox}, z50, tGarra\\WObj:=wPallet;
    ENDPROC
ENDMODULE
`);
}

export const EIO = `EIO:CFG_1.0:6:1::
#
EIO_SIGNAL:

      -Name "doVacuum" -SignalType "DO"

      -Name "doNewBox" -SignalType "DO"
`;

// ------------------------------------------------------------------ estación

/** Caja alineada a ejes definida por su centro en XY y su base z0 -> [x0,y0,z0,lx,ly,lz]. */
const cajaMundo = (cx, cy, z0, lx, ly, lz) => [cx - lx / 2, cy - ly / 2, z0, lx, ly, lz];
const girarDims = (lx, ly, deg) => (Math.round(deg) % 180 ? [ly, lx] : [lx, ly]);

/** Partes de la estación: {nombre, color:[r,g,b], t:[x,y,z], oculto, cajas:[[x0,y0,z0,lx,ly,lz]]}. */
export function generarGeometria(d) {
  const s = d.spec;
  const { conveyor: cv, pallet: p, caja, garra } = s;
  const suelo = d.suelo;
  const partes = [];
  const parte = (nombre, color, t, oculto, cajas) => partes.push({ nombre, color, t, oculto, cajas });

  if ((s.robot.base_z_mm || 0) > 0) parte("Pedestal", [90, 90, 90], [0, 0, 0], false, [cajaMundo(0, 0, suelo, 900, 900, -suelo)]);

  // Conveyor: cinta, patas y tope
  const [ex, ey] = cv.fin_xy_mm;
  const cdir = cv.direccion_deg;
  const [ux, uy] = rot2(1, 0, cdir);
  const L = cv.largo_mm, W = cv.ancho_mm, H = cv.altura_mm;
  const mx = ex - (ux * L) / 2, my = ey - (uy * L) / 2;
  const [lx, ly] = girarDims(L, W, cdir);
  const cinta = [cajaMundo(mx, my, suelo + H - 100, lx, ly, 100)];
  for (const a of [-L / 2 + 60, L / 2 - 60])
    for (const b of [-W / 2 + 40, W / 2 - 40]) {
      const [ox, oy] = rot2(a, b, cdir);
      cinta.push(cajaMundo(mx + ox, my + oy, suelo, 80, 80, H - 100));
    }
  const [tlx, tly] = girarDims(20, W, cdir);
  parte("Conveyor", [60, 60, 70], [0, 0, 0], false, cinta);
  parte("Conveyor_Tope", [200, 160, 0], [0, 0, 0], false, [cajaMundo(ex + ux * 10, ey + uy * 10, suelo + H, tlx, tly, 80)]);

  // Pallet tipo europeo simplificado: 3 tablas inferiores, 9 tacos, tablero superior
  const PL = p.largo_mm, PW = p.ancho_mm, PH = p.alto_mm;
  const [pcx, pcy] = p.centro_xy_mm;
  const prot = p.rotacion_deg;
  const cuerpos = [];
  const hTabla = 22, hTablero = 44, hTaco = PH - hTabla - hTablero;
  for (const j of [50, PW / 2, PW - 50]) {
    let [ox, oy] = rot2(0, j - PW / 2, prot);
    let [dx, dy] = girarDims(PL, 100, prot);
    cuerpos.push(cajaMundo(pcx + ox, pcy + oy, suelo, dx, dy, hTabla));
    for (const i of [72.5, PL / 2, PL - 72.5]) {
      [ox, oy] = rot2(i - PL / 2, j - PW / 2, prot);
      [dx, dy] = girarDims(145, 100, prot);
      cuerpos.push(cajaMundo(pcx + ox, pcy + oy, suelo + hTabla, dx, dy, hTaco));
    }
  }
  const [tdx, tdy] = girarDims(PL, PW, prot);
  cuerpos.push(cajaMundo(pcx, pcy, suelo + hTabla + hTaco, tdx, tdy, hTablero));
  parte("Pallet", [196, 150, 90], [0, 0, 0], false, cuerpos);

  // Caja plantilla en el punto de pick (la usa el Smart Component Source)
  const [px, py] = d.pickXY;
  const [clx, cly] = girarDims(caja.largo_mm, caja.ancho_mm, cdir);
  parte("Caja", [205, 160, 100], [px, py, suelo + H], false, [[-clx / 2, -cly / 2, 0, clx, cly, caja.alto_mm]]);

  // Garra: en su marco local Z va de la brida (0) a las ventosas (largo_tcp)
  const T = garra.largo_tcp_mm, cl = caja.largo_mm, ca = caja.ancho_mm;
  parte("Garra", [40, 90, 200], [0, -1600, suelo], false, [
    [-100, -100, 0, 200, 200, 40],                          // placa de brida
    [-40, -40, 40, 80, 80, Math.max(T - 120, 10)],          // mástil
    [-cl / 2 - 20, -ca / 2 - 20, T - 80, cl + 40, ca + 40, 60], // cuerpo de vacío
    [-cl / 2, -ca / 2, T - 20, cl, ca, 20],                 // ventosas / espuma
  ]);

  // Pallet lleno (oculto): sirve para revisar el mosaico sin simular
  parte("Vista_PalletLleno", [205, 160, 100], [0, 0, 0], true, d.places.map((c) => {
    const [dx, dy] = girarDims(c.bx, c.by, prot);
    return cajaMundo(c.wx, c.wy, c.wz - caja.alto_mm + 1, dx - 2, dy - 2, caja.alto_mm - 2);
  }));
  return partes;
}

export function generarEstacionTxt(d, partes) {
  const s = d.spec;
  const l = [
    "# Geometría de la celda para PaletizadoAddin (RobotStudio).",
    `# Celda: ${s.nombre}  -  robot ${s.robot.modelo} en el origen.`,
    "# PART <nombre> <r> <g> <b> <x> <y> <z> <oculto 0|1>   marco de la parte (mm, mundo)",
    "# BOX  <x0> <y0> <z0> <lx> <ly> <lz>                   caja alineada a ejes, relativa a la parte (mm)",
    `ROBOT ${s.robot.modelo}`,
  ];
  for (const pt of partes) {
    l.push(`PART ${pt.nombre} ${pt.color.join(" ")} ${pt.t.map(f).join(" ")} ${pt.oculto ? 1 : 0}`);
    for (const c of pt.cajas) l.push("BOX " + c.map(f).join(" "));
  }
  return l.join("\n") + "\n";
}

// ------------------------------------------------------------------ vista / resumen

/** Datos para la vista 3D (web/vista3d.js). */
export function datosVista(d, partes) {
  const s = d.spec;
  return {
    nombre: s.nombre, descripcion: s.descripcion || "", modelo: s.robot.modelo,
    alcance: s.robot.alcance_mm, suelo: d.suelo, alto_caja: s.caja.alto_mm,
    partes: partes.filter((p) => p.nombre !== "Vista_PalletLleno"),
    places: d.places.map((c) => {
      const [lx, ly] = girarDims(c.bx, c.by, s.pallet.rotacion_deg);
      return { x: c.wx, y: c.wy, z: c.wz, capa: c.capa, lx, ly };
    }),
  };
}

export function generarResumen(d) {
  const s = d.spec, ck = d.checks;
  const porCapa = new Map();
  for (const c of d.places) {
    const k = `${c.capa}|${c.patron}`;
    porCapa.set(k, (porCapa.get(k) || 0) + 1);
  }
  const altura = s.pallet.alto_mm + s.capas * s.caja.alto_mm;
  const out = [`# Resumen: ${s.nombre}`, "", s.descripcion || "", "",
    `- Robot: **${s.robot.modelo}** (alcance ${s.robot.alcance_mm} mm)`,
    `- Cajas totales: **${d.places.length}** en ${s.capas} capas`,
    `- Altura del pallet cargado: **${altura} mm** desde el suelo`,
    `- Carga en muñeca: ${ck.carga} kg (garra + caja)`,
    `- Distancia horizontal de pick: ${ck.rPick.toFixed(0)} mm; rango de place: ` +
    `${ck.rMin.toFixed(0)}-${ck.rMax.toFixed(0)} mm`,
    `- TCP más alto: ${ck.zTcpMax.toFixed(0)} mm; brida más alta (con aproximación): ` +
    `${ck.zBridaMax.toFixed(0)} mm sobre la base del robot`, "",
    "| Capa | Mosaico | Cajas |", "|---|---|---|"];
  for (const [k, n] of porCapa) {
    const [capa, pat] = k.split("|");
    out.push(`| ${capa} | ${pat} | ${n} |`);
  }
  out.push("", "## Advertencias", "", ...d.advertencias.map((a) => `- ${a}`));
  return out.join("\n") + "\n";
}

/** Genera todos los archivos de una celda. */
export function generarTodo(spec) {
  const d = calcular(spec);
  const partes = generarGeometria(d);
  return {
    datos: d,
    partes,
    vista: datosVista(d, partes),
    archivos: {
      "MPaletizado.mod": generarRapid(d),
      "EIO_paletizado.cfg": EIO,
      "estacion.txt": generarEstacionTxt(d, partes),
      "resumen.md": generarResumen(d),
    },
  };
}
