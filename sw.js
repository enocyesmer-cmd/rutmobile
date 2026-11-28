/* Service worker de Rutmovil: deja la app funcionando sin internet.
   Si cambias archivos de la página, sube el número de VERSION para que se actualice. */
var VERSION = 'rutmovil-v22';

var ARCHIVOS = [
  './',
  'index.html',
  'style.css',
  'script.js',
  'map.css',
  'map.js',
  'plan.css',
  'plan.js',
  'tarifas.css',
  'tarifas.js',
  'horarios.css',
  'horarios.js',
  'rutas-extra.js',
  'mapa-todas.css',
  'mapa-todas.js',
  'vivo.js',
  'vivo-mapa.css',
  'vivo-mapa.js',
  'conductor.css',
  'conductor.js',
  'reportes.css',
  'reportes.js',
  'bienvenida.css',
  'bienvenida.js',
  'nicaragua.js',
  'manifest.webmanifest',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'maskable-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSION)
      .then(function (cache) { return cache.addAll(ARCHIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (claves) {
        return Promise.all(claves.filter(function (clave) {
          return clave !== VERSION;
        }).map(function (clave) {
          return caches.delete(clave);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Primero lo guardado (rápido y sin internet) y se actualiza en segundo plano.
self.addEventListener('fetch', function (evento) {
  var peticion = evento.request;

  if (peticion.method !== 'GET') return;

  var url = new URL(peticion.url);
  var esPropio = url.origin === self.location.origin;
  var esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ||
    (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.indexOf('/leaflet/') !== -1);

  if (!esPropio && !esFuente) return;

  evento.respondWith(
    caches.match(peticion, { ignoreSearch: esPropio }).then(function (guardado) {
      var red = fetch(peticion).then(function (respuesta) {
        if (respuesta && (respuesta.ok || respuesta.type === 'opaque')) {
          var copia = respuesta.clone();
          caches.open(VERSION).then(function (cache) { cache.put(peticion, copia); });
        }

        return respuesta;
      }).catch(function () {
        return guardado || (peticion.mode === 'navigate' ? caches.match('index.html') : Response.error());
      });

      return guardado || red;
    })
  );
});
