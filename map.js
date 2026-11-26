/* Mapa de Rutmovil (estilo Waze).
   Archivo nuevo: lee los buses que ya simula script.js (window.RutmovilDatos) y los dibuja sobre un mapa.
   - Mapa: Leaflet + mosaicos de OpenStreetMap/CARTO (claro u oscuro según tu tema).
   - Recorridos: se calculan sobre las calles reales con OSRM y se guardan en el celular.
   - Si no hay internet o falla el cálculo, usa líneas rectas entre paradas. */
(function () {
  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
  var MOSAICO_CLARO = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  var MOSAICO_OSCURO = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  var CLAVE_GEO = 'rutmovil-geo-v1';
  var CENTRO = [12.1364, -86.2514];
  var NICARAGUA = [[10.7, -87.7], [15.03, -82.55]];

  // Ciudades principales (aproximadas) para decirte "cerca de ..." según tu ubicación.
  var CIUDADES = [
    ['Managua', 12.1364, -86.2514], ['León', 12.4379, -86.8780], ['Masaya', 11.9744, -86.0952],
    ['Granada', 11.9299, -85.9560], ['Jinotepe', 11.8500, -86.1990], ['Estelí', 13.0910, -86.3540],
    ['Matagalpa', 12.9260, -85.9170], ['Jinotega', 13.0910, -86.0020], ['Chinandega', 12.6292, -87.1310],
    ['Rivas', 11.4370, -85.8250], ['Juigalpa', 12.1060, -85.3650], ['Boaco', 12.4700, -85.6600],
    ['Ocotal', 13.6320, -86.4760], ['Somoto', 13.4800, -86.5830], ['San Carlos', 11.1220, -84.7780],
    ['Bluefields', 12.0130, -83.7640], ['Bilwi (Puerto Cabezas)', 14.0390, -83.3850]
  ];

  // Un color por ruta (en el orden en que aparecen en script.js).
  var COLORES = ['#2f6bff', '#e64980', '#0ca678', '#d9480f', '#9c36b5', '#1098ad'];

  // Coordenadas APROXIMADAS de cada parada [latitud, longitud].
  // Si una parada queda mal ubicada, corrige su número aquí y el mapa se ajusta solo.
  var PARADAS = {
    'Mercado Huembes': [12.1212, -86.2402],
    'Rotonda Cristo Rey': [12.1244, -86.2530],
    'Metrocentro': [12.1366, -86.2698],
    'Hospital Militar': [12.1432, -86.2570],
    'Rotonda Rubén Darío': [12.1390, -86.2470],
    'Camino de Oriente': [12.1340, -86.2335],
    'Terminal Mayoreo': [12.1585, -86.1885],
    'Ciudad Sandino': [12.1622, -86.3440],
    'Zona Franca': [12.1590, -86.3140],
    'Villa Libertad': [12.1575, -86.2870],
    'Mercado Oriental': [12.1468, -86.2480],
    'Parque Central': [12.1520, -86.2740],
    'Malecón': [12.1566, -86.2742],
    'UNI': [12.1285, -86.2590],
    'Rotonda Universitaria': [12.1325, -86.2625],
    'Plaza Inter': [12.1345, -86.2660],
    'Linda Vista': [12.1270, -86.2800],
    'Santo Domingo': [12.1130, -86.2890],
    'Terminal Israel Lewites': [12.1395, -86.3320],
    'Rotonda El Güegüense': [12.1268, -86.2470],
    'Barrio Bolonia': [12.1400, -86.2745],
    'Carretera Norte': [12.1550, -86.2280],
    'Villa Fontana': [12.1185, -86.2770],
    'Plaza España': [12.1385, -86.2610],
    'Parque Las Piedrecitas': [12.1445, -86.2660],
    'Ticuantepe': [12.0245, -86.2030],
    'Carretera Masaya': [12.1015, -86.2230],
    'Rotonda Jean Paul Genie': [12.1332, -86.2590]
  };

  // ---- geometría ----
  function haversine(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * rad;
    var dLng = (b[1] - a[1]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function rumboEntre(a, b) {
    var rad = Math.PI / 180;
    var y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
    var x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) -
      Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);

    return (Math.atan2(y, x) / rad + 360) % 360;
  }

  function acumulada(coords) {
    var cum = [0];

    for (var i = 1; i < coords.length; i++) {
      cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
    }

    return cum;
  }

  // g = { c: [[lat,lng]...], l: distancias acumuladas de cada parada, t: distancia total según el origen }
  function armarRuta(g) {
    var cum = acumulada(g.c);
    var total = cum[cum.length - 1];
    var escala = g.t ? total / g.t : 1;

    return {
      c: g.c,
      cum: cum,
      total: total,
      dp: g.l.map(function (valor) { return Math.min(valor * escala, total); })
    };
  }

  function puntoEn(info, distancia) {
    var cum = info.cum;
    var d = Math.min(Math.max(distancia, 0), info.total);
    var bajo = 0;
    var alto = cum.length - 1;

    while (alto - bajo > 1) {
      var medio = (bajo + alto) >> 1;

      if (cum[medio] <= d) bajo = medio; else alto = medio;
    }

    var largo = cum[alto] - cum[bajo];
    var f = largo > 0 ? (d - cum[bajo]) / largo : 0;
    var a = info.c[bajo];
    var b = info.c[alto];

    return {
      lat: a[0] + (b[0] - a[0]) * f,
      lng: a[1] + (b[1] - a[1]) * f,
      rumbo: rumboEntre(a, b)
    };
  }

  // pos = parada fraccionaria del bus (como en script.js). Fuera de 0..última parada no se dibuja.
  function distanciaBus(info, pos) {
    var n = info.dp.length;

    if (pos < 0 || pos > n - 1) return null;

    var i = Math.min(Math.floor(pos), n - 2);
    var f = pos - i;

    return info.dp[i] + (info.dp[i + 1] - info.dp[i]) * f;
  }
  // ---- fin geometría ----

  var esc = function (texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var dosDigitos = function (n) { return (n < 10 ? '0' : '') + n; };
  var mmss = function (seg) { return dosDigitos(Math.floor(seg / 60)) + ':' + dosDigitos(Math.floor(seg % 60)); };

  var formatoDistancia = function (m) {
    return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  };

  var datos = function () { return window.RutmovilDatos; };

  function esOscuro() {
    var tema = document.documentElement.getAttribute('data-theme');

    return tema ? tema === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ---- interfaz ----
  var iconos = {
    mapa: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7zM9 4v13M15 7v13"/></svg>',
    cerrar: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    ubicacion: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    pais: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    rutas: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>',
    mas: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    menos: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>'
  };

  var boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'rm-open';
  boton.setAttribute('aria-haspopup', 'dialog');
  boton.innerHTML = iconos.mapa + '<span>Mapa</span>';
  document.body.appendChild(boton);

  var panel = document.createElement('div');
  panel.className = 'rm';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Mapa de rutas en vivo');
  panel.innerHTML =
    '<div class="rm-map" id="rm-map"></div>' +
    '<div class="rm-err" id="rm-err" hidden><p id="rm-errtxt"></p><button type="button" class="rm-link" id="rm-retry">Reintentar</button></div>' +
    '<div class="rm-top"><button type="button" class="rm-btn" id="rm-close" aria-label="Cerrar mapa">' + iconos.cerrar + '</button>' +
    '<div class="rm-chips" id="rm-chips" role="group" aria-label="Elegir ruta"></div></div>' +
    '<div class="rm-dock"><div class="rm-fabs">' +
    '<button type="button" class="rm-btn" id="rm-nic" aria-label="Ver toda Nicaragua">' + iconos.pais + '</button>' +
    '<button type="button" class="rm-btn" id="rm-rutas" aria-label="Ver todas las rutas">' + iconos.rutas + '</button>' +
    '<button type="button" class="rm-btn" id="rm-zin" aria-label="Acercar">' + iconos.mas + '</button>' +
    '<button type="button" class="rm-btn" id="rm-zout" aria-label="Alejar">' + iconos.menos + '</button>' +
    '<button type="button" class="rm-btn" id="rm-loc" aria-label="Mostrar mi ubicación" aria-pressed="false">' + iconos.ubicacion + '</button>' +
    '</div><div class="rm-sheet"><div id="rm-ubic"></div><div id="rm-fijo"></div><div id="rm-vivo"></div>' +
    '<p class="rm-estado" id="rm-estado" role="status"></p>' +
    '<p class="rm-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · ' +
    '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a></p></div></div>';
  document.body.appendChild(panel);

  var $ = function (id) { return document.getElementById(id); };

  // ---- estado ----
  var map = null;
  var cargandoMapa = null;
  var recorridosListos = false;
  var capaMosaico = null;
  var mosaicoOscuro = null;
  var capaLineas = null;
  var capaParadas = null;
  var capaBuses = null;
  var capaUsuario = null;
  var info = {};
  var lineas = {};
  var marcadores = {};
  var estimado = {};
  var sel = null;
  var selBus = null;
  var selParada = {};
  var usuario = null;
  var marcaUsuario = null;
  var circuloUsuario = null;
  var idUbicacion = null;
  var quiereUbicacion = false;
  var centrarAlLlegar = false;
  var siguiendo = false;
  var rafId = null;
  var ultimoVivo = 0;
  var ultimoFoco = null;
  var avisoTimer = null;

  function color(ruta) {
    var i = datos().rutas.indexOf(ruta);

    return COLORES[(i < 0 ? 0 : i) % COLORES.length];
  }

  function rutaPorId(id) {
    return datos().rutas.filter(function (r) { return r.id === id; })[0];
  }

  function frecuencia(ruta) {
    return Math.max(1, Math.round((ruta.stops.length + 1.4) / (ruta.base * ruta.buses.length)));
  }

  function aviso(texto) {
    var zona = $('rm-estado');

    zona.textContent = texto;
    clearTimeout(avisoTimer);

    if (texto) {
      avisoTimer = setTimeout(function () { zona.textContent = ''; }, 6000);
    }
  }

  // ---- carga de Leaflet ----
  function cargarLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();

    return new Promise(function (resolver, rechazar) {
      var css = document.createElement('link');

      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      css.crossOrigin = 'anonymous';
      document.head.appendChild(css);

      var js = document.createElement('script');

      js.src = LEAFLET_JS;
      js.crossOrigin = 'anonymous';
      js.onload = function () { window.L && window.L.map ? resolver() : rechazar(); };
      js.onerror = function () { js.parentNode.removeChild(js); rechazar(); };
      document.head.appendChild(js);
    });
  }

  function mostrarError(texto) {
    $('rm-errtxt').textContent = texto;
    $('rm-err').hidden = false;
  }

  function asegurarMapa() {
    if (map) return Promise.resolve();
    if (cargandoMapa) return cargandoMapa;

    if (!datos()) {
      mostrarError('No se encontraron las rutas de Rutmovil para dibujarlas en el mapa.');
      return Promise.reject();
    }

    aviso('Cargando mapa…');
    $('rm-err').hidden = true;

    cargandoMapa = cargarLeaflet().then(function () {
      crearMapa();
      aviso('');
    }).catch(function () {
      cargandoMapa = null;
      mostrarError('No se pudo cargar el mapa. Revisa tu conexión a internet e inténtalo otra vez.');
      aviso('');
      return Promise.reject();
    });

    return cargandoMapa;
  }

  function crearMapa() {
    var L = window.L;

    map = L.map('rm-map', { zoomControl: false, attributionControl: false, center: CENTRO, zoom: 12, minZoom: 6, maxBounds: [[9.0, -90.0], [16.5, -81.0]], maxBoundsViscosity: 0.8 });
    map.on('dragstart', function () { if (siguiendo) { siguiendo = false; renderUbic(); } });
    capaLineas = L.layerGroup().addTo(map);
    capaParadas = L.layerGroup().addTo(map);
    capaBuses = L.layerGroup().addTo(map);
    capaUsuario = L.layerGroup().addTo(map);
    ponerMosaicos();
  }

  function ponerMosaicos() {
    if (!map) return;

    var oscuro = esOscuro();

    if (capaMosaico && mosaicoOscuro === oscuro) return;
    if (capaMosaico) map.removeLayer(capaMosaico);

    mosaicoOscuro = oscuro;
    capaMosaico = window.L.tileLayer(oscuro ? MOSAICO_OSCURO : MOSAICO_CLARO, { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
    capaMosaico.setZIndex(1);

    if (capaLineas) estilos();
  }

  // ---- recorridos sobre las calles ----
  function leerCache() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_GEO) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function guardarCache(cache) {
    try {
      localStorage.setItem(CLAVE_GEO, JSON.stringify(cache));
    } catch (e) {}
  }

  function pedirCalles(puntos) {
    var coordenadas = puntos.map(function (p) { return p[1].toFixed(5) + ',' + p[0].toFixed(5); }).join(';');
    var url = 'https://router.project-osrm.org/route/v1/driving/' + coordenadas +
      '?overview=full&geometries=geojson&steps=false';
    var control = window.AbortController ? new AbortController() : null;
    var plazo = setTimeout(function () { if (control) control.abort(); }, 10000);

    return fetch(url, control ? { signal: control.signal } : undefined).then(function (respuesta) {
      if (!respuesta.ok) throw new Error('osrm');

      return respuesta.json();
    }).then(function (json) {
      clearTimeout(plazo);

      var r = json && json.routes && json.routes[0];

      if (!r || json.code !== 'Ok') throw new Error('osrm');

      var l = [0];

      r.legs.forEach(function (tramo) { l.push(l[l.length - 1] + tramo.distance); });

      return {
        c: r.geometry.coordinates.map(function (p) { return [Math.round(p[1] * 1e5) / 1e5, Math.round(p[0] * 1e5) / 1e5]; }),
        l: l,
        t: r.distance
      };
    }).catch(function (error) {
      clearTimeout(plazo);
      throw error;
    });
  }

  function lineaRecta(puntos) {
    var cum = acumulada(puntos);

    return { c: puntos, l: cum, t: cum[cum.length - 1] };
  }

  function obtenerRecorrido(ruta, cache) {
    var puntos = ruta.stops.map(function (nombre) { return PARADAS[nombre]; });

    if (puntos.some(function (p) { return !p; })) return Promise.resolve(null);

    var firma = puntos.map(function (p) { return p[0] + ',' + p[1]; }).join(';');

    if (cache[ruta.id] && cache[ruta.id].s === firma) {
      return Promise.resolve({ g: cache[ruta.id].g, puntos: puntos, real: true });
    }

    return pedirCalles(puntos).then(function (g) {
      cache[ruta.id] = { s: firma, g: g };
      guardarCache(cache);

      return { g: g, puntos: puntos, real: true };
    }).catch(function () {
      return { g: lineaRecta(puntos), puntos: puntos, real: false };
    });
  }

  function cargarRecorridos() {
    if (recorridosListos) return;

    recorridosListos = true;
    aviso('Calculando recorridos…');

    var D = datos();
    var cache = leerCache();
    var pendientes = D.rutas.map(function (ruta) {
      return obtenerRecorrido(ruta, cache).then(function (resultado) {
        if (!resultado) return null;

        dibujarRuta(ruta, resultado);

        return resultado;
      });
    });

    Promise.all(pendientes).then(function (resultados) {
      var rectas = resultados.filter(function (r) { return r && !r.real; }).length;

      aviso(rectas ? 'Sin conexión al servicio de calles: se muestran líneas rectas entre paradas.' : '');

      if (!sel) ajustarATodas();
    });
  }

  function dibujarRuta(ruta, resultado) {
    var L = window.L;

    info[ruta.id] = armarRuta(resultado.g);
    info[ruta.id].puntos = resultado.puntos;
    info[ruta.id].color = color(ruta);

    var casing = L.polyline(resultado.g.c, { weight: 9, lineCap: 'round', lineJoin: 'round', interactive: false });
    var linea = L.polyline(resultado.g.c, { weight: 5, lineCap: 'round', lineJoin: 'round', bubblingMouseEvents: false });

    linea.on('click', function () { elegirRuta(ruta.id); });
    capaLineas.addLayer(casing);
    capaLineas.addLayer(linea);
    lineas[ruta.id] = { casing: casing, linea: linea };

    estilos();
    dibujarParadas();
    moverBuses();
    renderVivo(true);
  }

  function ajustarATodas() {
    var grupo = Object.keys(lineas).map(function (id) { return lineas[id].linea.getBounds(); });

    if (!grupo.length) return;

    var limites = grupo[0];

    grupo.forEach(function (b) { limites = limites.extend(b); });
    map.fitBounds(limites, { paddingTopLeft: [24, 90], paddingBottomRight: [24, 230], maxZoom: 14 });
  }

  function estilos() {
    var oscuro = esOscuro();

    Object.keys(lineas).forEach(function (id) {
      var par = lineas[id];
      var tono = info[id].color;
      var activa = sel === id;
      var apagada = sel && !activa;

      par.casing.setStyle({
        color: oscuro ? '#0a0f33' : '#ffffff',
        weight: activa ? 11 : 9,
        opacity: apagada ? 0.35 : 0.95
      });
      par.linea.setStyle({
        color: apagada ? '#8a93b8' : tono,
        weight: activa ? 7 : 5,
        opacity: apagada ? 0.55 : 1
      });

      if (activa) {
        par.casing.bringToFront();
        par.linea.bringToFront();
      }
    });

    dibujarParadas();
  }

  function dibujarParadas() {
    var L = window.L;
    var D = datos();

    capaParadas.clearLayers();

    D.rutas.forEach(function (ruta) {
      var inf = info[ruta.id];

      if (!inf) return;
      if (sel && sel !== ruta.id) return;

      ruta.stops.forEach(function (nombre, indice) {
        var extremo = indice === 0 || indice === ruta.stops.length - 1;

        if (!sel && !extremo) return;

        var elegida = sel === ruta.id && selParada[ruta.id] === indice;
        var marca = L.circleMarker(inf.puntos[indice], {
          radius: elegida ? 10 : (sel ? 7 : 5),
          color: inf.color,
          weight: 3,
          fillColor: elegida ? inf.color : (esOscuro() ? '#10153a' : '#ffffff'),
          fillOpacity: 1,
          bubblingMouseEvents: false
        });

        marca.bindTooltip(nombre, {
          direction: 'top', offset: [0, -8], className: 'rm-tip',
          permanent: !!sel && extremo
        });
        marca.on('click', function () {
          selParada[ruta.id] = indice;
          if (sel !== ruta.id) elegirRuta(ruta.id, { parada: indice }); else { dibujarParadas(); renderFijo(); renderVivo(true); }
        });
        capaParadas.addLayer(marca);
      });
    });
  }

  // ---- buses ----
  function crearMarcadorBus(ruta, bus, tono) {
    var L = window.L;
    var html = '<div class="rm-bus" style="--c:' + tono + '"><span class="rm-arrow"></span><span class="rm-badge">' + esc(ruta.id) + '</span></div>';
    var marca = L.marker([0, 0], {
      icon: L.divIcon({ className: 'rm-bus-wrap', html: html, iconSize: [46, 46], iconAnchor: [23, 23] }),
      keyboard: true,
      title: 'Ruta ' + ruta.id + ', bus ' + bus.id,
      zIndexOffset: 500
    });

    marca.on('click', function () { elegirRuta(ruta.id, { bus: bus.id }); });

    return marca;
  }

  // Entre un cálculo y otro de script.js (cada segundo) el bus sigue avanzando, para que el movimiento sea suave.
  function posicionEstimada(clave, bus, ahora, D) {
    var e = estimado[clave];

    if (!e || e.base !== bus.pos) {
      e = estimado[clave] = { base: bus.pos, t: ahora };
    }

    var minutos = Math.min((ahora - e.t) / 60000, 1.5 / 60);

    return bus.pos + D.velocidadReal(bus) * minutos;
  }

  function moverBuses() {
    var D = datos();
    var ahora = Date.now();

    D.rutas.forEach(function (ruta) {
      var inf = info[ruta.id];

      if (!inf) return;

      ruta.buses.forEach(function (bus) {
        var clave = ruta.id + '|' + bus.id;
        var marca = marcadores[clave];

        if (!marca) marca = marcadores[clave] = crearMarcadorBus(ruta, bus, inf.color);

        var distancia = distanciaBus(inf, posicionEstimada(clave, bus, ahora, D));

        if (distancia === null) {
          if (capaBuses.hasLayer(marca)) capaBuses.removeLayer(marca);
          return;
        }

        var punto = puntoEn(inf, distancia);

        if (!capaBuses.hasLayer(marca)) capaBuses.addLayer(marca);

        marca.setLatLng([punto.lat, punto.lng]);

        var elemento = marca.getElement();
        var contenedor = elemento && elemento.firstChild;

        if (!contenedor) return;

        contenedor.classList.toggle('late', !!bus.delayed);
        contenedor.classList.toggle('dim', !!sel && sel !== ruta.id);
        contenedor.classList.toggle('sel', sel === ruta.id && selBus === bus.id);
        contenedor.firstChild.style.transform = 'rotate(' + punto.rumbo.toFixed(0) + 'deg)';
      });
    });
  }

  // ---- selección de ruta ----
  function paradaCercana(ruta) {
    if (!usuario || !info[ruta.id]) return null;

    var mejor = 0;
    var corta = Infinity;

    info[ruta.id].puntos.forEach(function (p, i) {
      var d = haversine([usuario.lat, usuario.lng], p);

      if (d < corta) { corta = d; mejor = i; }
    });

    return { indice: mejor, metros: corta };
  }

  function elegirRuta(id, opciones) {
    var D = datos();

    sel = id;
    selBus = (opciones && opciones.bus) || null;

    if (id) {
      var ruta = rutaPorId(id);

      if (opciones && opciones.parada !== undefined) {
        selParada[id] = opciones.parada;
      } else if (selParada[id] === undefined) {
        var cerca = paradaCercana(ruta);

        selParada[id] = cerca ? cerca.indice : ((D.paradaElegida && D.paradaElegida[id]) || 0);
      }
    }

    estilos();
    renderFijo();
    renderVivo(true);
    moverBuses();

    if (id && lineas[id]) {
      map.fitBounds(lineas[id].linea.getBounds(), { paddingTopLeft: [28, 96], paddingBottomRight: [28, 260], maxZoom: 15 });
    } else if (!id) {
      ajustarATodas();
    }
  }

  // ---- tarjeta inferior ----
  function renderChips() {
    var D = datos();
    var html = '<button type="button" class="rm-rchip rm-todas" data-id="" aria-pressed="' + (!sel) + '">Todas</button>';

    html += D.rutas.map(function (ruta) {
      return '<button type="button" class="rm-rchip" data-id="' + esc(ruta.id) + '" style="--c:' + color(ruta) +
        '" aria-pressed="' + (sel === ruta.id) + '" aria-label="Ruta ' + esc(ruta.id) + '"><i></i>' + esc(ruta.id) + '</button>';
    }).join('');

    $('rm-chips').innerHTML = html;
  }

  function renderFijo() {
    renderChips();

    var zona = $('rm-fijo');

    if (!sel) {
      zona.innerHTML = '<div class="rm-sh-h"><div><b>Rutas en vivo</b><span class="rm-sub" id="rm-resumen"></span></div></div>';
      return;
    }

    var ruta = rutaPorId(sel);
    var tono = color(ruta);
    var paradas = ruta.stops.map(function (nombre, i) {
      return '<button type="button" class="rm-sp" data-i="' + i + '" aria-pressed="' + (selParada[sel] === i) + '">' + esc(nombre) + '</button>';
    }).join('');

    zona.innerHTML =
      '<div class="rm-sh-h" style="--c:' + tono + '"><span class="rm-num">' + esc(ruta.id) + '</span>' +
      '<div><b>' + esc(ruta.stops[0]) + ' → ' + esc(ruta.stops[ruta.stops.length - 1]) + '</b>' +
      '<span class="rm-sub">' + ruta.stops.length + ' paradas · un bus cada ~' + frecuencia(ruta) + ' min</span></div>' +
      '<button type="button" class="rm-btn" id="rm-todas" aria-label="Ver todas las rutas">' + iconos.cerrar + '</button></div>' +
      '<div class="rm-stops" style="--c:' + tono + '" role="group" aria-label="Elegir parada">' + paradas + '</div>';
  }

  var ultimoHtmlVivo = '';

  function htmlVivo() {
    var D = datos();

    if (!sel) {
      var circulando = 0;

      D.rutas.forEach(function (ruta) {
        ruta.buses.forEach(function (bus) {
          if (bus.pos >= 0 && bus.pos <= ruta.stops.length - 1) circulando++;
        });
      });

      var resumen = $('rm-resumen');

      if (resumen) resumen.textContent = D.rutas.length + ' rutas · ' + circulando + ' buses circulando ahora';

      var html = '<p class="rm-hint">Toca el número de una ruta, un bus o una parada para ver cuándo llega.</p>';

      if (usuario) {
        var mejor = null;

        D.rutas.forEach(function (ruta) {
          var c = paradaCercana(ruta);

          if (c && (!mejor || c.metros < mejor.metros)) mejor = { ruta: ruta, indice: c.indice, metros: c.metros };
        });

        if (mejor) {
          var primero = D.calcularLlegada(mejor.ruta, mejor.indice)[0];

          html += '<div class="rm-near">Parada más cercana: <b>' + esc(mejor.ruta.stops[mejor.indice]) + '</b> · ' +
            formatoDistancia(mejor.metros) + '<br>Ruta ' + esc(mejor.ruta.id) + ': ' +
            (primero ? D.mostrarLlegada(primero.segundos) : 'sin buses próximos') + '</div>' +
            '<button type="button" class="rm-link" data-ruta="' + esc(mejor.ruta.id) + '" data-parada="' + mejor.indice + '">Ver ruta ' + esc(mejor.ruta.id) + '</button>';
        }
      }

      return html;
    }

    var ruta = rutaPorId(sel);
    var indice = selParada[sel] || 0;
    var llegadas = D.calcularLlegada(ruta, indice);
    var p = llegadas[0];
    var estado = !p ? ['Sin buses', ''] : (p.bus.delayed ? ['Con retraso', 'warn'] : (p.segundos < 60 ? ['Llegando', 'go'] : ['En camino', 'ok']));
    var filas = llegadas.slice(0, 3).map(function (llegada) {
      var texto = llegada.bus.delayed ? 'Con retraso' : (llegada.bus.pos < 0 ? 'Sale de ' + ruta.stops[0] : 'En ruta');

      return '<li' + (selBus === llegada.bus.id ? ' class="rm-me"' : '') + '><span class="rm-bid">' + esc(llegada.bus.id) +
        '</span><span class="rm-st">' + esc(texto) + '</span><span class="rm-cd">' + mmss(llegada.segundos) + '</span></li>';
    }).join('');

    return '<div style="--c:' + color(ruta) + '"><div class="rm-eta"><span class="rm-big">' + (p ? D.mostrarLlegada(p.segundos) : '–') +
      '</span><span class="rm-lbl">Próximo bus a <b>' + esc(ruta.stops[indice]) + '</b></span>' +
      '<span class="rm-chip ' + estado[1] + '">' + estado[0] + '</span></div>' +
      '<ol class="rm-next">' + (filas || '<li><span class="rm-st">Sin buses próximos por ahora.</span></li>') + '</ol></div>';
  }

  function renderVivo(forzar) {
    var html = htmlVivo();

    if (!forzar && html === ultimoHtmlVivo) return;

    ultimoHtmlVivo = html;
    $('rm-vivo').innerHTML = html;
  }

  // ---- ubicación del usuario ----
  function iconoUsuario() {
    return window.L.divIcon({
      className: 'rm-me-wrap', iconSize: [40, 40], iconAnchor: [20, 20],
      html: '<div class="rm-me"><span class="rm-me-arrow"></span><i></i></div>'
    });
  }

  function cercaDe(lat, lng) {
    var mejor = null;

    CIUDADES.forEach(function (c) {
      var d = haversine([lat, lng], [c[1], c[2]]);

      if (!mejor || d < mejor.metros) mejor = { nombre: c[0], metros: d };
    });

    return mejor;
  }

  function dentroDeNicaragua(lat, lng) {
    return lat >= NICARAGUA[0][0] && lat <= NICARAGUA[1][0] && lng >= NICARAGUA[0][1] && lng <= NICARAGUA[1][1];
  }

  function renderUbic() {
    var zona = $('rm-ubic');

    if (!usuario) { zona.innerHTML = ''; return; }

    var c = cercaDe(usuario.lat, usuario.lng);
    var lugar = !dentroDeNicaragua(usuario.lat, usuario.lng)
      ? 'Parece que estás fuera de Nicaragua'
      : (c.metros < 5000 ? 'Estás en ' + c.nombre : 'A ' + formatoDistancia(c.metros) + ' de ' + c.nombre);

    zona.innerHTML = '<div class="rm-ubic"><div><b>Tu ubicación</b><span class="rm-sub">' + esc(lugar) + '</span>' +
      '<span class="rm-sub">' + usuario.lat.toFixed(5) + ', ' + usuario.lng.toFixed(5) +
      (usuario.precision ? ' · ±' + formatoDistancia(usuario.precision) : '') + '</span></div>' +
      '<button type="button" class="rm-link" data-u="centrar">Centrar</button>' +
      '<button type="button" class="rm-link" data-u="seguir" aria-pressed="' + siguiendo + '">' + (siguiendo ? 'Siguiéndote' : 'Seguirme') + '</button></div>';
  }

  function iniciarUbicacion(centrar) {
    if (!navigator.geolocation) {
      aviso('Tu navegador no permite obtener la ubicación.');
      return;
    }

    if (idUbicacion !== null) {
      if (usuario && centrar) map.flyTo([usuario.lat, usuario.lng], Math.max(map.getZoom(), 15));
      return;
    }

    quiereUbicacion = true;
    centrarAlLlegar = !!centrar;
    $('rm-loc').setAttribute('aria-pressed', 'true');
    aviso('Buscando tu ubicación…');

    idUbicacion = navigator.geolocation.watchPosition(function (posicion) {
      var c = posicion.coords;
      var primera = !usuario;

      usuario = { lat: c.latitude, lng: c.longitude, precision: c.accuracy };
      aviso('');

      if (!marcaUsuario) {
        marcaUsuario = window.L.marker([c.latitude, c.longitude], { icon: iconoUsuario(), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(capaUsuario);
        circuloUsuario = window.L.circle([c.latitude, c.longitude], { radius: c.accuracy || 30, weight: 1, color: '#1a73ff', fillColor: '#1a73ff', fillOpacity: 0.1, interactive: false }).addTo(capaUsuario);
      } else {
        marcaUsuario.setLatLng([c.latitude, c.longitude]);
        circuloUsuario.setLatLng([c.latitude, c.longitude]).setRadius(c.accuracy || 30);
      }

      var elemento = marcaUsuario.getElement();
      var punto = elemento && elemento.firstChild;

      if (punto) {
        var tieneRumbo = typeof c.heading === 'number' && !isNaN(c.heading);

        punto.classList.toggle('rumbo', tieneRumbo);
        if (tieneRumbo) punto.firstChild.style.transform = 'rotate(' + c.heading + 'deg)';
      }

      if (primera && centrarAlLlegar) {
        map.flyTo([c.latitude, c.longitude], 15);
        centrarAlLlegar = false;
      }

      if (siguiendo) map.panTo([c.latitude, c.longitude]);
      renderUbic();
      renderVivo(true);
    }, function (error) {
      if (error.code === 1) {
        detenerUbicacion();
        quiereUbicacion = false;
        aviso('No diste permiso para usar tu ubicación.');
      } else if (!usuario) {
        aviso('No se pudo obtener tu ubicación.');
      }
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }

  function detenerUbicacion() {
    if (idUbicacion !== null && navigator.geolocation) navigator.geolocation.clearWatch(idUbicacion);

    idUbicacion = null;
    $('rm-loc').setAttribute('aria-pressed', 'false');
  }

  // ---- abrir y cerrar ----
  function cuadro() {
    if (panel.hidden) return;

    if (map && capaBuses) {
      moverBuses();

      var ahora = Date.now();

      if (ahora - ultimoVivo >= 1000) {
        ultimoVivo = ahora;
        renderVivo(false);
      }
    }

    rafId = requestAnimationFrame(cuadro);
  }

  function abrir() {
    if (!panel.hidden) return;

    ultimoFoco = document.activeElement;
    panel.hidden = false;
    document.documentElement.classList.add('rm-abierto');

    try {
      history.pushState({ rmMapa: 1 }, '');
    } catch (e) {}

    $('rm-close').focus();
    renderFijo();
    renderVivo(true);
    renderUbic();

    asegurarMapa().then(function () {
      map.invalidateSize();
      ponerMosaicos();
      cargarRecorridos();
      if (quiereUbicacion) iniciarUbicacion(false);
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(cuadro);
    }).catch(function () {});
  }

  function cerrar() {
    if (panel.hidden) return;

    panel.hidden = true;
    document.documentElement.classList.remove('rm-abierto');
    cancelAnimationFrame(rafId);
    detenerUbicacion();
    siguiendo = false;

    if (history.state && history.state.rmMapa) history.back();
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  boton.addEventListener('click', abrir);
  $('rm-close').addEventListener('click', cerrar);
  $('rm-retry').addEventListener('click', function () {
    $('rm-err').hidden = true;
    asegurarMapa().then(function () {
      map.invalidateSize();
      cargarRecorridos();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(cuadro);
    }).catch(function () {});
  });

  // El botón "atrás" del celular cierra el mapa en vez de salir de la app.
  window.addEventListener('popstate', function () {
    if (!panel.hidden) {
      panel.hidden = true;
      document.documentElement.classList.remove('rm-abierto');
      cancelAnimationFrame(rafId);
      detenerUbicacion();
      siguiendo = false;
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && !panel.hidden) cerrar();
  });

  $('rm-nic').addEventListener('click', function () {
    if (map) map.fitBounds(NICARAGUA, { paddingTopLeft: [10, 90], paddingBottomRight: [10, 260] });
  });
  $('rm-rutas').addEventListener('click', function () {
    if (map) elegirRuta(null);
  });
  $('rm-ubic').addEventListener('click', function (evento) {
    var accion = evento.target.closest('[data-u]');

    if (!accion || !usuario || !map) return;

    if (accion.getAttribute('data-u') === 'centrar') {
      map.flyTo([usuario.lat, usuario.lng], Math.max(map.getZoom(), 15));
    } else {
      siguiendo = !siguiendo;
      if (siguiendo) map.flyTo([usuario.lat, usuario.lng], Math.max(map.getZoom(), 16));
      renderUbic();
    }
  });
  $('rm-zin').addEventListener('click', function () { if (map) map.zoomIn(); });
  $('rm-zout').addEventListener('click', function () { if (map) map.zoomOut(); });
  $('rm-loc').addEventListener('click', function () {
    if (map) iniciarUbicacion(true);
  });

  $('rm-chips').addEventListener('click', function (evento) {
    var chip = evento.target.closest('.rm-rchip');

    if (!chip || !map) return;

    elegirRuta(chip.getAttribute('data-id') || null);
  });

  $('rm-fijo').addEventListener('click', function (evento) {
    if (evento.target.closest('#rm-todas')) {
      elegirRuta(null);
      return;
    }

    var parada = evento.target.closest('.rm-sp');

    if (!parada || !sel) return;

    selParada[sel] = Number(parada.getAttribute('data-i'));
    selBus = null;
    renderFijo();
    renderVivo(true);
    dibujarParadas();

    var inf = info[sel];

    if (inf) map.panTo(inf.puntos[selParada[sel]]);
  });

  $('rm-vivo').addEventListener('click', function (evento) {
    var enlace = evento.target.closest('[data-ruta]');

    if (!enlace) return;

    elegirRuta(enlace.getAttribute('data-ruta'), { parada: Number(enlace.getAttribute('data-parada')) });
  });

  // El mapa sigue el tema claro/oscuro de Rutmovil.
  new MutationObserver(ponerMosaicos).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (window.matchMedia) {
    var consulta = window.matchMedia('(prefers-color-scheme: dark)');

    if (consulta.addEventListener) consulta.addEventListener('change', ponerMosaicos);
  }
})();
