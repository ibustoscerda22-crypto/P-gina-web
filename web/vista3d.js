// Vista 3D de la celda (three.js). La usan web/index.html y vista_previa.html.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const S = 0.001; // mm -> m
const rgb = (c) => (c[0] << 16) | (c[1] << 8) | c[2];

function caja(x0, y0, z0, lx, ly, lz, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(lx * S, ly * S, lz * S), new THREE.MeshStandardMaterial({ color }));
  m.position.set((x0 + lx / 2) * S, (y0 + ly / 2) * S, (z0 + lz / 2) * S);
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })));
  return m;
}

/**
 * Crea la vista en `host`. Devuelve { actualizar(datos), mostrar(n) }.
 * `alCambiar(n, total, capa)` se llama cada vez que cambia el número de cajas visibles.
 */
export function crearVista(host, alCambiar = () => {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(-3.2, -3.6, 3.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.9, 0.4, 0.8);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(-3, -4, 6);
  scene.add(sol);

  const oscuroMQ = matchMedia("(prefers-color-scheme: dark)");
  let celda = new THREE.Group();
  scene.add(celda);
  let cajas = [], places = [];

  function fondo() {
    const t = document.documentElement.dataset.theme;
    const oscuro = t ? t === "dark" : oscuroMQ.matches;
    scene.background = new THREE.Color(oscuro ? 0x15171a : 0xf4f5f7);
    return oscuro;
  }

  function actualizar(D) {
    scene.remove(celda);
    celda.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    celda = new THREE.Group();
    const oscuro = fondo();
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({ color: oscuro ? 0x2a2d31 : 0xe2e4e8 }));
    suelo.position.z = D.suelo * S;
    celda.add(suelo);
    const grid = new THREE.GridHelper(10, 20, 0x888888, oscuro ? 0x3a3d42 : 0xc8cbd0);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = D.suelo * S + 0.001;
    celda.add(grid);
    for (const p of D.partes) {
      if (p.nombre === "Garra") continue;
      const g = new THREE.Group();
      g.position.set(p.t[0] * S, p.t[1] * S, p.t[2] * S);
      for (const b of p.cajas) g.add(caja(...b, rgb(p.color)));
      celda.add(g);
    }
    // Robot esquemático y círculo de alcance
    celda.add(caja(-350, -350, D.suelo, 700, 700, -D.suelo + 300, 0xe8a317));
    celda.add(caja(-200, -200, 300, 400, 400, 600, 0xe8a317));
    const anillo = new THREE.Mesh(new THREE.RingGeometry(D.alcance * S - 0.01, D.alcance * S, 128),
      new THREE.MeshBasicMaterial({ color: 0xe8a317, side: THREE.DoubleSide }));
    anillo.position.z = D.suelo * S + 0.003;
    celda.add(anillo);
    places = D.places;
    cajas = places.map((p) => {
      const m = caja(p.x - p.lx / 2 + 1, p.y - p.ly / 2 + 1, p.z - D.alto_caja + 1, p.lx - 2, p.ly - 2, D.alto_caja - 2,
        p.capa % 2 ? 0xcd9f64 : 0xb8854a);
      celda.add(m);
      return m;
    });
    scene.add(celda);
    mostrar(cajas.length);
  }

  function mostrar(n) {
    cajas.forEach((c, i) => (c.visible = i < n));
    alCambiar(n, cajas.length, n ? places[n - 1].capa : 0);
  }

  function tam() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(tam).observe(host);
  tam();
  oscuroMQ.addEventListener("change", fondo);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  return { actualizar, mostrar };
}

/** Botón ▶ / ⏸ + slider que anima el apilado caja a caja. */
export function controlesAnimacion(vista, boton, slider) {
  let timer = null, total = 0;
  const parar = () => { clearInterval(timer); timer = null; boton.textContent = "▶ Simular apilado"; };
  slider.addEventListener("input", () => { parar(); vista.mostrar(+slider.value); });
  boton.addEventListener("click", () => {
    if (timer) return parar();
    if (+slider.value >= total) slider.value = 0;
    boton.textContent = "⏸ Pausa";
    timer = setInterval(() => {
      slider.value = +slider.value + 1;
      vista.mostrar(+slider.value);
      if (+slider.value >= total) parar();
    }, 180);
  });
  return {
    reiniciar(n) { parar(); total = n; slider.max = n; slider.value = n; },
  };
}
