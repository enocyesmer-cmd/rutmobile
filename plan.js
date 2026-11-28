/* Planificador de viaje de Rutmovil (operaciones 01 a 05; la 05 suma el costo del viaje con tarifas.js).
   Archivo nuevo: no cambia nada de lo existente. Lee las rutas de script.js (window.RutmovilDatos),
   los sitios de interés de nicaragua.js y las coordenadas de las paradas de map.js (window.RutmovilMapa.paradas).
   Aquí se eligen origen y destino y se calcula la ruta directa (sentido del bus, paradas, espera y tiempo total) o, si no hay, una combinación con un transbordo.
   Con el botón "Ver en el mapa" lo dibuja en el mapa de map.js, y se puede elegir el origen o el destino tocando el mapa. */
(function () {
  var MAX_SITIO_KM = 3;   // un sitio de interés solo se ofrece si hay una parada a esta distancia o menos

  var boton = document.getElementById('planbtn');
  var panel = null;
  var campoOrigen = null;
  var campoDestino = null;
  var resultado = null;
  var opciones = null;
  var puntosMapa = { o: null, d: null };   // puntos elegidos tocando el mapa (origen y destino)
  var vistas = [];                         // opciones que se ven en pantalla, para el botón "Ver en el mapa"

  if (!boton) return;

  var escapar = function (texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Distancia en kilómetros entre dos puntos [lat, lng].
  function distanciaKm(a, b) {
    var rad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * rad;
    var dLng = (b[1] - a[1]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function textoDistancia(km) {
    if (km < 0.05) return 'menos de 50 m';

    return km < 1 ? 'unos ' + (Math.round(km * 20) * 50) + ' m' : km.toFixed(1).replace('.', ',') + ' km';
  }

  // Parada más cercana a un punto [lat, lng]: { parada, km } o null.
  function masCercana(punto, paradas, orden) {
    var cerca = null;

    orden.forEach(function (nombre) {
      var c = paradas[nombre].coord;

      if (!c) return;

      var km = distanciaKm(punto, c);

      if (!cerca || km < cerca.km) cerca = { parada: nombre, km: km };
    });

    return cerca;
  }

  // Construye (una sola vez) la lista de puntos que se pueden elegir.
  function prepararOpciones() {
    if (opciones) return opciones;

    var datos = window.RutmovilDatos;
    var mapa = window.RutmovilMapa;
    var coords = (mapa && mapa.paradas) || {};
    var paradas = {};
    var orden = [];

    if (datos && datos.rutas) {
      datos.rutas.forEach(function (ruta) {
        ruta.stops.forEach(function (nombre) {
          if (!paradas[nombre]) {
            paradas[nombre] = { nombre: nombre, rutas: [], coord: coords[nombre] || null };
            orden.push(nombre);
          }

          if (paradas[nombre].rutas.indexOf(ruta.id) === -1) paradas[nombre].rutas.push(ruta.id);
        });
      });
    }

    orden.sort(function (a, b) { return a.localeCompare(b, 'es'); });

    var sitios = [];
    var P = window.RutmovilNicaragua;

    if (P && P.sitios) {
      P.sitios.forEach(function (sitio) {
        var punto = [sitio[1], sitio[2]];
        var cerca = masCercana(punto, paradas, orden);

        if (cerca && cerca.km <= MAX_SITIO_KM) {
          var cat = P.categorias && P.categorias[sitio[3]];

          sitios.push({ nombre: sitio[0], emoji: cat ? cat[0] : '📍', cerca: cerca, coord: punto });
        }
      });

      sitios.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
    }

    opciones = { paradas: paradas, orden: orden, sitios: sitios };

    return opciones;
  }

  function htmlOpciones(o) {
    var html = '<option value="">Elige un punto</option><optgroup label="Paradas de las rutas">';

    o.orden.forEach(function (nombre) {
      html += '<option value="p:' + escapar(nombre) + '">' + escapar(nombre) + '</option>';
    });

    html += '</optgroup>';

    if (o.sitios.length) {
      html += '<optgroup label="Sitios de interés">';
      o.sitios.forEach(function (sitio, i) {
        html += '<option value="s:' + i + '">' + sitio.emoji + ' ' + escapar(sitio.nombre) + '</option>';
      });
      html += '</optgroup>';
    }

    return html;
  }

  // Convierte lo elegido en un punto con su parada (la misma, o la más cercana si es un sitio).
  function resolver(valor, campo) {
    var o = prepararOpciones();

    if (!valor) return null;

    if (valor === 'm') {
      var pm = puntosMapa[campo];
      var cercana = pm ? masCercana([pm.lat, pm.lng], o.paradas, o.orden) : null;

      if (!cercana) return null;
      if (cercana.km > MAX_SITIO_KM) return { lejos: true, km: cercana.km };

      return {
        nombre: 'tu punto del mapa', parada: cercana.parada, km: cercana.km,
        rutas: o.paradas[cercana.parada].rutas, esSitio: true, coord: [pm.lat, pm.lng]
      };
    }

    if (valor.indexOf('p:') === 0) {
      var parada = o.paradas[valor.slice(2)];

      return parada ? { nombre: parada.nombre, parada: parada.nombre, km: 0, rutas: parada.rutas, esSitio: false, coord: parada.coord } : null;
    }

    var sitio = o.sitios[Number(valor.slice(2))];

    if (!sitio) return null;

    return {
      nombre: sitio.nombre, parada: sitio.cerca.parada, km: sitio.cerca.km,
      rutas: o.paradas[sitio.cerca.parada].rutas, esSitio: true, coord: sitio.coord
    };
  }

  // ---- ruta directa (operación 02) ----
  var ultimo = null;   // lo último que se buscó, para refrescar los tiempos
  var reloj = null;
  var abiertas = {};   // rutas con la lista de paradas desplegada (para no cerrarlas al refrescar)

  // Caminata aproximada: línea recta x 1,3 a 5 km/h.
  function minutosAPie(km) {
    return km < 0.05 ? 0 : Math.max(1, Math.ceil(km * 1.3 * 12));
  }

  // Rutas que llevan de la parada de origen a la de destino en el sentido en que van los buses.
  function buscarDirectas(origen, destino) {
    var datos = window.RutmovilDatos;
    var aPie = minutosAPie(origen.km) + minutosAPie(destino.km);
    var directas = [];
    var contrarias = [];

    datos.rutas.forEach(function (ruta) {
      var i = ruta.stops.indexOf(origen.parada);
      var f = ruta.stops.indexOf(destino.parada);

      if (i === -1 || f === -1) return;

      if (f < i) {
        contrarias.push(ruta.id);
        return;
      }

      var llegadas = datos.calcularLlegada(ruta, i);
      var espera = llegadas.length
        ? llegadas[0].segundos
        : (ruta.stops.length + 1.4) / (ruta.base * ruta.buses.length) * 60;
      var esperaMin = espera < 30 ? 0 : Math.ceil(espera / 60);
      var viaje = Math.max(1, Math.ceil((f - i) / ruta.base));

      directas.push({
        id: ruta.id, desde: i, hasta: f, paradas: f - i, viaje: viaje, espera: espera, esperaMin: esperaMin,
        sinBus: !llegadas.length, nombres: ruta.stops.slice(i, f + 1),
        total: aPie + esperaMin + viaje
      });
    });

    directas.sort(function (a, b) { return a.total - b.total; });

    return { directas: directas, contrarias: contrarias };
  }

  // ---- transbordo (operación 03) ----
  var MAX_CAMBIO_KM = 0.5;   // para cambiar de bus se puede caminar hasta esta distancia entre dos paradas

  var vecinasCache = {};

  // La parada misma y las paradas a menos de MAX_CAMBIO_KM, con su distancia.
  function vecinas(nombre) {
    if (vecinasCache[nombre]) return vecinasCache[nombre];

    var o = prepararOpciones();
    var aqui = o.paradas[nombre] && o.paradas[nombre].coord;
    var lista = [{ nombre: nombre, km: 0 }];

    if (aqui) {
      o.orden.forEach(function (otro) {
        var c = o.paradas[otro].coord;

        if (otro === nombre || !c) return;

        var km = distanciaKm(aqui, c);

        if (km <= MAX_CAMBIO_KM) lista.push({ nombre: otro, km: km });
      });
    }

    vecinasCache[nombre] = lista;

    return lista;
  }

  // Cada cuántos minutos pasa un bus de la ruta (el mismo cálculo que usa la lista de rutas).
  function cadaMin(ruta) {
    return Math.max(1, (ruta.stops.length + 1.4) / (ruta.base * ruta.buses.length));
  }

  // Combina dos rutas: la primera sale del origen, la segunda llega al destino, y se cambia en una parada
  // (la misma o una cercana a pie). Por cada pareja de rutas se queda con el mejor punto de cambio.
  function buscarTransbordos(origen, destino) {
    var datos = window.RutmovilDatos;
    var aPie = minutosAPie(origen.km) + minutosAPie(destino.km);
    var porPareja = {};

    datos.rutas.forEach(function (rA) {
      var iO = rA.stops.indexOf(origen.parada);

      if (iO === -1) return;

      var llA = datos.calcularLlegada(rA, iO);
      var esperaA = llA.length ? llA[0].segundos : cadaMin(rA) * 30;

      datos.rutas.forEach(function (rB) {
        var iD = rB.stops.indexOf(destino.parada);

        if (rB.id === rA.id || iD === -1) return;

        for (var a = iO + 1; a < rA.stops.length; a++) {
          vecinas(rA.stops[a]).forEach(function (v) {
            var b = rB.stops.indexOf(v.nombre);

            if (b === -1 || b >= iD) return;

            var viajeA = (a - iO) / rA.base * 60;                  // segundos
            var cambio = minutosAPie(v.km) * 60;
            var llegaYo = esperaA + viajeA + cambio;               // segundos desde ahora hasta la parada de cambio
            var llB = datos.calcularLlegada(rB, b).filter(function (x) { return x.segundos >= llegaYo; });
            var esperaB = llB.length ? llB[0].segundos - llegaYo : cadaMin(rB) * 30;
            var viajeB = (iD - b) / rB.base * 60;
            var total = aPie + Math.ceil((llegaYo + esperaB + viajeB) / 60);
            var clave = rA.id + '>' + rB.id;

            if (!porPareja[clave] || total < porPareja[clave].total) {
              porPareja[clave] = {
                a: rA.id, b: rB.id, iO: iO, bajaIdx: a, subeIdx: b, iD: iD, total: total, espera: esperaA, esperaB: Math.ceil(esperaB / 60),
                viajeMin: Math.ceil((viajeA + viajeB) / 60), paradasA: a - iO, paradasB: iD - b,
                bajaEn: rA.stops[a], subeEn: v.nombre, caminar: minutosAPie(v.km), estimada: !llB.length
              };
            }
          });
        }
      });
    });

    return Object.keys(porPareja).map(function (k) { return porPareja[k]; })
      .sort(function (x, y) { return x.total - y.total; }).slice(0, 3);
  }

  function tarjetaTransbordo(op, mejor, origen, destino, i) {
    var datos = window.RutmovilDatos;
    var pasos = '<li>Sube a la <strong>' + escapar(op.a) + '</strong> en ' + escapar(origen.parada) + '.</li>' +
      '<li>Baja en <strong>' + escapar(op.bajaEn) + '</strong> (' + op.paradasA + (op.paradasA === 1 ? ' parada' : ' paradas') + ').</li>' +
      (op.caminar ? '<li>Camina unos ' + op.caminar + ' min hasta ' + escapar(op.subeEn) + '.</li>' : '') +
      '<li>Sube a la <strong>' + escapar(op.b) + '</strong> en ' + escapar(op.subeEn) +
      (op.esperaB <= 1 ? ' (casi sin espera).</li>' : ' (espera ' + (op.estimada ? '~' : 'de unos ') + op.esperaB + ' min).</li>') +
      '<li>Baja en <strong>' + escapar(destino.parada) + '</strong> (' + op.paradasB + (op.paradasB === 1 ? ' parada' : ' paradas') + ').</li>';
    var id = op.a + '-' + op.b;

    return '<article class="pl-opcion' + (mejor ? ' pl-mejor' : '') + '">' +
      '<header><span class="pl-ruta">' + escapar(op.a) + '</span><span class="pl-flecha" aria-hidden="true">→</span>' +
      '<span class="pl-ruta">' + escapar(op.b) + '</span>' +
      (mejor ? '<span class="pl-badge">Más rápida</span>' : '') +
      '<span class="pl-total">~' + op.total + ' min</span></header>' +
      '<dl class="pl-meta">' +
      '<div><dt>Espera</dt><dd>' + datos.mostrarLlegada(op.espera) + '</dd></div>' +
      '<div><dt>Viaje</dt><dd>~' + op.viajeMin + ' min</dd></div>' +
      '<div><dt>Cambio en</dt><dd class="pl-texto">' + escapar(op.bajaEn) + '</dd></div></dl>' + htmlCosto([op.a, op.b]) +
      '<details data-ruta="' + escapar(id) + '"' + (abiertas[id] ? ' open' : '') + '>' +
      '<summary>Ver los pasos</summary><ol class="pl-lista">' + pasos + '</ol></details>' + botonVer(i) + '</article>';
  }

  function lineaParada(verbo, punto) {
    var extra = punto.esSitio && punto.km >= 0.05
      ? ' (a ' + textoDistancia(punto.km) + ' de ' + escapar(punto.nombre) + ', unos ' + minutosAPie(punto.km) + ' min a pie)'
      : '';

    return '<p>' + verbo + ' en <strong>' + escapar(punto.parada) + '</strong>' + extra + '</p>';
  }

  // Costo del viaje (operación 05): un pasaje por cada ruta que se toma. Si tarifas.js no cargó, no se muestra nada.
  function htmlCosto(ids) {
    var T = window.RutmovilTarifas;

    if (!T) return '';

    var detalle = ids.length > 1
      ? ids.map(function (id) { return 'ruta ' + escapar(id) + ' ' + T.formato(T.costoRuta(id)); }).join(' + ')
      : 'un pasaje';

    return '<p class="pl-costo"><span>Costo del viaje</span><strong>' + T.formato(T.costoViaje(ids)) +
      '</strong><small>' + detalle + '</small></p>';
  }

  function botonVer(i) {
    return '<button type="button" class="pl-ver" data-i="' + i + '">Ver en el mapa</button>';
  }

  function tarjetaOpcion(opcion, mejor, i) {
    var datos = window.RutmovilDatos;
    var lista = opcion.nombres.map(function (nombre, i) {
      var clase = i === 0 || i === opcion.nombres.length - 1 ? ' class="pl-extremo"' : '';

      return '<li' + clase + '>' + escapar(nombre) + '</li>';
    }).join('');

    return '<article class="pl-opcion' + (mejor ? ' pl-mejor' : '') + '">' +
      '<header><span class="pl-ruta">' + escapar(opcion.id) + '</span>' +
      (mejor ? '<span class="pl-badge">Más rápida</span>' : '') +
      '<span class="pl-total">~' + opcion.total + ' min</span></header>' +
      '<dl class="pl-meta">' +
      '<div><dt>Espera</dt><dd>' + (opcion.sinBus ? '~' + opcion.esperaMin + ' min' : datos.mostrarLlegada(opcion.espera)) + '</dd></div>' +
      '<div><dt>Viaje</dt><dd>~' + opcion.viaje + ' min</dd></div>' +
      '<div><dt>Paradas</dt><dd>' + opcion.paradas + '</dd></div></dl>' + htmlCosto([opcion.id]) +
      '<details data-ruta="' + escapar(opcion.id) + '"' + (abiertas[opcion.id] ? ' open' : '') + '>' +
      '<summary>Ver paradas del trayecto</summary><ol class="pl-lista">' + lista + '</ol></details>' + botonVer(i) + '</article>';
  }

  function coordDe(nombre) {
    var parada = prepararOpciones().paradas[nombre];
    var c = parada && parada.coord;

    return c ? [c[0], c[1]] : null;
  }

  function mayus(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function registrar(origen, destino, op, cambio) {
    vistas.push({ origen: origen, destino: destino, op: op, cambio: cambio });

    return vistas.length - 1;
  }

  // Arma lo que necesita el mapa para dibujar el viaje elegido (operación 04).
  function especificar(vista) {
    var origen = vista.origen;
    var destino = vista.destino;
    var op = vista.op;
    var tramos = vista.cambio
      ? [{ ruta: op.a, desde: op.iO, hasta: op.bajaIdx }, { ruta: op.b, desde: op.subeIdx, hasta: op.iD }]
      : [{ ruta: op.id, desde: op.desde, hasta: op.hasta }];
    var puntos = [];
    var caminatas = [];

    [['origen', origen], ['destino', destino]].forEach(function (par) {
      var punto = par[1];
      var enParada = coordDe(punto.parada);
      var lugar = punto.esSitio && punto.coord ? punto.coord : enParada;

      if (lugar) puntos.push({ tipo: par[0], nombre: mayus(punto.nombre), lat: lugar[0], lng: lugar[1] });
      if (punto.esSitio && punto.km >= 0.05 && enParada && lugar) caminatas.push([lugar, enParada]);
    });

    if (vista.cambio) {
      var baja = coordDe(op.bajaEn);
      var sube = coordDe(op.subeEn);

      if (baja) puntos.push({ tipo: 'cambio', nombre: op.bajaEn, lat: baja[0], lng: baja[1] });
      if (op.subeEn !== op.bajaEn && baja && sube) caminatas.push([baja, sube]);
    }

    return {
      tramos: tramos, puntos: puntos, caminatas: caminatas, total: op.total,
      titulo: mayus(origen.nombre) + ' → ' + mayus(destino.nombre),
      rutas: vista.cambio ? op.a + ' → ' + op.b : op.id
    };
  }

  function dibujar(valorOrigen, valorDestino) {
    var origen = resolver(valorOrigen, 'o');
    var destino = resolver(valorDestino, 'd');

    vistas = [];

    if (!origen || !destino) {
      resultado.innerHTML = '<p class="pl-aviso">Elige el origen y el destino para ver las rutas.</p>';
      return;
    }

    var lejos = origen.lejos ? origen : (destino.lejos ? destino : null);

    if (lejos) {
      resultado.innerHTML = '<p class="pl-aviso">Tu punto del mapa queda a ' + textoDistancia(lejos.km) +
        ' de la parada más cercana. Elige un punto más cerca de las rutas.</p>';
      return;
    }

    if (origen.parada === destino.parada) {
      resultado.innerHTML = '<p class="pl-aviso">El origen y el destino quedan en la misma parada (' + escapar(origen.parada) +
        '). Elige puntos distintos.</p>';
      return;
    }

    var r = buscarDirectas(origen, destino);
    var html = '<div class="pl-resumen"><small>Tu viaje</small>' + lineaParada('Sube', origen) + lineaParada('Baja', destino) + '</div>';

    var nota = '<p class="pl-nota">El total suma caminata, espera y viaje. Son estimaciones con los datos de ejemplo de Rutmovil.' +
      (window.RutmovilTarifas ? ' Las tarifas son de referencia.' : '') + '</p>';

    if (r.directas.length) {
      html += r.directas.map(function (opcion, i) { return tarjetaOpcion(opcion, i === 0 && r.directas.length > 1, registrar(origen, destino, opcion, false)); }).join('') + nota;
    } else {
      var combinadas = buscarTransbordos(origen, destino);

      if (combinadas.length) {
        html += '<p class="pl-nota">No hay ruta directa, pero puedes combinar dos rutas con un transbordo:</p>' +
          combinadas.map(function (op, i) { return tarjetaTransbordo(op, i === 0 && combinadas.length > 1, origen, destino, registrar(origen, destino, op, true)); }).join('') + nota;
      } else if (r.contrarias.length) {
        html += '<p class="pl-aviso">' + (r.contrarias.length > 1 ? 'Las rutas ' : 'La ruta ') + escapar(r.contrarias.join(', ')) +
          (r.contrarias.length > 1 ? ' pasan' : ' pasa') + ' por los dos puntos, pero en sentido contrario. Prueba intercambiando origen y destino.</p>';
      } else {
        html += '<p class="pl-aviso">Ninguna ruta ni combinación de dos rutas llega de ' + escapar(origen.parada) + ' a ' + escapar(destino.parada) +
          ' en ese sentido. Prueba con otro punto o intercambia origen y destino.</p>';
      }
    }

    resultado.innerHTML = html;
  }

  // manual = true cuando la persona toca el botón (se anuncia el resultado); si no, es un refresco de tiempos.
  function buscar(manual) {
    ultimo = { o: campoOrigen.value, d: campoDestino.value };
    resultado.setAttribute('aria-live', manual === true ? 'polite' : 'off');
    dibujar(ultimo.o, ultimo.d);
  }

  function refrescar() {
    if (!panel || panel.hidden || !ultimo || !ultimo.o || !ultimo.d) return;

    resultado.setAttribute('aria-live', 'off');
    dibujar(ultimo.o, ultimo.d);
  }

  // Punto elegido tocando el mapa: aparece como una opción más del selector (operación 04).
  function ponerOpcionMapa(select, hay) {
    var viejo = select.querySelector('option[value="m"]');

    if (viejo) viejo.parentNode.removeChild(viejo);
    if (!hay) return;

    var opcion = document.createElement('option');

    opcion.value = 'm';
    opcion.textContent = '📍 Mi punto en el mapa';
    select.insertBefore(opcion, select.children[1] || null);
  }

  function elegirEnMapa(campo) {
    var mapa = window.RutmovilMapa;
    var select = campo === 'o' ? campoOrigen : campoDestino;

    if (!mapa || !mapa.elegirPunto) {
      resultado.innerHTML = '<p class="pl-aviso">El mapa no está disponible en este momento.</p>';
      return;
    }

    cerrar();
    mapa.elegirPunto({
      mensaje: campo === 'o' ? 'Toca el mapa para elegir dónde empiezas tu viaje' : 'Toca el mapa para elegir adónde vas',
      alElegir: function (punto) {
        puntosMapa[campo] = punto;
        ponerOpcionMapa(select, true);
        select.value = 'm';
        abrir();

        if (campoOrigen.value && campoDestino.value) buscar(true);
      },
      alCancelar: function () { abrir(); }
    });
  }

  function construir() {
    var o = prepararOpciones();
    var html = htmlOpciones(o);

    panel = document.createElement('div');
    panel.className = 'pl';
    panel.id = 'plan';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'pl-titulo');
    panel.innerHTML =
      '<div class="pl-top"><h2 id="pl-titulo">Planificar viaje</h2>' +
      '<button class="pl-cerrar" type="button" aria-label="Cerrar planificador">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="pl-cuerpo"><div class="pl-form">' +
      '<div class="pl-campo"><label for="pl-origen">Origen</label><select id="pl-origen">' + html + '</select>' +
      '<button type="button" class="pl-mapa" data-campo="o">📍 Elegir en el mapa</button></div>' +
      '<div class="pl-campo"><label for="pl-destino">Destino</label><select id="pl-destino">' + html + '</select>' +
      '<button type="button" class="pl-mapa" data-campo="d">📍 Elegir en el mapa</button></div>' +
      '<button class="pl-swap" type="button" aria-label="Intercambiar origen y destino" title="Intercambiar">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16M8 4L4 8M8 4l4 4M16 20V4M16 20l-4-4M16 20l4-4"/></svg></button>' +
      '<button class="pl-ir" type="button">Ver rutas</button></div>' +
      '<div class="pl-res" id="pl-res"></div></div>';

    document.body.appendChild(panel);

    campoOrigen = panel.querySelector('#pl-origen');
    campoDestino = panel.querySelector('#pl-destino');
    resultado = panel.querySelector('#pl-res');

    panel.querySelector('.pl-cerrar').addEventListener('click', cerrar);
    panel.querySelector('.pl-ir').addEventListener('click', function () { buscar(true); });
    panel.querySelector('.pl-swap').addEventListener('click', function () {
      var valorO = campoOrigen.value;
      var valorD = campoDestino.value;
      var guardado = puntosMapa.o;

      puntosMapa.o = puntosMapa.d;
      puntosMapa.d = guardado;
      ponerOpcionMapa(campoOrigen, !!puntosMapa.o);
      ponerOpcionMapa(campoDestino, !!puntosMapa.d);
      campoOrigen.value = valorD;
      campoDestino.value = valorO;

      if (campoOrigen.value && campoDestino.value) buscar(true);
    });
    // Recuerda qué listas de paradas están abiertas (el evento toggle no sube, por eso se usa la captura).
    resultado.addEventListener('toggle', function (evento) {
      var detalle = evento.target;

      if (detalle && detalle.getAttribute) abiertas[detalle.getAttribute('data-ruta')] = detalle.open;
    }, true);
    panel.addEventListener('click', function (evento) {
      var objetivo = evento.target;
      var campo = objetivo && objetivo.getAttribute ? objetivo.getAttribute('data-campo') : null;

      if (campo) elegirEnMapa(campo);
    });
    resultado.addEventListener('click', function (evento) {
      var objetivo = evento.target;
      var i = objetivo && objetivo.getAttribute ? objetivo.getAttribute('data-i') : null;
      var mapa = window.RutmovilMapa;

      if (i === null || !vistas[Number(i)]) return;

      if (!mapa || !mapa.verViaje) {
        objetivo.textContent = 'El mapa no está disponible';
        return;
      }

      var viaje = especificar(vistas[Number(i)]);

      cerrar();
      mapa.verViaje(viaje);
    });
    panel.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') cerrar();
    });
  }

  function abrir() {
    if (!panel) construir();

    panel.hidden = false;
    document.documentElement.classList.add('pl-abierto');
    campoOrigen.focus();

    if (!reloj) reloj = setInterval(refrescar, 5000);
  }

  function cerrar() {
    if (!panel) return;

    panel.hidden = true;
    document.documentElement.classList.remove('pl-abierto');

    if (reloj) { clearInterval(reloj); reloj = null; }

    boton.focus();
  }

  boton.addEventListener('click', abrir);

  window.RutmovilPlan = { abrir: abrir, cerrar: cerrar };
})();
