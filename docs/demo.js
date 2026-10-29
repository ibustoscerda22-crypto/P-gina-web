"use strict";

// Demostraciones animadas: una figura que repite el movimiento de cada ejercicio.
//
// Cada pose describe el cuerpo de perfil (mirando a la derecha) con ángulos en grados:
// 0 = adelante, 90 = abajo, 180 = atrás, -90 = arriba.
//   apoyo:   punto que queda fijo ['pie' | 'rodilla' | 'mano' | 'cadera', x, y]
//   torso:   ángulo de cadera a hombros     curva: arqueo de la espalda
//   cabeza:  giro de la cabeza respecto al torso
//   brazos / piernas: { n: cercano, f: lejano }, cada uno [ángulo1, ángulo2]
//            o { a: [x, y], s: ±1 } para que la mano o el pie lleguen a ese punto
//   pies:    ángulo de los pies { n, f } (si falta, perpendicular a la pierna)
// Cada cuadro: { p: pose, h: ms quieto, t: ms de transición al siguiente }.

const MEDIDAS = { torso: 44, brazo: 24, ante: 22, muslo: 28, tibia: 28, cuello: 13, cabeza: 9, pie: 8 };
const SUELO = 150;

const PIERNAS_DE_PIE = { n: [90, 90], f: [90, 90] };

