/* Modo conductor de Rutmovil (operación 09 y su mejora 09b).
   Archivo nuevo: pantalla "Soy conductor". El celular usa su GPS siempre que la pantalla está abierta (aunque todavía no comparta)
   y lo cruza con las paradas de la ruta para saber dónde está: parada más cercana, distancia a la ruta, avance y próxima parada.
   Al abrir elige sola la ruta más cercana a donde estás. Al activar "compartir", manda la posición y la ruta con vivo.js (Firebase) aunque
   cierres la pantalla, y si recargas la página se reanuda sola (si ya diste permiso del GPS).
   Si vivo.js no tiene la dirección de la base de datos (modo demo), todo se ve igual pero no se envía nada, y se avisa en pantalla.
   La posición solo se comparte mientras el conductor lo tiene activado: al parar (o al cerrar la página) se borra de la base de datos. */
(function () {
  var ENVIO_MINIMO_MS = 3000;    // no enviar más seguido que esto
  var LATIDO_MS = 5000;          // si el celular está quieto, igual avisa cada tanto que sigue conectado
  var MAX_IMPRECISION_M = 300;   // lecturas con más error que esto no se envían
  var MAX_SUGERIR_M = 1500;      // la ruta se elige sola si hay una a esta distancia o menos
  var LEJOS_M = 400;             // más lejos que esto de la ruta se avisa "estás fuera de la ruta"

  var boton = document.getElementById('conductorbtn');
  var panel = null;
  var abierto = false;
  var campos = {};
  var compartiendo = false;
  var idVigilancia = null;
  var latido = null;
  var reloj = null;
  var candado = null;            // pantalla encendida mientras se comparte
  var ultima = null;             // última lectura del GPS
  var ultimoEnvio = 0;
  var enviados = 0;
  var fallos = 0;
  var tocoRuta = false;          // si la persona eligió la ruta a mano, ya no se cambia sola
  var sugerida = false;

  if (!boton) return;

  var Vivo = function () { return window.RutmovilVivo; };

  var escapar = function (texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function leerGuardado(clave) {
    try { return localStorage.getItem(clave) || ''; } catch (e) { return ''; }
  }

  function guardar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) {}
  }

  function borrarGuardado(clave) {
    try { localStorage.removeItem(clave); } catch (e) {}
  }

  function textoDistancia(metros) {
    return metros < 1000 ? Math.round(metros / 10) * 10 + ' m' : (metros / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  // ---- dónde está el conductor respecto a una ruta ----
  function coordsDe(ruta) {
    var mapa = window.RutmovilMapa;
    var paradas = mapa && mapa.paradas;
    var lista = [];

    if (!paradas) return null;

    for (var i = 0; i < ruta.stops.length; i++) {
      if (!paradas[ruta.stops[i]]) return null;

      lista.push(paradas[ruta.stops[i]]);
    }

    return lista;
  }

  // Convierte a metros alrededor de un punto (suficiente para distancias de una ciudad).
  function aMetros(punto, lat0) {
    return [punto[1] * 111320 * Math.cos(lat0 * Math.PI / 180), punto[0] * 110574];
  }

  // Punto [lat, lng] contra la línea de paradas de la ruta: distancia a la línea, parada más cercana y avance.
  function ubicarEnRuta(ruta, lat, lng) {
    var puntos = coordsDe(ruta);

    if (!puntos) return null;

    var yo = aMetros([lat, lng], lat);
    var m = puntos.map(function (p) { return aMetros(p, lat); });
    var mejor = { dist: Infinity, tramo: 0, t: 0 };
    var cercana = { dist: Infinity, indice: 0 };

    for (var i = 0; i < m.length; i++) {
      var dp = Math.hypot(yo[0] - m[i][0], yo[1] - m[i][1]);

      if (dp < cercana.dist) cercana = { dist: dp, indice: i };

      if (i === m.length - 1) break;

      var ax = m[i][0], ay = m[i][1];
      var vx = m[i + 1][0] - ax, vy = m[i + 1][1] - ay;
      var largo = vx * vx + vy * vy;
      var t = largo ? Math.max(0, Math.min(1, ((yo[0] - ax) * vx + (yo[1] - ay) * vy) / largo)) : 0;
      var d = Math.hypot(yo[0] - (ax + t * vx), yo[1] - (ay + t * vy));

      if (d < mejor.dist) mejor = { dist: d, tramo: i, t: t };
    }

    var avance = mejor.tramo + mejor.t;   // 0 = primera parada, n-1 = última
    var siguiente = avance >= m.length - 1 - 0.02 ? null : Math.min(m.length - 1, Math.floor(avance + 0.02) + 1);

    return {
      lejos: mejor.dist, parada: cercana.indice, paradaDist: cercana.dist,
      progreso: Math.round(avance / (m.length - 1) * 100), siguiente: siguiente
    };
  }

  function rutaPorId(id) {
    var datos = window.RutmovilDatos;

    return datos && datos.rutas ? datos.rutas.filter(function (r) { return r.id === id; })[0] : null;
  }

  // Ruta más cercana a la posición actual.
  function rutaMasCercana(lat, lng) {
    var datos = window.RutmovilDatos;
    var mejor = null;

    if (!datos || !datos.rutas) return null;

    datos.rutas.forEach(function (ruta) {
      var u = ubicarEnRuta(ruta, lat, lng);

      if (u && (!mejor || u.lejos < mejor.u.lejos)) mejor = { ruta: ruta, u: u };
    });

    return mejor;
  }

  function opcionesRutas() {
    var datos = window.RutmovilDatos;

    if (!datos || !datos.rutas) return '';

    return datos.rutas.map(function (r) {
      return '<option value="' + escapar(r.id) + '">Ruta ' + escapar(r.id) + ' · ' + escapar(r.stops[0]) + ' → ' + escapar(r.stops[r.stops.length - 1]) + '</option>';
    }).join('');
  }

  function construir() {
    if (panel) return;

    var real = Vivo() && Vivo().activo;

    panel = document.createElement('div');
    panel.className = 'pl cd';
    panel.id = 'conductor';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'cd-titulo');
    panel.innerHTML =
      '<div class="pl-top"><h2 id="cd-titulo">Soy conductor</h2>' +
      '<button class="pl-cerrar" type="button" aria-label="Cerrar modo conductor">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="pl-cuerpo">' +
      '<p class="cd-modo ' + (real ? 'cd-real' : 'cd-demo') + '">' + (real
        ? '<b>Conectado.</b> Tu posición se envía a la base de datos y los pasajeros ven tu bus en vivo.'
        : '<b>Modo demo.</b> Todavía no hay base de datos conectada: puedes probar el GPS, pero tu posición no se envía a nadie.') + '</p>' +
      '<div class="pl-form">' +
      '<div class="pl-campo"><label for="cd-ruta">Ruta que manejas</label><select id="cd-ruta">' + opcionesRutas() + '</select></div>' +
      '<p class="cd-sugerencia" id="cd-sugerencia" role="status" hidden></p>' +
      '<div class="pl-campo"><label for="cd-nombre">Unidad (opcional)</label><input id="cd-nombre" type="text" maxlength="24" placeholder="Ejemplo: Bus 12" autocomplete="off"></div>' +
      '<button class="pl-ir" type="button" id="cd-ir">Empezar a compartir mi posición</button></div>' +
      '<p class="pl-aviso cd-error" id="cd-error" role="alert" hidden></p>' +
      '<dl class="cd-datos" id="cd-datos" hidden>' +
      '<div><dt>Estado</dt><dd id="cd-estado">–</dd></div>' +
      '<div><dt>Precisión</dt><dd id="cd-precision">–</dd></div>' +
      '<div class="cd-ancho"><dt>Cerca de</dt><dd class="cd-texto" id="cd-cerca">–</dd></div>' +
      '<div><dt>Distancia a la ruta</dt><dd id="cd-lejos">–</dd></div>' +
      '<div><dt>Avance en la ruta</dt><dd id="cd-avance">–</dd></div>' +
      '<div class="cd-ancho"><dt>Próxima parada</dt><dd class="cd-texto" id="cd-sig">–</dd></div>' +
      '<div><dt>Velocidad</dt><dd id="cd-vel">–</dd></div>' +
      '<div><dt>Último envío</dt><dd id="cd-ultimo">–</dd></div></dl>' +
      '<p class="pl-nota">La ubicación está activa mientras esta pantalla está abierta, para saber dónde estás en la ruta. ' +
      'Solo se comparte con los pasajeros cuando tocas "Empezar a compartir", y se borra al dejar de compartir o cerrar la página. ' +
      'Mantén la pantalla encendida: la app intenta evitar que se apague.</p></div>';

    document.body.appendChild(panel);

    ['ruta', 'nombre', 'ir', 'error', 'datos', 'estado', 'precision', 'cerca', 'lejos', 'avance', 'sig', 'vel', 'ultimo', 'sugerencia'].forEach(function (k) {
      campos[k] = panel.querySelector('#cd-' + k);
    });

    var rutaGuardada = leerGuardado('rutmovil-conductor-ruta');

    if (rutaGuardada && campos.ruta.querySelector('option[value="' + rutaGuardada.replace(/"/g, '') + '"]')) {
      campos.ruta.value = rutaGuardada;
      tocoRuta = true;   // la ruta de la vez anterior se respeta hasta que la persona decida otra
    }

    campos.nombre.value = leerGuardado('rutmovil-conductor-nombre');

    panel.querySelector('.pl-cerrar').addEventListener('click', cerrar);
    campos.ir.addEventListener('click', function () { if (compartiendo) parar(); else empezar(); });
    campos.ruta.addEventListener('change', function () {
      tocoRuta = true;
      campos.sugerencia.hidden = true;
      pintar();
    });
    panel.addEventListener('keydown', function (evento) { if (evento.key === 'Escape') cerrar(); });
  }

  function mostrarError(texto) {
    campos.error.textContent = texto || '';
    campos.error.hidden = !texto;
  }

  // La primera vez que llega la ubicación se elige sola la ruta más cercana (si la persona no eligió ya otra).
  function sugerir() {
    if (sugerida || tocoRuta || compartiendo || !ultima) return;

    var c = rutaMasCercana(ultima.latitude, ultima.longitude);

    sugerida = true;

    if (!c) return;

    if (c.u.lejos <= MAX_SUGERIR_M) {
      campos.ruta.value = c.ruta.id;
      campos.sugerencia.textContent = 'Elegimos la ruta ' + c.ruta.id + ' porque es la más cercana a tu ubicación (a ' + textoDistancia(c.u.lejos) + '). Cámbiala si manejas otra.';
    } else {
      campos.sugerencia.textContent = 'Estás a ' + textoDistancia(c.u.lejos) + ' de la ruta más cercana (la ' + c.ruta.id + '). Elige la ruta que manejas.';
    }

    campos.sugerencia.hidden = false;
  }

  function pintar() {
    if (!panel) return;

    var ahora = Date.now();
    var vivo = Vivo();
    var ruta = rutaPorId(campos.ruta.value);
    var u = ultima && ruta ? ubicarEnRuta(ruta, ultima.latitude, ultima.longitude) : null;

    campos.ir.textContent = compartiendo ? 'Dejar de compartir' : 'Empezar a compartir mi posición';
    campos.ir.classList.toggle('cd-parar', compartiendo);
    campos.ruta.disabled = compartiendo;
    campos.nombre.disabled = compartiendo;
    campos.datos.hidden = !(compartiendo || idVigilancia !== null);
    boton.classList.toggle('cd-activo', compartiendo);

    if (campos.datos.hidden) return;

    if (!ultima) {
      campos.estado.textContent = 'Buscando GPS…';
    } else if (!compartiendo) {
      campos.estado.textContent = 'Ubicación activa';
    } else if (vivo && vivo.activo) {
      campos.estado.textContent = fallos > 2 ? 'Sin conexión, reintentando' : 'En vivo real';
    } else {
      campos.estado.textContent = 'Demo (no se envía)';
    }

    campos.precision.textContent = ultima ? '± ' + Math.round(ultima.accuracy) + ' m' : '–';
    campos.vel.textContent = ultima && ultima.speed !== null && isFinite(ultima.speed) ? Math.round(ultima.speed * 3.6) + ' km/h' : '–';

    if (u) {
      campos.cerca.textContent = ruta.stops[u.parada] + ' (a ' + textoDistancia(u.paradaDist) + ')';
      campos.lejos.textContent = u.lejos > LEJOS_M ? 'Fuera: ' + textoDistancia(u.lejos) : textoDistancia(u.lejos);
      campos.lejos.classList.toggle('cd-mal', u.lejos > LEJOS_M);
      campos.avance.textContent = u.progreso + ' %';
      campos.sig.textContent = u.siguiente === null ? 'Fin de la ruta' : ruta.stops[u.siguiente];
    } else {
      campos.cerca.textContent = '–';
      campos.lejos.textContent = '–';
      campos.lejos.classList.remove('cd-mal');
      campos.avance.textContent = '–';
      campos.sig.textContent = '–';
    }

    campos.ultimo.textContent = vivo && vivo.activo
      ? (!compartiendo ? 'no compartes' : (ultimoEnvio ? 'hace ' + Math.max(0, Math.round((ahora - ultimoEnvio) / 1000)) + ' s · ' + enviados + ' envíos' : 'todavía no'))
      : (compartiendo ? 'no se envía (demo)' : '–');
  }

  function enviar() {
    var vivo = Vivo();

    if (!compartiendo || !ultima || !vivo) return;
    if (ultima.accuracy > MAX_IMPRECISION_M) return;

    var ahora = Date.now();

    if (ahora - ultimoEnvio < ENVIO_MINIMO_MS) return;

    ultimoEnvio = ahora;

    var u = ubicarEnRuta(rutaPorId(campos.ruta.value) || { stops: [] }, ultima.latitude, ultima.longitude);

    vivo.publicar(vivo.miId(), {
      ruta: campos.ruta.value,
      nombre: campos.nombre.value.trim(),
      lat: ultima.latitude,
      lng: ultima.longitude,
      rumbo: ultima.heading,
      vel: ultima.speed !== null && isFinite(ultima.speed) ? ultima.speed * 3.6 : null,
      parada: u ? u.parada : null
    }).then(function (r) {
      if (r.ok) { enviados++; fallos = 0; } else if (!r.demo) { fallos++; }

      pintar();
    });
  }

  function pedirPantalla() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (c) { candado = c; }).catch(function () {});
      }
    } catch (e) {}
  }

  function soltarPantalla() {
    try { if (candado && candado.release) candado.release(); } catch (e) {}

    candado = null;
  }

  // ---- GPS: activo mientras la pantalla esté abierta o se esté compartiendo ----
  function iniciarGPS() {
    if (idVigilancia !== null) return;

    if (!navigator.geolocation) {
      mostrarError('Este navegador no tiene GPS. Prueba con Chrome o Safari en el celular.');
      return;
    }

    idVigilancia = navigator.geolocation.watchPosition(function (pos) {
      ultima = pos.coords;
      sugerir();
      enviar();
      pintar();
    }, function (error) {
      var textos = {
        1: 'No diste permiso para usar tu ubicación. Actívala en los ajustes del navegador y vuelve a intentarlo.',
        2: 'No se pudo obtener tu ubicación. Revisa que el GPS esté encendido.',
        3: 'El GPS tarda en responder. Sal a un lugar abierto y espera unos segundos.'
      };

      mostrarError(textos[error.code] || 'No se pudo leer el GPS.');

      // Si el permiso se negó no tiene caso seguir; con otros errores el GPS sigue intentando solo.
      if (error.code === 1) {
        if (compartiendo) parar();

        detenerGPS();
        pintar();
      }
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });

    reloj = setInterval(pintar, 1000);
  }

  function detenerGPS() {
    if (idVigilancia !== null && navigator.geolocation) navigator.geolocation.clearWatch(idVigilancia);

    idVigilancia = null;
    clearInterval(reloj);
    reloj = null;
    ultima = null;
  }

  function mantenerGPS() {
    if (abierto || compartiendo) iniciarGPS(); else detenerGPS();
  }

  function empezar() {
    mostrarError('');

    if (!navigator.geolocation) {
      mostrarError('Este navegador no tiene GPS. Prueba con Chrome o Safari en el celular.');
      return;
    }

    if (!campos.ruta.value) {
      mostrarError('Elige la ruta que manejas.');
      return;
    }

    guardar('rutmovil-conductor-ruta', campos.ruta.value);
    guardar('rutmovil-conductor-nombre', campos.nombre.value.trim());
    guardar('rutmovil-conductor-activo', '1');   // para reanudar solo si se recarga la página

    compartiendo = true;
    ultimoEnvio = 0;
    enviados = 0;
    fallos = 0;
    mantenerGPS();

    // Si el celular está quieto no llegan lecturas nuevas: el latido repite la última para seguir "en vivo".
    latido = setInterval(function () { if (ultima) { ultimoEnvio = 0; enviar(); } }, LATIDO_MS);
    pedirPantalla();
    enviar();
    pintar();
  }

  function parar() {
    var vivo = Vivo();

    compartiendo = false;
    clearInterval(latido);
    latido = null;
    soltarPantalla();
    borrarGuardado('rutmovil-conductor-activo');

    if (vivo) vivo.quitar(vivo.miId());

    mantenerGPS();
    pintar();
  }

  function abrir() {
    construir();

    abierto = true;
    panel.hidden = false;
    document.documentElement.classList.add('pl-abierto');
    mostrarError('');
    mantenerGPS();
    pintar();
    campos.ruta.focus();
  }

  function cerrar() {
    if (!panel) return;

    abierto = false;
    panel.hidden = true;
    document.documentElement.classList.remove('pl-abierto');
    mantenerGPS();   // si sigue compartiendo, el GPS no se apaga
    boton.focus();
  }

  // Al cerrar la página se borra la posición; la marca de "activo" se queda para reanudar al volver.
  window.addEventListener('pagehide', function () {
    var vivo = Vivo();

    if (compartiendo && vivo) vivo.quitar(vivo.miId());
  });
  document.addEventListener('visibilitychange', function () {
    if (compartiendo && document.visibilityState === 'visible' && !candado) pedirPantalla();
  });

  boton.addEventListener('click', abrir);

  // Si se estaba compartiendo y la página se recargó, se reanuda sola, pero solo si el permiso del GPS ya estaba dado.
  if (leerGuardado('rutmovil-conductor-activo') === '1' && navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(function (estado) {
      if (estado.state !== 'granted') {
        borrarGuardado('rutmovil-conductor-activo');
        return;
      }

      construir();
      empezar();
    }).catch(function () {});
  } else {
    borrarGuardado('rutmovil-conductor-activo');
  }

  window.RutmovilConductor = { abrir: abrir, cerrar: cerrar, estaCompartiendo: function () { return compartiendo; } };
})();
