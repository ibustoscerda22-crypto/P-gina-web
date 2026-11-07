// Guarda la app en caché para que funcione sin internet (en el auto suele no haber señal).
const CACHE = 'obd-diagnostico-v1';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'icon.svg',
  'manifest.webmanifest',
  'js/app.js',
  'js/analysis.js',
  'js/dtc.js',
  'js/elm327.js',
  'js/pids.js',
  'js/simulator.js',
  'js/transport.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
