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

// Fotos reales de cada ejercicio (posición inicial y final), de Free Exercise DB,
// colección de dominio público: https://github.com/yuhonas/free-exercise-db
const FOTOS = {
  circulos_brazos: 2, saltos_tijera: 2, gato_camello: 2, flexion_inclinada: 2, flexion: 2,
  fondos_banco: 2, colgado: 1, escapulares: 2, remo_invertido: 2, dominada_negativa: 2,
  sentadilla: 2, zancada: 2, puente_gluteo: 2, plancha: 1, plancha_lateral: 2,
  bicho_muerto: 2, superman: 2,
};

// El "video" animado de cada ejercicio. tamano: "grande" | "paso" | "chica"
function htmlMedia(e, tamano) {
  return htmlDemo(e.id, `demo-${tamano}`);
}

// Fotos reales (posición inicial y final), si el ejercicio las tiene.
function htmlFotos(e) {
  const n = FOTOS[e.id];
  if (!n) return "";
  const nombre = e.nombre.replace(/"/g, "");
  return `<div class="fotos-fila">${Array.from({ length: n }, (_, i) =>
    `<figure><img src="fotos/${e.id}-${i + 1}.jpg" alt="${i === 0 ? "Posición inicial" : "Posición final"}: ${nombre}" loading="lazy">
     <figcaption>${n === 1 ? "Posición" : i === 0 ? "Inicio" : "Final"}</figcaption></figure>`
  ).join("")}</div>`;
}

// Video tutorial real (YouTube) de cada ejercicio.
const VIDEOS = {
  circulos_brazos: "YTueIW_xapc",
  saltos_tijera: "CcSADh4EbXc",
  gato_camello: "EeGZCFmRGQQ",
  flexion_pared: "_ifxX0U-xrM",
  flexion_inclinada: "uCTbmCjiF7Y",
  flexion_rodillas: "QjN9gIpaOAQ",
  flexion: "hI_KSc0XUIM",
  fondos_banco: "V1K9BFx9OeM",
  flexion_pike: "wyfxnKdBlzk",
  colgado: "HIgYkLMDAvo",
  escapulares: "QXZ5vZrjApY",
  remo_invertido: "Qnf19U2GPUA",
  dominada_negativa: "Szv52x_uYXA",
  sentadilla: "RRx-NNdCRjA",
  zancada: "PHA9tVMRsj8",
  sentadilla_bulgara: "IdilLr9nyuQ",
  puente_gluteo: "v_9dS-l3GWU",
  elevacion_talones: "OKFDQOQAk6w",
  plancha: "LKd2gK40YCY",
  plancha_lateral: "3iTX7S0kONg",
  bicho_muerto: "XkTtXA3-IqU",
  hollow: "bfD5yo0Kw0k",
  superman: "7p4l-KnxxaY",
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

function urlBusquedaVideo(e) {
  const q = BUSQUEDA_VIDEO[e.id] || `${e.nombre} ejercicio técnica correcta`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// Miniatura que se cambia por el reproductor al tocarla (así no se gastan datos antes).
function htmlVideo(e) {
  const id = VIDEOS[e.id];
  if (!id) return "";
  return `
    <div class="video" data-video="${id}">
      <button class="video-portada" data-reproducir aria-label="Reproducir video de ${e.nombre.replace(/"/g, "")}">
        <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()">
        <span class="video-play">▶</span>
        <span class="video-sin-red">Necesitas internet para ver el video</span>
      </button>
    </div>
    <div class="video-enlaces">
      <a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">Abrir en YouTube</a>
      <a href="${urlBusquedaVideo(e)}" target="_blank" rel="noopener">Ver más videos</a>
    </div>`;
}

document.addEventListener("click", (ev) => {
  const boton = ev.target.closest("[data-reproducir]");
  if (!boton) return;
  const caja = boton.closest("[data-video]");
  const id = caja.dataset.video;
  caja.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1"
    title="Video del ejercicio" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
});

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

// ---------- Dibujo: "video" de estudio ----------

const f1 = (n) => n.toFixed(1);

// Encuadre 4:3 que contiene todo el movimiento (como un video).
function encuadreDemo(demo) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity;
  const tomar = ([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
  };
  const cuadros = demo.cuadros;
  cuadros.forEach((c, i) => {
    [c.p, interpolar(c.p, cuadros[(i + 1) % cuadros.length].p, 0.5)].forEach((pose) => {
      const r = resolverPose(pose);
      [r.cadera, r.hombro, ...r.brazoN, ...r.brazoF, ...r.piernaN.puntos, ...r.piernaF.puntos, r.piernaN.pie[1], r.piernaF.pie[1]].forEach(tomar);
      tomar([r.cabeza[0] - MEDIDAS.cabeza, r.cabeza[1] - MEDIDAS.cabeza]);
      tomar([r.cabeza[0] + MEDIDAS.cabeza, r.cabeza[1]]);
    });
  });
  (demo.objetos || []).forEach((o) => {
    if (o.tipo === "caja") { tomar([o.x, o.y]); tomar([o.x + o.w, o.y]); }
    if (o.tipo === "barra") { tomar([o.x1 - 8, o.y - 4]); tomar([o.x2 + 8, o.y]); }
    if (o.tipo === "pared") tomar([o.x + 14, SUELO]);
  });
  const margen = 16;
  let x = minX - margen;
  let w = maxX - minX + margen * 2;
  let y = minY - margen;
  const abajo = SUELO + 14;
  let h = abajo - y;
  if (w / h < 4 / 3) {
    const nuevoW = (h * 4) / 3;
    x -= (nuevoW - w) / 2;
    w = nuevoW;
  } else {
    const nuevoH = (w * 3) / 4;
    y = abajo - nuevoH;
    h = nuevoH;
  }
  return { x, y, w, h };
}

// Segmento del cuerpo con grosor distinto en cada punta (más parecido a un músculo).
function trazoCuerpo(a, b, ra, rb) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / L;
  const ny = dx / L;
  const p1 = [a[0] + nx * ra, a[1] + ny * ra];
  const p2 = [b[0] + nx * rb, b[1] + ny * rb];
  const p3 = [b[0] - nx * rb, b[1] - ny * rb];
  const p4 = [a[0] - nx * ra, a[1] - ny * ra];
  return `M${f1(p1[0])},${f1(p1[1])} L${f1(p2[0])},${f1(p2[1])} A${rb},${rb} 0 0 0 ${f1(p3[0])},${f1(p3[1])} L${f1(p4[0])},${f1(p4[1])} A${ra},${ra} 0 0 0 ${f1(p1[0])},${f1(p1[1])}Z`;
}

const punto = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function htmlObjetos(objetos, cuadro) {
  return (objetos || [])
    .map((o) => {
      if (o.tipo === "pared")
        return `<rect class="obj-pared" x="${o.x}" y="${f1(cuadro.y)}" width="${f1(cuadro.x + cuadro.w - o.x)}" height="${f1(SUELO - cuadro.y)}"/>`;
      if (o.tipo === "caja")
        return `<rect class="obj-caja" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="2.5"/>
                <rect class="obj-caja-tapa" x="${o.x}" y="${o.y}" width="${o.w}" height="4" rx="2"/>`;
      if (o.tipo === "barra")
        return `
          <line class="obj-poste" x1="${o.x1}" y1="${o.y}" x2="${o.x1}" y2="${SUELO}"/>
          <line class="obj-poste" x1="${o.x2}" y1="${o.y}" x2="${o.x2}" y2="${SUELO}"/>
          <line class="obj-barra" x1="${o.x1 - 6}" y1="${o.y}" x2="${o.x2 + 6}" y2="${o.y}"/>`;
      return "";
    })
    .join("");
}

let contadorDemos = 0;

function iniciarDemo(el) {
  const demo = DEMOS[el.dataset.demo];
  if (!demo) return;
  el.dataset.activo = "1";
  const uid = `d${++contadorDemos}`;
  const c = encuadreDemo(demo);
  const conControles = !el.classList.contains("demo-chica");
  const lado = (sufijo, clase) => `<path data-p="${sufijo}" class="${clase}"/>`;
  el.innerHTML = `
    <svg viewBox="${f1(c.x)} ${f1(c.y)} ${f1(c.w)} ${f1(c.h)}" role="img" aria-label="Video animado del ejercicio">
      <defs>
        <radialGradient id="${uid}-fondo" cx="0.55" cy="0.35" r="0.85">
          <stop offset="0" stop-color="#f1f1f4"/><stop offset="1" stop-color="#c4c4cc"/>
        </radialGradient>
        <linearGradient id="${uid}-suelo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d3d3da"/><stop offset="1" stop-color="#b9b9c2"/>
        </linearGradient>
        <radialGradient id="${uid}-sombra">
          <stop offset="0" stop-color="#000" stop-opacity="0.28"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="${f1(c.x)}" y="${f1(c.y)}" width="${f1(c.w)}" height="${f1(c.h)}" fill="url(#${uid}-fondo)"/>
      <rect x="${f1(c.x)}" y="${SUELO + 3}" width="${f1(c.w)}" height="${f1(c.y + c.h - SUELO)}" fill="url(#${uid}-suelo)"/>
      ${htmlObjetos(demo.objetos, c)}
      <ellipse data-p="sombra" cy="${SUELO + 4}" ry="4" fill="url(#${uid}-sombra)"/>
      <g class="${demo.frente ? "cuerpo" : "cuerpo lejos"}">
        ${lado("brazoF", "piel")}${lado("manoF", "piel")}${lado("piernaF", "piel")}${lado("shortF", "short")}${lado("pieF", "zapatilla")}
      </g>
      <g class="cuerpo">
        ${lado("piernaN", "piel")}${lado("shortN", "short")}${lado("pieN", "zapatilla")}
        ${lado("cuello", "piel")}
        ${lado("torso", "polera")}${lado("cadera", "short")}
        <circle data-p="pelo" class="pelo" r="${MEDIDAS.cabeza + 0.6}"/>
        <circle data-p="cara" class="piel" r="${MEDIDAS.cabeza - 0.6}"/>
        ${lado("brazoN", "piel")}${lado("mangaN", "polera")}${lado("manoN", "piel")}
      </g>
    </svg>
    ${
      conControles
        ? `<div class="demo-controles">
             <button class="demo-btn" data-demo-pausa aria-label="Pausar">❚❚</button>
             <button class="demo-btn demo-lento" data-demo-lento aria-pressed="false">Lento</button>
           </div>
           <div class="demo-progreso"><div></div></div>`
        : ""
    }`;
  const partes = {};
  el.querySelectorAll("[data-p]").forEach((n) => (partes[n.dataset.p] = n));
  const barra = el.querySelector(".demo-progreso div");
  const total = demo.cuadros.reduce((s, q) => s + q.h + q.t, 0);

  const pierna = (puntos, pie) => {
    const [cad, rod, tob] = puntos;
    const d = trazoCuerpo(cad, rod, 6.6, 4.8) + trazoCuerpo(rod, tob, 4.6, 3.1);
    const short = trazoCuerpo(cad, punto(cad, rod, 0.55), 7.2, 6);
    const zapatilla = trazoCuerpo(punto(pie[0], pie[1], -0.15), pie[1], 3.4, 2.6);
    return { d, short, zapatilla };
  };
  const brazo = (puntos) => {
    const [hom, codo, mano] = puntos;
    return {
      d: trazoCuerpo(hom, codo, 4.4, 3.4) + trazoCuerpo(codo, mano, 3.3, 2.5),
      manga: trazoCuerpo(hom, punto(hom, codo, 0.45), 5, 4.4),
      mano: trazoCuerpo(punto(codo, mano, 0.98), mano, 3, 3),
    };
  };

  const dibujar = (p) => {
    const r = resolverPose(p);
    const pn = pierna(r.piernaN.puntos, r.piernaN.pie);
    const pf = pierna(r.piernaF.puntos, r.piernaF.pie);
    const bn = brazo(r.brazoN);
    const bf = brazo(r.brazoF);
    partes.piernaN.setAttribute("d", pn.d);
    partes.shortN.setAttribute("d", pn.short);
    partes.pieN.setAttribute("d", pn.zapatilla);
    partes.piernaF.setAttribute("d", pf.d);
    partes.shortF.setAttribute("d", pf.short);
    partes.pieF.setAttribute("d", pf.zapatilla);
    partes.brazoN.setAttribute("d", bn.d);
    partes.mangaN.setAttribute("d", bn.manga);
    partes.manoN.setAttribute("d", bn.mano);
    partes.brazoF.setAttribute("d", bf.d);
    partes.manoF.setAttribute("d", bf.mano);
    // Torso en dos tramos para seguir la curva de la espalda.
    const medio = [
      0.25 * r.cadera[0] + 0.5 * r.control[0] + 0.25 * r.hombro[0],
      0.25 * r.cadera[1] + 0.5 * r.control[1] + 0.25 * r.hombro[1],
    ];
    partes.torso.setAttribute("d", trazoCuerpo(r.cadera, medio, 7.4, 7.8) + trazoCuerpo(medio, r.hombro, 7.8, 8.4));
    partes.cadera.setAttribute("d", trazoCuerpo(r.cadera, punto(r.cadera, medio, 0.55), 7.8, 7.6));
    partes.cuello.setAttribute("d", trazoCuerpo(r.hombro, r.cabeza, 3.6, 3.6));
    const giro = p.torso + (p.cabeza || 0);
    const adelante = demo.frente ? 0 : 1.6;
    const pelo = mover(mover(r.cabeza, giro, 1.8), giro + 90, -adelante);
    const cara = mover(r.cabeza, giro + 90, adelante);
    partes.pelo.setAttribute("cx", f1(pelo[0]));
    partes.pelo.setAttribute("cy", f1(pelo[1]));
    partes.cara.setAttribute("cx", f1(cara[0]));
    partes.cara.setAttribute("cy", f1(cara[1]));
    // Sombra en el suelo bajo el cuerpo.
    const xs = [r.cadera[0], r.hombro[0], r.piernaN.pie[1][0], r.piernaF.pie[1][0]];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    partes.sombra.setAttribute("cx", f1((minX + maxX) / 2));
    partes.sombra.setAttribute("rx", f1(Math.max(14, (maxX - minX) / 2 + 10)));
  };

  let tiempo = 0;
  let ultimo = performance.now();
  let pausado = false;
  let velocidad = 1;
  const cuadro = (ahora) => {
    if (!el.isConnected) return; // la pantalla cambió: se detiene sola
    if (!pausado) tiempo += (ahora - ultimo) * velocidad;
    ultimo = ahora;
    dibujar(poseEnTiempo(demo, tiempo));
    if (barra) barra.style.width = `${((tiempo % total) / total) * 100}%`;
    requestAnimationFrame(cuadro);
  };
  el.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-demo-lento]")) {
      velocidad = velocidad === 1 ? 0.4 : 1;
      ev.target.setAttribute("aria-pressed", String(velocidad !== 1));
      return;
    }
    if (!conControles) return;
    pausado = !pausado;
    const b = el.querySelector("[data-demo-pausa]");
    b.textContent = pausado ? "▶" : "❚❚";
    b.setAttribute("aria-label", pausado ? "Reproducir" : "Pausar");
    el.classList.toggle("en-pausa", pausado);
  });
  dibujar(demo.cuadros[0].p);
  requestAnimationFrame(cuadro);
}

function htmlDemo(id, clase = "") {
  return DEMOS[id] ? `<div class="demo ${clase}" data-demo="${id}"></div>` : "";
}

function activarDemos(raiz = document) {
  raiz.querySelectorAll("[data-demo]:not([data-activo])").forEach(iniciarDemo);
}
