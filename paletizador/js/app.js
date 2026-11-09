/* Interfaz de usuario de PalletCell Designer */
(function () {
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString("es-CL");
  const STORE = "palletcell.cfg.v1";

  const DEF = {
    projectName: "Celda Paletizado L1",
    robotBrand: "ABB", robotModel: "IRB 460", robotCtrl: "IRC5",
    plcBrand: "Siemens", plcModel: "S7-1500F CPU 1516F-3 PN/DP", hmiModel: "WinCC Unified MTP1200 (12\")", protocol: "PROFINET",
    boxL: 400, boxW: 300, boxH: 250, boxWeight: 12, rate: 8,
    arrival: "rodillos", nInfeed: 1, infeedH: 800,
    palletType: "ISO 1200x1000 (Chile/industrial)", palletL: 1200, palletW: 1000, palletH: 150, palletMass: 25,
    maxStackH: 1800, maxLayers: 0, overhang: 0, gap: 5, patternType: "trabado", slipSheet: false,
    nOutfeed: 2, outfeedH: 350, palletSupply: "manual", palletExit: "manual",
    gripper: "vacio", gripperMass: 35, boxesPerPick: 1, toolTcpZ: 300, pedestalH: 0, approachZ: 150, approachXY: 25,
    doors: 1, robotStopTime: 450, lightCurtain: true, lcResolution: 400, lcResponse: 15, safetyPlcResponse: 25, scanner: false, robotSafe: true,
    ipPLC: "192.168.0.1", ipHMI: "192.168.0.10", ipRobot: "192.168.0.20", pnPLC: "plc-pal", pnRobot: "robot-pal",
    plcInStart: 100, plcOutStart: 100, kukaIOOffset: 1, kukaToolOut: 513, kukaToolIn: 513
  };
  const NUM = new Set(Object.keys(DEF).filter((k) => typeof DEF[k] === "number"));
  const BOOL = new Set(Object.keys(DEF).filter((k) => typeof DEF[k] === "boolean"));

  let cfg = load();
  let ctx = null, FILES = {};
  const viewSel = {};

  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s) return Object.assign({}, DEF, s); } catch (e) { /* sin almacenamiento */ }
    return Object.assign({}, DEF);
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(cfg)); } catch (e) { /* ignorar */ } }
  function toast(t) { let el = $(".toast"); if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); } el.textContent = t; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 1800); }

  /* ---------------- Formulario ---------------- */
  function fill(k, opts, val) {
    const el = $(`[data-k="${k}"]`);
    el.innerHTML = opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}">${esc(t)}</option>`; }).join("");
    const vals = opts.map((o) => (Array.isArray(o) ? o[0] : o));
    el.value = vals.includes(val) ? val : vals[0];
    return el.value;
  }
  function syncSelects() {
    fill("robotBrand", Object.keys(PAL.ROBOTS), cfg.robotBrand);
    const rb = PAL.ROBOTS[cfg.robotBrand];
    cfg.robotModel = fill("robotModel", Object.keys(rb.models), cfg.robotModel);
    cfg.robotCtrl = fill("robotCtrl", Object.keys(rb.controllers), cfg.robotCtrl);
    fill("plcBrand", Object.keys(PAL.PLCS), cfg.plcBrand);
    cfg.plcModel = fill("plcModel", Object.keys(PAL.PLCS[cfg.plcBrand].models), cfg.plcModel);
    cfg.hmiModel = fill("hmiModel", Object.keys(PAL.HMIS[cfg.plcBrand]), cfg.hmiModel);
    fill("arrival", Object.entries(PAL.ARRIVAL), cfg.arrival);
    fill("palletType", Object.keys(PAL.PALLETS), cfg.palletType);
    fill("palletSupply", Object.entries(PAL.PALLET_SUPPLY), cfg.palletSupply);
    fill("palletExit", Object.entries(PAL.PALLET_EXIT), cfg.palletExit);
    fill("gripper", Object.entries(PAL.GRIPPERS).map(([k, g]) => [k, g.name]), cfg.gripper);
    const m = rb.models[cfg.robotModel], c = rb.controllers[cfg.robotCtrl];
    $("#robotInfo").textContent = `${m.axes} ejes · ${m.payload} kg · alcance ${m.reach} mm · ~${m.cph} ciclos/h · ${c.sw} · ${c.lang}`;
  }
  function writeForm() {
    syncSelects();
    $$("[data-k]").forEach((el) => {
      const k = el.dataset.k;
      if (el.tagName === "SELECT" && el.options.length && !BOOL.has(k)) { if ([...el.options].some((o) => o.value == cfg[k])) el.value = cfg[k]; }
      else if (el.type === "checkbox") el.checked = !!cfg[k];
      else if (el.tagName !== "SELECT") el.value = cfg[k];
    });
  }
  function onChange(e) {
    const el = e.target, k = el.dataset.k;
    if (!k) return;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (NUM.has(k)) v = Number(v) || 0;
    const prev = cfg[k];
    cfg[k] = v;
    if (k === "robotBrand") { const rb = PAL.ROBOTS[v]; cfg.robotModel = suggestModel(v); cfg.robotCtrl = Object.keys(rb.controllers)[0]; }
    if (k === "plcBrand") {
      cfg.plcModel = Object.keys(PAL.PLCS[v].models).find((n) => PAL.PLCS[v].models[n].safety) || Object.keys(PAL.PLCS[v].models)[0];
      cfg.hmiModel = Object.keys(PAL.HMIS[v])[0];
      cfg.protocol = PAL.PLCS[v].nativeBus;
    }
    if (k === "palletType" && v !== "Personalizado") { const p = PAL.PALLETS[v]; cfg.palletL = p.L; cfg.palletW = p.W; cfg.palletH = p.H; }
    if (k === "gripper") cfg.gripperMass = PAL.GRIPPERS[v].mass;
    if (["robotBrand", "plcBrand", "palletType", "gripper", "robotModel", "robotCtrl"].includes(k) || prev === undefined) writeForm();
    save();
    schedule();
  }
  /* Modelo más pequeño (4 ejes primero) que cumpla carga +15% y alcance para el palet */
  function suggestModel(brand) {
    const models = PAL.ROBOTS[brand].models;
    const need = ((cfg.gripperMass || PAL.GRIPPERS[cfg.gripper].mass) + cfg.boxWeight) * 1.15;
    const minReach = Math.hypot(cfg.palletL / 2, cfg.palletW + 700) + 400;
    const ok = Object.keys(models).filter((n) => models[n].payload >= need && models[n].reach >= minReach)
      .sort((a, b) => (models[a].axes - models[b].axes) || (models[a].payload - models[b].payload));
    return ok[0] || Object.keys(models).sort((a, b) => models[b].payload - models[a].payload)[0];
  }
  let tmr = null;
  function schedule() { clearTimeout(tmr); tmr = setTimeout(generate, 150); }

  /* ---------------- Generación ---------------- */
  function generate() {
    const c = Object.assign({}, cfg);
    c.boxesPerPick = Number(c.boxesPerPick) === 2 ? 2 : 1;
    c.nInfeed = Number(c.nInfeed); c.nOutfeed = Number(c.nOutfeed); c.lcResolution = Number(c.lcResolution);
    const robot = PAL.ROBOTS[c.robotBrand].models[c.robotModel];
    const robotCat = PAL.ROBOTS[c.robotBrand];
    const pat = PAL.calc.pattern(c);
    const lay = PAL.calc.layout(c, robot);
    const checks = PAL.calc.checks(c, robot, pat);
    ctx = { cfg: c, robot, robotCat, pat, lay, checks, list: PAL.calc.placements(c, pat) };

    FILES = {};
    const put = (o) => Object.assign(FILES, o);
    put(PAL.genRobot.files(ctx));
    put(PAL.genPLC.files(ctx));
    const io = PAL.genPLC.ioList(ctx);
    FILES["plc/io_list.csv"] = ["Tipo;Nombre;Siemens;Allen-Bradley;Descripción"].concat(io.di.map((d) => `DI;${d.name};${d.s7};${d.ab};${d.desc}`), io.dq.map((d) => `DO;${d.name};${d.s7};${d.ab};${d.desc}`)).join("\r\n");
    put(PAL.genHMI.files(ctx));
    FILES["comunicacion/comunicacion.txt"] = PAL.genDocs.comm(ctx);
    FILES["comunicacion/mapa_senales.csv"] = PAL.genDocs.interfaceCSV(ctx);
    FILES["robot/workobjects_calibracion.txt"] = PAL.genDocs.wobjDoc(ctx);
    FILES["seguridad/concepto_seguridad.txt"] = PAL.genSafety.text(ctx);
    FILES["docs/guia_implementacion.txt"] = PAL.genDocs.guide(ctx);
    FILES["docs/lista_materiales.csv"] = PAL.genDocs.bom(ctx);
    FILES["docs/layout.svg"] = layoutSVG(ctx, { standalone: true });
    FILES["docs/mosaico_capaA.svg"] = patternSVG(ctx, ctx.pat.unitsA, "Capa A (impares)", true);
    FILES["docs/mosaico_capaB.svg"] = patternSVG(ctx, ctx.pat.unitsB, "Capa B (pares)", true);
    FILES["docs/posiciones_mosaico.csv"] = ["Capa;Toma;Cajas;Zonas;TCP X mm;TCP Y mm;Z mm;Rz °"].concat(ctx.list.map((p) => `${p.layer};${p.idx};${p.n};${p.zones};${p.x};${p.y};${p.z};${p.rz}`)).join("\r\n");
    FILES["config.json"] = JSON.stringify(cfg, null, 2);
    FILES["LEEME.txt"] = `Paquete generado por PalletCell Designer — ${c.projectName}\n\nEmpieza por docs/guia_implementacion.txt.\n\n` + Object.keys(FILES).sort().map((f) => "  " + f).join("\n") + "\n";

    renderAll();
  }

  /* ---------------- SVG: layout ---------------- */
  function rectPoly(cx, cy, e1, ha, e2, hb) {
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, r]) => [cx + s * ha * e1.x + r * hb * e2.x, cy + s * ha * e1.y + r * hb * e2.y]);
  }
  function rayExit(p, u, f) {
    let s = Infinity;
    if (u.x > 1e-9) s = Math.min(s, (f.x1 - p.x) / u.x); else if (u.x < -1e-9) s = Math.min(s, (f.x0 - p.x) / u.x);
    if (u.y > 1e-9) s = Math.min(s, (f.y1 - p.y) / u.y); else if (u.y < -1e-9) s = Math.min(s, (f.y0 - p.y) / u.y);
    return s;
  }
  function layoutSVG(ctx, opt) {
    const { cfg, lay, robot } = ctx;
    const F = lay.fence;
    const shapes = [], pts = [];
    const rad = (d) => (d * Math.PI) / 180;
    const P = (poly) => { pts.push(...poly); return poly; };
    const conv = [], pallets = [], curtains = [], frames = [], labels = [];

    lay.infeeds.forEach((f) => {
      const u = { x: Math.cos(rad(f.theta)), y: Math.sin(rad(f.theta)) }, t = { x: Math.sin(rad(f.theta)), y: -Math.cos(rad(f.theta)) };
      const stop = { x: f.center.x - (cfg.boxL / 2) * u.x, y: f.center.y - (cfg.boxL / 2) * u.y };
      const len = rayExit(stop, u, F) + 1500;
      conv.push({ poly: P(rectPoly(stop.x + (len / 2) * u.x, stop.y + (len / 2) * u.y, u, len / 2, t, cfg.boxW / 2 + 60)), box: rectPoly(f.center.x, f.center.y, u, cfg.boxL / 2, t, cfg.boxW / 2) });
      for (let k = 1; k <= 2; k++) { const c = { x: f.center.x + u.x * (cfg.boxL + 60) * k, y: f.center.y + u.y * (cfg.boxL + 60) * k }; conv[conv.length - 1]["q" + k] = rectPoly(c.x, c.y, u, cfg.boxL / 2, t, cfg.boxW / 2); }
      const lp = { x: stop.x + u.x * (len - 400), y: stop.y + u.y * (len - 400) };
      labels.push({ x: lp.x, y: lp.y, t: `INFEED ${f.id}`, a: 0 });
      frames.push({ o: f.frame, n: `IF${f.id}` });
    });
    lay.pallets.forEach((p) => {
      const u = { x: Math.cos(rad(p.theta)), y: Math.sin(rad(p.theta)) }, t = { x: Math.sin(rad(p.theta)), y: -Math.cos(rad(p.theta)) };
      const s = rayExit(p.center, u, F);
      const cross = { x: p.center.x + s * u.x, y: p.center.y + s * u.y };
      if (cfg.palletExit === "conveyor" || cfg.palletSupply === "conveyor") {
        const len = s + 1600;
        conv.push({ poly: P(rectPoly(p.center.x + (len / 2) * u.x, p.center.y + (len / 2) * u.y, u, len / 2, t, cfg.palletL / 2 + 50)) });
      }
      const pal = P(rectPoly(p.center.x, p.center.y, t, cfg.palletL / 2, u, cfg.palletW / 2));
      const boxes = ctx.pat.layerA.map((b) => {
        const x = b.x - cfg.palletL / 2, y = b.y - cfg.palletW / 2;
        const cx = p.center.x + x * t.x + y * u.x, cy = p.center.y + x * t.y + y * u.y;
        return rectPoly(cx, cy, t, b.dx / 2, u, b.dy / 2);
      });
      pallets.push({ pal, boxes, p });
      const w = cfg.palletL / 2 + 250;
      curtains.push({ a: [cross.x - w * t.x, cross.y - w * t.y], b: [cross.x + w * t.x, cross.y + w * t.y], c: cross });
      labels.push({ x: p.center.x, y: p.center.y, t: `PALET ${p.id}`, a: 0 });
      frames.push({ o: p.frame, n: `P${p.id}` });
    });
    let sheetPoly = null;
    if (lay.sheet) {
      const th = rad(lay.sheet.theta), u = { x: Math.cos(th), y: Math.sin(th) }, t = { x: Math.sin(th), y: -Math.cos(th) };
      sheetPoly = P(rectPoly(lay.sheet.center.x, lay.sheet.center.y, t, cfg.palletL / 2, u, cfg.palletW / 2));
      labels.push({ x: lay.sheet.center.x, y: lay.sheet.center.y, t: "LÁMINAS", a: 0 });
    }
    pts.push([F.x0, F.y0], [F.x1, F.y1], [-robot.reach, -robot.reach * 0.2], [robot.reach * 0.2, 0]);
    let minX = Math.min(...pts.map((q) => q[0])) - 300, maxX = Math.max(...pts.map((q) => q[0])) + 300;
    let minY = Math.min(...pts.map((q) => q[1])) - 300, maxY = Math.max(...pts.map((q) => q[1])) + 500;
    const W = maxX - minX, H = maxY - minY;
    const X = (x) => (x - minX).toFixed(0), Y = (y) => (maxY - y).toFixed(0);
    const poly = (pp, fill, stroke, sw, extra) => `<polygon points="${pp.map((q) => X(q[0]) + "," + Y(q[1])).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra || ""}/>`;
    const fs = Math.max(90, W / 55);
    const col = opt.standalone
      ? { robot: "#e8792b", pallet: "#c9a26b", box: "#7aa7d9", conv: "#9aa5b1", fence: "#55606b", curtain: "#e5b800", ink: "#1f2933", bg: "#ffffff", muted: "#66727f" }
      : { robot: "var(--robot)", pallet: "var(--pallet)", box: "var(--box)", conv: "var(--conv)", fence: "var(--fence)", curtain: "var(--curtain)", ink: "var(--ink)", bg: "var(--bg)", muted: "var(--muted)" };

    shapes.push(`<rect x="0" y="0" width="${W.toFixed(0)}" height="${H.toFixed(0)}" fill="${col.bg}"/>`);
    // Cerco
    shapes.push(`<rect x="${X(F.x0)}" y="${Y(F.y1)}" width="${F.x1 - F.x0}" height="${F.y1 - F.y0}" fill="none" stroke="${col.fence}" stroke-width="${fs / 4}" stroke-dasharray="${fs * 0.8} ${fs * 0.3}"/>`);
    // Puertas: en los puntos del cerco angularmente más alejados de estaciones y de otras puertas
    const busy = lay.pallets.map((p) => p.theta).concat(lay.infeeds.map((f) => f.theta), lay.sheet ? [lay.sheet.theta] : []);
    const sides = [
      { a: [F.x0, F.y0], b: [F.x1, F.y0], n: [0, 1] }, { a: [F.x1, F.y0], b: [F.x1, F.y1], n: [-1, 0] },
      { a: [F.x1, F.y1], b: [F.x0, F.y1], n: [0, -1] }, { a: [F.x0, F.y1], b: [F.x0, F.y0], n: [1, 0] }
    ];
    const cand = [];
    sides.forEach((s) => { for (let k = 4; k <= 16; k++) { const q = k / 20; cand.push({ x: s.a[0] + (s.b[0] - s.a[0]) * q, y: s.a[1] + (s.b[1] - s.a[1]) * q, s }); } });
    const angDist = (a, b) => Math.abs(PAL.calc.norm180(a - b));
    for (let d = 0; d < cfg.doors; d++) {
      let best = null, bestScore = -1;
      cand.forEach((c) => {
        const th = (Math.atan2(c.y, c.x) * 180) / Math.PI;
        const sc = Math.min(...busy.map((b) => angDist(th, b)));
        if (sc > bestScore) { bestScore = sc; best = c; }
      });
      busy.push((Math.atan2(best.y, best.x) * 180) / Math.PI);
      const s = best.s, len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      const tx = (s.b[0] - s.a[0]) / len, ty = (s.b[1] - s.a[1]) / len;
      const h1 = [best.x - 450 * tx, best.y - 450 * ty], h2 = [best.x + 450 * tx, best.y + 450 * ty];
      const leaf = [h1[0] + 900 * (0.5 * tx + 0.87 * s.n[0]), h1[1] + 900 * (0.5 * ty + 0.87 * s.n[1])];
      const lbl = [best.x - s.n[0] * fs * 1.6, best.y - s.n[1] * fs * 1.6];
      shapes.push(`<line x1="${X(h1[0])}" y1="${Y(h1[1])}" x2="${X(h2[0])}" y2="${Y(h2[1])}" stroke="${col.bg}" stroke-width="${fs / 2}"/>`);
      shapes.push(`<line x1="${X(h1[0])}" y1="${Y(h1[1])}" x2="${X(leaf[0])}" y2="${Y(leaf[1])}" stroke="${col.fence}" stroke-width="${fs / 5}"/>`);
      shapes.push(`<circle cx="${X(h2[0] - s.n[0] * 250)}" cy="${Y(h2[1] - s.n[1] * 250)}" r="${fs * 0.45}" fill="#c53030"/>`);
      shapes.push(`<text x="${X(lbl[0])}" y="${Y(lbl[1])}" font-size="${fs * 0.75}" fill="${col.ink}" text-anchor="middle">Puerta ${d + 1} (bloqueo)</text>`);
    }
    // Alcance
    shapes.push(`<circle cx="${X(0)}" cy="${Y(0)}" r="${robot.reach}" fill="none" stroke="${col.robot}" stroke-width="${fs / 8}" stroke-dasharray="${fs / 2} ${fs / 3}" opacity=".8"/>`);
    const lblA = [45, 135, -45, -135, 0, 90, -90, 180].map((a) => ({ a, d: Math.min(...busy.map((x) => angDist(a, x))) })).sort((p, q) => q.d - p.d)[0].a;
    shapes.push(`<text x="${X(robot.reach * 1.02 * Math.cos(rad(lblA)))}" y="${Y(robot.reach * 1.02 * Math.sin(rad(lblA)))}" font-size="${fs * 0.7}" fill="${col.robot}" text-anchor="${Math.cos(rad(lblA)) < -0.1 ? "end" : "start"}">alcance ${robot.reach} mm</text>`);
    conv.forEach((c) => {
      shapes.push(poly(c.poly, col.conv, col.fence, fs / 10, 'opacity=".55"'));
      if (c.box) { shapes.push(poly(c.box, col.box, col.ink, fs / 12)); if (c.q1) shapes.push(poly(c.q1, col.box, col.ink, fs / 14, 'opacity=".6"')); if (c.q2) shapes.push(poly(c.q2, col.box, col.ink, fs / 14, 'opacity=".4"')); }
    });
    if (sheetPoly) shapes.push(poly(sheetPoly, col.bg, col.ink, fs / 10, `stroke-dasharray="${fs / 3} ${fs / 6}"`));
    pallets.forEach((p) => { shapes.push(poly(p.pal, col.pallet, col.ink, fs / 10)); p.boxes.forEach((b) => shapes.push(poly(b, col.box, col.ink, fs / 18, 'opacity=".75"'))); });
    if (cfg.lightCurtain || cfg.scanner) curtains.forEach((c) => {
      shapes.push(`<line x1="${X(c.a[0])}" y1="${Y(c.a[1])}" x2="${X(c.b[0])}" y2="${Y(c.b[1])}" stroke="${col.curtain}" stroke-width="${fs / 2.5}"/>`);
      if (cfg.scanner) shapes.push(`<circle cx="${X(c.a[0])}" cy="${Y(c.a[1])}" r="${fs * 0.4}" fill="${col.curtain}"/>`);
    });
    // Robot
    shapes.push(`<circle cx="${X(0)}" cy="${Y(0)}" r="${Math.max(380, robot.reach * 0.17)}" fill="${col.robot}" stroke="${col.ink}" stroke-width="${fs / 10}"/>`);
    shapes.push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(robot.reach * 0.3)}" y2="${Y(0)}" stroke="${col.ink}" stroke-width="${fs / 5}"/>`);
    shapes.push(`<text x="${X(0)}" y="${+Y(0) + fs * 0.3}" font-size="${fs * 0.75}" fill="#fff" text-anchor="middle" font-weight="700">${esc(cfg.robotBrand)}</text>`);
    // Frames
    frames.forEach((fr) => {
      const a = rad(fr.o.rz), L = fs * 3;
      const ox = fr.o.x, oy = fr.o.y;
      shapes.push(`<line x1="${X(ox)}" y1="${Y(oy)}" x2="${X(ox + L * Math.cos(a))}" y2="${Y(oy + L * Math.sin(a))}" stroke="#d62828" stroke-width="${fs / 6}"/>`);
      shapes.push(`<line x1="${X(ox)}" y1="${Y(oy)}" x2="${X(ox - L * Math.sin(a))}" y2="${Y(oy + L * Math.cos(a))}" stroke="#2a9d34" stroke-width="${fs / 6}"/>`);
      shapes.push(`<circle cx="${X(ox)}" cy="${Y(oy)}" r="${fs / 4}" fill="${col.ink}"/>`);
      shapes.push(`<text x="${+X(ox) + fs * 0.3}" y="${+Y(oy) + fs}" font-size="${fs * 0.6}" fill="${col.ink}">${fr.n}</text>`);
    });
    labels.forEach((l) => shapes.push(`<text x="${X(l.x)}" y="${Y(l.y)}" font-size="${fs * 0.85}" font-weight="700" fill="${col.ink}" text-anchor="middle" paint-order="stroke" stroke="${col.bg}" stroke-width="${fs / 5}">${l.t}</text>`));
    // Cotas
    shapes.push(`<text x="${X((F.x0 + F.x1) / 2)}" y="${+Y(F.y0) + fs * 1.3}" font-size="${fs * 0.75}" fill="${col.muted}" text-anchor="middle">Cerco ${f1((F.x1 - F.x0) / 1000)} × ${f1((F.y1 - F.y0) / 1000)} m  ·  ${f1(lay.area)} m²</text>`);
    shapes.push(`<g transform="translate(${fs},${fs})"><line x1="0" y1="${fs * 2}" x2="${fs * 2}" y2="${fs * 2}" stroke="#d62828" stroke-width="${fs / 6}"/><line x1="0" y1="${fs * 2}" x2="0" y2="0" stroke="#2a9d34" stroke-width="${fs / 6}"/><text x="${fs * 2.2}" y="${fs * 2.2}" font-size="${fs * 0.6}" fill="${col.ink}">X</text><text x="${-fs * 0.2}" y="${-fs * 0.2}" font-size="${fs * 0.6}" fill="${col.ink}">Y  (base robot)</text></g>`);
    const head = opt.standalone ? `<?xml version="1.0" encoding="UTF-8"?>\n` : "";
    return `${head}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" font-family="Arial, sans-serif">${shapes.join("")}</svg>`;
  }

  /* ---------------- SVG: mosaico ---------------- */
  function patternSVG(ctx, units, title, standalone) {
    const { cfg } = ctx;
    const m = 160 + cfg.overhang;
    const W = cfg.palletL + 2 * m, H = cfg.palletW + 2 * m + 120;
    const X = (x) => (x + m).toFixed(1), Y = (y) => (cfg.palletW + m - y).toFixed(1);
    const c = standalone ? { pal: "#c9a26b", box: "#7aa7d9", ink: "#1f2933", bg: "#fff", muted: "#66727f" } : { pal: "var(--pallet)", box: "var(--box)", ink: "var(--ink)", bg: "var(--bg)", muted: "var(--muted)" };
    const s = [`<rect width="${W}" height="${H}" fill="${c.bg}"/>`];
    s.push(`<rect x="${X(0)}" y="${Y(cfg.palletW)}" width="${cfg.palletL}" height="${cfg.palletW}" fill="${c.pal}" stroke="${c.ink}" stroke-width="4"/>`);
    units.forEach((u, i) => {
      u.boxes.forEach((b) => s.push(`<rect x="${X(b.x - b.dx / 2)}" y="${Y(b.y + b.dy / 2)}" width="${b.dx}" height="${b.dy}" fill="${c.box}" stroke="${c.ink}" stroke-width="3" opacity=".9"/>`));
      if (u.n === 2) s.push(`<rect x="${X(u.x - u.dx / 2 + 12)}" y="${Y(u.y + u.dy / 2 - 12)}" width="${u.dx - 24}" height="${u.dy - 24}" fill="none" stroke="${c.ink}" stroke-width="5" stroke-dasharray="18 10"/>`);
      // TCP y sentido de la herramienta (eje X = zona A)
      const a = (u.rz * Math.PI) / 180, len = Math.min(140, ctx.cfg.boxL * 0.35);
      s.push(`<line x1="${X(u.tx)}" y1="${Y(u.ty)}" x2="${X(u.tx + len * Math.cos(a))}" y2="${Y(u.ty + len * Math.sin(a))}" stroke="#d62828" stroke-width="6" opacity=".8"/>`);
      s.push(`<circle cx="${X(u.tx)}" cy="${Y(u.ty)}" r="10" fill="#d62828"/>`);
      const lb = u.boxes[0];
      s.push(`<text x="${X(lb.x)}" y="${+Y(lb.y) + 14}" font-size="40" font-weight="700" text-anchor="middle" fill="${c.ink}">${i + 1}</text>`);
    });
    s.push(`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(220)}" y2="${Y(0)}" stroke="#d62828" stroke-width="8"/><line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(220)}" stroke="#2a9d34" stroke-width="8"/>`);
    s.push(`<text x="${X(230)}" y="${+Y(0) + 12}" font-size="34" fill="#d62828">X</text><text x="${+X(0) - 30}" y="${Y(230)}" font-size="34" fill="#2a9d34">Y</text>`);
    s.push(`<text x="${W / 2}" y="${H - 30}" font-size="38" text-anchor="middle" fill="${c.muted}">▼ lado del robot ▼   ·   ${esc(title)}   ·   n° = orden de toma · ● TCP → zona A</text>`);
    return `${standalone ? '<?xml version="1.0" encoding="UTF-8"?>\n' : ""}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif">${s.join("")}</svg>`;
  }

  /* ---------------- Paneles ---------------- */
  function kpi(v, l, cls) { return `<div class="kpi ${cls || ""}"><div class="v">${v}</div><div class="l">${l}</div></div>`; }

  function renderSummary() {
    const { cfg, pat, checks, lay, robot } = ctx;
    const msgs = [];
    if (checks.loadPct > 100) msgs.push(["bad", `Carga ${checks.load} kg supera la capacidad del robot (${robot.payload} kg).`]);
    else if (checks.loadPct > 85) msgs.push(["warn", `Carga al ${checks.loadPct}% de la capacidad: revisar diagrama de carga con inercias.`]);
    else msgs.push(["ok", `Carga ${checks.load} kg (${checks.loadPct}% de ${robot.payload} kg).`]);
    if (checks.cyclePct > 100) msgs.push(["bad", `Se requieren ${checks.cyclesH} ciclos/h y el robot entrega ~${checks.capacity}: no alcanza. Usa toma múltiple, otro robot o menos infeeds.`]);
    else if (checks.cyclePct > 80) msgs.push(["warn", `Uso de ciclo ${checks.cyclePct}%: poco margen (recomendado < 80%).`]);
    else msgs.push(["ok", `Uso de ciclo ${checks.cyclePct}% (${checks.cyclesH} de ~${checks.capacity} ciclos/h).`]);
    if (!pat.perLayer) msgs.push(["bad", "La caja no cabe en el palet."]);
    if (pat.warn) msgs.push(["warn", pat.warn]);
    lay.warns.forEach((w) => msgs.push(["warn", w]));
    const S = cfg.plcBrand === "Siemens";
    if ((S && cfg.protocol !== "PROFINET") || (!S && cfg.protocol !== "EtherNet/IP")) msgs.push(["warn", `${cfg.protocol} no es el bus nativo de ${cfg.plcBrand}: necesitarás un gateway.`]);
    if (!PAL.PLCS[cfg.plcBrand].models[cfg.plcModel].safety) msgs.push(["warn", "La CPU elegida no es de seguridad: agrega relé/PLC de seguridad o elige una CPU F / GuardLogix."]);
    if (cfg.palletSupply === "manual" && !cfg.lightCurtain && !cfg.scanner) msgs.push(["bad", "Estaciones con acceso manual sin cortina ni escáner: falta protección."]);
    if (pat.palletWeight > 1000) msgs.push(["warn", `Palet completo de ${pat.palletWeight} kg: verificar capacidad del transportador y de la grúa.`]);

    $("#t-sum").innerHTML = `
      <h2>${esc(cfg.projectName)}</h2>
      <div class="kpis">
        ${kpi(pat.perLayer, "cajas por capa")}${kpi(pat.picksPerLayer, "tomas por capa")}${kpi(pat.layers, "capas")}${kpi(pat.total, "cajas por palet")}
        ${kpi(pat.eff + "%", "ocupación de área", pat.eff > 85 ? "ok" : pat.eff > 70 ? "" : "warn")}
        ${kpi(pat.stackH + " mm", "altura palet lleno")}${kpi(f1(pat.palletWeight) + " kg", "peso palet lleno")}
        ${kpi(checks.loadPct + "%", "carga del robot", checks.loadPct > 100 ? "bad" : checks.loadPct > 85 ? "warn" : "ok")}
        ${kpi(checks.cyclePct + "%", "uso de ciclo", checks.cyclePct > 100 ? "bad" : checks.cyclePct > 80 ? "warn" : "ok")}
        ${kpi(checks.cycleTime + " s", "ciclo requerido")}${kpi(f1(checks.palletTime) + " min", "tiempo por palet")}
        ${kpi(f1(lay.area) + " m²", "área cercada")}${kpi(Object.keys(FILES).length, "archivos generados")}
      </div>
      <ul class="msgs">${msgs.map((m) => `<li class="${m[0]}">${esc(m[1])}</li>`).join("")}</ul>
      <div class="row2">
        <div><h4>Equipos</h4><table>
          <tr><th>Robot</th><td>${esc(cfg.robotBrand)} ${esc(cfg.robotModel)} · ${esc(cfg.robotCtrl)} (${robot.axes} ejes, ${robot.payload} kg, ${robot.reach} mm)</td></tr>
          <tr><th>PLC maestro</th><td>${esc(cfg.plcBrand)} ${esc(cfg.plcModel)} · ${esc(PAL.PLCS[cfg.plcBrand].software)}</td></tr>
          <tr><th>HMI</th><td>${esc(cfg.hmiModel)} · ${esc(PAL.HMIS[cfg.plcBrand][cfg.hmiModel].sw)}</td></tr>
          <tr><th>Comunicación</th><td>${esc(cfg.protocol)} · 64/64 bytes · seguridad ${esc(ctx.robotCat.safeBus[cfg.protocol])}</td></tr>
          <tr><th>Herramienta</th><td>${esc(PAL.GRIPPERS[cfg.gripper].name)} (${checks.gripMass} kg)</td></tr>
          <tr><th>Infeed</th><td>${cfg.nInfeed} × ${esc(PAL.ARRIVAL[cfg.arrival])} · ${cfg.rate} cajas/min c/u</td></tr>
          <tr><th>Outfeed</th><td>${cfg.nOutfeed} estación(es) · entrada: ${esc(PAL.PALLET_SUPPLY[cfg.palletSupply])} · salida: ${esc(PAL.PALLET_EXIT[cfg.palletExit])}</td></tr>
          <tr><th>Seguridad</th><td>${[cfg.lightCurtain && "cortinas de luz", cfg.scanner && "escáner láser", cfg.robotSafe && ctx.robotCat.safetyOption.split(" (")[0], `${cfg.doors} puerta(s) con bloqueo`].filter(Boolean).join(" · ")}</td></tr>
        </table></div>
        <div><h4>Layout</h4><div class="svgbox">${layoutSVG(ctx, {})}</div></div>
      </div>`;
  }

  function renderLayout() {
    const { lay, cfg } = ctx;
    $("#t-lay").innerHTML = `<h2>Layout de la celda (vista superior)</h2>
      <div class="legend"><span><i style="background:var(--robot)"></i>Robot y alcance</span><span><i style="background:var(--pallet)"></i>Palet</span><span><i style="background:var(--box)"></i>Producto</span><span><i style="background:var(--conv)"></i>Transportador</span><span><i style="background:var(--curtain)"></i>${cfg.scanner ? "Cortina/escáner" : "Cortina de luz"}</span><span><i style="background:#d62828"></i>X frame</span><span><i style="background:#2a9d34"></i>Y frame</span></div>
      <div class="svgbox">${layoutSVG(ctx, {})}</div>
      <h4>Estaciones (coordenadas en la base del robot)</h4>
      <table><tr><th>Estación</th><th>Ángulo</th><th>Centro X</th><th>Centro Y</th><th>Distancia</th><th>Frame origen (X, Y, Z, Rz)</th></tr>
      ${lay.pallets.map((p) => `<tr><td>Palet ${p.id}</td><td>${p.theta}°</td><td>${f1(p.center.x)}</td><td>${f1(p.center.y)}</td><td>${f1(p.rc)}</td><td class="mono">${p.frame.x}, ${p.frame.y}, ${p.frame.z}, ${p.frame.rz}°</td></tr>`).join("")}
      ${lay.infeeds.map((f) => `<tr><td>Infeed ${f.id}</td><td>${f.theta}°</td><td>${f1(f.center.x)}</td><td>${f1(f.center.y)}</td><td>${f1(Math.hypot(f.center.x, f.center.y))}</td><td class="mono">${f.frame.x}, ${f.frame.y}, ${f.frame.z}, ${f.frame.rz}°</td></tr>`).join("")}
      </table>
      <p class="hint">Disposición de referencia generada automáticamente para que todo quede dentro del 92% del alcance. Ajusta en CAD y luego actualiza los frames con la calibración real.</p>`;
  }

  function renderPattern() {
    const { pat, list, cfg } = ctx;
    const rows = list.filter((p) => p.layer <= 2);
    $("#t-pat").innerHTML = `<h2>Mosaico de palet</h2>
      <div class="kpis">${kpi(pat.perLayer, "cajas/capa")}${kpi(pat.picksPerLayer, "tomas/capa")}${kpi(pat.layers, "capas")}${kpi(pat.total, "total")}${kpi(pat.eff + "%", "área ocupada")}${kpi(pat.stackH + " mm", "altura")}${kpi(esc(pat.type), "mosaico usado")}</div>
      ${pat.warn ? `<ul class="msgs"><li>${esc(pat.warn)}</li></ul>` : ""}
      <div class="row2"><div><h4>Capa A — impares</h4><div class="svgbox">${patternSVG(ctx, pat.unitsA, "Capa A")}</div></div>
      <div><h4>Capa B — pares</h4><div class="svgbox">${patternSVG(ctx, pat.unitsB, "Capa B")}</div></div></div>
      <p class="hint">Números = orden de colocación (primero lo más lejano al robot). La aproximación final es diagonal desde −X/−Y (${cfg.approachXY} mm) y ${cfg.approachZ} mm en Z, para no rozar cajas ya puestas. Las posiciones son del TCP de la herramienta: ${pat.nPick === 2 ? "con pinza de 2 zonas, un par se toma al centro (zonas A+B) y una caja suelta sólo con la zona A, girando la herramienta para que la zona vacía no quede sobre cajas ya puestas" : "con pinza simple el TCP coincide con el centro de la caja"}. Se cargan en el PLC (DB_Pattern / PatA-PatB) y el PLC las envía al robot.</p>
      <h4>Posiciones (capas 1 y 2; el resto en posiciones_mosaico.csv)</h4>
      <div class="tblwrap"><table><tr><th>Capa</th><th>Toma</th><th>Cajas</th><th>Zonas</th><th>TCP X</th><th>TCP Y</th><th>Z</th><th>Rz °</th><th>Al PLC (X,Y,Z,Rz ×10)</th></tr>
      ${rows.map((p) => `<tr><td>${p.layer}</td><td>${p.idx}</td><td>${p.n}</td><td>${p.zones === 3 ? "A+B" : "A"}</td><td>${p.x}</td><td>${p.y}</td><td>${p.z}</td><td>${p.rz}</td><td class="mono">${Math.round(p.x * 10)}, ${Math.round(p.y * 10)}, ${Math.round(p.z * 10)}, ${Math.round(p.rz * 10)}</td></tr>`).join("")}</table></div>`;
  }

  function renderWobj() {
    const { lay, cfg } = ctx;
    const b = cfg.robotBrand;
    const items = lay.pallets.map((p) => ({ k: "P" + p.id, n: `Palet ${p.id}`, f: p.frame, L: Math.min(800, cfg.palletL - 100), Wd: Math.min(600, cfg.palletW - 100) }))
      .concat(lay.infeeds.map((f) => ({ k: "I" + f.id, n: `Infeed ${f.id}`, f: f.frame, L: 300, Wd: Math.max(150, cfg.boxW - 50) })));
    const fmt = (fr) => {
      if (b === "ABB") return `[FALSE,TRUE,"",[[${fr.x},${fr.y},${fr.z}],[${(fr.q || PAL.calc.quatZ(fr.rz)).join(",")}]],[[0,0,0],[1,0,0,0]]]`;
      const e = fr.e || { A: fr.rz, B: 0, C: 0 };
      if (b === "FANUC") return `X ${fr.x}  Y ${fr.y}  Z ${fr.z}  W ${e.C}  P ${e.B}  R ${e.A}`;
      return `{X ${fr.x}, Y ${fr.y}, Z ${fr.z}, A ${e.A}, B ${e.B}, C ${e.C}}`;
    };
    $("#t-wob").innerHTML = `<h2>Workobjects / frames de usuario</h2>
      <p class="hint">${b === "ABB" ? "wobjdata (uframe con cuaternión)" : b === "FANUC" ? "User Frames UFRAME (X Y Z W P R)" : "BASE_DATA (X Y Z A B C)"}. Valores nominales calculados del layout. Los frames de palet tienen origen en la esquina, X a lo largo del palet y Y alejándose del robot.</p>
      <div class="tblwrap"><table><tr><th>Estación</th><th>Valor nominal ${esc(b)}</th></tr>
      ${items.map((i) => `<tr><td>${i.n}</td><td class="mono">${esc(fmt(i.f))}</td></tr>`).join("")}</table></div>
      <h4>Calculadora de calibración por 3 puntos</h4>
      <p class="hint">Enseña con el TCP calibrado: P1 = origen, P2 = sobre el eje +X, P3 = sobre el lado +Y. Pega aquí las coordenadas (en la base del robot / World) y obtén el frame listo para el controlador y la desviación respecto al nominal.</p>
      <label>Estación <select id="wSel">${items.map((i) => `<option value="${i.k}">${i.n}</option>`).join("")}</select></label>
      <div class="calc" id="wPts"></div>
      <button id="wCalc" class="primary" style="margin-top:8px">Calcular frame</button>
      <div class="result" id="wRes">—</div>`;
    const sel = $("#wSel");
    const fillPts = () => {
      const it = items.find((i) => i.k === sel.value), a = (it.f.rz * Math.PI) / 180;
      const P = [[it.f.x, it.f.y, it.f.z], [it.f.x + it.L * Math.cos(a), it.f.y + it.L * Math.sin(a), it.f.z], [it.f.x - it.Wd * Math.sin(a), it.f.y + it.Wd * Math.cos(a), it.f.z]];
      $("#wPts").innerHTML = P.map((p, i) => ["X", "Y", "Z"].map((ax, j) => `<label>P${i + 1} ${ax}<input id="p${i}${j}" type="number" step="0.1" value="${Math.round(p[j] * 10) / 10}"></label>`).join("")).join("");
    };
    sel.onchange = fillPts; fillPts();
    $("#wCalc").onclick = () => {
      const it = items.find((i) => i.k === sel.value);
      const P = [0, 1, 2].map((i) => [0, 1, 2].map((j) => Number($(`#p${i}${j}`).value)));
      try {
        const fr = PAL.calc.frame3p(P[0], P[1], P[2]);
        const d = Math.hypot(fr.x - it.f.x, fr.y - it.f.y, fr.z - it.f.z), dr = PAL.calc.norm180(fr.e.A - it.f.rz);
        const status = d > 20 || Math.abs(dr) > 2 || fr.tilt > 0.5 ? "⚠ REVISAR montaje o puntos enseñados" : "✔ Dentro de tolerancia";
        $("#wRes").textContent = `${it.n} — ${b}\n${fmt(fr)}\n\nABB  : [[${fr.x},${fr.y},${fr.z}],[${fr.q.join(",")}]]\nFANUC: X ${fr.x} Y ${fr.y} Z ${fr.z} W ${fr.e.C} P ${fr.e.B} R ${fr.e.A}\nKUKA : {X ${fr.x}, Y ${fr.y}, Z ${fr.z}, A ${fr.e.A}, B ${fr.e.B}, C ${fr.e.C}}\n\nDesviación vs nominal: posición ${f1(d)} mm, giro ${f1(dr)}°, inclinación del plano ${fr.tilt}°\nDistancias P1-P2 ${fr.dX} mm, P3 al eje X ${fr.dY} mm\n${status}`;
      } catch (e) { $("#wRes").textContent = "Error: " + e.message; }
    };
  }

  function renderComm() {
    const { cfg } = ctx, I = PAL.iface;
    const tbl = (list, toRob) => `<div class="tblwrap"><table><tr><th>Byte.Bit</th><th>Nombre</th><th>Tipo</th><th>Descripción</th><th>${esc(cfg.plcBrand)}</th><th>${esc(cfg.robotBrand)}</th></tr>
      ${list.map((s) => { const r = I.robotAddr(cfg.robotBrand, toRob, s, cfg); return `<tr><td class="mono">${s.byte}${s.bit != null ? "." + s.bit : ""}</td><td class="mono">${s.name}</td><td>${s.type}${s.unit ? " [" + s.unit + "]" : ""}</td><td>${esc(s.desc)}</td><td class="mono">${esc(I.plcAddr(cfg.plcBrand, toRob, s, cfg))}</td><td class="mono">${esc(r.name)}${r.map ? " <small>(" + esc(r.map) + ")</small>" : ""}</td></tr>`; }).join("")}</table></div>`;
    $("#t-com").innerHTML = `<h2>Comunicación PLC (maestro) ↔ robot (esclavo)</h2>
      <div class="kpis">${kpi(esc(cfg.protocol), "protocolo")}${kpi("64 / 64", "bytes PLC→R / R→PLC")}${kpi(esc(cfg.ipPLC), "IP PLC")}${kpi(esc(cfg.ipRobot), "IP robot")}${kpi(esc(cfg.ipHMI), "IP HMI")}</div>
      <h4>PLC → Robot</h4>${tbl(I.PLC_TO_ROBOT, true)}
      <h4>Robot → PLC</h4>${tbl(I.ROBOT_TO_PLC, false)}
      <h4>Configuración y handshake</h4><pre class="src">${esc(FILES["comunicacion/comunicacion.txt"])}</pre>`;
  }

  function codeViewer(id, prefixes) {
    const names = Object.keys(FILES).filter((f) => prefixes.some((p) => f.startsWith(p)));
    if (!viewSel[id] || !names.includes(viewSel[id])) viewSel[id] = names[0];
    return `<div class="code"><div class="flist">${names.map((n) => `<button data-f="${esc(n)}" data-v="${id}" class="${n === viewSel[id] ? "on" : ""}">${esc(n.split("/").slice(1).join("/"))}</button>`).join("")}</div>
      <div class="viewer"><div class="bar"><strong class="mono">${esc(viewSel[id])}</strong><span><button data-copy="${esc(viewSel[id])}">Copiar</button> <button data-dl="${esc(viewSel[id])}">Descargar</button></span></div>
      <pre class="src">${esc(FILES[viewSel[id]] || "")}</pre></div></div>`;
  }

  function renderRobot() {
    const { cfg } = ctx;
    const tips = {
      ABB: "Carga PalletPLC.mod en T_ROB1 y EIO_PLC.cfg en la configuración de E/S (RobotStudio o FlexPendant). main() espera comandos del PLC.",
      FANUC: "Programas TP en formato ASCII (.LS). Cárgalos con la opción ASCII Upload o conviértelos en ROBOGUIDE. PAL_MAIN es el programa a arrancar en remoto.",
      KUKA: "PalMain.src/.dat a R1\\Program. Las señales SIGNAL van en $config.dat. Arranque por Automático externo."
    };
    $("#t-rob").innerHTML = `<h2>Programa del robot — ${esc(cfg.robotBrand)} ${esc(cfg.robotModel)}</h2><p class="hint">${esc(tips[cfg.robotBrand])}</p>${codeViewer("rob", ["robot/"])}`;
  }

  /* ---------------- Simulador PackML ---------------- */
  const PM = PAL.PACKML;
  const ACTING = new Set([1, 3, 7, 8, 10, 12, 13, 14, 15, 16]);
  const GRID = { 15: [0, 0], 4: [1, 0], 3: [2, 0], 6: [3, 0], 16: [4, 0], 17: [5, 0],
    14: [2, 1], 5: [3, 1], 13: [4, 1], 12: [2, 2], 11: [3, 2], 10: [4, 2],
    2: [0, 3], 7: [1, 3], 1: [2, 3], 9: [3, 3], 8: [4, 3] };
  const sim = { state: 2, mode: 1, since: Date.now(), cond: { estop: false, starve: false, fault: false }, pallets: [], active: 0, lastBox: Date.now(), boxes: 0, hmiScreen: "01", log: [] };
  function simReset() { sim.pallets = ctx.lay.pallets.map(() => ({ n: 0, done: false, swapAt: 0 })); }
  function go(s) { if (s !== sim.state) { sim.log.unshift(`${new Date().toLocaleTimeString()}  ${PM.states[sim.state]} → ${PM.states[s]}`); sim.log = sim.log.slice(0, 8); sim.state = s; sim.since = Date.now(); } }
  function cmd(c) {
    const t = PM.onCommand[c] && PM.onCommand[c][sim.state];
    if (t == null) return;
    if (c === "Unhold" && sim.cond.fault) return;
    if (c === "Reset" && sim.cond.estop) return;
    go(t);
    paintSim(true);
  }
  function tick() {
    if (!ctx) return;
    if (sim.pallets.length !== ctx.lay.pallets.length) simReset();
    const now = Date.now(), dt = now - sim.since;
    if (sim.cond.estop && sim.state !== 8 && sim.state !== 9) go(8);
    else if (sim.cond.fault && [6, 5, 13, 14].includes(sim.state)) go(10);
    else if (sim.state === 6 && sim.cond.starve) go(13);
    else if (sim.state === 5 && !sim.cond.starve && dt > 800) go(14);
    else if (ACTING.has(sim.state) && dt > 1200) {
      if (!(sim.state === 1 && sim.cond.estop)) go(PM.onComplete[sim.state]);
    }
    // Producción simulada (x4 velocidad)
    const total = ctx.pat.total || 1;
    sim.pallets.forEach((p) => { if (p.done && p.swapAt && now > p.swapAt) { p.n = 0; p.done = false; p.swapAt = 0; } });
    if (sim.state === 6 && now - sim.lastBox > Math.max(250, (ctx.checks.cycleTime * 1000) / 4)) {
      sim.lastBox = now;
      let i = sim.pallets.findIndex((p, k) => k === sim.active && !p.done);
      if (i < 0) i = sim.pallets.findIndex((p) => !p.done);
      if (i >= 0) {
        sim.active = i; const p = sim.pallets[i]; const add = Math.min(ctx.pat.nPick, total - p.n); p.n += add; sim.boxes += add;
        if (p.n >= total) { p.done = true; p.swapAt = now + 6000; }
      }
    }
    paintSim();
  }
  function pmlSVG() {
    const w = 150, h = 54, gx = 18, gy = 26;
    const s = [];
    Object.entries(GRID).forEach(([st, [c, r]]) => {
      st = Number(st);
      const x = 10 + c * (w + gx), y = 10 + r * (h + gy), cur = st === sim.state;
      const fill = cur ? (st === 6 ? "#2e8b57" : st === 9 || st === 8 ? "#c53030" : st === 11 || st === 5 ? "#d69e2e" : "#2b6cb0") : "transparent";
      s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${ACTING.has(st) ? 24 : 4}" fill="${fill}" stroke="var(--ink)" stroke-width="${cur ? 3 : 1.2}" ${ACTING.has(st) ? 'stroke-dasharray="5 3"' : ""}/>`);
      s.push(`<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="15" font-weight="${cur ? 700 : 400}" fill="${cur ? "#fff" : "var(--ink)"}">${PM.states[st]} (${st})</text>`);
    });
    return `<svg viewBox="0 0 ${10 + 6 * (w + gx)} ${10 + 4 * (h + gy)}" font-family="system-ui, sans-serif">${s.join("")}</svg>`;
  }
  function pmlButtons(cls) {
    return Object.keys(PM.onCommand).map((c) => {
      const ok = PM.onCommand[c][sim.state] != null && !(c === "Unhold" && sim.cond.fault) && !(c === "Reset" && sim.cond.estop);
      return `<button data-cmd="${c}" ${ok ? "" : "disabled"} class="${cls || ""}">${c}</button>`;
    }).join("");
  }
  function stateCls(s) { return s === 6 ? "exe" : [5, 11, 13, 10].includes(s) ? "amb" : [8, 9].includes(s) ? "red" : [4, 15, 3].includes(s) ? "blu" : ""; }

  function renderPLC() {
    const { cfg } = ctx;
    $("#t-plc").innerHTML = `<h2>Lógica PLC con PackML — ${esc(cfg.plcBrand)} ${esc(cfg.plcModel)}</h2>
      <p class="hint">El PLC es el maestro: la máquina de estados PackML decide cuándo el robot puede trabajar, el secuenciador elige el infeed y la estación, calcula la posición del mosaico y la envía al robot con handshake. Simula el comportamiento abajo (las transiciones son las mismas que en el código).</p>
      <div class="svgbox" id="pmlDiag"></div>
      <div class="pml-btns" id="pmlBtns"></div>
      <div class="pml-cond">
        <label><input type="checkbox" data-cond="estop"> Paro de emergencia</label>
        <label><input type="checkbox" data-cond="fault"> Falla robot / puerta abierta (→ Held)</label>
        <label><input type="checkbox" data-cond="starve"> Sin producto / sin palet (→ Suspended)</label>
      </div>
      <div class="result" id="pmlLog"></div>
      <h4>Código generado</h4>
      <p class="hint">${cfg.plcBrand === "Siemens" ? "TIA Portal: Fuentes externas → agregar 01..04 → 'Generar bloques desde la fuente' en orden. Crear antes los tags Robot_In/Robot_Out." : "Studio 5000: crear UDTs, importar el CSV de tags/alias y pegar cada rutina ST en el programa Palletizer."}</p>
      ${codeViewer("plc", ["plc/"])}`;
    $$("[data-cond]").forEach((el) => { el.checked = sim.cond[el.dataset.cond]; el.onchange = () => { sim.cond[el.dataset.cond] = el.checked; tick(); }; });
    paintSim(true);
  }

  function hmiBody() {
    const { cfg, lay, pat } = ctx;
    const scr = PAL.genHMI.screens(ctx);
    if (sim.hmiScreen === "02") return `<div class="card" style="grid-column:1/3"><h5>Control PackML</h5>${pmlSVG()}<div class="pml-btns">${pmlButtons()}</div>
      <div>Modo: <span class="badge b">${PM.modes[sim.mode]}</span></div></div>`;
    if (sim.hmiScreen !== "01") { const s = scr.find((x) => x.id === sim.hmiScreen); return `<div class="card" style="grid-column:1/3"><h5>${s.id} · ${esc(s.name)}</h5><p>${esc(s.desc)}</p></div>`; }
    const total = pat.total || 1;
    const alarms = [];
    if (sim.cond.estop) alarms.push("Paro de emergencia activado");
    if (sim.cond.fault) alarms.push("Falla activa en el robot / puerta abierta");
    if (sim.cond.starve) alarms.push("Celda suspendida: falta producto o palet");
    sim.pallets.forEach((p, i) => p.done && alarms.push(`Palet ${i + 1} completo: retirar`));
    return `<div class="card lay"><h5>Vista general</h5>${layoutSVG(ctx, { standalone: true })}</div>
      <div class="card"><h5>Estaciones</h5>
        ${lay.pallets.map((p, i) => { const s = sim.pallets[i] || { n: 0 }; const pct = Math.round((s.n / total) * 100); const lyr = Math.min(pat.layers, Math.floor(s.n / Math.max(1, pat.perLayer)) + 1);
          return `<div class="station"><b>Palet ${p.id}</b><div class="bar"><span style="width:${pct}%"></span></div><span>${s.done ? '<span class="badge a">LLENO</span>' : `${pct}%`}</span></div><div style="font-size:11px;margin:-4px 0 6px 76px;color:#555">capa ${lyr}/${pat.layers} · ${s.n}/${total} cajas ${sim.active === i && sim.state === 6 ? "· <b>llenando</b>" : ""}</div>`; }).join("")}
        <h5 style="margin-top:8px">Robot ${esc(cfg.robotBrand)}</h5>
        <div style="font-size:12px">Com. <b>${sim.cond.estop ? "—" : "OK"}</b> · ${sim.state === 6 ? "Ejecutando Pick&Place" : "En espera"} · ciclo ${ctx.checks.cycleTime} s</div>
        <h5 style="margin-top:8px">Producción</h5><div style="font-size:12px">Cajas: <b>${sim.boxes}</b> · Infeeds: ${lay.infeeds.map((f) => `<span class="badge ${sim.cond.starve ? "" : "b"}">IF${f.id}</span>`).join(" ")}</div>
        <h5 style="margin-top:8px">Alarmas</h5>${alarms.length ? alarms.map((a) => `<div class="alm">● ${esc(a)}</div>`).join("") : '<div style="color:#555">Sin alarmas</div>'}
      </div>`;
  }

  function renderHMI() {
    const { cfg } = ctx;
    const hmi = PAL.HMIS[cfg.plcBrand][cfg.hmiModel];
    const T = PAL.genHMI.tags(ctx), A = PAL.genHMI.alarms(ctx);
    $("#t-hmi").innerHTML = `<h2>HMI — ${esc(cfg.hmiModel)}</h2>
      <p class="hint">${esc(hmi.sw)} · ${hmi.res} · estilo ISA-101 (gris neutro, color sólo para anormalidad). Maqueta navegable conectada al simulador PackML.</p>
      <div class="hmi" id="hmiMock"></div>
      <div class="row2"><div><h4>Pantallas</h4><table>${PAL.genHMI.screens(ctx).map((s) => `<tr><th>${s.id}</th><td><b>${esc(s.name)}</b><br>${esc(s.desc)}</td></tr>`).join("")}</table></div>
      <div><h4>Alarmas</h4><div class="tblwrap"><table><tr><th>ID</th><th>Texto</th><th>Clase</th><th>Bit</th></tr>${A.map((a) => `<tr><td>${a.id}</td><td>${esc(a.text)}</td><td>${a.cls}</td><td class="mono">W${a.word}.${a.bit}</td></tr>`).join("")}</table></div>
      <h4>Tags (${T.length})</h4><div class="tblwrap" style="max-height:260px"><table><tr><th>Nombre</th><th>Dirección</th><th>Tipo</th></tr>${T.map((t) => `<tr><td class="mono">${t.name}</td><td class="mono">${esc(t.path)}</td><td>${t.type}</td></tr>`).join("")}</table></div></div></div>
      <h4>Archivos</h4>${codeViewer("hmi", ["hmi/"])}`;
    paintSim(true);
  }

  let simSig = "";
  function paintSim(force) {
    if (!ctx) return;
    const sig = [sim.state, sim.mode, sim.boxes, sim.hmiScreen, sim.active, JSON.stringify(sim.cond), sim.pallets.map((p) => p.n + (p.done ? "d" : "")).join(","), new Date().getMinutes()].join("|");
    if (!force && sig === simSig) return;
    simSig = sig;
    const d = $("#pmlDiag"); if (d) d.innerHTML = pmlSVG();
    const b = $("#pmlBtns"); if (b) b.innerHTML = pmlButtons();
    const l = $("#pmlLog"); if (l) l.textContent = `Estado: ${PM.states[sim.state]} (${sim.state})   Modo: ${PM.modes[sim.mode]}   Cajas: ${sim.boxes}\n` + sim.log.join("\n");
    const m = $("#hmiMock");
    if (m) {
      const scr = PAL.genHMI.screens(ctx).slice(0, 8);
      m.innerHTML = `<div class="hd"><b>▦ ${esc(ctx.cfg.projectName)}</b><span class="st ${stateCls(sim.state)}">${PM.states[sim.state].toUpperCase()}</span><span>Modo: <b>${PM.modes[sim.mode]}</b></span><span style="margin-left:auto">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span>👤 Operador</span></div>
        <div class="bd">${hmiBody()}</div>
        <div class="ft">${scr.map((s) => `<button data-scr="${s.id}" class="${s.id === sim.hmiScreen ? "cur" : ""}">${s.id} ${esc(s.name)}</button>`).join("")}<button data-cmd="Stop" style="margin-left:auto">■ Stop</button><button data-cmd="Reset">↺ Reset</button><button data-cmd="Start">▶ Start</button></div>`;
    }
  }

  function renderSafety() {
    const c = PAL.genSafety.concept(ctx);
    $("#t-saf").innerHTML = `<h2>Seguridad de la celda</h2>
      <div class="kpis">${kpi("PL d / Cat.3", "nivel requerido típico")}${kpi(c.dist.S + " mm", "distancia mín. cortina (ISO 13855)")}${kpi(c.tStop + " ms", "tiempo total de parada")}${kpi(esc(c.bus), "bus de seguridad")}</div>
      <div class="row2"><div><h4>Dispositivos</h4><table><tr><th>Cant.</th><th>Dispositivo</th></tr>${c.devices.map((d) => `<tr><td>${d.q}</td><td>${esc(d.item)}<br><small>${esc(d.note)}</small></td></tr>`).join("")}</table></div>
      <div><h4>Funciones de seguridad</h4><table><tr><th>ID</th><th>Función</th><th>Reacción</th><th>PL</th></tr>${c.sf.map((s) => `<tr><td>${s.id}</td><td><b>${esc(s.f)}</b><br><small>${esc(s.trig)}</small></td><td>${esc(s.react)}</td><td>${esc(s.pl)}</td></tr>`).join("")}</table></div></div>
      <h4>Concepto completo</h4><pre class="src">${esc(FILES["seguridad/concepto_seguridad.txt"])}</pre>`;
  }

  function renderDocs() {
    const names = Object.keys(FILES).sort();
    $("#t-doc").innerHTML = `<h2>Archivos del paquete (${names.length})</h2>
      <p class="hint">Descarga todo en un .zip con el botón de arriba o archivo por archivo. Empieza por docs/guia_implementacion.txt.</p>
      <div class="tblwrap" style="max-height:none"><table><tr><th>Archivo</th><th>Tamaño</th><th></th></tr>${names.map((n) => `<tr><td class="mono">${esc(n)}</td><td>${(new Blob([FILES[n]]).size / 1024).toFixed(1)} kB</td><td><button data-dl="${esc(n)}">Descargar</button> <button data-show="${esc(n)}">Ver</button></td></tr>`).join("")}</table></div>
      <h4>Guía de implementación</h4><pre class="src" id="docView">${esc(FILES["docs/guia_implementacion.txt"])}</pre>`;
  }

  function renderAll() {
    renderSummary(); renderLayout(); renderPattern(); renderWobj(); renderComm();
    renderRobot(); renderPLC(); renderHMI(); renderSafety(); renderDocs();
  }

  /* ---------------- Descargas ---------------- */
  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function zipAll() {
    const base = (cfg.projectName || "celda").replace(/[^\w\-]+/g, "_");
    if (!window.JSZip) { toast("Sin conexión a la librería ZIP: descargando archivos uno a uno"); Object.keys(FILES).forEach((n, i) => setTimeout(() => download(n.replace(/\//g, "_"), FILES[n]), i * 250)); return; }
    const z = new JSZip();
    Object.entries(FILES).forEach(([n, c]) => z.file(`${base}/${n}`, c));
    download(base + ".zip", await z.generateAsync({ type: "blob" }));
  }

  /* ---------------- Eventos ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-t]");
    if (!t) return;
    if (t.dataset.t) { $$(".tabs button").forEach((b) => b.classList.toggle("on", b === t)); $$(".panel").forEach((p) => p.classList.toggle("on", p.id === "t-" + t.dataset.t)); return; }
    if (t.dataset.f) { viewSel[t.dataset.v] = t.dataset.f; ({ rob: renderRobot, plc: renderPLC, hmi: renderHMI })[t.dataset.v](); return; }
    if (t.dataset.dl) { download(t.dataset.dl.split("/").pop(), FILES[t.dataset.dl]); return; }
    if (t.dataset.copy) { navigator.clipboard && navigator.clipboard.writeText(FILES[t.dataset.copy]).then(() => toast("Copiado")); return; }
    if (t.dataset.show) { $("#docView").textContent = FILES[t.dataset.show]; $("#docView").scrollIntoView({ behavior: "smooth" }); return; }
    if (t.dataset.cmd) { cmd(t.dataset.cmd); return; }
    if (t.dataset.scr) { sim.hmiScreen = t.dataset.scr; paintSim(true); return; }
  });
  $("#form").addEventListener("change", onChange);
  $("#form").addEventListener("input", (e) => { if (e.target.type === "number" || e.target.type === "text") onChange(e); });
  $("#btnZip").onclick = zipAll;
  $("#btnSave").onclick = () => download((cfg.projectName || "celda").replace(/[^\w\-]+/g, "_") + ".json", JSON.stringify(cfg, null, 2), "application/json");
  $("#fileLoad").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => { cfg = Object.assign({}, DEF, JSON.parse(t)); save(); writeForm(); generate(); toast("Configuración cargada"); }).catch(() => toast("Archivo inválido"));
  };
  $("#btnReset").onclick = () => { cfg = Object.assign({}, DEF); save(); writeForm(); generate(); };

  writeForm();
  generate();
  setInterval(tick, 250);
})();
