/* Horarios de Rutmovil (operación 06).
   Archivo nuevo: no cambia nada de lo existente. Agrega a cada ruta abierta el horario completo del día
   en la parada elegida, y a cada expreso abierto todas sus salidas de hoy.
   Los horarios son de EJEMPLO: salen del primer y último bus de la tabla de abajo y de la frecuencia de cada ruta.
   script.js dibuja las tarjetas una y otra vez, por eso se vigilan los contenedores y se completa lo que falte. */
(function () {
  var HORARIOS = {
    // Primer y último bus que sale de la primera parada (minutos desde las 0:00: 300 = 5:00 a. m.).
    rutaPorDefecto: { primero: 300, ultimo: 1260 },
    rutas: {
      '110': { primero: 300, ultimo: 1260 },
      '119': { primero: 330, ultimo: 1200 },
      '105': { primero: 300, ultimo: 1260 },
      '133': { primero: 300, ultimo: 1230 },
      '102': { primero: 330, ultimo: 1230 },
      '162': { primero: 300, ultimo: 1200 }
    },
    // En hora pico los buses salen más seguido.
    horasPico: [[360, 540], [960, 1140]],   // de 6:00 a 9:00 a. m. y de 4:00 a 7:00 p. m.
    factorPico: 0.75,
    minimoEntreBuses: 3
  };

  var abiertos = {};   // horarios desplegados, para no cerrarlos cuando se redibuja la tarjeta

  function datos() {
    return window.RutmovilDatos;
  }

  function dosDigitos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function horaTexto(minutos) {
    var h = Math.floor(minutos / 60) % 24;
    var m = Math.floor(minutos % 60);

    return (h % 12 === 0 ? 12 : h % 12) + ':' + dosDigitos(m) + ' ' + (h >= 12 ? 'p. m.' : 'a. m.');
  }

  function horaEnPunto(hora) {
    var h = hora % 24;

    return (h % 12 === 0 ? 12 : h % 12) + ' ' + (h >= 12 ? 'p. m.' : 'a. m.');
  }

  function esPico(minutos) {
    return HORARIOS.horasPico.some(function (r) { return minutos >= r[0] && minutos < r[1]; });
  }

  // Cada cuántos minutos sale un bus (el mismo cálculo de la tarjeta de la ruta en script.js).
  function frecuenciaBase(ruta) {
    return Math.max(1, Math.round((ruta.stops.length + 1.4) / (ruta.base * ruta.buses.length)));
  }

  function pasoEn(ruta, minutos) {
    var f = frecuenciaBase(ruta);

    return esPico(minutos) ? Math.max(HORARIOS.minimoEntreBuses, Math.round(f * HORARIOS.factorPico)) : f;
  }

  // Horas a las que sale un bus de la primera parada.
  function salidasTerminal(ruta) {
    var h = HORARIOS.rutas[ruta.id] || HORARIOS.rutaPorDefecto;
    var lista = [];

    for (var t = h.primero; t <= h.ultimo; t += pasoEn(ruta, t)) lista.push(t);

    return lista;
  }

  // Horas a las que pasa un bus por la parada número i: la salida más lo que tarda en llegar (base = paradas por minuto).
  function horarioParada(ruta, i) {
    var desfase = Math.round(i / ruta.base);

    return salidasTerminal(ruta).map(function (t) { return t + desfase; });
  }

  // Salidas del día de un expreso, con su retraso (usa el mismo cálculo de retrasos de script.js).
  function horarioExpreso(expreso) {
    var lista = [];

    for (var hora = expreso.first, numero = 0; hora <= expreso.last; hora += expreso.every, numero++) {
      lista.push({ hora: hora, retraso: datos().calcularRetraso(expreso, numero) });
    }

    return lista;
  }

  // Dibuja las horas agrupadas por hora del reloj; la próxima se resalta y las que ya pasaron se atenuan.
  // Cada elemento es { hora: minutos, retraso: minutos (opcional) }.
  function htmlTabla(items, ahora) {
    var filas = {};
    var orden = [];
    var siguiente = null;

    items.forEach(function (item) {
      var bloque = Math.floor(item.hora / 60);

      if (!filas[bloque]) { filas[bloque] = []; orden.push(bloque); }

      filas[bloque].push(item);

      if (siguiente === null && item.hora + (item.retraso || 0) >= ahora) siguiente = item;
    });

    return orden.map(function (bloque) {
      var celdas = filas[bloque].map(function (item) {
        var clase = 'hr-h' + (item === siguiente ? ' sig' : '') + (item.hora + (item.retraso || 0) < ahora ? ' pasado' : '') +
          (item.retraso ? ' tarde' : '');
        var minutos = ':' + dosDigitos(item.hora % 60);

        return '<span class="' + clase + '"' + (item === siguiente ? ' aria-label="Próximo: ' + horaTexto(item.hora) + '"' : '') + '>' + minutos +
          (item.retraso ? '<sup>+' + item.retraso + '</sup>' : '') + '</span>';
      }).join('');

      return '<div class="hr-fila"><b>' + horaEnPunto(bloque) + '</b><div class="hr-horas">' + celdas + '</div></div>';
    }).join('');
  }

  function minutosAhora() {
    var f = new Date();

    return f.getHours() * 60 + f.getMinutes();
  }

  // Crea (una vez por tarjeta) el bloque desplegable y lo coloca después de los botones del panel.
  function bloque(panel, clave) {
    var det = panel.querySelector('.horario');

    if (det) return det;

    det = document.createElement('details');
    det.className = 'horario';
    det.setAttribute('data-clave', clave);
    det.innerHTML = '<summary></summary><div class="hr-cuerpo"></div>';

    var acciones = panel.querySelector('.acciones');

    if (acciones && acciones.parentNode) {
      acciones.parentNode.insertBefore(det, acciones.nextSibling);
    } else {
      panel.appendChild(det);
    }

    if (abiertos[clave]) det.open = true;

    return det;
  }

  function llenar(det, resumen, cuerpo, version) {
    if (det.getAttribute('data-v') === version) return;

    det.setAttribute('data-v', version);
    det.querySelector('summary').innerHTML = resumen;
    det.querySelector('.hr-cuerpo').innerHTML = cuerpo;
  }

  function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function marcarRutas() {
    var D = datos();
    var cont = document.getElementById('grid');

    if (!D || !cont) return;

    var ahora = minutosAhora();

    Array.prototype.forEach.call(cont.querySelectorAll('.card.open[data-id]'), function (tarjeta) {
      var panel = tarjeta.querySelector('.panel');
      var ruta = D.rutas.filter(function (r) { return r.id === tarjeta.getAttribute('data-id'); })[0];

      if (!panel || !ruta) return;

      var i = D.paradaElegida[ruta.id];
      var horas = horarioParada(ruta, i);

      if (!horas.length) return;

      var det = bloque(panel, 'r' + ruta.id);
      var resumen = 'Horario completo de <strong>' + escapar(ruta.stops[i]) + '</strong>';
      var info = '<p class="hr-info">Primer bus ' + horaTexto(horas[0]) + ' · último ' + horaTexto(horas[horas.length - 1]) +
        ' · cada ~' + frecuenciaBase(ruta) + ' min (en hora pico, ~' + pasoEn(ruta, HORARIOS.horasPico[0][0]) + ' min)' +
        (horas[horas.length - 1] < ahora ? ' · ya no hay más buses hoy' : '') + '</p>';

      llenar(det, resumen,
        info + htmlTabla(horas.map(function (h) { return { hora: h }; }), ahora) +
        '<p class="hr-nota">Horario de ejemplo. Toca otra parada del recorrido para ver el suyo.</p>',
        i + '|' + ahora);
    });
  }

  function marcarExpresos() {
    var D = datos();
    var cont = document.getElementById('board');

    if (!D || !cont) return;

    var ahora = minutosAhora();

    Array.prototype.forEach.call(cont.querySelectorAll('.card.open[data-id]'), function (tarjeta) {
      var panel = tarjeta.querySelector('.panel');
      var expreso = D.expresos.filter(function (e) { return e.id === tarjeta.getAttribute('data-id'); })[0];

      if (!panel || !expreso) return;

      var salidas = horarioExpreso(expreso);
      var det = bloque(panel, 'e' + expreso.id);
      var ultima = salidas.length ? salidas[salidas.length - 1].hora : expreso.last;
      var info = '<p class="hr-info">Sale de ' + escapar(expreso.terminal) + ', andén ' + expreso.gate + ' · primera salida ' +
        horaTexto(expreso.first) + ' · última ' + horaTexto(ultima) + ' · cada ' + expreso.every + ' min' +
        (ultima < ahora ? ' · ya no hay más salidas hoy' : '') + '</p>';

      llenar(det, 'Horario completo de hoy (' + salidas.length + ' salidas)',
        info + htmlTabla(salidas, ahora) +
        '<p class="hr-nota">Las salidas con <sup>+N</sup> llevan N minutos de retraso (la hora mostrada es la programada).</p>',
        String(ahora));
    });
  }

  function vigilar(selector, marcar) {
    var cont = document.getElementById(selector);

    if (!cont) return;

    var pendiente = false;
    var revisar = function () {
      pendiente = false;
      marcar();
    };

    // Recuerda qué horarios están abiertos (el evento toggle no sube, por eso se usa la captura).
    cont.addEventListener('toggle', function (evento) {
      var det = evento.target;

      if (det && det.classList && det.classList.contains('horario')) abiertos[det.getAttribute('data-clave')] = det.open;
    }, true);

    marcar();

    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (pendiente) return;

        pendiente = true;
        requestAnimationFrame(revisar);
      }).observe(cont, { childList: true, subtree: true });
    }
  }

  vigilar('grid', marcarRutas);
  vigilar('board', marcarExpresos);

  window.RutmovilHorarios = {
    horarios: HORARIOS,
    horaTexto: horaTexto,
    horarioParada: function (id, indice) {
      var ruta = datos().rutas.filter(function (r) { return r.id === id; })[0];

      return ruta ? horarioParada(ruta, indice) : [];
    },
    horarioExpreso: function (id) {
      var expreso = datos().expresos.filter(function (e) { return e.id === id; })[0];

      return expreso ? horarioExpreso(expreso) : [];
    }
  };
})();
