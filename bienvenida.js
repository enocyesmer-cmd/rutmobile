/* Bienvenida y "Modo demo" de Rutmovil (operación 13).
   Archivo nuevo: una pantalla de bienvenida corta que sale la primera vez, y un botón "Modo demo" en la cabecera que explica,
   punto por punto, qué es REAL y qué es SIMULADO en esta versión. El texto se ajusta solo: si vivo.js tiene la base de datos conectada,
   los buses de conductores y los reportes cuentan como reales; si no, se explican como demo. No cambia nada de lo existente. */
(function () {
  var CLAVE = 'rutmovil-bienvenida';
  var tabs = document.querySelector('.hero .tabs');

  var escapar = function (texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function conectado() {
    return !!(window.RutmovilVivo && window.RutmovilVivo.activo);
  }

  function leer() {
    try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; }
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, '1'); } catch (e) {}
  }

  // ---- botón en la cabecera, junto a las pestañas ----
  var boton = document.createElement('button');

  boton.type = 'button';
  boton.className = 'bv-boton';
  boton.id = 'demobtn';
  boton.setAttribute('aria-haspopup', 'dialog');
  boton.innerHTML = '<i aria-hidden="true"></i>Modo demo';

  if (tabs && tabs.parentNode) tabs.parentNode.insertBefore(boton, tabs.nextSibling);
  else document.body.insertBefore(boton, document.body.firstChild);

  // ---- ventanas ----
  var ventana = null;
  var foco = null;

  function fila(que, estado, texto) {
    var etiquetas = { real: 'Real', sim: 'Simulado', ej: 'De ejemplo', cel: 'Solo en tu celular' };

    return '<li><div class="bv-q"><b>' + escapar(que) + '</b><span class="bv-et bv-' + estado + '">' + etiquetas[estado] + '</span></div><p>' + texto + '</p></li>';
  }

  function contenidoDemo() {
    var real = conectado();
    var filas = [
      fila('Mapa y calles', 'real', 'El mapa es de OpenStreetMap y los recorridos se trazan sobre calles reales con OSRM. Necesita internet; sin conexión se usan líneas rectas.'),
      fila('Tu ubicación', 'real', 'Sale del GPS de tu celular, solo si das permiso. No se envía a nadie.'),
      fila('Rutas, paradas y recorridos', 'ej', 'Las rutas y las coordenadas de las paradas son aproximadas y de ejemplo. No son los recorridos oficiales.'),
      fila('Buses y tiempos de llegada', 'sim', 'Los buses "en vivo" de las tarjetas y del mapa los genera un simulador dentro de la página. Los minutos que ves no son de unidades reales.'),
      fila('Salidas de expresos y horarios', 'sim', 'Se calculan con horarios de ejemplo y retrasos al azar.'),
      fila('Tarifas', 'ej', 'Pasajes de referencia. Confírmalos con la tarifa oficial antes de usarlos como dato real.'),
      real
        ? fila('Buses de conductores (Soy conductor)', 'real', 'Cuando un conductor comparte su GPS, su bus aparece en el mapa con la etiqueta <b>EN VIVO</b>, mezclado con los simulados.')
        : fila('Buses de conductores (Soy conductor)', 'sim', 'Todavía no hay base de datos conectada: puedes probar el GPS del conductor, pero tu posición no se envía y nadie la ve.'),
      real
        ? fila('Reportes de retraso, bus lleno o accidente', 'real', 'Los reportes de los pasajeros los ven todos los usuarios de esa ruta, por un rato.')
        : fila('Reportes de retraso, bus lleno o accidente', 'cel', 'Sin base de datos, tu reporte se guarda solo en este celular y nadie más lo ve.'),
      fila('Favoritos, avisos y modo oscuro', 'real', 'Funcionan de verdad y se guardan en tu celular. Ojo: los avisos usan los tiempos simulados.')
    ].join('');

    return '<p class="bv-estado ' + (real ? 'bv-ok' : 'bv-aviso') + '" role="status">' + (real
      ? '<b>Datos reales activados.</b> La base de datos está conectada: lo que mandan los conductores y los pasajeros es real. Los buses sin la etiqueta EN VIVO siguen siendo simulados.'
      : '<b>Estás en modo demo.</b> No hay base de datos conectada, así que los buses y los tiempos son simulados. Es seguro: nada se envía ni se guarda fuera de tu celular.') + '</p>' +
      '<ul class="bv-lista">' + filas + '</ul>' +
      '<p class="bv-pie">' + (real ? '' : 'Para ver buses reales hay que conectar una base de datos: los pasos están en <b>GUIA-FIREBASE.md</b>. ') +
      'Más detalles en el <b>README.md</b>.</p>';
  }

  function contenidoBienvenida() {
    return '<div class="bv-logo" aria-hidden="true"><svg width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="12" fill="#1423ff"/>' +
      '<path d="M12 32 C12 22 22 24 22 16 C22 12 26 11 32 12" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="12" cy="32" r="4" fill="#fff"/><circle cx="32" cy="12" r="4" fill="#38b6ff"/></svg></div>' +
      '<p class="bv-lema">Las rutas y expresos de Managua, en tu bolsillo.</p>' +
      '<ul class="bv-puntos">' +
      '<li><b>Mira cuándo llega tu bus</b><span>Tiempos por parada, favoritos y avisos.</span></li>' +
      '<li><b>Planifica tu viaje</b><span>Con transbordo, tiempo y costo.</span></li>' +
      '<li><b>Mapa con todas las rutas</b><span>Y los buses moviéndose en vivo.</span></li>' +
      '<li><b>Ayuda a los demás</b><span>Reporta retrasos, buses llenos o accidentes.</span></li></ul>' +
      '<p class="bv-estado ' + (conectado() ? 'bv-ok' : 'bv-aviso') + '">' + (conectado()
        ? 'Hay datos reales conectados: los buses con la etiqueta <b>EN VIVO</b> son de conductores de verdad.'
        : 'Esta es una <b>demo</b>: los buses y los tiempos se simulan. Toca "Modo demo" para ver qué es real y qué no.') + '</p>';
  }

  function construir() {
    if (ventana) return;

    ventana = document.createElement('div');
    ventana.className = 'bv-fondo';
    ventana.hidden = true;
    ventana.innerHTML = '<div class="bv-hoja" role="dialog" aria-modal="true" aria-labelledby="bv-titulo" tabindex="-1">' +
      '<h2 id="bv-titulo"></h2><div class="bv-cuerpo" id="bv-cuerpo"></div><div class="bv-acciones" id="bv-acciones"></div></div>';
    document.body.appendChild(ventana);

    ventana.addEventListener('click', function (evento) {
      var accion = evento.target.closest ? evento.target.closest('[data-bv]') : null;

      if (evento.target === ventana) { cerrar(); return; }

      if (!accion) return;

      var que = accion.getAttribute('data-bv');

      if (que === 'cerrar') cerrar();
      else if (que === 'demo') mostrar('demo');
      else if (que === 'bienvenida') mostrar('bienvenida');
    });
    ventana.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') { evento.stopPropagation(); cerrar(); }
    });
  }

  function mostrar(cual) {
    construir();

    var esDemo = cual === 'demo';

    ventana.querySelector('#bv-titulo').textContent = esDemo ? 'Modo demo: qué es real y qué es simulado' : 'Bienvenido a Rutmovil';
    ventana.querySelector('#bv-cuerpo').innerHTML = esDemo ? contenidoDemo() : contenidoBienvenida();
    ventana.querySelector('#bv-acciones').innerHTML = esDemo
      ? '<button type="button" class="bv-prim" data-bv="cerrar">Entendido</button><button type="button" class="bv-sec" data-bv="bienvenida">Ver la bienvenida</button>'
      : '<button type="button" class="bv-prim" data-bv="cerrar">Empezar</button><button type="button" class="bv-sec" data-bv="demo">Modo demo: ¿qué es real?</button>';

    if (ventana.hidden) foco = document.activeElement;

    ventana.hidden = false;
    document.documentElement.classList.add('bv-abierto');
    ventana.querySelector('.bv-cuerpo').scrollTop = 0;
    ventana.querySelector('.bv-prim').focus();
  }

  function cerrar() {
    if (!ventana || ventana.hidden) return;

    ventana.hidden = true;
    document.documentElement.classList.remove('bv-abierto');
    guardar();   // desde que la cierra una vez, la bienvenida no vuelve a salir sola

    if (foco && foco.focus && document.contains(foco)) foco.focus();
  }

  boton.addEventListener('click', function () { mostrar('demo'); });

  // La bienvenida sale sola solo la primera vez, y no cuando alguien abre un enlace directo a una ruta compartida.
  if (!leer() && !/^#ruta-/.test(location.hash)) mostrar('bienvenida');

  window.RutmovilBienvenida = { demo: function () { mostrar('demo'); }, bienvenida: function () { mostrar('bienvenida'); } };
})();
