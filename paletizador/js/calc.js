/* Cálculos: mosaico de palet, layout de la celda, frames (workobjects), verificación de carga,
   ciclo y distancias de seguridad. Unidades: mm, kg, grados. */
window.PAL = window.PAL || {};

PAL.calc = (function () {
  const deg = (r) => (r * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;
  const r1 = (v) => Math.round(v * 10) / 10;

  /* ---------- Mosaico ---------- */
  function gridBoxes(x0, y0, cols, rows, sx, sy, dx, dy, rot) {
    const out = [];
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        out.push({ x: x0 + i * sx + dx / 2, y: y0 + j * sy + dy / 2, rot, dx, dy });
    return out;
  }

  /* Mejor arreglo de dos bloques (orientación 0° y 90°) dentro de un rectángulo. */
  function twoBlock(PL, PW, bl, bw, g) {
    const a = bl + g, b = bw + g;
    let best = { n: 0, boxes: [] };
    const tryIt = (boxes) => { if (boxes.length > best.n) best = { n: boxes.length, boxes }; };
    // División a lo largo de X
    for (let c1 = 0; c1 <= Math.floor((PL + g) / a); c1++) {
      const rows1 = Math.floor((PW + g) / b);
      const xr = PL + g - c1 * a;
      const cols2 = Math.floor(xr / b), rows2 = Math.floor((PW + g) / a);
      const boxes = gridBoxes(0, 0, c1, rows1, a, b, bl, bw, 0)
        .concat(gridBoxes(c1 * a, 0, cols2, rows2, b, a, bw, bl, 90));
      tryIt(boxes);
    }
    // División a lo largo de Y
    for (let r = 0; r <= Math.floor((PW + g) / b); r++) {
      const cols1 = Math.floor((PL + g) / a);
      const yr = PW + g - r * b;
      const rows2 = Math.floor(yr / a), cols2 = Math.floor((PL + g) / b);
      const boxes = gridBoxes(0, 0, cols1, r, a, b, bl, bw, 0)
        .concat(gridBoxes(0, r * b, cols2, rows2, b, a, bw, bl, 90));
      tryIt(boxes);
    }
    return best.boxes;
  }

  function columnBlock(PL, PW, bl, bw, g) {
    const a = bl + g, b = bw + g;
    const o0 = gridBoxes(0, 0, Math.floor((PL + g) / a), Math.floor((PW + g) / b), a, b, bl, bw, 0);
    const o90 = gridBoxes(0, 0, Math.floor((PL + g) / b), Math.floor((PW + g) / a), b, a, bw, bl, 90);
    return o0.length >= o90.length ? o0 : o90;
  }

  function centerOn(boxes, PL, PW, ov) {
    if (!boxes.length) return boxes;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    boxes.forEach((b) => {
      minx = Math.min(minx, b.x - b.dx / 2); maxx = Math.max(maxx, b.x + b.dx / 2);
      miny = Math.min(miny, b.y - b.dy / 2); maxy = Math.max(maxy, b.y + b.dy / 2);
    });
    const ox = (PL - (maxx - minx)) / 2 - minx, oy = (PW - (maxy - miny)) / 2 - miny;
    // El voladizo (ov) solo amplía el área útil; el centrado lo reparte de forma simétrica
    return boxes.map((b) => ({ ...b, x: r1(b.x + ox), y: r1(b.y + oy) }));
  }

  /* Orden de colocación con aproximación final desde (-X, -Y) del frame del palet (lado robot).
     Regla: al colocar P, ninguna caja ya colocada puede estar pegada a P por su lado -X o -Y
     (estaría en la trayectoria de aproximación). Se ordena topológicamente: si Q es vecina
     inmediata de P por -X/-Y, P va antes que Q. Desempate: más lejos del robot (Y alto), luego X alto. */
  function sortForPlacing(boxes, reach) {
    const R = (reach || 25) + 15;
    const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 1;
    const bb = (b) => ({ l: b.x - b.dx / 2, r: b.x + b.dx / 2, d: b.y - b.dy / 2, u: b.y + b.dy / 2 });
    const blocks = (q, p) => { // q está en la franja de aproximación de p
      const Q = bb(q), P = bb(p);
      const left = Q.r <= P.l + 1 && P.l - Q.r < R && ov(Q.d, Q.u, P.d, P.u);
      const below = Q.u <= P.d + 1 && P.d - Q.u < R && ov(Q.l, Q.r, P.l, P.r);
      return left || below;
    };
    const rest = boxes.slice(), out = [];
    while (rest.length) {
      const free = rest.filter((p) => !rest.some((r) => r !== p && blocks(p, r)));
      const pool = free.length ? free : rest;
      pool.sort((p, q) => (Math.abs(q.y - p.y) > 1 ? q.y - p.y : q.x - p.x));
      const pick = pool[0];
      out.push(pick);
      rest.splice(rest.indexOf(pick), 1);
    }
    return out;
  }

  function pattern(cfg) {
    const PL = cfg.palletL, PW = cfg.palletW, ov = cfg.overhang, g = cfg.gap;
    const UL = PL + 2 * ov, UW = PW + 2 * ov;
    let bl = cfg.boxL, bw = cfg.boxW;
    let base = cfg.patternType === "columna" ? columnBlock(UL, UW, bl, bw, g) : twoBlock(UL, UW, bl, bw, g);
    base = centerOn(base, PL, PW, ov);
    const layerA = sortForPlacing(base, cfg.approachXY);
    let layerB, warn = null;
    if (cfg.patternType === "columna") layerB = layerA;
    else if (cfg.patternType === "espejo") layerB = sortForPlacing(base.map((b) => ({ ...b, y: r1(PW - b.y) })), cfg.approachXY);
    else layerB = sortForPlacing(base.map((b) => ({ ...b, x: r1(PL - b.x), y: r1(PW - b.y) })), cfg.approachXY);

    const same = layerA.every((b) => layerB.some((c) => Math.abs(c.x - b.x) < 1 && Math.abs(c.y - b.y) < 1 && c.rot === b.rot));
    if (cfg.patternType !== "columna" && same)
      warn = "El mosaico resultante es simétrico: la capa B queda igual a la A y no hay traba entre capas. Considera ajustar medidas, separación o usar lámina separadora (slip sheet).";

    const usableH = cfg.maxStackH - cfg.palletH;
    const layers = Math.max(0, Math.min(cfg.maxLayers || 99, Math.floor(usableH / cfg.boxH)));
    const perLayer = layerA.length;
    let area = 0; layerA.forEach((b) => (area += b.dx * b.dy));
    const eff = (area / (PL * PW)) * 100;
    const totalW = perLayer * layers * cfg.boxWeight + cfg.palletMass;
    return {
      layerA, layerB, perLayer, layers, total: perLayer * layers, eff: r1(eff),
      stackH: cfg.palletH + layers * cfg.boxH, palletWeight: r1(totalW), warn
    };
  }

  /* Lista completa de colocaciones (capa, índice, X, Y, Z, Rz) en el frame del palet. */
  function placements(cfg, pat) {
    const list = [];
    for (let l = 0; l < pat.layers; l++) {
      const lay = l % 2 === 0 ? pat.layerA : pat.layerB;
      lay.forEach((b, i) => list.push({ layer: l + 1, idx: i + 1, x: b.x, y: b.y, z: r1((l + 1) * cfg.boxH), rz: b.rot }));
    }
    return list;
  }

  /* ---------- Layout de la celda ---------- */
  const PALLET_ANGLES = { 1: [90], 2: [90, -90], 3: [90, -90, 180], 4: [70, 135, -70, -135] };
  const INFEED_ANGLES = { 1: [0], 2: [18, -18], 3: [28, 0, -28], 4: [33, 11, -11, -33] };

  function frameFromPolar(theta, r) { return { x: r * Math.cos(rad(theta)), y: r * Math.sin(rad(theta)) }; }

  function layout(cfg, robot) {
    const R = robot.reach * 0.92;
    const warns = [];
    const a = cfg.palletL / 2 + cfg.overhang, b = cfg.palletW / 2 + cfg.overhang;
    const pallets = (PALLET_ANGLES[cfg.nOutfeed] || PALLET_ANGLES[2]).map((th, i) => {
      let rc = Math.sqrt(Math.max(0, R * R - a * a)) - b;
      const rMin = rc - b;
      if (rMin < 600) warns.push(`Palet ${i + 1}: el borde interior queda a ${Math.round(rMin)} mm de la base (mín. recomendado 600 mm). El robot es pequeño para este palet.`);
      if (rc <= 0) { rc = 600 + b; warns.push(`Palet ${i + 1}: fuera de alcance. Elige un robot con más alcance.`); }
      const c = frameFromPolar(th, rc);
      const u = { x: Math.cos(rad(th)), y: Math.sin(rad(th)) };
      const t = { x: Math.sin(rad(th)), y: -Math.cos(rad(th)) };
      const ox = c.x - (cfg.palletL / 2) * t.x - (cfg.palletW / 2) * u.x;
      const oy = c.y - (cfg.palletL / 2) * t.y - (cfg.palletW / 2) * u.y;
      const z = cfg.outfeedH + cfg.palletH - cfg.pedestalH;
      return { id: i + 1, theta: th, center: c, rc, frame: { x: r1(ox), y: r1(oy), z: r1(z), rz: r1(norm180(th - 90)) } };
    });
    // Comprobación de alcance vertical (pila completa + aproximación)
    const pickR = robot.reach * 0.6;
    const infeeds = (INFEED_ANGLES[cfg.nInfeed] || INFEED_ANGLES[1]).map((th, i) => {
      const c = frameFromPolar(th, pickR);
      const z = cfg.infeedH - cfg.pedestalH;
      // Origen en el tope final del transportador; X = sentido de flujo (hacia el robot)
      const u = { x: Math.cos(rad(th)), y: Math.sin(rad(th)) };
      const t = { x: Math.sin(rad(th)), y: -Math.cos(rad(th)) };
      const ox = c.x - (cfg.boxL / 2) * u.x - (cfg.boxW / 2) * t.x;
      const oy = c.y - (cfg.boxL / 2) * u.y - (cfg.boxW / 2) * t.y;
      return { id: i + 1, theta: th, center: c, frame: { x: r1(ox), y: r1(oy), z: r1(z), rz: r1(norm180(th + 180)) } };
    });
    // Solapes entre estaciones
    const all = pallets.map((p) => ({ c: p.center, r: Math.hypot(a, b), n: "Palet " + p.id }))
      .concat(infeeds.map((f) => ({ c: f.center, r: Math.hypot(cfg.boxL, cfg.boxW) / 2 + 150, n: "Infeed " + f.id })));
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        if (Math.hypot(all[i].c.x - all[j].c.x, all[i].c.y - all[j].c.y) < (all[i].r + all[j].r) * 0.85)
          warns.push(`${all[i].n} y ${all[j].n} quedan muy cerca: revisa el layout en CAD.`);

    // Cerco perimetral
    let minx = -900, maxx = 900, miny = -900, maxy = 900;
    const grow = (x, y) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); };
    pallets.forEach((p) => { [[-a, -b], [a, -b], [a, b], [-a, b]].forEach(([dx, dy]) => {
      const th = rad(p.theta), t = { x: Math.sin(th), y: -Math.cos(th) }, u = { x: Math.cos(th), y: Math.sin(th) };
      grow(p.center.x + dx * t.x + dy * u.x, p.center.y + dx * t.y + dy * u.y); }); });
    infeeds.forEach((f) => grow(f.center.x, f.center.y));
    const m = 700;
    const fence = { x0: Math.round(minx - m), y0: Math.round(miny - m), x1: Math.round(maxx + m), y1: Math.round(maxy + m) };
    // El infeed atraviesa el cerco: se alarga hasta el borde
    const stackTop = cfg.outfeedH + cfg.maxStackH + cfg.approachZ - cfg.pedestalH;
    const heightReach = robot.reach * 0.75;
    if (stackTop > heightReach + 600)
      warns.push(`Altura de pila + aproximación (${Math.round(stackTop)} mm sobre la base) es exigente para el alcance vertical del robot; considera pedestal o un modelo mayor.`);
    return { pallets, infeeds, fence, warns, area: ((fence.x1 - fence.x0) * (fence.y1 - fence.y0)) / 1e6 };
  }

  function norm180(a) { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; }

  /* ---------- Orientaciones ---------- */
  function quatZ(rzDeg) {
    const h = rad(rzDeg) / 2;
    return [Math.cos(h), 0, 0, Math.sin(h)].map((v) => Math.round(v * 1e6) / 1e6);
  }

  function matToQuat(m) {
    const [[a, b, c], [d, e, f], [g, h, i]] = m;
    const tr = a + e + i;
    let w, x, y, z;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (h - f) / s; y = (c - g) / s; z = (d - b) / s; }
    else if (a > e && a > i) { const s = Math.sqrt(1 + a - e - i) * 2; w = (h - f) / s; x = 0.25 * s; y = (b + d) / s; z = (c + g) / s; }
    else if (e > i) { const s = Math.sqrt(1 + e - a - i) * 2; w = (c - g) / s; x = (b + d) / s; y = 0.25 * s; z = (f + h) / s; }
    else { const s = Math.sqrt(1 + i - a - e) * 2; w = (d - b) / s; x = (c + g) / s; y = (f + h) / s; z = 0.25 * s; }
    if (w < 0) { w = -w; x = -x; y = -y; z = -z; }
    return [w, x, y, z].map((v) => Math.round(v * 1e6) / 1e6);
  }

  /* Euler ZYX: R = Rz(A)·Ry(B)·Rx(C). KUKA = A,B,C; FANUC: W=C, P=B, R=A. */
  function matToZYX(m) {
    const B = Math.atan2(-m[2][0], Math.hypot(m[0][0], m[1][0]));
    const A = Math.atan2(m[1][0], m[0][0]);
    const C = Math.atan2(m[2][1], m[2][2]);
    return { A: r3(deg(A)), B: r3(deg(B)), C: r3(deg(C)) };
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;

  /* Frame por 3 puntos: P1 origen, P2 sobre +X, P3 en el plano XY lado +Y. */
  function frame3p(p1, p2, p3) {
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const nrm = (u) => { const l = Math.hypot(...u); if (l < 1e-6) throw new Error("Puntos coincidentes o alineados"); return u.map((v) => v / l); };
    const X = nrm(sub(p2, p1));
    const Z = nrm(cross(X, sub(p3, p1)));
    const Y = cross(Z, X);
    const m = [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
    const dX = Math.hypot(...sub(p2, p1)), dY = Math.abs(sub(p3, p1).reduce((s, v, k) => s + v * Y[k], 0));
    return { x: r3(p1[0]), y: r3(p1[1]), z: r3(p1[2]), q: matToQuat(m), e: matToZYX(m), tilt: r3(deg(Math.acos(Math.min(1, Math.abs(Z[2]))))), dX: r3(dX), dY: r3(dY) };
  }

  /* ---------- Verificaciones ---------- */
  function checks(cfg, robot, pat) {
    const grip = PAL.GRIPPERS[cfg.gripper];
    const gripMass = cfg.gripperMass || grip.mass;
    const load = gripMass + cfg.boxWeight * cfg.boxesPerPick;
    const cyclesH = (cfg.rate * cfg.nInfeed * 60) / cfg.boxesPerPick
      + (cfg.slipSheet ? (cfg.rate * cfg.nInfeed * 60) / Math.max(1, pat.perLayer) : 0);
    const capacity = robot.cph * (robot.axes === 6 ? 0.9 : 1) * (load > robot.payload * 0.7 ? 0.8 : 1);
    return {
      gripMass, load: r1(load), loadPct: r1((load / robot.payload) * 100),
      cyclesH: Math.round(cyclesH), capacity: Math.round(capacity), cyclePct: r1((cyclesH / capacity) * 100),
      cycleTime: r1(3600 / Math.max(1, cyclesH)),
      palletTime: pat.total ? r1((pat.total / (cfg.rate * cfg.nInfeed)) ) : 0
    };
  }

  /* ISO 13855: S = K·T + C */
  function safetyDistance(resolution, tTotalMs) {
    const T = tTotalMs / 1000;
    if (resolution <= 40) {
      const C = Math.max(0, 8 * (resolution - 14));
      let S = 2000 * T + C, K = 2000;
      if (S > 500) { S = Math.max(500, 1600 * T + C); K = 1600; }
      return { S: Math.round(Math.max(100, S)), K, C, type: "detección de mano/brazo (d ≤ 40 mm)" };
    }
    const C = 850;
    return { S: Math.round(1600 * T + C), K: 1600, C, type: "detección de cuerpo (multihaz)" };
  }

  return { pattern, placements, layout, quatZ, frame3p, checks, safetyDistance, norm180, r1 };
})();