const DEMOS = {
  circulos_brazos: {
    lineal: true,
    cuadros: [-90, 0, 90, 180, 270].map((a, i) => ({
      p: {
        apoyo: ["pie", 100, SUELO], torso: -90, piernas: PIERNAS_DE_PIE, pies: { n: 0, f: 0 },
        brazos: { n: [a, a], f: [a - 20, a - 20] },
      },
      h: 0,
      t: i === 4 ? 0 : 450,
    })),
  },

  saltos_tijera: {
    frente: true,
    cuadros: [
      {
        p: {
          apoyo: ["pie", 102, SUELO], torso: -90, piernas: { n: [88, 90], f: [92, 90] }, pies: { n: 0, f: 180 },
          brazos: { n: [80, 85], f: [100, 95] },
        },
        h: 120, t: 280,
      },
      {
        p: {
          apoyo: ["cadera", 100, 98], torso: -90, piernas: { n: [68, 68], f: [112, 112] }, pies: { n: 0, f: 180 },
          brazos: { n: [-50, -70], f: [-130, -110] },
        },
        h: 120, t: 280,
      },
    ],
  },

  gato_camello: {
    cuadros: [
      {
        p: {
          apoyo: ["rodilla", 70, SUELO], torso: -24, curva: 9, cabeza: 55,
          piernas: { n: [90, 180], f: [92, 182] }, pies: { n: 180, f: 180 },
          brazos: { n: { a: [110, SUELO], s: 1 }, f: { a: [114, SUELO], s: 1 } },
        },
        h: 500, t: 1300,
      },
      {
        p: {
          apoyo: ["rodilla", 70, SUELO], torso: -24, curva: -7, cabeza: -30,
          piernas: { n: [90, 180], f: [92, 182] }, pies: { n: 180, f: 180 },
          brazos: { n: { a: [110, SUELO], s: 1 }, f: { a: [114, SUELO], s: 1 } },
        },
        h: 500, t: 1300,
      },
    ],
  },

  flexion_pared: {
    objetos: [{ tipo: "pared", x: 150 }],
    cuadros: [
      {
        p: {
          apoyo: ["pie", 80, SUELO], torso: -70, piernas: { n: [110, 110], f: [112, 112] }, pies: { n: 0, f: 0 },
          brazos: { n: { a: [150, 60], s: 1 }, f: { a: [150, 64], s: 1 } },
        },
        h: 300, t: 900,
      },
      {
        p: {
          apoyo: ["pie", 80, SUELO], torso: -60, piernas: { n: [120, 120], f: [122, 122] }, pies: { n: 0, f: 0 },
          brazos: { n: { a: [150, 60], s: 1 }, f: { a: [150, 64], s: 1 } },
        },
        h: 200, t: 900,
      },
    ],
  },

  flexion_inclinada: {
    objetos: [{ tipo: "caja", x: 125, y: 115, w: 55, h: 35 }],
    cuadros: [
      {
        p: {
          apoyo: ["pie", 77, SUELO], torso: -51, piernas: { n: [129, 129], f: [131, 131] },
          brazos: { n: { a: [140, 115], s: 1 }, f: { a: [143, 115], s: 1 } },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["pie", 77, SUELO], torso: -43, piernas: { n: [137, 137], f: [139, 139] },
          brazos: { n: { a: [140, 115], s: 1 }, f: { a: [143, 115], s: 1 } },
        },
        h: 200, t: 900,
      },
    ],
  },

  flexion_rodillas: {
    cuadros: [
      {
        p: {
          apoyo: ["rodilla", 70, SUELO], torso: -40, piernas: { n: [140, 195], f: [142, 197] },
          brazos: { n: { a: [125, SUELO], s: 1 }, f: { a: [128, SUELO], s: 1 } },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["rodilla", 70, SUELO], torso: -8, piernas: { n: [172, 195], f: [174, 197] },
          brazos: { n: { a: [125, SUELO], s: 1 }, f: { a: [128, SUELO], s: 1 } },
        },
        h: 200, t: 900,
      },
    ],
  },

  flexion: {
    cuadros: [
      {
        p: {
          apoyo: ["pie", 30, SUELO], torso: -27.4, piernas: { n: [152.6, 152.6], f: [154, 154] },
          brazos: { n: { a: [119, SUELO], s: 1 }, f: { a: [122, SUELO], s: 1 } },
        },
        h: 300, t: 1100,
      },
      {
        p: {
          apoyo: ["pie", 30, SUELO], torso: -5.7, piernas: { n: [174.3, 174.3], f: [175.5, 175.5] },
          brazos: { n: { a: [119, SUELO], s: 1 }, f: { a: [122, SUELO], s: 1 } },
        },
        h: 200, t: 900,
      },
    ],
  },

  fondos_banco: {
    objetos: [{ tipo: "caja", x: 30, y: 110, w: 55, h: 40 }],
    cuadros: [
      {
        p: {
          apoyo: ["cadera", 90, 106], torso: -88, pies: { n: 0, f: 0 },
          piernas: { n: { a: [120, SUELO], s: -1 }, f: { a: [116, SUELO], s: -1 } },
          brazos: { n: { a: [84, 110], s: 1 }, f: { a: [80, 110], s: 1 } },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["cadera", 90, 126], torso: -88, pies: { n: 0, f: 0 },
          piernas: { n: { a: [120, SUELO], s: -1 }, f: { a: [116, SUELO], s: -1 } },
          brazos: { n: { a: [84, 110], s: 1 }, f: { a: [80, 110], s: 1 } },
        },
        h: 200, t: 900,
      },
    ],
  },

  flexion_pike: {
    cuadros: [
      {
        p: {
          apoyo: ["cadera", 80, 96], torso: 37,
          piernas: { n: { a: [65, SUELO], s: -1 }, f: { a: [62, SUELO], s: -1 } },
          brazos: { n: { a: [150, SUELO], s: -1 }, f: { a: [153, SUELO], s: -1 } },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["cadera", 92, 102], torso: 45,
          piernas: { n: { a: [65, SUELO], s: -1 }, f: { a: [62, SUELO], s: -1 } },
          brazos: { n: { a: [150, SUELO], s: -1 }, f: { a: [153, SUELO], s: -1 } },
        },
        h: 200, t: 1000,
      },
    ],
  },

  colgado: {
    objetos: [{ tipo: "barra", x1: 60, x2: 140, y: 12 }],
    cuadros: [
      {
        p: {
          apoyo: ["mano", 100, 14], torso: -90, brazos: { n: [-90, -90], f: [-92, -92] },
          piernas: { n: [92, 160], f: [88, 158] },
        },
        h: 600, t: 1300,
      },
      {
        p: {
          apoyo: ["mano", 100, 14], torso: -87, brazos: { n: [-90, -90], f: [-92, -92] },
          piernas: { n: [86, 156], f: [83, 154] },
        },
        h: 600, t: 1300,
      },
    ],
  },

  escapulares: {
    objetos: [{ tipo: "barra", x1: 60, x2: 140, y: 12 }],
    cuadros: [
      {
        p: {
          apoyo: ["mano", 100, 14], torso: -90, curva: 0, cabeza: 0,
          brazos: { n: [-90, -90], f: [-92, -92] }, piernas: { n: [92, 160], f: [88, 158] },
        },
        h: 500, t: 600,
      },
      {
        p: {
          apoyo: ["mano", 100, 14], torso: -95, curva: -6, cabeza: -15,
          brazos: { n: [-72, -106], f: [-74, -108] }, piernas: { n: [92, 160], f: [88, 158] },
        },
        h: 700, t: 600,
      },
    ],
  },

  remo_invertido: {
    objetos: [{ tipo: "barra", x1: 135, x2: 175, y: 96 }],
    cuadros: [
      {
        p: {
          apoyo: ["pie", 52, SUELO], torso: -6, piernas: { n: [174, 174], f: [176, 176] },
          brazos: { n: { a: [155, 97], s: 1 }, f: { a: [158, 97], s: 1 } },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["pie", 52, SUELO], torso: -27, piernas: { n: [153, 153], f: [155, 155] },
          brazos: { n: { a: [155, 97], s: 1 }, f: { a: [158, 97], s: 1 } },
        },
        h: 400, t: 1000,
      },
    ],
  },

  dominada_negativa: {
    objetos: [{ tipo: "barra", x1: 60, x2: 140, y: 12 }],
    cuadros: [
      {
        p: {
          apoyo: ["cadera", 98, 74], torso: -90, cabeza: -12,
          brazos: { n: { a: [106, 14], s: 1 }, f: { a: [104, 14], s: 1 } },
          piernas: { n: [95, 160], f: [92, 158] },
        },
        h: 500, t: 2600,
      },
      {
        p: {
          apoyo: ["cadera", 100, 104], torso: -90, cabeza: 0,
          brazos: { n: { a: [106, 14], s: 1 }, f: { a: [104, 14], s: 1 } },
          piernas: { n: [92, 160], f: [89, 158] },
        },
        h: 300, t: 700,
      },
    ],
  },

  sentadilla: {
    cuadros: [
      {
        p: {
          apoyo: ["pie", 100, SUELO], torso: -90, piernas: { n: [90, 90], f: [91, 89] }, pies: { n: 0, f: 0 },
          brazos: { n: [80, 80], f: [82, 82] },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["pie", 100, SUELO], torso: -55, piernas: { n: [10, 110], f: [12, 112] }, pies: { n: 0, f: 0 },
          brazos: { n: [0, 0], f: [2, 2] },
        },
        h: 200, t: 1000,
      },
    ],
  },

  zancada: {
    cuadros: [
      {
        p: {
          apoyo: ["pie", 110, SUELO], torso: -90, piernas: { n: [90, 90], f: [90, 90] }, pies: { n: 0, f: 0 },
          brazos: { n: [100, 60], f: [102, 62] },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["pie", 110, SUELO], torso: -90, piernas: { n: [0, 90], f: [110, 175] }, pies: { n: 0, f: 85 },
          brazos: { n: [100, 60], f: [102, 62] },
        },
        h: 250, t: 1000,
      },
    ],
  },

  sentadilla_bulgara: {
    objetos: [{ tipo: "caja", x: 20, y: 120, w: 45, h: 30 }],
    cuadros: [
      {
        p: {
          apoyo: ["cadera", 100, 100], torso: -82, pies: { n: 0, f: 180 },
          piernas: { n: { a: [125, SUELO], s: -1 }, f: { a: [57, 120], s: -1 } },
          brazos: { n: [95, 95], f: [97, 97] },
        },
        h: 300, t: 1000,
      },
      {
        p: {
          apoyo: ["cadera", 98, 124], torso: -78, pies: { n: 0, f: 180 },
          piernas: { n: { a: [125, SUELO], s: -1 }, f: { a: [57, 120], s: -1 } },
          brazos: { n: [95, 95], f: [97, 97] },
        },
        h: 250, t: 1000,
      },
    ],
  },

  puente_gluteo: {
    cuadros: [
      {
        p: {
          apoyo: ["cadera", 90, 142], torso: 180, pies: { n: 0, f: 0 },
          piernas: { n: { a: [122, 148], s: -1 }, f: { a: [125, 148], s: -1 } },
          brazos: { n: [2, 0], f: [4, 0] },
        },
        h: 300, t: 900,
      },
      {
        p: {
          apoyo: ["cadera", 88, 118], torso: 150, pies: { n: 0, f: 0 },
          piernas: { n: { a: [122, 148], s: -1 }, f: { a: [125, 148], s: -1 } },
          brazos: { n: [3, 0], f: [5, 0] },
        },
        h: 700, t: 900,
      },
    ],
  },

  elevacion_talones: {
    objetos: [{ tipo: "caja", x: 85, y: 135, w: 70, h: 15 }],
    cuadros: [
      {
        p: {
          apoyo: ["pie", 100, 137], torso: -90, piernas: { n: [90, 90], f: [90, 90] }, pies: { n: -15, f: -15 },
          brazos: { n: [85, 85], f: [87, 87] },
        },
        h: 300, t: 800,
      },
      {
        p: {
          apoyo: ["pie", 100, 127], torso: -90, piernas: { n: [90, 90], f: [90, 90] }, pies: { n: 60, f: 60 },
          brazos: { n: [85, 85], f: [87, 87] },
        },
        h: 600, t: 900,
      },
    ],
  },

  plancha: {
    cuadros: [
      {
        p: {
          apoyo: ["pie", 30, SUELO], torso: -14, piernas: { n: [166, 166], f: [168, 168] },
          brazos: { n: [90, 0], f: [92, 2] },
        },
        h: 900, t: 1100,
      },
      {
        p: {
          apoyo: ["pie", 30, SUELO], torso: -12.5, piernas: { n: [167.2, 167.2], f: [169, 169] },
          brazos: { n: [90, 0], f: [92, 2] },
        },
        h: 900, t: 1100,
      },
    ],
  },

  plancha_lateral: {
    cuadros: [
      {
        p: {
          apoyo: ["pie", 30, SUELO], torso: -14, piernas: { n: [166, 166], f: [166, 166] },
          brazos: { n: [90, 0], f: [-90, -90] },
        },
        h: 900, t: 1100,
      },
      {
        p: {
          apoyo: ["pie", 30, SUELO], torso: -12.5, piernas: { n: [167.2, 167.2], f: [167.2, 167.2] },
          brazos: { n: [90, 0], f: [-82, -82] },
        },
        h: 900, t: 1100,
      },
    ],
  },

  bicho_muerto: (() => {
    const pose = (brazoN, brazoF, piernaN, piernaF) => ({
      apoyo: ["cadera", 110, 142], torso: 180,
      brazos: { n: brazoN, f: brazoF }, piernas: { n: piernaN, f: piernaF },
    });
    const neutral = pose([-90, -90], [-88, -88], [-90, 0], [-92, -2]);
    return {
      cuadros: [
        { p: neutral, h: 250, t: 800 },
        { p: pose([190, 190], [-88, -88], [-90, 0], [-8, -8]), h: 350, t: 800 },
        { p: neutral, h: 250, t: 800 },
        { p: pose([-90, -90], [192, 192], [-6, -6], [-92, -2]), h: 350, t: 800 },
      ],
    };
  })(),

  hollow: {
    cuadros: [
      {
        p: {
          apoyo: ["cadera", 100, 142], torso: 195, curva: 4,
          brazos: { n: [195, 195], f: [197, 197] }, piernas: { n: [-15, -15], f: [-13, -13] },
        },
        h: 800, t: 900,
      },
      {
        p: {
          apoyo: ["cadera", 100, 142], torso: 193, curva: 4,
          brazos: { n: [193, 193], f: [195, 195] }, piernas: { n: [-13, -13], f: [-11, -11] },
        },
        h: 800, t: 900,
      },
    ],
  },

  superman: {
    cuadros: [
      {
        p: {
          apoyo: ["cadera", 100, 143], torso: 180, pies: { n: 85, f: 85 },
          brazos: { n: [180, 180], f: [182, 182] }, piernas: { n: [0, 0], f: [2, 2] },
        },
        h: 300, t: 800,
      },
      {
        p: {
          apoyo: ["cadera", 100, 144], torso: 192, pies: { n: 85, f: 85 },
          brazos: { n: [198, 198], f: [200, 200] }, piernas: { n: [-12, -12], f: [-10, -10] },
        },
        h: 900, t: 800,
      },
    ],
  },
};

