/* Vista "todas las rutas a la vez" del mapa de Rutmovil (operación 08).
   Archivo nuevo: el mapa ya dibujaba todas las rutas con la opción "Todas"; aquí se suma una leyenda con un botón por ruta
   (con su color) para encender o apagar cada una, y los botones "Todas" y "Ninguna". Con 12 rutas encima, así se puede limpiar el mapa.
   La leyenda solo se ve cuando el mapa está en Rutas y sin ninguna ruta elegida. Usa window.RutmovilMapa (estado y ocultarRutas, de map.js).
   Tocar una ruta de la lista de arriba del mapa sigue funcionando igual: elegir una ruta apagada la vuelve a mostrar. */
(function () {
  var mapa = window.RutmovilMapa;
  var datos = window.RutmovilDatos;
  var sheet = document.getElementById('rm-sheet');
  var vivo = document.getElementById('rm-vivo');
  var chips = document.getElementById('rm-chips');

  if (!mapa || !mapa.estado || !mapa.ocultarRutas || !datos || !sheet || !vivo || !chips) return;

  var escapar = function (texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var caja = document.createElement('div');

  caja.id = 'rm-leyenda';
  caja.className = 'rm-leyenda';
  caja.hidden = true;
  caja.setAttribute('role', 'group');
  caja.setAttribute('aria-label', 'Rutas visibles en el mapa');
  vivo.parentNode.insertBefore(caja, vivo);

  var huella = '';   // para volver a dibujar solo cuando algo cambió

  function color(ruta, indice) {
    return ruta.color || ['#2f6bff', '#e64980', '#0ca678', '#d9480f', '#9c36b5', '#1098ad'][indice % 6];
  }

  function actualizar() {
    var estado = mapa.estado();
    var visible = estado.modo === 'rutas' && !estado.sel;

    caja.hidden = !visible;

    if (!visible) return;

    var nuevaHuella = datos.rutas.length + '|' + Object.keys(estado.ocultas).sort().join(',');

    if (nuevaHuella === huella) return;

    huella = nuevaHuella;

    var apagadas = Object.keys(estado.ocultas).length;
    var botones = datos.rutas.map(function (ruta, i) {
      var encendida = !estado.ocultas[ruta.id];

      return '<button type="button" class="rm-leg-b" data-id="' + escapar(ruta.id) + '" style="--c:' + color(ruta, i) +
        '" aria-pressed="' + encendida + '" aria-label="Ruta ' + escapar(ruta.id) + ', ' + (encendida ? 'visible' : 'oculta') +
        '"><i></i>' + escapar(ruta.id) + '</button>';
    }).join('');

    caja.innerHTML =
      '<div class="rm-leg-h"><b>Todas las rutas</b><span class="rm-sub">' + (datos.rutas.length - apagadas) + ' de ' + datos.rutas.length + ' visibles</span>' +
      '<span class="rm-leg-acc"><button type="button" class="rm-leg-t" data-acc="todas">Todas</button>' +
      '<button type="button" class="rm-leg-t" data-acc="ninguna">Ninguna</button></span></div>' +
      '<div class="rm-leg-g">' + botones + '</div>';
  }

  caja.addEventListener('click', function (evento) {
    var boton = evento.target.closest ? evento.target.closest('button') : null;

    if (!boton) return;

    var estado = mapa.estado();
    var ocultas = Object.keys(estado.ocultas);
    var acc = boton.getAttribute('data-acc');
    var id = boton.getAttribute('data-id');

    if (acc === 'todas') {
      ocultas = [];
    } else if (acc === 'ninguna') {
      ocultas = datos.rutas.map(function (r) { return r.id; });
    } else if (id) {
      ocultas = estado.ocultas[id] ? ocultas.filter(function (x) { return x !== id; }) : ocultas.concat(id);
    } else {
      return;
    }

    mapa.ocultarRutas(ocultas);
    actualizar();

    var foco = id ? caja.querySelector('[data-id="' + id + '"]') : caja.querySelector('[data-acc="' + acc + '"]');

    if (foco) foco.focus();
  });

  // El mapa vuelve a dibujar la fila de rutas de arriba cada vez que cambia lo que se ve: ahí se aprovecha para revisar.
  if (window.MutationObserver) {
    new MutationObserver(actualizar).observe(chips, { childList: true });
  }

  actualizar();
})();
