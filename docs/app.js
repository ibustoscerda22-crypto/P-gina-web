"use strict";

// ---------- Utilidades ----------

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ejercicio = (id) => EJERCICIO_POR_ID[id];
const nivelPorId = (id) => NIVELES.find((n) => n.id === id) || NIVELES[0];

function textoMedida(b) {
  return b.reps != null ? `${b.reps} reps` : `${b.segundos} s`;
}
function textoBloque(b) {
  const base = b.series > 1 ? `${b.series} × ${textoMedida(b)}` : textoMedida(b);
  return b.porLado ? `${base} por lado` : base;
}
function minutosEstimados(rutina) {
  const s = rutina.bloques.reduce((total, b) => {
    const trabajo = b.reps != null ? b.reps * 3 : b.segundos;
    return total + b.series * (trabajo * (b.porLado ? 2 : 1) + b.descanso);
  }, 0);
  return Math.max(5, Math.round(s / 60));
}
function formatoReloj(s) {
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : String(s);
}

// ---------- Progreso (guardado en el teléfono) ----------

const META_SEMANAL = 3;

const Progreso = {
  sesiones: [],
  nivel: 1,

  cargar() {
    try {
      this.sesiones = JSON.parse(localStorage.getItem("cal_sesiones") || "[]");
      this.nivel = Number(localStorage.getItem("cal_nivel")) || 1;
    } catch {
      this.sesiones = [];
      this.nivel = 1;
    }
  },
  guardar() {
    try {
      localStorage.setItem("cal_sesiones", JSON.stringify(this.sesiones));
      localStorage.setItem("cal_nivel", String(this.nivel));
    } catch {
      /* sin almacenamiento disponible: el progreso dura solo esta visita */
    }
  },
  registrar(rutina, duracion, sensacion) {
    this.sesiones.unshift({
      id: String(Date.now()),
      rutinaID: rutina.id,
      rutinaNombre: rutina.nombre,
      nivel: rutina.nivel,
      fecha: new Date().toISOString(),
      duracion,
      sensacion,
    });
    this.guardar();
  },
  borrar(id) {
    this.sesiones = this.sesiones.filter((s) => s.id !== id);
    this.guardar();
  },
  reiniciar() {
    this.sesiones = [];
    this.nivel = 1;
    this.guardar();
  },
  setNivel(n) {
    this.nivel = n;
    this.guardar();
  },

  inicioSemana(fecha) {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // la semana parte el lunes
    return d;
  },
  sesionesEnSemana(fecha) {
    const inicio = this.inicioSemana(fecha);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 7);
    return this.sesiones.filter((s) => {
      const f = new Date(s.fecha);
      return f >= inicio && f < fin;
    });
  },
  get estaSemana() {
    return this.sesionesEnSemana(new Date()).length;
  },
  get diasSemana() {
    const inicio = this.inicioSemana(new Date());
    const hoy = new Date().toDateString();
    return ["L", "M", "X", "J", "V", "S", "D"].map((letra, i) => {
      const dia = new Date(inicio);
      dia.setDate(dia.getDate() + i);
      const clave = dia.toDateString();
      return {
        letra,
        entrenado: this.sesiones.some((s) => new Date(s.fecha).toDateString() === clave),
        esHoy: clave === hoy,
      };
    });
  },
  // Semanas seguidas cumpliendo la meta. La semana en curso solo suma si ya se cumplió.
  get racha() {
    let racha = 0;
    const fecha = new Date();
    if (this.sesionesEnSemana(fecha).length < META_SEMANAL) fecha.setDate(fecha.getDate() - 7);
    while (this.sesionesEnSemana(fecha).length >= META_SEMANAL) {
      racha++;
      fecha.setDate(fecha.getDate() - 7);
    }
    return racha;
  },
  get minutosTotales() {
    return Math.floor(this.sesiones.reduce((t, s) => t + s.duracion, 0) / 60);
  },
  get siguienteRutina() {
    const rutinas = nivelPorId(this.nivel).rutinas;
    const ultima = this.sesiones.find((s) => s.nivel === this.nivel);
    const i = ultima ? rutinas.findIndex((r) => r.id === ultima.rutinaID) : -1;
    return i === -1 ? rutinas[0] : rutinas[(i + 1) % rutinas.length];
  },
  get sesionesEnNivel() {
    return this.sesiones.filter((s) => s.nivel === this.nivel).length;
  },
  // Sugiere subir tras 6 sesiones si las 3 últimas no fueron difíciles.
  get sugerirSubir() {
    if (this.nivel >= NIVELES.length) return false;
    const del = this.sesiones.filter((s) => s.nivel === this.nivel);
    return del.length >= 6 && !del.slice(0, 3).some((s) => s.sensacion === "dificil");
  },
};

