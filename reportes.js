/* Reportes de los pasajeros en Rutmovil (operación 12).
   Archivo nuevo: botón "Reportar un problema" (retraso, bus lleno o accidente) en cada ruta abierta y en el mapa, y avisos
   visibles en la ruta afectada: una etiqueta en su tarjeta (aunque esté cerrada), el detalle en la tarjeta abierta y un cuadro en el mapa.
   Con la base de datos conectada (vivo.js) los reportes los ven todos; en modo demo se guardan solo en este celular.
   Cada reporte dura un rato (ver TIPOS): después deja de mostrarse solo. No cambia el simulador ni las tarjetas existentes. */
(function () {
  var TIPOS = {
    accidente: { texto: 'Accidente', detalle: 'Hubo un accidente en el recorrido', minutos: 60, orden: 0 },
    retraso:   { texto: 'Retraso', detalle: 'Los buses van con retraso', minutos: 30, orden: 1 },
    lleno:     { texto: 'Bus lleno', detalle: 'Los buses van llenos', minutos: 20, orden: 2 }
  };
  var CLAVE_LOCAL = 'rutmovil-reportes';
  var ENFRIAR_MS = 5 * 60000;    // el mismo reporte (misma ruta y tipo) no se repite antes de esto
  var LEER_CADA_MS = 15000;      // cada cuánto se leen los reportes de los demás

  var datos = window.RutmovilDatos;
  var vivo = window.RutmovilVivo;

  if (!datos || !datos.rutas) return;

  var escapar = function (texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var rutaPorId = function (id) {
    return datos.rutas.filter(function (r) { return r.id === id; })[0];
  };

  // ---- datos: los míos (en este celular) y los de los demás (base de datos) ----
  var locales = [];   // { ruta, tipo, t }
  var remotos = [];   // { clave, ruta, tipo, t }

  function leerLocales() {
    try {
      var lista = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '[]');

      return Array.isArray(lista) ? lista.filter(function (r) { return r && TIPOS[r.tipo] && isFinite(r.t) && typeof r.ruta === 'string'; }) : [];
    } catch (e) { return []; }
  }

  function guardarLocales() {
    try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(locales)); } catch (e) {}
  }

  function vigente(r) {
    return Date.now() - r.t < TIPOS[r.tipo].minutos * 60000 && r.t <= Date.now() + 60000;
  }

  locales = leerLocales().filter(vigente);

  // Reportes vigentes de una ruta, agrupados por tipo: [{ tipo, cuantos, t }] del más grave al menos grave.
  function activos(rutaId) {
    var miId = vivo && vivo.miId ? vivo.miId() : '';
    var vistos = {};
    var grupos = {};

    remotos.concat(locales.map(function (r) {
      return { clave: miId + '-' + r.ruta + '-' + r.tipo, ruta: r.ruta, tipo: r.tipo, t: r.t };
    })).forEach(function (r) {
      if (!TIPOS[r.tipo] || (rutaId && r.ruta !== rutaId) || !vigente(r)) return;

      var unica = r.clave || (r.ruta + r.tipo + r.t);

      if (vistos[unica]) return;   // mi propio reporte puede venir también de la base de datos: se cuenta una vez

      vistos[unica] = true;

      var llave = r.ruta + '|' + r.tipo;

      if (!grupos[llave]) grupos[llave] = { ruta: r.ruta, tipo: r.tipo, cuantos: 0, t: 0 };

      grupos[llave].cuantos++;
      grupos[llave].t = Math.max(grupos[llave].t, r.t);
    });

    return Object.keys(grupos).map(function (k) { return grupos[k]; }).sort(function (a, b) {
      return TIPOS[a.tipo].orden - TIPOS[b.tipo].orden || b.t - a.t;
    });
  }

  function hace(t) {
    var min = Math.max(0, Math.round((Date.now() - t) / 60000));

    return min < 1 ? 'hace un momento' : 'hace ' + min + ' min';
  }

  function etiquetas(lista) {
    return lista.map(function (g) {
      return '<span class="rep-chip rep-' + g.tipo + '" title="' + escapar(TIPOS[g.tipo].detalle) + '">' + escapar(TIPOS[g.tipo].texto) +
        (g.cuantos > 1 ? ' · ' + g.cuantos : '') + '</span>';
    }).join('');
  }

  function detalle(lista) {
    return lista.map(function (g) {
      return '<li class="rep-' + g.tipo + '"><b>' + escapar(TIPOS[g.tipo].texto) + '</b> · ' + escapar(TIPOS[g.tipo].detalle) +
        ' · ' + g.cuantos + (g.cuantos === 1 ? ' reporte' : ' reportes') + ' · ' + hace(g.t) + '</li>';
    }).join('');
  }

  // ---- ventana para reportar ----
  var ventana = null;
  var rutaReporte = null;
  var focoAnterior = null;
  var cierre = null;

  function construir() {
    if (ventana) return;

    ventana = document.createElement('div');
    ventana.className = 'rep-fondo';
    ventana.hidden = true;
    ventana.innerHTML =
      '<div class="rep-hoja" role="dialog" aria-modal="true" aria-labelledby="rep-titulo">' +
      '<h2 id="rep-titulo">Reportar un problema</h2><p class="rep-ruta" id="rep-ruta"></p>' +
      '<div class="rep-opciones">' +
      Object.keys(TIPOS).sort(function (a, b) { return TIPOS[a].orden - TIPOS[b].orden; }).map(function (tipo) {
        return '<button type="button" class="rep-op rep-' + tipo + '" data-tipo="' + tipo + '"><b>' + TIPOS[tipo].texto + '</b><span>' + TIPOS[tipo].detalle + '</span></button>';
      }).join('') +
      '</div><p class="rep-estado" id="rep-estado" role="status"></p>' +
      '<p class="rep-nota" id="rep-nota"></p>' +
      '<button type="button" class="rep-cancelar" id="rep-cancelar">Cancelar</button></div>';
    document.body.appendChild(ventana);

    ventana.addEventListener('click', function (evento) {
      if (evento.target === ventana || evento.target.id === 'rep-cancelar') { cerrarVentana(); return; }

      var boton = evento.target.closest ? evento.target.closest('[data-tipo]') : null;

      if (boton) reportar(boton.getAttribute('data-tipo'));
    });
    ventana.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') { evento.stopPropagation(); cerrarVentana(); }
    });
  }

  function abrirVentana(rutaId) {
    var ruta = rutaPorId(rutaId);

    if (!ruta) return;

    construir();
    clearTimeout(cierre);
    rutaReporte = rutaId;
    focoAnterior = document.activeElement;
    ventana.querySelector('#rep-titulo').textContent = 'Reportar en la ruta ' + ruta.id;
    ventana.querySelector('#rep-ruta').textContent = ruta.stops[0] + ' – ' + ruta.stops[ruta.stops.length - 1];
    ventana.querySelector('#rep-estado').textContent = '';
    ventana.querySelector('#rep-nota').textContent = vivo && vivo.activo
      ? 'Tu reporte lo verán todos los usuarios de esta ruta durante un rato.'
      : 'Modo demo: tu reporte se guarda solo en este celular, nadie más lo ve.';
    Array.prototype.forEach.call(ventana.querySelectorAll('.rep-op'), function (b) { b.disabled = false; });
    ventana.hidden = false;
    ventana.querySelector('.rep-op').focus();
  }

  function cerrarVentana() {
    if (!ventana || ventana.hidden) return;

    clearTimeout(cierre);
    ventana.hidden = true;
    rutaReporte = null;

    if (focoAnterior && focoAnterior.focus && document.contains(focoAnterior)) focoAnterior.focus();
  }

  function reportar(tipo) {
    var estado = ventana.querySelector('#rep-estado');

    if (!rutaReporte || !TIPOS[tipo]) return;

    var ruta = rutaReporte;
    var repetido = locales.some(function (r) { return r.ruta === ruta && r.tipo === tipo && Date.now() - r.t < ENFRIAR_MS; });

    if (repetido) {
      estado.textContent = 'Ya reportaste esto hace poco. Gracias: no hace falta repetirlo.';
      return;
    }

    locales = locales.filter(function (r) { return !(r.ruta === ruta && r.tipo === tipo); });
    locales.push({ ruta: ruta, tipo: tipo, t: Date.now() });
    guardarLocales();
    Array.prototype.forEach.call(ventana.querySelectorAll('.rep-op'), function (b) { b.disabled = true; });
    pintarTodo();

    var texto = 'Listo, reportaste "' + TIPOS[tipo].texto + '" en la ruta ' + ruta + '. Gracias.';

    if (vivo && vivo.activo) {
      estado.textContent = 'Enviando…';
      vivo.publicarReporte(vivo.miId(), { ruta: ruta, tipo: tipo }).then(function (r) {
        estado.textContent = r.ok ? texto : texto.replace(/\. Gracias\.$/, '') + ', pero no se pudo enviar a los demás (revisa tu conexión). Se ve en este celular.';
      });
    } else {
      estado.textContent = texto.replace(/\. Gracias\.$/, '') + ' (modo demo: solo en este celular).';
    }

    cierre = setTimeout(cerrarVentana, 2200);
  }

  // ---- en las tarjetas de ruta ----
  function marcarTarjetas() {
    var contenedor = document.getElementById('grid');

    if (!contenedor) return;

    Array.prototype.forEach.call(contenedor.querySelectorAll('.card[data-id]'), function (tarjeta) {
      var id = tarjeta.getAttribute('data-id');
      var lista = activos(id);
      var info = tarjeta.querySelector('.info');

      if (info) {
        var chips = info.querySelector('.rep-chips');
        var html = etiquetas(lista);

        if (!chips && html) {
          chips = document.createElement('span');
          chips.className = 'rep-chips';
          info.appendChild(chips);
        }

        if (chips && chips.getAttribute('data-h') !== html) {
          chips.setAttribute('data-h', html);
          chips.innerHTML = html;
          chips.hidden = !html;
        }
      }

      var acciones = tarjeta.querySelector('.acciones');

      if (!acciones) return;

      var boton = acciones.querySelector('.rep-btn');

      if (!boton) {
        boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'avisar rep-btn';
        boton.setAttribute('data-rep', id);
        boton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19zM12 10v4.5M12 17.5v.01" stroke-linejoin="round"/></svg>Reportar un problema';
        acciones.appendChild(boton);
      }

      var lado = acciones.parentNode;
      var cuadro = lado.querySelector('.rep-lista');
      var htmlLista = detalle(lista);

      if (htmlLista) {
        if (!cuadro) {
          cuadro = document.createElement('ul');
          cuadro.className = 'rep-lista';
          lado.insertBefore(cuadro, acciones);
        }

        if (cuadro.getAttribute('data-h') !== htmlLista) {
          cuadro.setAttribute('data-h', htmlLista);
          cuadro.innerHTML = htmlLista;
        }
      } else if (cuadro) {
        lado.removeChild(cuadro);
      }
    });
  }

  // ---- en el mapa ----
  var zonaVivo = document.getElementById('rm-vivo');
  var cajaMapa = null;
  var ultimoMapa = '';

  if (zonaVivo) {
    cajaMapa = document.createElement('div');
    cajaMapa.id = 'rm-reportes';
    cajaMapa.className = 'rep-mapa';
    cajaMapa.hidden = true;
    zonaVivo.parentNode.insertBefore(cajaMapa, zonaVivo);
  }

  function pintarMapa() {
    var mapa = window.RutmovilMapa;

    if (!cajaMapa || !mapa || !mapa.estado || !document.documentElement.classList.contains('rm-abierto')) return;

    var estado = mapa.estado();
    var html = '';

    if (estado.modo === 'rutas' && estado.sel) {
      var lista = activos(estado.sel);

      html = '<div class="rep-mapa-h"><b>Ruta ' + escapar(estado.sel) + '</b>' + (lista.length ? '' : '<span>Sin reportes ahora</span>') + '</div>' +
        (lista.length ? '<ul class="rep-lista">' + detalle(lista) + '</ul>' : '') +
        '<button type="button" class="rep-btn-mapa" data-rep="' + escapar(estado.sel) + '">Reportar un problema en esta ruta</button>';
    } else if (estado.modo === 'rutas') {
      var todos = activos('');

      if (todos.length) {
        html = '<div class="rep-mapa-h"><b>Reportes activos</b></div><ul class="rep-lista">' + todos.slice(0, 4).map(function (g) {
          return '<li class="rep-' + g.tipo + '"><b>Ruta ' + escapar(g.ruta) + '</b> · ' + escapar(TIPOS[g.tipo].texto) +
            (g.cuantos > 1 ? ' · ' + g.cuantos + ' reportes' : '') + ' · ' + hace(g.t) + '</li>';
        }).join('') + '</ul>';
      }
    }

    if (html === ultimoMapa) return;

    ultimoMapa = html;
    cajaMapa.innerHTML = html;
    cajaMapa.hidden = !html;
  }

  function pintarTodo() {
    marcarTarjetas();
    pintarMapa();
  }

  // ---- eventos ----
  document.addEventListener('click', function (evento) {
    var boton = evento.target.closest ? evento.target.closest('[data-rep]') : null;

    if (boton) abrirVentana(boton.getAttribute('data-rep'));
  });

  var grid = document.getElementById('grid');
  var pendiente = false;

  // script.js vuelve a dibujar las tarjetas al abrirlas o filtrarlas: se completa lo que falte (sin cambios no se toca nada).
  if (grid && window.MutationObserver) {
    new MutationObserver(function () {
      if (pendiente) return;

      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; marcarTarjetas(); });
    }).observe(grid, { childList: true, subtree: true });
  }

  // El mapa no avisa cuándo se elige otra ruta: mientras esté abierto se revisa cada segundo.
  setInterval(function () {
    var antes = locales.length;

    locales = locales.filter(vigente);

    if (locales.length !== antes) guardarLocales();

    pintarTodo();
  }, 1000);

  function leerRemotos() {
    if (!vivo || !vivo.activo || document.visibilityState !== 'visible') return;

    vivo.leerReportes().then(function (lista) {
      if (lista) { remotos = lista; pintarTodo(); }   // si no se pudo leer, se conserva lo anterior
    }).catch(function () {});
  }

  if (vivo && vivo.activo) {
    leerRemotos();
    setInterval(leerRemotos, LEER_CADA_MS);
    document.addEventListener('visibilitychange', leerRemotos);
  }

  pintarTodo();

  window.RutmovilReportes = {
    abrir: abrirVentana,
    activos: activos
  };
})();
