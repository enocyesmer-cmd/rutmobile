/* Tarifas de Rutmovil (operación 05).
   Archivo nuevo: no cambia nada de lo existente. Aquí está la única tabla de precios de la app:
   si cambia un pasaje, se corrige aquí y se actualiza solo en las tarjetas y en el planificador.
   Los valores son de REFERENCIA (córdobas): confírmalos con la tarifa oficial antes de usarlos como dato real.
   Pone el pasaje en cada tarjeta de ruta y de expreso (script.js dibuja las tarjetas) y comparte las cuentas
   con plan.js mediante window.RutmovilTarifas. */
(function () {
  var MONEDA = 'C$';

  var TARIFAS = {
    // Pasaje urbano de Managua: una sola tarifa por subida. Si una ruta cobra distinto, ponla por su número.
    rutaPorDefecto: 5,
    rutas: { '110': 5, '119': 5, '105': 5, '133': 5, '102': 5, '162': 5 },

    // Expresos interurbanos: pasaje por persona desde la terminal.
    expresos: { mas: 35, gra: 50, leo: 90, jin: 45, est: 130, mat: 125 }
  };

  function formato(valor) {
    return MONEDA + ' ' + String(valor).replace('.', ',');
  }

  function costoRuta(id) {
    var valor = TARIFAS.rutas[id];

    return typeof valor === 'number' ? valor : TARIFAS.rutaPorDefecto;
  }

  function costoExpreso(id) {
    var valor = TARIFAS.expresos[id];

    return typeof valor === 'number' ? valor : null;
  }

  // Un viaje con transbordo paga una subida por cada ruta que toma.
  function costoViaje(idsRutas) {
    return idsRutas.reduce(function (total, id) { return total + costoRuta(id); }, 0);
  }

  window.RutmovilTarifas = {
    tarifas: TARIFAS,
    formato: formato,
    costoRuta: costoRuta,
    costoExpreso: costoExpreso,
    costoViaje: costoViaje
  };

  // ---- pasaje dentro de las tarjetas ----
  // script.js vuelve a dibujar las tarjetas al abrirlas, filtrarlas o marcarlas favoritas,
  // por eso se vigila el contenedor y se pone la etiqueta a las que no la tengan.
  function marcar(contenedor, buscarCosto) {
    Array.prototype.forEach.call(contenedor.querySelectorAll('.card[data-id]'), function (tarjeta) {
      var info = tarjeta.querySelector('.info');

      if (!info || info.querySelector('.tarifa')) return;

      var costo = buscarCosto(tarjeta.getAttribute('data-id'));

      if (costo === null) return;

      var etiqueta = document.createElement('span');

      etiqueta.className = 'tarifa';
      etiqueta.textContent = 'Pasaje ' + formato(costo);
      etiqueta.title = 'Tarifa de referencia por persona';
      info.appendChild(etiqueta);
    });
  }

  function vigilar(selector, buscarCosto) {
    var contenedor = document.querySelector(selector);

    if (!contenedor) return;

    var pendiente = false;
    var revisar = function () {
      pendiente = false;
      marcar(contenedor, buscarCosto);
    };

    marcar(contenedor, buscarCosto);

    if (window.MutationObserver) {
      new MutationObserver(function () {
        if (pendiente) return;

        pendiente = true;
        requestAnimationFrame(revisar);
      }).observe(contenedor, { childList: true, subtree: true });
    }
  }

  vigilar('#grid', costoRuta);
  vigilar('#board', costoExpreso);
})();
