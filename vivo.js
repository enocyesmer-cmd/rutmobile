/* Datos reales de Rutmovil (operación 09): conexión con Firebase Realtime Database (plan gratis).
   Archivo nuevo. AQUÍ SE PEGA LA CLAVE (la dirección de tu base de datos). Mientras esté vacía, la app funciona en MODO DEMO:
   nada se envía ni se lee y no sale ningún error. Los pasos para crear la base de datos están en la operación 11. */

// Guía paso a paso: GUIA-FIREBASE.md (las reglas de seguridad están en firebase-reglas.json).
// Dirección de tu base de datos de Firebase, por ejemplo: 'https://mi-proyecto-default-rtdb.firebaseio.com'
var FIREBASE_URL = '';
// Opcional: token o secreto de la base de datos si tus reglas piden autenticación. Con reglas abiertas déjalo vacío.
var FIREBASE_CLAVE = '';

(function () {
  var EDAD_MAXIMA_MS = 45000;   // un bus que no avisa en 45 segundos se considera desconectado
  var base = String(FIREBASE_URL || '').trim().replace(/\/+$/, '');
  var activo = /^https:\/\/[\w.-]+/.test(base);   // sin dirección (o mal escrita) = modo demo
  var clave = String(FIREBASE_CLAVE || '').trim();

  // Identificador de este celular como conductor: se crea una vez y se recuerda.
  function miId() {
    var id = '';

    try { id = localStorage.getItem('rutmovil-conductor-id') || ''; } catch (e) {}

    if (!/^[a-z0-9]{8,20}$/.test(id)) {
      id = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

      try { localStorage.setItem('rutmovil-conductor-id', id); } catch (e) {}
    }

    return id;
  }

  function url(ruta) {
    return base + '/' + ruta + '.json' + (clave ? '?auth=' + encodeURIComponent(clave) : '');
  }

  // Solo se envía lo que se espera, con su tipo y tamaño: la base de datos es pública y no debe recibir basura.
  function limpiar(d) {
    var lat = Number(d.lat);
    var lng = Number(d.lng);

    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

    var salida = {
      ruta: String(d.ruta || '').slice(0, 8),
      nombre: String(d.nombre || '').slice(0, 24),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      t: Date.now()
    };

    // El GPS manda null cuando no sabe el rumbo o la velocidad: eso no es 0, así que no se envía.
    if (typeof d.parada === 'number' && d.parada >= 0 && d.parada < 200) salida.parada = Math.floor(d.parada);   // parada más cercana dentro de la ruta
    if (typeof d.rumbo === 'number' && isFinite(d.rumbo)) salida.rumbo = Math.round(d.rumbo);
    if (typeof d.vel === 'number' && isFinite(d.vel)) salida.vel = Math.round(d.vel);

    return salida.ruta ? salida : null;
  }

  // Publica la posición de un bus. Siempre responde con { ok, demo }: nunca lanza un error.
  function publicar(id, datos) {
    var limpio = limpiar(datos);

    if (!activo) return Promise.resolve({ ok: false, demo: true });
    if (!limpio) return Promise.resolve({ ok: false, demo: false, motivo: 'datos' });

    return fetch(url('buses/' + id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limpio)
    }).then(function (r) {
      return { ok: r.ok, demo: false, motivo: r.ok ? '' : 'http' + r.status };
    }).catch(function () {
      return { ok: false, demo: false, motivo: 'red' };
    });
  }

  // Borra la posición del bus (al dejar de compartir). keepalive deja que la petición termine aunque se cierre la página.
  function quitar(id) {
    if (!activo) return Promise.resolve({ ok: false, demo: true });

    return fetch(url('buses/' + id), { method: 'DELETE', keepalive: true })
      .then(function (r) { return { ok: r.ok, demo: false }; })
      .catch(function () { return { ok: false, demo: false, motivo: 'red' }; });
  }

  // Lee los buses reales conectados ahora (los más viejos que EDAD_MAXIMA_MS se descartan). Lo usa la operación 10.
  function leer() {
    if (!activo) return Promise.resolve([]);

    return fetch(url('buses')).then(function (r) { return r.ok ? r.json() : null; }).then(function (todo) {
      var ahora = Date.now();

      if (!todo || typeof todo !== 'object') return [];

      return Object.keys(todo).map(function (id) {
        var b = todo[id];

        return b && typeof b === 'object' ? { id: id, ruta: b.ruta, nombre: b.nombre || '', lat: b.lat, lng: b.lng, rumbo: b.rumbo, vel: b.vel, parada: b.parada, t: b.t } : null;
      }).filter(function (b) {
        return b && isFinite(b.lat) && isFinite(b.lng) && b.ruta && isFinite(b.t) && ahora - b.t <= EDAD_MAXIMA_MS;
      });
    }).catch(function () { return []; });
  }

  // ---- reportes de los pasajeros (operación 12): retraso, bus lleno o accidente en una ruta ----
  var TIPOS_REPORTE = ['retraso', 'lleno', 'accidente'];

  // Publica un reporte. La clave es [id del celular]-[ruta]-[tipo]: repetir el mismo reporte solo renueva su hora (no se acumulan).
  function publicarReporte(id, datos) {
    var ruta = String((datos && datos.ruta) || '').slice(0, 8);
    var tipo = String((datos && datos.tipo) || '');

    if (!activo) return Promise.resolve({ ok: false, demo: true });
    if (!/^[a-z0-9]{1,8}$/.test(ruta) || TIPOS_REPORTE.indexOf(tipo) === -1) return Promise.resolve({ ok: false, demo: false, motivo: 'datos' });

    return fetch(url('reportes/' + id + '-' + ruta + '-' + tipo), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruta: ruta, tipo: tipo, t: Date.now() })
    }).then(function (r) {
      return { ok: r.ok, demo: false, motivo: r.ok ? '' : 'http' + r.status };
    }).catch(function () {
      return { ok: false, demo: false, motivo: 'red' };
    });
  }

  // Lee los reportes publicados (quien los muestra decide cuánto dura cada tipo). Sin base de datos devuelve una lista vacía.
  function leerReportes() {
    if (!activo) return Promise.resolve([]);

    return fetch(url('reportes')).then(function (r) { return r.ok ? r.json() : null; }).then(function (todo) {
      if (!todo || typeof todo !== 'object') return [];

      return Object.keys(todo).map(function (clave) {
        var d = todo[clave];

        return d && typeof d === 'object' ? { clave: clave, ruta: String(d.ruta || ''), tipo: String(d.tipo || ''), t: Number(d.t) } : null;
      }).filter(function (d) {
        return d && d.ruta && TIPOS_REPORTE.indexOf(d.tipo) !== -1 && isFinite(d.t);
      });
    }).catch(function () { return null; });   // null = no se pudo leer (distinto de "no hay reportes")
  }

  window.RutmovilVivo = {
    activo: activo,
    edadMaximaMs: EDAD_MAXIMA_MS,
    miId: miId,
    publicar: publicar,
    quitar: quitar,
    leer: leer,
    publicarReporte: publicarReporte,
    leerReportes: leerReportes
  };
})();
