/* Más rutas de Managua para Rutmovil (operación 07).
   Archivo nuevo: se SUMA a las 6 rutas de script.js, sin borrar ni cambiar ninguna.
   Cada ruta nueva lleva su número, sus paradas en orden, su velocidad (base = paradas por minuto),
   cuántos buses simula (n) y su color en el mapa. Las paradas nuevas llevan sus coordenadas aproximadas [latitud, longitud];
   las paradas que ya existían se reutilizan por su nombre, así el planificador puede combinarlas con las rutas de antes.
   Los recorridos son de EJEMPLO (no son los oficiales). Para agregar otra ruta, copia un bloque de RUTAS_NUEVAS
   y, si tiene paradas nuevas, pon su coordenada en PARADAS_NUEVAS: el mapa, las tarjetas, el planificador, las tarifas y los horarios la toman solos.
   Debe cargarse después de script.js y de map.js (ver index.html). */
(function () {
  var datos = window.RutmovilDatos;
  var mapa = window.RutmovilMapa;

  if (!datos || !datos.rutas || !mapa || !mapa.paradas) return;

  // Paradas nuevas (coordenadas aproximadas). Si una queda mal ubicada, corrige su número aquí.
  var PARADAS_NUEVAS = {
    'Aeropuerto Augusto C. Sandino': [12.1415, -86.1682],
    'Hospital Vivian Pellas': [12.0968, -86.2057],
    'UCA Managua': [12.1140, -86.2540],
    'UNAN-Managua': [12.1330, -86.2680],
    'Estadio Nacional': [12.1383, -86.2799],
    'Antigua Catedral': [12.1524, -86.2730],
    'Rotonda Centroamérica': [12.1273, -86.2208]
  };

  var RUTAS_NUEVAS = [
    { id: '113', stops: ['Aeropuerto Augusto C. Sandino', 'Terminal Mayoreo', 'Carretera Norte', 'Mercado Oriental', 'Antigua Catedral', 'Malecón'], base: 0.4, n: 3, color: '#f59f00' },
    { id: '120', stops: ['UCA Managua', 'Mercado Huembes', 'Rotonda Centroamérica', 'Hospital Vivian Pellas', 'Carretera Masaya'], base: 0.37, n: 2, color: '#74b816' },
    { id: '127', stops: ['Santo Domingo', 'Linda Vista', 'Estadio Nacional', 'UNAN-Managua', 'Plaza España', 'Hospital Militar'], base: 0.43, n: 3, color: '#e03131' },
    { id: '141', stops: ['Ciudad Sandino', 'Terminal Israel Lewites', 'Estadio Nacional', 'Barrio Bolonia', 'Antigua Catedral'], base: 0.39, n: 2, color: '#7950f2' },
    { id: '152', stops: ['Villa Libertad', 'Mercado Oriental', 'Rotonda Rubén Darío', 'Rotonda Centroamérica', 'Aeropuerto Augusto C. Sandino'], base: 0.41, n: 3, color: '#15aabf' },
    { id: '175', stops: ['Ticuantepe', 'Hospital Vivian Pellas', 'Carretera Masaya', 'Rotonda Centroamérica', 'Carretera Norte', 'Terminal Mayoreo'], base: 0.35, n: 3, color: '#ae3ec9' }
  ];

  // Las paradas nuevas se agregan al mapa sin pisar las que ya estaban.
  Object.keys(PARADAS_NUEVAS).forEach(function (nombre) {
    if (!mapa.paradas[nombre]) mapa.paradas[nombre] = PARADAS_NUEVAS[nombre];
  });

  RUTAS_NUEVAS.forEach(function (ruta) {
    var yaExiste = datos.rutas.some(function (r) { return r.id === ruta.id; });
    var sinCoordenada = ruta.stops.some(function (nombre) { return !mapa.paradas[nombre]; });

    // Una ruta repetida o con una parada sin coordenada no se agrega (así no rompe el mapa).
    if (yaExiste || sinCoordenada) return;

    // Mismo arranque que usa script.js para los buses de las rutas de ejemplo.
    ruta.buses = [];

    for (var i = 0; i < ruta.n; i++) {
      ruta.buses.push({
        id: 'B' + (i + 1),
        pos: (i / ruta.n) * (ruta.stops.length + 0.5) - 1 + Math.random() * 0.3,
        speed: ruta.base * (0.85 + Math.random() * 0.3),
        delayed: false,
        delayUntil: 0
      });
    }

    datos.paradaElegida[ruta.id] = 0;
    datos.rutas.push(ruta);
  });
})();
