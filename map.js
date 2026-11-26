/* Mapa de Rutmovil (estilo Waze).
   Archivo nuevo: lee los buses que ya simula script.js (window.RutmovilDatos) y los dibuja sobre un mapa.
   - Mapa: Leaflet + mosaicos de OpenStreetMap/CARTO (claro u oscuro según tu tema).
   - Recorridos: se calculan sobre las calles reales con OSRM y se guardan en el celular.
   - Si no hay internet o falla el cálculo, usa líneas rectas entre paradas. */
(function () {
  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
  // Por defecto el mapa usa OpenStreetMap, que NO pide clave.
  // CARTO ahora exige una clave gratuita (carto.com/basemaps/apikey). Si quieres su diseño, pega tu clave aquí:
  var CLAVE_CARTO = '';
  // Fotos de las paradas con Google Maps (Places y Street View). Necesita una clave de Google Cloud
  // (ver instrucciones en LEEME-FOTOS.txt). Si lo dejas vacío, las paradas se ven con tarjetas de color e icono.
  var CLAVE_GOOGLE = '';
  var MOSAICO_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var MOSAICO_CLARO = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=' + CLAVE_CARTO;
  var MOSAICO_OSCURO = 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=' + CLAVE_CARTO;
  var ETIQUETAS_ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
  var CALLES_ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';
  var MOSAICO_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var ETIQUETAS_SAT = 'https://basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}{r}.png?key=' + CLAVE_CARTO;
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

  // Destinos de los expresos (ciudades, coordenadas aproximadas). El origen sale de la terminal de cada expreso.
  var DESTINOS = {
    mas: [11.9744, -86.0952], gra: [11.9299, -85.9560], leo: [12.4379, -86.8780],
    jin: [11.8500, -86.1990], est: [13.0910, -86.3540], mat: [12.9260, -85.9170]
  };
  var TERMINALES = {
    'Huembes': [12.1212, -86.2402], 'Israel Lewites': [12.1395, -86.3320], 'Mayoreo': [12.1585, -86.1885]
  };

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
  // Silueta de Nicaragua para el botón "Ver todo el país", dibujada con el mismo contorno del mapa.
  function iconoPais() {
    var P = window.RutmovilNicaragua;

    if (!P) return '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>';

    var lats = P.contorno.map(function (p) { return p[0]; });
    var lngs = P.contorno.map(function (p) { return p[1]; });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var escala = 19 / Math.max(maxLat - minLat, maxLng - minLng);
    var ox = (24 - (maxLng - minLng) * escala) / 2;
    var oy = (24 - (maxLat - minLat) * escala) / 2;
    var d = P.contorno.map(function (p, i) {
      return (i ? 'L' : 'M') + (ox + (p[1] - minLng) * escala).toFixed(1) + ' ' + (oy + (maxLat - p[0]) * escala).toFixed(1);
    }).join('') + 'Z';

    return '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '" class="rm-ic-fill"/></svg>';
  }

  var iconos = {
    mapa: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7zM9 4v13M15 7v13"/></svg>',
    cerrar: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    ubicacion: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    pais: iconoPais(),
    rutas: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>',
    capas: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5"/></svg>',
    sitios: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
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
    '<button type="button" class="rm-btn rm-btn-pais" id="rm-nic" aria-label="Ver toda Nicaragua" title="Toda Nicaragua">' + iconos.pais + '</button>' +
    '<button type="button" class="rm-btn" id="rm-rutas" aria-label="Ver todas las rutas">' + iconos.rutas + '</button>' +
    '<button type="button" class="rm-btn" id="rm-sitios" aria-label="Mostrar u ocultar sitios" aria-pressed="true" title="Sitios">' + iconos.sitios + '</button>' +
    '<button type="button" class="rm-btn" id="rm-capas" aria-label="Cambiar a vista satélite" aria-pressed="false" title="Satélite">' + iconos.capas + '</button>' +
    '<div class="rm-zoom"><button type="button" id="rm-zin" aria-label="Acercar">' + iconos.mas + '</button>' +
    '<button type="button" id="rm-zout" aria-label="Alejar">' + iconos.menos + '</button></div>' +
    '<button type="button" class="rm-btn" id="rm-loc" aria-label="Mostrar mi ubicación" aria-pressed="false">' + iconos.ubicacion + '</button>' +
    '</div><div class="rm-sheet" id="rm-sheet"><button type="button" class="rm-grab" id="rm-grab" aria-label="Plegar panel" aria-expanded="true"><span></span></button><div id="rm-ubic"></div><div id="rm-fijo"></div><div id="rm-vivo"></div>' +
    '<p class="rm-estado" id="rm-estado" role="status"></p>' +
    '<p class="rm-credit" id="rm-credit"></p></div></div>';
  document.body.appendChild(panel);

  var $ = function (id) { return document.getElementById(id); };

  // ---- estado ----
  var map = null;
  var cargandoMapa = null;
  var recorridosListos = false;
  var capaMosaico = null;
  var claveMosaico = null;
  var capaEtiquetas = null;
  var capaCalles = null;
  var fotos = {};
  var satelite = false;
  var capaSitios = null;
  var marcasSitios = [];
  var verSitios = true;
  var capaLineas = null;
  var capaParadas = null;
  var capaBuses = null;
  var capaUsuario = null;
  var capaPais = null;
  var mascara = null;
  var bordeLuz = null;
  var borde = null;
  var capaCiudades = null;
  var marcasCiudades = [];
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
  var modo = 'rutas';
  var selExp = null;
  var infoExp = {};
  var lineasExp = {};
  var marcadoresExp = {};
  var capaLineasExp = null;
  var capaParadasExp = null;
  var capaBusesExp = null;
  var recorridosExpListos = false;
  var pendiente = null;
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

    map = L.map('rm-map', { zoomControl: false, attributionControl: false, center: CENTRO, zoom: 12, minZoom: 6, zoomSnap: 0.5, zoomDelta: 1, maxBounds: [[9.0, -90.0], [16.5, -81.0]], maxBoundsViscosity: 0.8 });
    map.on('dragstart', function () { if (siguiendo) { siguiendo = false; renderUbic(); } });
    dibujarPais();
    capaLineas = L.layerGroup().addTo(map);
    capaParadas = L.layerGroup().addTo(map);
    capaBuses = L.layerGroup().addTo(map);
    capaUsuario = L.layerGroup().addTo(map);
    capaLineasExp = L.layerGroup();
    capaParadasExp = L.layerGroup();
    capaBusesExp = L.layerGroup();
    dibujarSitios();
    map.on('zoomend', function () {
      mostrarExpresosEnPais();
      visibilidadSitios();
      map.getContainer().classList.toggle('rm-lab', map.getZoom() >= 13);
    });
    ponerMosaicos();
  }

  function ponerMosaicos() {
    if (!map) return;

    var oscuro = esOscuro();
    var clave = (satelite ? 's' : 'c') + (oscuro ? 'o' : 'l');

    if (capaMosaico && claveMosaico === clave) return;
    if (capaMosaico) map.removeLayer(capaMosaico);
    if (capaEtiquetas) { map.removeLayer(capaEtiquetas); capaEtiquetas = null; }
    if (capaCalles) { map.removeLayer(capaCalles); capaCalles = null; }

    claveMosaico = clave;

    var ref = { referrerPolicy: 'strict-origin-when-cross-origin', crossOrigin: true };
    var osm = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    var carto = '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
    var esri = 'Imágenes © Esri';
    var credito;

    if (satelite) {
      capaMosaico = window.L.tileLayer(MOSAICO_SAT, { maxZoom: 19, referrerPolicy: ref.referrerPolicy }).addTo(map);

      if (CLAVE_CARTO) {
        capaEtiquetas = window.L.tileLayer(ETIQUETAS_SAT, { maxZoom: 19, referrerPolicy: ref.referrerPolicy }).addTo(map);
      } else {
        capaEtiquetas = window.L.tileLayer(ETIQUETAS_ESRI, { maxZoom: 19, referrerPolicy: ref.referrerPolicy }).addTo(map);
        capaCalles = window.L.tileLayer(CALLES_ESRI, { maxZoom: 19, referrerPolicy: ref.referrerPolicy }).addTo(map);
        capaCalles.setZIndex(2);
      }

      capaEtiquetas.setZIndex(3);
      credito = esri + (CLAVE_CARTO ? ' · ' + carto + ' · ' + osm : '');
    } else if (CLAVE_CARTO) {
      capaMosaico = window.L.tileLayer(oscuro ? MOSAICO_OSCURO : MOSAICO_CLARO, { maxZoom: 20, maxNativeZoom: 18, referrerPolicy: ref.referrerPolicy }).addTo(map);
      credito = osm + ' · ' + carto;
    } else {
      capaMosaico = window.L.tileLayer(MOSAICO_OSM, {
        maxZoom: 19, referrerPolicy: ref.referrerPolicy, className: oscuro ? 'rm-tinte-oscuro' : 'rm-tinte-claro'
      }).addTo(map);
      credito = osm;
    }

    $('rm-credit').innerHTML = credito;
    capaMosaico.setZIndex(1);

    if (capaPais) estiloPais();
    if (capaLineas) estilos();
    if (capaLineasExp) estilosExp();
  }

  // ---- Nicaragua: contorno, zona exterior atenuada y ciudades ----
  function dibujarPais() {
    var L = window.L;
    var P = window.RutmovilNicaragua;

    if (!P) return;

    capaPais = L.layerGroup().addTo(map);
    mascara = L.polygon([[[24, -100], [24, -70], [4, -70], [4, -100]], P.contorno], { stroke: false, interactive: false });
    bordeLuz = L.polygon(P.contorno, { fill: false, weight: 14, lineJoin: 'round', interactive: false });
    borde = L.polygon(P.contorno, { fill: false, weight: 2.5, lineJoin: 'round', interactive: false });
    [mascara, bordeLuz, borde].forEach(function (capa) { capaPais.addLayer(capa); });

    capaCiudades = L.layerGroup().addTo(map);
    marcasCiudades = P.ciudades.map(function (c) {
      var html = '<div class="rm-city t' + c[3] + (c[4] ? ' cap' : '') + '"><i></i><span>' + esc(c[0]) + '</span></div>';
      var marca = L.marker([c[1], c[2]], {
        icon: L.divIcon({ className: 'rm-city-wrap', html: html, iconSize: [0, 0] }),
        keyboard: false, title: c[0], zIndexOffset: c[3] === 1 ? 300 : 100
      });

      marca.on('click', function () { map.flyTo([c[1], c[2]], Math.max(map.getZoom(), c[3] === 1 ? 11 : 12), { duration: 0.8 }); });

      return { marca: marca, nivel: c[3], max: c[4] ? 12 : 13 };
    });

    map.on('zoomend', visibilidadCiudades);
    visibilidadCiudades();
    estiloPais();
  }

  function visibilidadCiudades() {
    if (!capaCiudades) return;

    var z = map.getZoom();

    marcasCiudades.forEach(function (m) {
      var minimo = m.nivel === 1 ? 6 : (m.nivel === 2 ? 8 : 10);
      var ver = z >= minimo && z <= m.max;

      if (ver && !capaCiudades.hasLayer(m.marca)) capaCiudades.addLayer(m.marca);
      if (!ver && capaCiudades.hasLayer(m.marca)) capaCiudades.removeLayer(m.marca);
    });
  }

  function estiloPais() {
    if (!capaPais) return;

    var oscuro = esOscuro();

    mascara.setStyle({ fillColor: oscuro ? '#02030f' : '#1b2468', fillOpacity: satelite ? 0.3 : (oscuro ? 0.5 : 0.2) });
    bordeLuz.setStyle({ color: oscuro ? '#8b96ff' : '#1423ff', opacity: oscuro ? 0.22 : 0.14 });
    borde.setStyle({ color: oscuro ? '#c4caff' : '#1423ff', opacity: 0.9 });
  }

  // ---- sitios de interés ----
  function dibujarSitios() {
    var L = window.L;
    var P = window.RutmovilNicaragua;

    if (!P || !P.sitios) return;

    capaSitios = L.layerGroup().addTo(map);
    marcasSitios = P.sitios.map(function (t) {
      var cat = P.categorias[t[3]] || ['📍', 12];
      var html = '<div class="rm-site"><b>' + cat[0] + '</b><span>' + esc(t[0]) + '</span></div>';
      var marca = L.marker([t[1], t[2]], {
        icon: L.divIcon({ className: 'rm-site-wrap', html: html, iconSize: [0, 0] }),
        keyboard: false, title: t[0], zIndexOffset: 200
      });

      marca.bindTooltip(t[0], { direction: 'top', offset: [0, -18], className: 'rm-tip' });

      return { marca: marca, min: cat[1] };
    });
    visibilidadSitios();
  }

  function visibilidadSitios() {
    if (!capaSitios) return;

    var z = map.getZoom();

    marcasSitios.forEach(function (m) {
      var ver = verSitios && z >= m.min;

      if (ver && !capaSitios.hasLayer(m.marca)) capaSitios.addLayer(m.marca);
      if (!ver && capaSitios.hasLayer(m.marca)) capaSitios.removeLayer(m.marca);
    });
  }

  // En la vista del país los recorridos de los expresos se ven junto a las ciudades.
  function mostrarExpresosEnPais() {
    if (!map || !capaLineasExp || modo !== 'rutas') return;

    var ver = !sel && map.getZoom() <= 11;

    [capaLineasExp, capaParadasExp].forEach(function (capa) {
      if (ver && !map.hasLayer(capa)) map.addLayer(capa);
      if (!ver && map.hasLayer(capa)) map.removeLayer(capa);
    });
  }

  function abrirExp(id) {
    if (modo !== 'expresos') cambiarModo('expresos');

    elegirExp(id);
  }

  function pasaPor(exp) {
    var P = window.RutmovilNicaragua;
    var e = P && P.expresos && P.expresos[exp.id];
    var inf = infoExp[exp.id];
    var partes = [];

    if (e && e.pasa.length) partes.push('Pasa por ' + e.pasa.map(function (n) { return esc(n[0]); }).join(' · '));
    if (inf) partes.push('~' + Math.round(inf.total / 1000) + ' km por carretera');

    return partes.length ? '<span class="rm-sub">' + partes.join(' · ') + '</span>' : '';
  }

  // ---- fotos de las paradas (se guardan solo en memoria: Google no permite guardarlas) ----
  function iconoParada(nombre) {
    var n = nombre.toLowerCase();

    if (/terminal/.test(n)) return '🚌';
    if (/mercado/.test(n)) return '🛒';
    if (/hospital/.test(n)) return '🏥';
    if (/uni\b|universit/.test(n)) return '🎓';
    if (/rotonda/.test(n)) return '🔄';
    if (/parque|malec/.test(n)) return '🌳';
    if (/plaza|metrocentro|zona franca/.test(n)) return '🏬';
    if (/carretera|camino/.test(n)) return '🛣️';

    return '📍';
  }

  function streetView(punto) {
    var lugar = punto[0] + ',' + punto[1];
    var clave = encodeURIComponent(CLAVE_GOOGLE);

    return fetch('https://maps.googleapis.com/maps/api/streetview/metadata?location=' + lugar + '&radius=100&key=' + clave)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.status !== 'OK') throw new Error('sin street view');

        return {
          url: 'https://maps.googleapis.com/maps/api/streetview?size=480x360&location=' + lugar + '&radius=100&fov=90&key=' + clave,
          autor: '', calle: true
        };
      });
  }

  function pedirFotoGoogle(nombre, punto) {
    return fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': CLAVE_GOOGLE, 'X-Goog-FieldMask': 'places.displayName,places.photos' },
      body: JSON.stringify({
        textQuery: nombre + ', Nicaragua', languageCode: 'es', maxResultCount: 1,
        locationBias: { circle: { center: { latitude: punto[0], longitude: punto[1] }, radius: 1500 } }
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('places');

      return r.json();
    }).then(function (j) {
      var foto = j.places && j.places[0] && j.places[0].photos && j.places[0].photos[0];

      if (!foto) throw new Error('sin foto');

      return {
        url: 'https://places.googleapis.com/v1/' + foto.name + '/media?maxWidthPx=480&maxHeightPx=360&key=' + encodeURIComponent(CLAVE_GOOGLE),
        autor: (foto.authorAttributions || []).map(function (a) { return a.displayName; }).join(', '), calle: false
      };
    }).catch(function () { return streetView(punto); });
  }

  function cargarFotos(ruta) {
    if (!CLAVE_GOOGLE) return;

    ruta.stops.forEach(function (nombre) {
      var punto = PARADAS[nombre];

      if (!punto || fotos[nombre]) return;

      fotos[nombre] = { estado: 'cargando' };
      pedirFotoGoogle(nombre, punto).then(function (r) {
        fotos[nombre] = { estado: 'ok', url: r.url, autor: r.autor, calle: r.calle };
      }).catch(function () {
        fotos[nombre] = { estado: 'sin' };
      }).then(function () { pintarFoto(nombre); });
    });
  }

  function htmlFotoInterior(nombre) {
    var f = fotos[nombre];
    var base = '<span class="rm-foto-ico" aria-hidden="true">' + iconoParada(nombre) + '</span>';

    if (f && f.estado === 'ok') {
      return base + '<img src="' + esc(f.url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' +
        '<i class="rm-foto-g" title="' + esc(f.autor ? 'Foto: ' + f.autor : 'Google Maps') + '">' + (f.calle ? 'Street View' : 'Google Maps') + '</i>';
    }

    return base;
  }

  function htmlFotos(ruta, tono) {
    return '<div class="rm-fotos" style="--c:' + tono + '" role="group" aria-label="Paradas de la ruta">' +
      ruta.stops.map(function (nombre, i) {
        return '<button type="button" class="rm-foto" data-i="' + i + '" data-fp="' + esc(nombre) + '" aria-pressed="' + (selParada[sel] === i) + '" aria-label="Parada ' + (i + 1) + ': ' + esc(nombre) + '">' +
          '<span class="rm-foto-img">' + htmlFotoInterior(nombre) + '</span>' +
          '<span class="rm-foto-n">' + (i + 1) + '</span><b>' + esc(nombre) + '</b></button>';
      }).join('') + '</div>';
  }

  function pintarFoto(nombre) {
    var zona = $('rm-fijo');

    Array.prototype.forEach.call(zona.querySelectorAll('.rm-foto'), function (tarjeta) {
      if (tarjeta.getAttribute('data-fp') === nombre) tarjeta.querySelector('.rm-foto-img').innerHTML = htmlFotoInterior(nombre);
    });
  }

  function centrarFoto() {
    var tarjeta = $('rm-fijo').querySelector('.rm-foto[aria-pressed="true"]');

    if (tarjeta && tarjeta.parentNode) {
      tarjeta.parentNode.scrollLeft = tarjeta.offsetLeft - (tarjeta.parentNode.clientWidth - tarjeta.offsetWidth) / 2;
    }
  }

  function htmlCiudades() {
    var P = window.RutmovilNicaragua;

    if (!P) return '';

    return '<div class="rm-stops rm-cities" role="group" aria-label="Ir a una ciudad">' +
      P.ciudades.map(function (c, i) {
        return c[3] === 1 ? '<button type="button" class="rm-sp" data-ciudad="' + i + '">' + esc(c[0]) + '</button>' : '';
      }).join('') + '</div>';
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

    return obtenerGeo(ruta.id, puntos, cache);
  }

  // Calcula (o recupera guardado) el recorrido por calles entre varios puntos.
  function obtenerGeo(clave, puntos, cache, respaldo) {
    var firma = puntos.map(function (p) { return p[0] + ',' + p[1]; }).join(';');

    if (cache[clave] && cache[clave].s === firma) {
      return Promise.resolve({ g: cache[clave].g, puntos: puntos, real: true });
    }

    return pedirCalles(puntos).then(function (g) {
      cache[clave] = { s: firma, g: g };
      guardarCache(cache);

      return { g: g, puntos: puntos, real: true };
    }).catch(function () {
      return { g: lineaRecta(respaldo || puntos), puntos: puntos, real: false };
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

      if (modo === 'rutas' && !sel) ajustarATodas();
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

// ---- expresos en el mapa ----
  var minutosAhoraMapa = function () {
    var f = new Date();

    return f.getHours() * 60 + f.getMinutes() + f.getSeconds() / 60 + f.getMilliseconds() / 60000;
  };

  var horaTexto = function (minutos) {
    var h = Math.floor(minutos / 60) % 24;

    return (h % 12 === 0 ? 12 : h % 12) + ':' + dosDigitos(Math.floor(minutos % 60 + 1e-6)) + ' ' + (h >= 12 ? 'p. m.' : 'a. m.');
  };

  var horaCortaMapa = function (minutos) {
    var h = Math.floor(minutos / 60) % 24;

    return (h % 12 === 0 ? 12 : h % 12) + ':' + dosDigitos(Math.floor(minutos % 60 + 1e-6));
  };

  function expPorId(id) {
    return datos().expresos.filter(function (e) { return e.id === id; })[0];
  }

  function colorExp(exp) {
    var i = datos().expresos.indexOf(exp);

    return COLORES[(i < 0 ? 0 : i) % COLORES.length];
  }

  function terminalCorta(exp) {
    return exp.terminal.replace('Terminal ', '').replace('Mercado ', '');
  }

  function coordTerminal(exp) {
    var clave = Object.keys(TERMINALES).filter(function (k) { return exp.terminal.indexOf(k) !== -1; })[0];

    return clave ? TERMINALES[clave] : null;
  }

  function salidasExp(exp, minutosAhora) {
    var D = datos();
    var lista = [];

    for (var hora = exp.first, n = 0; hora <= exp.last; hora += exp.every, n++) {
      var retraso = D.calcularRetraso(exp, n);

      lista.push({ numero: n, hora: hora, retraso: retraso, estimada: hora + retraso, falta: hora + retraso - minutosAhora });
    }

    return lista;
  }

  var enCaminoExp = function (s, exp, minutosAhora) {
    return s.estimada <= minutosAhora && minutosAhora < s.estimada + exp.dur;
  };

  function estadoSalidaMapa(s) {
    if (s.retraso > 0) return ['Retraso +' + s.retraso + ' min', 'warn'];
    if (s.falta <= 1) return ['Saliendo', 'go'];
    if (s.falta <= 10) return ['Abordando', 'go'];

    return ['Puntual', 'ok'];
  }

  function cargarRecorridosExp() {
    if (recorridosExpListos) return;

    recorridosExpListos = true;
    aviso('Calculando recorridos de los expresos…');

    var cache = leerCache();

    Promise.all(datos().expresos.map(function (exp) {
      var origen = coordTerminal(exp);
      var destino = DESTINOS[exp.id];

      if (!origen || !destino) return Promise.resolve(null);

      var extra = window.RutmovilNicaragua && window.RutmovilNicaragua.expresos && window.RutmovilNicaragua.expresos[exp.id];
      var respaldo = [origen].concat(extra ? extra.via : [], [destino]);

      return obtenerGeo('exp-' + exp.id, [origen, destino], cache, respaldo).then(function (resultado) {
        dibujarExp(exp, resultado);

        return resultado;
      });
    })).then(function (resultados) {
      var rectas = resultados.filter(function (r) { return r && !r.real; }).length;

      aviso(rectas ? 'Sin conexión al servicio de calles: se muestran líneas rectas entre ciudades.' : '');

      if (modo === 'expresos' && !selExp) ajustarATodasExp();
    });
  }

  function dibujarExp(exp, resultado) {
    var L = window.L;

    infoExp[exp.id] = armarRuta(resultado.g);
    infoExp[exp.id].puntos = resultado.puntos;
    infoExp[exp.id].color = colorExp(exp);

    var casing = L.polyline(resultado.g.c, { weight: 9, lineCap: 'round', lineJoin: 'round', interactive: false });
    var linea = L.polyline(resultado.g.c, { weight: 5, lineCap: 'round', lineJoin: 'round', bubblingMouseEvents: false });

    var flujo = L.polyline(resultado.g.c, { color: '#ffffff', weight: 2, opacity: 0.85, dashArray: '1 14', lineCap: 'round', className: 'rm-flow', interactive: false });

    linea.on('click', function () { abrirExp(exp.id); });
    capaLineasExp.addLayer(casing);
    capaLineasExp.addLayer(linea);
    capaLineasExp.addLayer(flujo);
    lineasExp[exp.id] = { casing: casing, linea: linea, flujo: flujo };

    estilosExp();
    moverBusesExp();
    renderVivo(true);
    mostrarExpresosEnPais();

    if (selExp === exp.id) renderFijo();

    if (modo === 'expresos' && selExp === exp.id) {
      map.fitBounds(linea.getBounds(), { paddingTopLeft: [28, 96], paddingBottomRight: [28, 260], maxZoom: 13 });
    }
  }

  function ajustarATodasExp() {
    var grupo = Object.keys(lineasExp).map(function (id) { return lineasExp[id].linea.getBounds(); });

    if (!grupo.length) return;

    var limites = grupo[0];

    grupo.forEach(function (b) { limites = limites.extend(b); });
    map.fitBounds(limites, { paddingTopLeft: [24, 90], paddingBottomRight: [24, 230], maxZoom: 10 });
  }

  function estilosExp() {
    var oscuro = esOscuro();

    Object.keys(lineasExp).forEach(function (id) {
      var par = lineasExp[id];
      var activa = selExp === id;
      var apagada = selExp && !activa;

      par.casing.setStyle({ color: oscuro ? '#0a0f33' : '#ffffff', weight: activa ? 11 : 9, opacity: apagada ? 0.35 : 0.95 });
      par.linea.setStyle({ color: apagada ? '#8a93b8' : infoExp[id].color, weight: activa ? 7 : 5, opacity: apagada ? 0.55 : 1 });

      if (activa) {
        par.casing.bringToFront();
        par.linea.bringToFront();
      }
    });

    Object.keys(lineasExp).forEach(function (id) {
      lineasExp[id].flujo.setStyle({ opacity: selExp && selExp !== id ? 0 : 0.85 });
      lineasExp[id].flujo.bringToFront();
    });

    dibujarExtremosExp();
  }

  function dibujarExtremosExp() {
    var L = window.L;

    capaParadasExp.clearLayers();

    datos().expresos.forEach(function (exp) {
      var inf = infoExp[exp.id];

      if (!inf || (selExp && selExp !== exp.id)) return;

      var extra = window.RutmovilNicaragua && window.RutmovilNicaragua.expresos && window.RutmovilNicaragua.expresos[exp.id];

      if (extra && selExp === exp.id) {
        extra.pasa.forEach(function (n) {
          var punto = L.circleMarker([n[1], n[2]], { radius: 5, color: inf.color, weight: 3, fillColor: '#ffffff', fillOpacity: 1, bubblingMouseEvents: false });

          punto.bindTooltip(n[0], { direction: 'top', offset: [0, -7], className: 'rm-tip', permanent: true });
          capaParadasExp.addLayer(punto);
        });
      }

      [0, 1].forEach(function (i) {
        var esDestino = i === 1;
        var marca = L.circleMarker(inf.puntos[i], {
          radius: esDestino ? 8 : 6, color: inf.color, weight: 3,
          fillColor: esDestino ? inf.color : (esOscuro() ? '#10153a' : '#ffffff'), fillOpacity: 1, bubblingMouseEvents: false
        });

        marca.bindTooltip(esDestino ? exp.dest : terminalCorta(exp), {
          direction: 'top', offset: [0, -8], className: 'rm-tip', permanent: esDestino || selExp === exp.id
        });
        marca.on('click', function () { abrirExp(exp.id); });
        capaParadasExp.addLayer(marca);
      });
    });
  }

  function crearMarcadorExp(exp, salida, tono) {
    var L = window.L;
    var html = '<div class="rm-bus" style="--c:' + tono + '"><span class="rm-arrow"></span><span class="rm-badge">' +
      esc(exp.dest.slice(0, 3).toUpperCase()) + '</span></div>';
    var marca = L.marker([0, 0], {
      icon: L.divIcon({ className: 'rm-bus-wrap', html: html, iconSize: [46, 46], iconAnchor: [23, 23] }),
      keyboard: true,
      title: 'Expreso a ' + exp.dest + ', salió a las ' + horaTexto(salida.estimada),
      zIndexOffset: 500
    });

    marca.on('click', function () { abrirExp(exp.id); });

    return marca;
  }

  // Los buses en camino se calculan con la hora de salida y el tiempo de viaje.
  function moverBusesExp() {
    var D = datos();
    var minutos = minutosAhoraMapa();
    var vivos = {};

    D.expresos.forEach(function (exp) {
      var inf = infoExp[exp.id];

      if (!inf) return;

      salidasExp(exp, minutos).forEach(function (salida) {
        if (!enCaminoExp(salida, exp, minutos)) return;

        var clave = exp.id + '|' + salida.numero;
        var marca = marcadoresExp[clave];

        vivos[clave] = true;

        if (!marca) {
          marca = marcadoresExp[clave] = crearMarcadorExp(exp, salida, inf.color);
          capaBusesExp.addLayer(marca);
        }

        var punto = puntoEn(inf, (minutos - salida.estimada) / exp.dur * inf.total);

        marca.setLatLng([punto.lat, punto.lng]);

        var elemento = marca.getElement();
        var contenedor = elemento && elemento.firstChild;

        if (!contenedor) return;

        contenedor.classList.toggle('dim', !!selExp && selExp !== exp.id);
        contenedor.firstChild.style.transform = 'rotate(' + punto.rumbo.toFixed(0) + 'deg)';
      });
    });

    Object.keys(marcadoresExp).forEach(function (clave) {
      if (!vivos[clave]) {
        capaBusesExp.removeLayer(marcadoresExp[clave]);
        delete marcadoresExp[clave];
      }
    });
  }

  function elegirExp(id) {
    selExp = id;

    estilosExp();
    renderFijo();
    renderVivo(true);
    moverBusesExp();

    if (id && lineasExp[id]) {
      map.fitBounds(lineasExp[id].linea.getBounds(), { paddingTopLeft: [28, 96], paddingBottomRight: [28, 260], maxZoom: 13 });
    } else if (!id) {
      ajustarATodasExp();
    }
  }

  function cargarSegunModo() {
    cargarRecorridos();
    cargarRecorridosExp();
  }

  function cambiarModo(nuevo) {
    if (nuevo === modo || !map) return;

    modo = nuevo;

    var enRutas = modo === 'rutas';

    [[capaLineas, capaParadas, capaBuses], [capaLineasExp, capaParadasExp, capaBusesExp]].forEach(function (grupo, i) {
      var visible = (i === 0) === enRutas;

      grupo.forEach(function (capa) {
        if (visible && !map.hasLayer(capa)) map.addLayer(capa);
        if (!visible && map.hasLayer(capa)) map.removeLayer(capa);
      });
    });

    $('rm-rutas').setAttribute('aria-label', enRutas ? 'Ver todas las rutas' : 'Ver todos los expresos');
    cargarSegunModo();

    if (enRutas) estilos(); else estilosExp();

    renderFijo();
    renderVivo(true);
    mostrarExpresosEnPais();

    if (enRutas) {
      if (sel && lineas[sel]) elegirRuta(sel); else ajustarATodas();
    } else if (selExp && lineasExp[selExp]) {
      elegirExp(selExp);
    } else {
      ajustarATodasExp();
    }
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
    mostrarExpresosEnPais();
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
    var html = '<button type="button" class="rm-rchip rm-modo" data-modo="rutas" aria-pressed="' + (modo === 'rutas') + '">Rutas</button>' +
      '<button type="button" class="rm-rchip rm-modo" data-modo="expresos" aria-pressed="' + (modo === 'expresos') + '">Expresos</button>';

    if (modo === 'rutas') {
      html += '<button type="button" class="rm-rchip rm-todas" data-id="" aria-pressed="' + (!sel) + '">Todas</button>';
      html += D.rutas.map(function (ruta) {
        return '<button type="button" class="rm-rchip" data-id="' + esc(ruta.id) + '" style="--c:' + color(ruta) +
          '" aria-pressed="' + (sel === ruta.id) + '" aria-label="Ruta ' + esc(ruta.id) + '"><i></i>' + esc(ruta.id) + '</button>';
      }).join('');
    } else {
      html += '<button type="button" class="rm-rchip rm-todas" data-id="" aria-pressed="' + (!selExp) + '">Todos</button>';
      html += D.expresos.map(function (exp) {
        return '<button type="button" class="rm-rchip rm-dest" data-id="' + esc(exp.id) + '" style="--c:' + colorExp(exp) +
          '" aria-pressed="' + (selExp === exp.id) + '" aria-label="Expreso a ' + esc(exp.dest) + '"><i></i>' + esc(exp.dest) + '</button>';
      }).join('');
    }

    $('rm-chips').innerHTML = html;
  }

  function renderFijo() {
    renderChips();

    var zona = $('rm-fijo');

    if (modo === 'expresos') {
      if (!selExp) {
        zona.innerHTML = '<div class="rm-sh-h"><div><b>Expresos en vivo</b><span class="rm-sub" id="rm-resumen"></span></div></div>' + htmlCiudades();
        return;
      }

      var exp = expPorId(selExp);

      zona.innerHTML =
        '<div class="rm-sh-h" style="--c:' + colorExp(exp) + '"><span class="rm-num">' + esc(exp.dest.slice(0, 3).toUpperCase()) + '</span>' +
        '<div><b>' + esc(terminalCorta(exp)) + ' → ' + esc(exp.dest) + '</b>' +
        '<span class="rm-sub">Andén ' + exp.gate + ' · cada ' + exp.every + ' min · viaje de ~' + exp.dur + ' min</span>' + pasaPor(exp) + '</div>' +
        '<button type="button" class="rm-btn" id="rm-todas" aria-label="Ver todos los expresos">' + iconos.cerrar + '</button></div>';
      return;
    }

    if (!sel) {
      zona.innerHTML = '<div class="rm-sh-h"><div><b>Rutas en vivo</b><span class="rm-sub" id="rm-resumen"></span></div></div>' + htmlCiudades();
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
      htmlFotos(ruta, tono) +
      '<div class="rm-stops" style="--c:' + tono + '" role="group" aria-label="Elegir parada">' + paradas + '</div>';

    centrarFoto();
    cargarFotos(ruta);
  }

  var ultimoHtmlVivo = '';

  function htmlVivoExp() {
    var D = datos();
    var minutos = minutosAhoraMapa();

    if (!selExp) {
      var enCamino = 0;

      D.expresos.forEach(function (exp) {
        salidasExp(exp, minutos).forEach(function (s) { if (enCaminoExp(s, exp, minutos)) enCamino++; });
      });

      var resumen = $('rm-resumen');

      if (resumen) resumen.textContent = D.expresos.length + ' expresos · ' + enCamino + ' en camino ahora';

      return '<p class="rm-hint">Toca un destino, un bus o una línea para ver las salidas de ese expreso.</p>';
    }

    var exp = expPorId(selExp);
    var todas = salidasExp(exp, minutos);
    var proximas = todas.filter(function (s) { return s.falta > -1; });
    var camino = todas.filter(function (s) { return enCaminoExp(s, exp, minutos); });
    var p = proximas[0];
    var estado = p ? estadoSalidaMapa(p) : ['Sin más salidas hoy', ''];
    var filas = camino.slice(0, 2).map(function (s) {
      return '<li><span class="rm-bid">' + horaCortaMapa(s.estimada) + '</span><span class="rm-st">En camino</span><span class="rm-cd">llega en ' +
        Math.ceil(s.estimada + exp.dur - minutos) + ' min</span></li>';
    }).join('') + proximas.slice(0, 3).map(function (s) {
      return '<li><span class="rm-bid">' + horaCortaMapa(s.estimada) + '</span><span class="rm-st">' + esc(estadoSalidaMapa(s)[0]) +
        '</span><span class="rm-cd">' + (s.falta < 1 ? 'Ahora' : Math.ceil(s.falta) + ' min') + '</span></li>';
    }).join('');

    return '<div style="--c:' + colorExp(exp) + '"><div class="rm-eta"><span class="rm-big">' +
      (p ? (p.falta < 1 ? 'Ahora' : Math.ceil(p.falta) + ' min') : '–') + '</span><span class="rm-lbl">' +
      (p ? 'Próxima salida · <b>' + esc(horaTexto(p.estimada)) + '</b>' : 'No hay más salidas hoy') + '</span>' +
      '<span class="rm-chip ' + estado[1] + '">' + esc(estado[0]) + '</span></div>' +
      '<ol class="rm-next">' + (filas || '<li><span class="rm-st">Los expresos salen desde las 5:00 a. m.</span></li>') + '</ol></div>';
  }

  function htmlVivo() {
    var D = datos();

    if (modo === 'expresos') return htmlVivoExp();

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
      if (modo === 'rutas') moverBuses(); else moverBusesExp();

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

      if (pendiente) {
        var deseado = pendiente;

        pendiente = null;
        cambiarModo(deseado.modo);
        if (deseado.id) elegirExp(deseado.id);
      }

      cargarSegunModo();
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
      cargarSegunModo();
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
    if (map) map.fitBounds(borde ? borde.getBounds() : NICARAGUA, { paddingTopLeft: [14, 90], paddingBottomRight: [14, 250], animate: true, duration: 0.9 });
  });
  $('rm-rutas').addEventListener('click', function () {
    if (!map) return;

    if (modo === 'expresos') elegirExp(null); else elegirRuta(null);
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
  $('rm-grab').addEventListener('click', function () {
    var plegada = $('rm-sheet').classList.toggle('rm-plegada');

    this.setAttribute('aria-expanded', String(!plegada));
    this.setAttribute('aria-label', plegada ? 'Desplegar panel' : 'Plegar panel');
  });
  $('rm-sitios').addEventListener('click', function () {
    verSitios = !verSitios;
    this.setAttribute('aria-pressed', String(verSitios));
    visibilidadSitios();
  });
  $('rm-capas').addEventListener('click', function () {
    satelite = !satelite;
    this.setAttribute('aria-pressed', String(satelite));
    this.setAttribute('aria-label', satelite ? 'Cambiar a vista de calles' : 'Cambiar a vista satélite');
    ponerMosaicos();
  });
  $('rm-zin').addEventListener('click', function () { if (map) map.zoomIn(); });
  $('rm-zout').addEventListener('click', function () { if (map) map.zoomOut(); });
  $('rm-loc').addEventListener('click', function () {
    if (map) iniciarUbicacion(true);
  });

  $('rm-chips').addEventListener('click', function (evento) {
    var chip = evento.target.closest('.rm-rchip');

    if (!chip || !map) return;

    if (chip.getAttribute('data-modo')) {
      cambiarModo(chip.getAttribute('data-modo'));
      return;
    }

    if (modo === 'expresos') elegirExp(chip.getAttribute('data-id') || null);
    else elegirRuta(chip.getAttribute('data-id') || null);
  });

  $('rm-fijo').addEventListener('click', function (evento) {
    if (evento.target.closest('#rm-todas')) {
      if (modo === 'expresos') elegirExp(null); else elegirRuta(null);
      return;
    }

    var ciudad = evento.target.closest('[data-ciudad]');

    if (ciudad && map) {
      var c = window.RutmovilNicaragua.ciudades[Number(ciudad.getAttribute('data-ciudad'))];

      map.flyTo([c[1], c[2]], c[4] ? 12 : 11, { duration: 0.9 });
      return;
    }

    var parada = evento.target.closest('.rm-sp, .rm-foto');

    if (!parada || !sel || modo !== 'rutas') return;

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

  // Permite que las tarjetas de Expresos abran el mapa en ese expreso.
  window.RutmovilMapa = {
    abrir: abrir,
    verExpreso: function (id) {
      pendiente = { modo: 'expresos', id: id };

      if (panel.hidden) {
        abrir();
      } else if (map) {
        var deseado = pendiente;

        pendiente = null;
        cambiarModo(deseado.modo);
        elegirExp(deseado.id);
      }
    }
  };

  // El mapa sigue el tema claro/oscuro de Rutmovil.
  new MutationObserver(ponerMosaicos).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (window.matchMedia) {
    var consulta = window.matchMedia('(prefers-color-scheme: dark)');

    if (consulta.addEventListener) consulta.addEventListener('change', ponerMosaicos);
  }
})();
