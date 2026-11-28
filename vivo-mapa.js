/* Buses reales en el mapa de Rutmovil (operación 10).
   Archivo nuevo: lee con vivo.js (Firebase) los buses de los conductores conectados y los dibuja en el mapa que ya existe,
   mezclados con los simulados y marcados como "En vivo real" (anillo verde y etiqueta). Si el bus real ya no avisa, desaparece solo.
   Mientras vivo.js esté en modo demo (sin dirección de base de datos) este archivo no hace nada y no sale ningún error.
   Solo consulta la base de datos mientras el mapa está abierto y la página visible, para gastar poco internet y batería. */
(function () {
  var CADA_MS = 5000;        // cada cuánto se consultan los buses reales
  var SUAVIZADO_MS = 250;    // cada cuánto se acerca el marcador a su posición nueva (movimiento suave)
  var AUSENCIAS_MAX = 2;     // un bus que falta en 2 consultas seguidas se quita (así un fallo de red no lo borra al instante)

  var mapa = window.RutmovilMapa;
  var vivo = window.RutmovilVivo;
  var datos = window.RutmovilDatos;
  var sheet = document.getElementById('rm-sheet');
  var zonaVivo = document.getElementById('rm-vivo');

  // Modo demo o piezas que faltan: la app sigue igual.
  if (!mapa || !mapa.interno || !vivo || !vivo.activo || !datos || !datos.rutas || !sheet || !zonaVivo) return;

  var reales = {};            // id del conductor -> { marca, lat, lng, mostrado:{lat,lng}, ruta, nombre, rumbo, parada, t, ausente }
  var consultando = false;
  var temporizador = null;
  var suavizado = null;
  var ultimoHtml = '';

  var escapar = function (texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var rutaPorId = function (id) {
    return datos.rutas.filter(function (r) { return r.id === id; })[0];
  };

  // Caja de aviso en el panel inferior del mapa, justo encima de la información de los buses simulados.
  var caja = document.createElement('div');

  caja.id = 'rm-real';
  caja.className = 'rm-real';
  caja.hidden = true;
  caja.setAttribute('role', 'status');
  zonaVivo.parentNode.insertBefore(caja, zonaVivo);

  function crearMarca(ruta, bus, tono) {
    var L = window.L;
    var html = '<div class="rm-bus rm-real" style="--c:' + tono + '"><span class="rm-arrow"></span>' +
      '<span class="rm-badge">' + escapar(ruta.id) + '</span><span class="rm-tag">EN VIVO</span></div>';
    var marca = L.marker([bus.lat, bus.lng], {
      icon: L.divIcon({ className: 'rm-bus-wrap', html: html, iconSize: [46, 46], iconAnchor: [23, 23] }),
      keyboard: true,
      title: 'En vivo real: ruta ' + ruta.id + (bus.nombre ? ', ' + bus.nombre : ''),
      zIndexOffset: 800   // por encima de los simulados
    });

    marca.on('click', function () { if (mapa.elegirRuta) mapa.elegirRuta(ruta.id); });

    return marca;
  }

  // Lo que dibuja el mapa depende de lo que se esté viendo: modo, ruta elegida y rutas apagadas.
  function pintarMarcas() {
    var m = mapa.interno();

    if (!m.map || !m.capaBuses || !window.L) return;

    Object.keys(reales).forEach(function (id) {
      var bus = reales[id];
      var ruta = rutaPorId(bus.ruta);

      if (!ruta) return;

      if (!bus.marca) bus.marca = crearMarca(ruta, bus, m.color(ruta));

      // Apagado desde la leyenda de "todas las rutas": el bus real también se oculta.
      if (m.ocultas[bus.ruta]) {
        if (m.capaBuses.hasLayer(bus.marca)) m.capaBuses.removeLayer(bus.marca);
        return;
      }

      if (!m.capaBuses.hasLayer(bus.marca)) m.capaBuses.addLayer(bus.marca);

      var elemento = bus.marca.getElement();
      var contenedor = elemento && elemento.firstChild;

      if (!contenedor) return;

      contenedor.classList.toggle('dim', !!m.sel && m.sel !== bus.ruta);
      contenedor.firstChild.classList.toggle('rm-sin-rumbo', typeof bus.rumbo !== 'number');

      if (typeof bus.rumbo === 'number') contenedor.firstChild.style.transform = 'rotate(' + bus.rumbo + 'deg)';
    });
  }

  // El marcador se acerca poco a poco a la posición que mandó el conductor, en vez de saltar cada 5 segundos.
  function acercar() {
    Object.keys(reales).forEach(function (id) {
      var bus = reales[id];

      if (!bus.marca) return;

      bus.mostrado.lat += (bus.lat - bus.mostrado.lat) * 0.3;
      bus.mostrado.lng += (bus.lng - bus.mostrado.lng) * 0.3;
      bus.marca.setLatLng([bus.mostrado.lat, bus.mostrado.lng]);
    });

    pintarMarcas();
  }

  function quitarMarca(bus) {
    var m = mapa.interno();

    if (bus.marca && m.capaBuses && m.capaBuses.hasLayer(bus.marca)) m.capaBuses.removeLayer(bus.marca);
  }

  function recibir(lista) {
    var vistos = {};

    lista.forEach(function (b) {
      if (!rutaPorId(b.ruta)) return;   // una ruta que esta app no conoce no se dibuja

      vistos[b.id] = true;

      var actual = reales[b.id];

      if (!actual) {
        actual = reales[b.id] = { mostrado: { lat: b.lat, lng: b.lng } };
      }

      actual.lat = b.lat;
      actual.lng = b.lng;
      actual.ruta = b.ruta;
      actual.nombre = b.nombre;
      actual.rumbo = typeof b.rumbo === 'number' ? b.rumbo : undefined;
      actual.parada = b.parada;
      actual.t = b.t;
      actual.ausente = 0;
    });

    Object.keys(reales).forEach(function (id) {
      if (vistos[id]) return;

      reales[id].ausente++;

      if (reales[id].ausente >= AUSENCIAS_MAX) {
        quitarMarca(reales[id]);
        delete reales[id];
      }
    });

    acercar();
    pintarAviso();
  }

  function hace(t) {
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));

    return s < 60 ? 'hace ' + s + ' s' : 'hace ' + Math.round(s / 60) + ' min';
  }

  // Texto bajo el mapa: cuántos buses reales hay y, si hay una ruta elegida, cuáles son de esa ruta.
  function pintarAviso() {
    var m = mapa.interno();
    var todos = Object.keys(reales).map(function (id) { return reales[id]; }).filter(function (b) { return !m.ocultas[b.ruta]; });
    var lista = m.sel ? todos.filter(function (b) { return b.ruta === m.sel; }) : todos;
    var html = '';

    if (m.modo === 'rutas' && lista.length) {
      html = '<b>En vivo real</b> · ' + (m.sel
        ? lista.length + (lista.length === 1 ? ' unidad' : ' unidades') + ' de la ruta ' + escapar(m.sel)
        : lista.length + (lista.length === 1 ? ' bus con GPS ahora' : ' buses con GPS ahora')) +
        '<ul>' + lista.slice(0, 4).map(function (b) {
          var ruta = rutaPorId(b.ruta);
          var parada = ruta && typeof b.parada === 'number' && ruta.stops[b.parada] ? ' · cerca de ' + escapar(ruta.stops[b.parada]) : '';

          return '<li><span class="rm-real-ruta" style="--c:' + escapar(m.color(ruta)) + '">' + escapar(b.ruta) + '</span><span>' +
            escapar(b.nombre || 'Unidad') + parada + '</span><span class="rm-real-hace">' + hace(b.t) + '</span></li>';
        }).join('') + '</ul>';
    }

    if (html === ultimoHtml) return;

    ultimoHtml = html;
    caja.innerHTML = html;
    caja.hidden = !html;
  }

  function consultar() {
    if (consultando) return;

    consultando = true;
    vivo.leer().then(recibir).catch(function () {}).then(function () { consultando = false; });
  }

  function debeCorrer() {
    return mapa.interno().abierto && document.visibilityState === 'visible';
  }

  // Solo se consulta con el mapa abierto y la página visible; al cerrar se detiene y se limpian los marcadores.
  function revisar() {
    var correr = debeCorrer();

    if (correr && !temporizador) {
      consultar();
      temporizador = setInterval(function () { consultar(); pintarAviso(); }, CADA_MS);
      suavizado = setInterval(acercar, SUAVIZADO_MS);
    } else if (!correr && temporizador) {
      clearInterval(temporizador);
      clearInterval(suavizado);
      temporizador = null;
      suavizado = null;

      if (!mapa.interno().abierto) {
        Object.keys(reales).forEach(function (id) { quitarMarca(reales[id]); });
        reales = {};
        ultimoHtml = '';
        caja.hidden = true;
        caja.innerHTML = '';
      }
    }
  }

  // El mapa marca <html class="rm-abierto"> al abrirse y la quita al cerrarse.
  if (window.MutationObserver) {
    new MutationObserver(revisar).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('visibilitychange', revisar);
  revisar();

  window.RutmovilVivoMapa = {
    cuantos: function () { return Object.keys(reales).length; }
  };
})();