// ---------- Componentes ----------

function htmlSemana() {
  const cumplida = Progreso.estaSemana >= META_SEMANAL;
  return `
    <section class="card">
      <div class="fila-titulo">
        <h3>Esta semana</h3>
        <span class="${cumplida ? "verde" : "secundario"} negrita">${Progreso.estaSemana} de ${META_SEMANAL}</span>
      </div>
      <div class="dias">
        ${Progreso.diasSemana
          .map(
            (d) => `
          <div class="dia ${d.esHoy ? "es-hoy" : ""}">
            <span>${d.letra}</span>
            <div class="punto ${d.entrenado ? "lleno" : ""}">${d.entrenado ? "✓" : ""}</div>
          </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function htmlIcono(categoria, tam = "") {
  return `<span class="icono ${tam}" aria-hidden="true">${CATEGORIAS[categoria].icono}</span>`;
}

function htmlFilaRutina(r) {
  return `
    <a class="fila" href="#/rutina/${r.id}">
      <span class="letra">${r.letra}</span>
      <span class="fila-texto">
        <strong>${esc(r.nombre)}</strong>
        <small>${esc(r.enfoque)} · ${minutosEstimados(r)} min</small>
      </span>
      <span class="chevron">›</span>
    </a>`;
}

function htmlDato(titulo, valor, icono) {
  return `<div class="dato"><span>${icono}</span><strong>${esc(valor)}</strong><small>${esc(titulo)}</small></div>`;
}

// ---------- Pantallas ----------

let eventoInstalar = null;

function vistaEntrenar() {
  const r = Progreso.siguienteRutina;
  const n = nivelPorId(r.nivel);
  const banner = Progreso.sugerirSubir
    ? `<section class="card banner">
        <div class="banner-icono">⬆️</div>
        <div>
          <h3>¡Estás listo para subir de nivel!</h3>
          <p class="secundario">Llevas ${Progreso.sesionesEnNivel} sesiones y ya no te cuestan tanto.</p>
          <button class="enlace" data-accion="subir">Pasar al nivel ${Progreso.nivel + 1}</button>
        </div>
      </section>`
    : "";

  return `
    <header class="titulo-grande"><h1>Calistenia</h1></header>
    ${htmlInstalar()}
    ${htmlSemana()}
    ${banner}
    <section class="hoy">
      <small>TOCA HOY</small>
      <h2>${esc(r.nombre)}</h2>
      <p>Nivel ${n.id} · ${esc(n.nombre)} · ${esc(r.enfoque)}</p>
      <p class="meta">⏱ ${minutosEstimados(r)} min &nbsp; · &nbsp; ${r.bloques.length} ejercicios</p>
      <div class="hoy-botones">
        <button class="btn-blanco" data-accion="empezar" data-rutina="${r.id}">▶ Empezar</button>
        <a class="btn-info" href="#/rutina/${r.id}" aria-label="Ver detalle">ⓘ</a>
      </div>
    </section>
    ${NIVELES.map(
      (nivel) => `
      <section>
        <div class="fila-titulo">
          <h3>Nivel ${nivel.id}: ${esc(nivel.nombre)} ${nivel.id === Progreso.nivel ? '<span class="etiqueta">ACTUAL</span>' : ""}</h3>
          <small class="secundario">${esc(nivel.semanas)}</small>
        </div>
        <p class="secundario">${esc(nivel.descripcion)}</p>
        <div class="card lista">${nivel.rutinas.map(htmlFilaRutina).join("")}</div>
      </section>`
    ).join("")}
    <section class="card">
      <h3>Consejos para empezar</h3>
      <ul class="consejos">${CONSEJOS.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
    </section>`;
}

function htmlInstalar() {
  const instalada =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  let oculto = false;
  try {
    oculto = localStorage.getItem("cal_ocultar_instalar") === "1";
  } catch {}
  if (instalada || oculto) return "";
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let cuerpo;
  if (eventoInstalar) {
    cuerpo = `<p>Instálala para abrirla como una app, sin el navegador.</p>
      <button class="btn" data-accion="instalar">Instalar app</button>`;
  } else if (esIOS) {
    cuerpo = `<p>En Safari toca <strong>Compartir</strong> <span aria-hidden="true">⬆︎</span> y luego <strong>"Agregar a inicio"</strong>.</p>`;
  } else {
    cuerpo = `<p>En Chrome abre el menú <strong>⋮</strong> y toca <strong>"Instalar app"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</p>`;
  }
  return `
    <section class="card instalar">
      <button class="cerrar" data-accion="ocultar-instalar" aria-label="Ocultar">×</button>
      <h3>📲 Ponla en tu pantalla de inicio</h3>
      ${cuerpo}
    </section>`;
}

function vistaRutina(id) {
  const r = RUTINA_POR_ID[id];
  if (!r) return vistaNoEncontrada();
  const n = nivelPorId(r.nivel);
  return `
    <header class="barra"><a href="#/" class="volver">‹ Entrenar</a></header>
    <header class="titulo-grande"><h1>${esc(r.nombre)}</h1></header>
    <section class="card">
      <p class="secundario">Nivel ${n.id} · ${esc(n.nombre)}</p>
      <h3>${esc(r.enfoque)}</h3>
      <p class="secundario">⏱ ${minutosEstimados(r)} min aprox. · ${r.bloques.length} ejercicios</p>
    </section>
    <h4 class="seccion">EJERCICIOS</h4>
    <div class="card lista">
      ${r.bloques
        .map((b) => {
          const e = ejercicio(b.ejercicio);
          return `
          <a class="fila" href="#/ejercicio/${e.id}">
            ${htmlIcono(e.categoria)}
            <span class="fila-texto">
              <strong>${esc(e.nombre)}</strong>
              <span class="naranja">${esc(textoBloque(b))}</span>
              <small>Descanso ${b.descanso} s</small>
            </span>
            <span class="chevron">›</span>
          </a>`;
        })
        .join("")}
    </div>
    <p class="nota">Los dos primeros ejercicios son de calentamiento. Toca cualquier ejercicio para ver cómo se hace y sus versiones más fáciles o difíciles.</p>
    <div class="pie-fijo">
      <button class="btn grande" data-accion="empezar" data-rutina="${r.id}">▶ Empezar entrenamiento</button>
    </div>`;
}

let busqueda = "";

function htmlListaEjercicios() {
  const q = busqueda.trim().toLowerCase();
  const html = Object.entries(CATEGORIAS)
    .map(([clave, cat]) => {
      const lista = EJERCICIOS.filter((e) => e.categoria === clave && (!q || e.nombre.toLowerCase().includes(q)));
      if (!lista.length) return "";
      return `
        <h4 class="seccion">${esc(cat.nombre.toUpperCase())}</h4>
        <div class="card lista">
          ${lista
            .map(
              (e) => `
            <a class="fila" href="#/ejercicio/${e.id}">
              ${htmlIcono(e.categoria)}
              <span class="fila-texto"><strong>${esc(e.nombre)}</strong><small>${esc(e.musculos.join(", "))}</small></span>
              <span class="chevron">›</span>
            </a>`
            )
            .join("")}
        </div>`;
    })
    .join("");
  return html || `<p class="nota">No hay ejercicios con ese nombre.</p>`;
}

function vistaEjercicios() {
  return `
    <header class="titulo-grande"><h1>Ejercicios</h1></header>
    <input class="buscar" type="search" placeholder="Buscar ejercicio" value="${esc(busqueda)}" data-buscar>
    <div id="lista-ejercicios">${htmlListaEjercicios()}</div>`;
}

function vistaEjercicio(id) {
  const e = ejercicio(id);
  if (!e) return vistaNoEncontrada();
  const facil = e.masFacil && ejercicio(e.masFacil);
  const dificil = e.masDificil && ejercicio(e.masDificil);
  const enlace = (otro, titulo, simbolo, clase) => `
    <a class="fila card progresion" href="#/ejercicio/${otro.id}">
      <span class="flecha ${clase}">${simbolo}</span>
      <span class="fila-texto"><small>${titulo}</small><strong>${esc(otro.nombre)}</strong></span>
      <span class="chevron">›</span>
    </a>`;
  return `
    <header class="barra"><a href="javascript:history.back()" class="volver">‹ Volver</a></header>
    <header class="titulo-grande"><h1>${esc(e.nombre)}</h1></header>
    <div class="ej-cabecera">
      ${htmlIcono(e.categoria, "xl")}
      <div>
        <small class="naranja negrita">${esc(CATEGORIAS[e.categoria].nombre.toUpperCase())}</small>
        <p class="secundario">${esc(e.musculos.join(" · "))}</p>
      </div>
    </div>
    <p>${esc(e.resumen)}</p>
    <h3>Cómo se hace</h3>
    <ol class="pasos">${e.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
    ${
      e.errores.length
        ? `<h3>Errores comunes</h3><ul class="errores">${e.errores.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : ""
    }
    ${
      facil || dificil
        ? `<h3>Progresión</h3>
           ${facil ? enlace(facil, "Más fácil", "↓", "verde-fondo") : ""}
           ${dificil ? enlace(dificil, "Siguiente paso", "↑", "naranja-fondo") : ""}`
        : ""
    }`;
}

function vistaProgreso() {
  const historial = Progreso.sesiones.length
    ? Progreso.sesiones
        .map((s) => {
          const sen = SENSACIONES.find((x) => x.id === s.sensacion) || SENSACIONES[1];
          const fecha = new Date(s.fecha).toLocaleDateString("es", { day: "numeric", month: "short" });
          return `
          <div class="fila">
            <span class="emoji">${sen.emoji}</span>
            <span class="fila-texto">
              <strong>${esc(s.rutinaNombre)}</strong>
              <small>Nivel ${s.nivel} · ${Math.max(1, Math.floor(s.duracion / 60))} min · ${sen.nombre}</small>
            </span>
            <small class="secundario">${fecha}</small>
            <button class="borrar" data-accion="borrar" data-id="${s.id}" aria-label="Borrar">🗑</button>
          </div>`;
        })
        .join("")
    : `<div class="fila"><span class="secundario">Aún no hay entrenamientos. ¡El primero es el más importante!</span></div>`;

  return `
    <header class="titulo-grande"><h1>Progreso</h1></header>
    <div class="datos">
      ${htmlDato("Entrenamientos", String(Progreso.sesiones.length), "✅")}
      ${htmlDato("Esta semana", `${Progreso.estaSemana}/${META_SEMANAL}`, "📅")}
      ${htmlDato("Racha (semanas)", String(Progreso.racha), "🔥")}
      ${htmlDato("Minutos", String(Progreso.minutosTotales), "⏱")}
    </div>
    ${htmlSemana()}
    <h4 class="seccion">TU NIVEL</h4>
    <div class="card">
      <label class="fila-titulo">
        <span>Nivel actual</span>
        <select data-nivel>
          ${NIVELES.map((n) => `<option value="${n.id}" ${n.id === Progreso.nivel ? "selected" : ""}>${n.id} · ${esc(n.nombre)}</option>`).join("")}
        </select>
      </label>
    </div>
    <p class="nota">La meta es ${META_SEMANAL} entrenamientos por semana. La racha cuenta las semanas seguidas en que la cumples.</p>
    <h4 class="seccion">HISTORIAL</h4>
    <div class="card lista">${historial}</div>
    ${
      Progreso.sesiones.length
        ? `<button class="btn-peligro" data-accion="reiniciar">Borrar todo el progreso</button>`
        : ""
    }`;
}

function vistaNoEncontrada() {
  return `<header class="titulo-grande"><h1>No encontrado</h1></header><p><a href="#/">Volver al inicio</a></p>`;
}

// ---------- Router ----------

function render() {
  const ruta = location.hash.replace(/^#/, "") || "/";
  const partes = ruta.split("/").filter(Boolean);
  let html;
  let pestana = "entrenar";
  if (partes[0] === "rutina") html = vistaRutina(partes[1]);
  else if (partes[0] === "ejercicios") (html = vistaEjercicios()), (pestana = "ejercicios");
  else if (partes[0] === "ejercicio") (html = vistaEjercicio(partes[1])), (pestana = "ejercicios");
  else if (partes[0] === "progreso") (html = vistaProgreso()), (pestana = "progreso");
  else html = vistaEntrenar();

  $("#vista").innerHTML = html;
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("activa", a.dataset.tab === pestana));
}

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
});

// ---------- Acciones de la interfaz ----------

document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-accion]");
  if (!el) return;
  const accion = el.dataset.accion;

  if (accion === "empezar") Entreno.abrir(RUTINA_POR_ID[el.dataset.rutina]);
  else if (accion === "subir") {
    Progreso.setNivel(Progreso.nivel + 1);
    render();
  } else if (accion === "borrar") {
    if (confirm("¿Borrar este entrenamiento del historial?")) {
      Progreso.borrar(el.dataset.id);
      render();
    }
  } else if (accion === "reiniciar") {
    if (confirm("¿Borrar todo el progreso? Se eliminará el historial y volverás al nivel 1.")) {
      Progreso.reiniciar();
      render();
    }
  } else if (accion === "instalar" && eventoInstalar) {
    eventoInstalar.prompt();
    await eventoInstalar.userChoice;
    eventoInstalar = null;
    render();
  } else if (accion === "ocultar-instalar") {
    try {
      localStorage.setItem("cal_ocultar_instalar", "1");
    } catch {}
    render();
  }
});

document.addEventListener("input", (ev) => {
  if (ev.target.matches("[data-buscar]")) {
    busqueda = ev.target.value;
    $("#lista-ejercicios").innerHTML = htmlListaEjercicios();
  }
});

document.addEventListener("change", (ev) => {
  if (ev.target.matches("[data-nivel]")) {
    Progreso.setNivel(Number(ev.target.value));
    render();
  }
});

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  eventoInstalar = ev;
  if (!Entreno.activo) render();
});

// ---------- Entrenamiento guiado ----------

function construirPasos(rutina) {
  const bloques = rutina.bloques;
  const pasos = [{ tipo: "preparacion", segundos: 10, primero: ejercicio(bloques[0].ejercicio) }];
  bloques.forEach((b, i) => {
    const e = ejercicio(b.ejercicio);
    const porTiempo = b.segundos != null;
    // Los ejercicios por tiempo y por lado se separan en dos pantallas.
    const lados = b.porLado && porTiempo ? ["Lado derecho", "Lado izquierdo"] : [null];
    for (let serie = 1; serie <= b.series; serie++) {
      lados.forEach((lado, j) => {
        if (j > 0) pasos.push({ tipo: "descanso", segundos: 5, siguiente: e });
        pasos.push({
          tipo: "ejercicio",
          ejercicio: e,
          reps: b.reps,
          segundos: b.segundos,
          porLado: b.porLado && !porTiempo,
          serie,
          total: b.series,
          lado,
        });
      });
      const ultimaSerie = serie === b.series;
      if (ultimaSerie && i === bloques.length - 1) continue;
      if (b.descanso <= 0) continue;
      pasos.push({ tipo: "descanso", segundos: b.descanso, siguiente: ultimaSerie ? ejercicio(bloques[i + 1].ejercicio) : e });
    }
  });
  return pasos;
}

const duracionPaso = (p) => (p.tipo === "ejercicio" ? (p.segundos ?? null) : p.segundos);

const CIRCUNFERENCIA = 2 * Math.PI * 90;

const Entreno = {
  activo: false,
  rutina: null,
  pasos: [],
  i: 0,
  restante: 0,
  total: 0,
  fin: 0,
  pausado: false,
  inicio: 0,
  duracion: 0,
  terminado: false,
  sensacion: "bien",
  intervalo: null,
  wakeLock: null,
  audio: null,

  abrir(rutina) {
    if (!rutina) return;
    Object.assign(this, {
      activo: true,
      rutina,
      pasos: construirPasos(rutina),
      i: 0,
      pausado: false,
      inicio: Date.now(),
      terminado: false,
      sensacion: "bien",
    });
    this.iniciarPaso();
    $("#entreno").hidden = false;
    document.body.classList.add("bloqueado");
    history.pushState({ entreno: true }, "");
    this.intervalo = setInterval(() => this.tick(), 250);
    this.mantenerPantalla();
    try {
      this.audio = this.audio || new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  },

  cerrar() {
    this.activo = false;
    clearInterval(this.intervalo);
    $("#entreno").hidden = true;
    document.body.classList.remove("bloqueado");
    if (this.wakeLock) this.wakeLock.release().catch(() => {});
    this.wakeLock = null;
    if (history.state && history.state.entreno) history.back();
    render();
  },

  pedirSalida() {
    if (this.terminado || confirm("¿Salir del entrenamiento sin guardar?")) this.cerrar();
  },

  async mantenerPantalla() {
    try {
      if ("wakeLock" in navigator) this.wakeLock = await navigator.wakeLock.request("screen");
    } catch {}
  },

  get paso() {
    return this.pasos[this.i];
  },

  iniciarPaso() {
    const d = duracionPaso(this.paso);
    this.restante = d || 0;
    this.total = d || 0;
    this.fin = Date.now() + this.restante * 1000;
    this.pausado = false;
    this.renderPaso();
  },

  tick() {
    if (this.terminado || this.pausado || duracionPaso(this.paso) == null) return;
    const ahora = Math.max(0, Math.ceil((this.fin - Date.now()) / 1000));
    if (ahora === this.restante) return;
    this.restante = ahora;
    if (ahora === 0) return this.avanzar();
    if (ahora <= 3) {
      this.pitido(660, 0.08);
      vibrar(30);
    }
    this.actualizarAnillo();
  },

  avanzar() {
    this.pitido(880, 0.18);
    vibrar([60, 40, 60]);
    if (this.i + 1 < this.pasos.length) {
      this.i++;
      this.iniciarPaso();
    } else {
      this.duracion = Math.round((Date.now() - this.inicio) / 1000);
      this.terminado = true;
      this.renderResumen();
    }
  },

  alternarPausa() {
    if (this.pausado) {
      this.fin = Date.now() + this.restante * 1000;
      this.pausado = false;
    } else {
      this.pausado = true;
    }
    const b = $("#entreno [data-e='pausa']");
    if (b) b.textContent = this.pausado ? "▶" : "❚❚";
  },

  sumar15() {
    this.fin += 15000;
    this.restante += 15;
    this.total += 15;
    this.actualizarAnillo();
  },

  pitido(frecuencia, duracion) {
    const ctx = this.audio;
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.frequency.value = frecuencia;
      gan.gain.setValueAtTime(0.15, ctx.currentTime);
      gan.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion);
      osc.connect(gan).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duracion);
    } catch {}
  },

  actualizarAnillo() {
    const anillo = $("#entreno .anillo-progreso");
    const texto = $("#entreno .anillo-texto");
    if (!anillo || !texto) return;
    const frac = this.total > 0 ? this.restante / this.total : 0;
    anillo.style.strokeDashoffset = String(CIRCUNFERENCIA * (1 - Math.min(1, frac)));
    texto.textContent = formatoReloj(this.restante);
  },

  htmlAnillo(color) {
    return `
      <div class="anillo">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="90" class="anillo-fondo" style="stroke:${color}"></circle>
          <circle cx="100" cy="100" r="90" class="anillo-progreso" style="stroke:${color};stroke-dasharray:${CIRCUNFERENCIA};stroke-dashoffset:0"></circle>
        </svg>
        <span class="anillo-texto">${formatoReloj(this.restante)}</span>
      </div>`;
  },

  htmlControlesTiempo(textoTerminar) {
    return `
      <div class="controles">
        <button class="btn-gris" data-e="pausa" aria-label="Pausar o reanudar">${this.pausado ? "▶" : "❚❚"}</button>
        <button class="btn grande" data-e="avanzar">${textoTerminar}</button>
      </div>`;
  },

  renderPaso() {
    const p = this.paso;
    const progreso = (this.i / this.pasos.length) * 100;
    let cuerpo = "";
    if (p.tipo === "preparacion") {
      cuerpo = `
        <div class="paso">
          <div class="espacio"></div>
          <h1>Prepárate</h1>
          ${this.htmlAnillo("var(--azul)")}
          <p class="secundario grande-texto">Primero: ${esc(p.primero.nombre)}</p>
          <div class="espacio"></div>
          <button class="btn grande" data-e="avanzar">Empezar ya</button>
        </div>`;
    } else if (p.tipo === "ejercicio") {
      const e = p.ejercicio;
      const objetivo =
        p.reps != null
          ? `<div class="reps"><strong>${p.reps}</strong><span>${p.porLado ? "repeticiones por lado" : "repeticiones"}</span></div>`
          : this.htmlAnillo("var(--naranja)");
      const controles =
        p.reps != null
          ? `<button class="btn grande" data-e="avanzar">✓ ¡Hecho!</button>`
          : this.htmlControlesTiempo("Terminar serie");
      cuerpo = `
        <div class="paso">
          <small class="naranja negrita">SERIE ${p.serie} DE ${p.total}</small>
          ${htmlIcono(e.categoria, "xl")}
          <h1>${esc(e.nombre)}</h1>
          ${p.lado ? `<p class="naranja negrita grande-texto">${p.lado}</p>` : ""}
          <div class="espacio"></div>
          ${objetivo}
          <div class="espacio"></div>
          <button class="enlace" data-e="tecnica">ⓘ Ver técnica</button>
          ${controles}
        </div>`;
    } else {
      cuerpo = `
        <div class="paso">
          <div class="espacio"></div>
          <h1>Descansa</h1>
          ${this.htmlAnillo("var(--verde)")}
          <p class="secundario">Siguiente</p>
          <p class="grande-texto negrita">${esc(p.siguiente.nombre)}</p>
          <div class="espacio"></div>
          <button class="btn-gris" data-e="mas15">+15 s</button>
          ${this.htmlControlesTiempo("Saltar descanso")}
        </div>`;
    }
    $("#entreno").innerHTML = `
      <header class="entreno-barra">
        <button class="cerrar-entreno" data-e="salir" aria-label="Salir">✕</button>
        <strong>${esc(this.rutina.nombre)}</strong>
        <span></span>
      </header>
      <div class="barra-progreso"><div style="width:${progreso}%"></div></div>
      ${cuerpo}
      <div class="hoja" hidden></div>`;
    this.actualizarAnillo();
  },

  mostrarTecnica() {
    const e = this.paso.ejercicio;
    if (!e) return;
    if (!this.pausado && duracionPaso(this.paso) != null) this.alternarPausa();
    const hoja = $("#entreno .hoja");
    hoja.innerHTML = `
      <div class="hoja-contenido">
        <div class="fila-titulo"><h2>${esc(e.nombre)}</h2><button class="enlace" data-e="cerrar-tecnica">Listo</button></div>
        <p>${esc(e.resumen)}</p>
        <h3>Cómo se hace</h3>
        <ol class="pasos">${e.pasos.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
        <h3>Errores comunes</h3>
        <ul class="errores">${e.errores.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>`;
    hoja.hidden = false;
  },

  renderResumen() {
    const series = this.pasos.filter((p) => p.tipo === "ejercicio").length;
    const mensajes = {
      facil: "Genial. Si se repite, la app te sugerirá subir de nivel.",
      bien: "Ese es el punto justo: exigente pero con buena técnica.",
      dificil: "Normal al comienzo. Usa las versiones más fáciles y repite el nivel.",
    };
    $("#entreno").innerHTML = `
      <header class="entreno-barra">
        <button class="cerrar-entreno" data-e="salir" aria-label="Cerrar">✕</button><span></span><span></span>
      </header>
      <div class="resumen">
        <div class="trofeo">🏆</div>
        <h1>¡Entrenamiento completado!</h1>
        <p class="secundario grande-texto">${esc(this.rutina.nombre)}</p>
        <div class="datos">
          ${htmlDato("Tiempo", `${Math.max(1, Math.floor(this.duracion / 60))} min`, "⏱")}
          ${htmlDato("Series", String(series), "🔁")}
        </div>
        <h3>¿Cómo te sentiste?</h3>
        <div class="sensaciones">
          ${SENSACIONES.map(
            (s) => `
            <button class="sensacion ${s.id === this.sensacion ? "elegida" : ""}" data-e="sensacion" data-valor="${s.id}">
              <span>${s.emoji}</span><strong>${s.nombre}</strong>
            </button>`
          ).join("")}
        </div>
        <p class="nota centro">${mensajes[this.sensacion]}</p>
        <button class="btn grande" data-e="guardar">Guardar entrenamiento</button>
      </div>`;
  },
};

function vibrar(patron) {
  try {
    if (navigator.vibrate) navigator.vibrate(patron);
  } catch {}
}

$("#entreno").addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-e]");
  if (!el) return;
  const e = Entreno;
  switch (el.dataset.e) {
    case "avanzar":
      e.avanzar();
      break;
    case "pausa":
      e.alternarPausa();
      break;
    case "mas15":
      e.sumar15();
      break;
    case "salir":
      e.pedirSalida();
      break;
    case "tecnica":
      e.mostrarTecnica();
      break;
    case "cerrar-tecnica":
      $("#entreno .hoja").hidden = true;
      break;
    case "sensacion":
      e.sensacion = el.dataset.valor;
      e.renderResumen();
      break;
    case "guardar":
      Progreso.registrar(e.rutina, e.duracion, e.sensacion);
      e.cerrar();
      break;
  }
});

// Botón "atrás" de Android durante el entrenamiento
window.addEventListener("popstate", () => {
  if (!Entreno.activo) return;
  if (Entreno.terminado || confirm("¿Salir del entrenamiento sin guardar?")) {
    Entreno.activo = false;
    Entreno.cerrar();
  } else {
    history.pushState({ entreno: true }, "");
  }
});

// Al volver a la app, recupera el bloqueo de pantalla
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Entreno.activo) Entreno.mantenerPantalla();
});

// ---------- Inicio ----------

Progreso.cargar();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