// Búsquedas de YouTube más precisas para los nombres que se prestan a confusión.
const BUSQUEDA_VIDEO = {
  gato_camello: "gato camello ejercicio movilidad columna",
  colgado: "dead hang colgarse en barra principiantes",
  escapulares: "scapular pull ups retracción escapular tutorial",
  remo_invertido: "remo invertido australiano principiantes tutorial",
  bicho_muerto: "dead bug ejercicio bicho muerto técnica",
  hollow: "hollow body hold principiantes tutorial",
  flexion_pike: "pike push up flexión pike principiantes",
  fondos_banco: "fondos en banco tríceps técnica",
};

function urlVideo(e) {
  const q = BUSQUEDA_VIDEO[e.id] || `${e.nombre} ejercicio técnica correcta`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// ---------- Motor ----------

const aRad = (g) => (g * Math.PI) / 180;
const aGrad = (r) => (r * 180) / Math.PI;
const mover = ([x, y], angulo, largo) => [x + largo * Math.cos(aRad(angulo)), y + largo * Math.sin(aRad(angulo))];

// Devuelve [raíz, articulación, extremo, ángulo del segundo segmento].
function extremidad(raiz, spec, l1, l2) {
  if (Array.isArray(spec)) {
    const j = mover(raiz, spec[0], l1);
    return [raiz, j, mover(j, spec[1], l2), spec[1]];
  }
  const [tx, ty] = spec.a;
  const dx = tx - raiz[0];
  const dy = ty - raiz[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = aGrad(Math.atan2(dy, dx));
  const a = aGrad(Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const j = mover(raiz, base + spec.s * a, l1);
  const fin = mover(raiz, base, d);
  return [raiz, j, fin, aGrad(Math.atan2(fin[1] - j[1], fin[0] - j[0]))];
}

function resolverPose(p) {
  const M = MEDIDAS;
  const [tipo, ax, ay] = p.apoyo;
  let cadera;
  if (tipo === "pie") {
    const [m, t] = p.piernas.n;
    cadera = mover(mover([ax, ay], t + 180, M.tibia), m + 180, M.muslo);
  } else if (tipo === "rodilla") {
    cadera = mover([ax, ay], p.piernas.n[0] + 180, M.muslo);
  } else if (tipo === "mano") {
    const [b, a] = p.brazos.n;
    const hombro = mover(mover([ax, ay], a + 180, M.ante), b + 180, M.brazo);
    cadera = mover(hombro, p.torso + 180, M.torso);
  } else {
    cadera = [ax, ay];
  }
  const hombro = mover(cadera, p.torso, M.torso);
  const cabeza = mover(hombro, p.torso + (p.cabeza || 0), M.cuello);
  const medio = [(cadera[0] + hombro[0]) / 2, (cadera[1] + hombro[1]) / 2];
  const curva = p.curva || 0;
  const control = [medio[0] + curva * Math.sin(aRad(p.torso)), medio[1] - curva * Math.cos(aRad(p.torso))];

  const pierna = (lado) => {
    const l = extremidad(cadera, p.piernas[lado], M.muslo, M.tibia);
    const ang = p.pies && p.pies[lado] != null ? p.pies[lado] : l[3] - 90;
    return { puntos: l.slice(0, 3), pie: [l[2], mover(l[2], ang, M.pie)] };
  };
  return {
    cadera, hombro, cabeza, control,
    brazoN: extremidad(hombro, p.brazos.n, M.brazo, M.ante).slice(0, 3),
    brazoF: extremidad(hombro, p.brazos.f, M.brazo, M.ante).slice(0, 3),
    piernaN: pierna("n"),
    piernaF: pierna("f"),
  };
}

function interpolar(a, b, u) {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * u;
  if (Array.isArray(a)) return a.map((v, i) => interpolar(v, b[i], u));
  if (a && typeof a === "object") {
    const r = {};
    for (const k of Object.keys(a)) r[k] = k in b ? interpolar(a[k], b[k], u) : a[k];
    return r;
  }
  return a;
}

const suavizar = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

function poseEnTiempo(demo, ms) {
  const cuadros = demo.cuadros;
  const total = cuadros.reduce((s, c) => s + c.h + c.t, 0);
  let t = ms % total;
  for (let i = 0; i < cuadros.length; i++) {
    const c = cuadros[i];
    if (t < c.h) return c.p;
    t -= c.h;
    if (t < c.t) {
      const u = t / c.t;
      return interpolar(c.p, cuadros[(i + 1) % cuadros.length].p, demo.lineal ? u : suavizar(u));
    }
    t -= c.t;
  }
  return cuadros[0].p;
}

const NS = "http://www.w3.org/2000/svg";
const puntos = (ps) => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

// Parte superior del encuadre: lo justo para que quepa todo el movimiento.
function techoDemo(demo) {
  let minY = SUELO;
  const cuadros = demo.cuadros;
  cuadros.forEach((c, i) => {
    [c.p, interpolar(c.p, cuadros[(i + 1) % cuadros.length].p, 0.5)].forEach((pose) => {
      const r = resolverPose(pose);
      const ys = [r.cadera, r.hombro, ...r.brazoN, ...r.brazoF, ...r.piernaN.puntos, ...r.piernaF.puntos].map((q) => q[1]);
      minY = Math.min(minY, r.cabeza[1] - MEDIDAS.cabeza, ...ys);
    });
  });
  (demo.objetos || []).forEach((o) => {
    if (o.y != null) minY = Math.min(minY, o.y);
  });
  return Math.min(Math.floor(minY - 14), 90);
}

function htmlObjetos(objetos = [], techo = -12) {
  return objetos
    .map((o) => {
      if (o.tipo === "pared") return `<rect class="demo-objeto" x="${o.x}" y="${techo}" width="${200 - o.x}" height="${SUELO - techo}"/>`;
      if (o.tipo === "caja") return `<rect class="demo-objeto" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="2"/>`;
      if (o.tipo === "barra")
        return `
          <line class="demo-poste" x1="${o.x1}" y1="${o.y}" x2="${o.x1}" y2="${SUELO}"/>
          <line class="demo-poste" x1="${o.x2}" y1="${o.y}" x2="${o.x2}" y2="${SUELO}"/>
          <line class="demo-barra" x1="${o.x1 - 6}" y1="${o.y}" x2="${o.x2 + 6}" y2="${o.y}"/>`;
      return "";
    })
    .join("");
}

function iniciarDemo(el) {
  const demo = DEMOS[el.dataset.demo];
  if (!demo) return;
  el.dataset.activo = "1";
  const claseLejos = demo.frente ? "demo-cerca" : "demo-lejos";
  const techo = techoDemo(demo);
  el.innerHTML = `
    <svg viewBox="0 ${techo} 200 ${SUELO + 10 - techo}" role="img" aria-label="Demostración animada">
      <line class="demo-suelo" x1="0" y1="${SUELO + 4}" x2="200" y2="${SUELO + 4}"/>
      ${htmlObjetos(demo.objetos, techo)}
      <g class="${claseLejos}">
        <polyline data-p="brazoF"/><polyline data-p="piernaF"/><line data-p="pieF"/>
      </g>
      <g class="demo-cerca">
        <path data-p="torso"/><line data-p="cuello"/>
        <circle data-p="cabeza" r="${MEDIDAS.cabeza}"/>
        <polyline data-p="piernaN"/><line data-p="pieN"/><polyline data-p="brazoN"/>
      </g>
    </svg>`;
  const partes = {};
  el.querySelectorAll("[data-p]").forEach((n) => (partes[n.dataset.p] = n));
  const linea = (n, [a, b]) => {
    n.setAttribute("x1", a[0].toFixed(1));
    n.setAttribute("y1", a[1].toFixed(1));
    n.setAttribute("x2", b[0].toFixed(1));
    n.setAttribute("y2", b[1].toFixed(1));
  };

  const dibujar = (p) => {
    const c = resolverPose(p);
    partes.torso.setAttribute(
      "d",
      `M${c.cadera[0].toFixed(1)},${c.cadera[1].toFixed(1)} Q${c.control[0].toFixed(1)},${c.control[1].toFixed(1)} ${c.hombro[0].toFixed(1)},${c.hombro[1].toFixed(1)}`
    );
    linea(partes.cuello, [c.hombro, c.cabeza]);
    partes.cabeza.setAttribute("cx", c.cabeza[0].toFixed(1));
    partes.cabeza.setAttribute("cy", c.cabeza[1].toFixed(1));
    partes.brazoN.setAttribute("points", puntos(c.brazoN));
    partes.brazoF.setAttribute("points", puntos(c.brazoF));
    partes.piernaN.setAttribute("points", puntos(c.piernaN.puntos));
    partes.piernaF.setAttribute("points", puntos(c.piernaF.puntos));
    linea(partes.pieN, c.piernaN.pie);
    linea(partes.pieF, c.piernaF.pie);
  };

  const inicio = performance.now();
  const cuadro = (ahora) => {
    if (!el.isConnected) return; // la pantalla cambió: se detiene sola
    dibujar(poseEnTiempo(demo, ahora - inicio));
    requestAnimationFrame(cuadro);
  };
  dibujar(demo.cuadros[0].p);
  requestAnimationFrame(cuadro);
}

function htmlDemo(id, clase = "") {
  return DEMOS[id] ? `<div class="demo ${clase}" data-demo="${id}"></div>` : "";
}

function activarDemos(raiz = document) {
  raiz.querySelectorAll("[data-demo]:not([data-activo])").forEach(iniciarDemo);
}
