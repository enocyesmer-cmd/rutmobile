(function () {
  var buscar = function (selector) {
    return document.querySelector(selector);
  };

  var altoParada = 56;

  // Datos de ejemplo de las rutas y los expresos.
  var rutas = [
    { id: '110', stops: ['Mercado Huembes', 'Rotonda Cristo Rey', 'Metrocentro', 'Hospital Militar', 'Rotonda Rubén Darío', 'Camino de Oriente', 'Terminal Mayoreo'], base: 0.42, n: 3 },
    { id: '119', stops: ['Ciudad Sandino', 'Zona Franca', 'Villa Libertad', 'Mercado Oriental', 'Parque Central', 'Malecón'], base: 0.36, n: 3 },
    { id: '105', stops: ['UNI', 'Rotonda Universitaria', 'Plaza Inter', 'Metrocentro', 'Linda Vista', 'Santo Domingo'], base: 0.45, n: 2 },
    { id: '133', stops: ['Terminal Israel Lewites', 'Mercado Huembes', 'Rotonda El Güegüense', 'Barrio Bolonia', 'Carretera Norte', 'Terminal Mayoreo'], base: 0.4, n: 3 },
    { id: '102', stops: ['Villa Fontana', 'Rotonda Rubén Darío', 'Plaza España', 'Parque Las Piedrecitas', 'Mercado Oriental'], base: 0.38, n: 2 },
    { id: '162', stops: ['Ticuantepe', 'Carretera Masaya', 'Rotonda Jean Paul Genie', 'Metrocentro', 'Hospital Militar', 'Camino de Oriente', 'Mercado Oriental'], base: 0.34, n: 3 }
  ];

  var expresos = [
    { id: 'mas', dest: 'Masaya', terminal: 'Terminal Mercado Huembes', gate: 3, first: 300, last: 1200, every: 15, dur: 40 },
    { id: 'gra', dest: 'Granada', terminal: 'Terminal Mercado Huembes', gate: 5, first: 305, last: 1170, every: 20, dur: 60 },
    { id: 'leo', dest: 'León', terminal: 'Terminal Israel Lewites', gate: 2, first: 300, last: 1140, every: 30, dur: 90 },
    { id: 'jin', dest: 'Jinotepe', terminal: 'Terminal Mercado Huembes', gate: 7, first: 330, last: 1110, every: 40, dur: 60 },
    { id: 'est', dest: 'Estelí', terminal: 'Terminal Mayoreo', gate: 4, first: 300, last: 1080, every: 60, dur: 150 },
    { id: 'mat', dest: 'Matagalpa', terminal: 'Terminal Mayoreo', gate: 6, first: 315, last: 1050, every: 60, dur: 150 }
  ];

  var pestanaActual = 'rutas';
  var textoBusqueda = '';
  var soloFavoritos = false;
  var rutaAbierta = null;
  var favoritos = {};

  try {
    favoritos = JSON.parse(localStorage.getItem('rutmovil-fav') || '{}') || {};
  } catch (e) {
    favoritos = {};
  }

  function guardarFavoritos() {
    try {
      localStorage.setItem('rutmovil-fav', JSON.stringify(favoritos));
    } catch (e) {}
  }

  var paradaElegida = {};

  rutas.forEach(function (ruta) {
    paradaElegida[ruta.id] = 0;
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
  });

  var velocidadReal = function (bus) {
    return bus.speed * (bus.delayed ? 0.5 : 1);
  };

  function calcularLlegada(ruta, parada) {
    return ruta.buses.filter(function (bus) {
      return bus.pos <= parada;
    }).map(function (bus) {
      return {
        bus: bus,
        segundos: Math.max(0, (parada - bus.pos) / velocidadReal(bus) * 60)
      };
    }).sort(function (a, b) {
      return a.segundos - b.segundos;
    });
  }

  // Comparte los datos con el mapa (map.js). Solo lectura: no cambia nada de lo de arriba.
  window.RutmovilDatos = {
    rutas: rutas,
    calcularLlegada: calcularLlegada,
    velocidadReal: velocidadReal,
    paradaElegida: paradaElegida,
    expresos: expresos,
    calcularRetraso: function (expreso, numero) { return calcularRetraso(expreso, numero); },
    mostrarLlegada: function (segundos) { return mostrarLlegada(segundos); }
  };

  var dosDigitos = function (numero) {
    return (numero < 10 ? '0' : '') + numero;
  };

  function mostrarLlegada(segundos) {
    return segundos < 30 ? 'Ahora' : Math.ceil(segundos / 60) + ' min';
  }

  function mostrarTiempo(segundos) {
    return dosDigitos(Math.floor(segundos / 60)) + ':' + dosDigitos(Math.floor(segundos % 60));
  }

  function mostrarHora(hora, minutos, segundos) {
    var periodo = hora >= 12 ? 'p. m.' : 'a. m.';
    var hora12 = hora % 12 === 0 ? 12 : hora % 12;

    return hora12 + ':' + dosDigitos(minutos) +
      (segundos === undefined ? '' : ':' + dosDigitos(segundos)) + ' ' + periodo;
  }

  // Ayudas para las animaciones.
  // Cambia el texto y lo anima solo si el valor cambió de verdad.
  function ponerTexto(elemento, texto) {
    if (elemento.textContent === texto) return;

    elemento.textContent = texto;
    elemento.classList.remove('bump');
    void elemento.offsetWidth;
    elemento.classList.add('bump');
  }

  // Pone una clase un rato y la quita (para animaciones de entrada).
  function marcarTemporal(elemento, clase, ms) {
    if (!elemento) return;

    elemento.classList.add(clase);
    clearTimeout(elemento['t_' + clase]);
    elemento['t_' + clase] = setTimeout(function () {
      elemento.classList.remove(clase);
    }, ms);
  }

  // Cierra el panel de una ruta con una animación y luego ejecuta "despues".
  function cerrarSuave(tarjeta, despues) {
    var panel = tarjeta.querySelector('.panel');
    var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!panel || reducir) {
      despues();
      return;
    }

    tarjeta.classList.add('closing');
    tarjeta.querySelector('.row').setAttribute('aria-expanded', 'false');
    panel.style.height = panel.offsetHeight + 'px';
    void panel.offsetWidth;
    panel.classList.add('collapse');
    setTimeout(despues, 380);
  }

  // Avisos en pantalla (toasts).
  function mostrarAviso(texto) {
    var contenedor = buscar('#toasts');
    var aviso = document.createElement('div');

    aviso.className = 'toast';
    aviso.setAttribute('role', 'status');
    aviso.textContent = texto;
    contenedor.appendChild(aviso);

    while (contenedor.children.length > 3) {
      contenedor.removeChild(contenedor.firstChild);
    }

    var quitar = function () {
      aviso.classList.add('out');
      setTimeout(function () {
        if (aviso.parentNode) aviso.parentNode.removeChild(aviso);
      }, 300);
    };

    aviso.addEventListener('click', quitar);
    setTimeout(quitar, 6000);
  }

  // Alertas "Avísame": avisan una vez cuando el bus está a 2 minutos de la parada.
  var alertas = {};
  var segundosAviso = 120;

  try {
    alertas = JSON.parse(localStorage.getItem('rutmovil-alertas') || '{}') || {};
  } catch (e) {
    alertas = {};
  }

  function guardarAlertas() {
    try {
      localStorage.setItem('rutmovil-alertas', JSON.stringify(alertas));
    } catch (e) {}
  }

  function alternarAviso(ruta) {
    var parada = paradaElegida[ruta.id];
    var clave = ruta.id + '|' + parada;
    var nombre = 'la ruta ' + ruta.id + ' en ' + ruta.stops[parada];

    if (alertas[clave]) {
      delete alertas[clave];
      guardarAlertas();
      mostrarAviso('Aviso desactivado para ' + nombre + '.');
      return;
    }

    var primero = calcularLlegada(ruta, parada)[0];

    if (!primero) {
      mostrarAviso('No hay buses próximos para ' + nombre + ' por ahora.');
      return;
    }

    if (primero.segundos <= segundosAviso) {
      mostrarAviso('El bus de ' + nombre + ' ya está a menos de 2 min.');
      return;
    }

    alertas[clave] = 1;
    guardarAlertas();

    try {
      if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
    } catch (e) {}

    mostrarAviso('Listo: te aviso cuando el bus de ' + nombre + ' esté a 2 min.');
  }

  function notificar(texto) {
    mostrarAviso(texto);

    try {
      if (window.Notification && Notification.permission === 'granted') {
        var opciones = { body: texto, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [120, 60, 120] };
        var simple = function () { new Notification('Rutmovil', opciones); };

        // En el celular las notificaciones salen por el service worker.
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
          navigator.serviceWorker.getRegistration().then(function (registro) {
            if (registro) {
              registro.showNotification('Rutmovil', opciones);
            } else {
              simple();
            }
          }).catch(function () {});
        } else {
          simple();
        }
      }
    } catch (e) {}

    try {
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    } catch (e) {}
  }

  function revisarAlertas() {
    Object.keys(alertas).forEach(function (clave) {
      var partes = clave.split('|');
      var ruta = rutas.filter(function (item) { return item.id === partes[0]; })[0];

      if (!ruta) {
        delete alertas[clave];
        guardarAlertas();
        return;
      }

      var parada = Number(partes[1]);
      var primero = calcularLlegada(ruta, parada)[0];

      if (primero && primero.segundos <= segundosAviso) {
        delete alertas[clave];
        guardarAlertas();
        notificar('¡Ya casi! El bus de la ruta ' + ruta.id + ' llega a ' + ruta.stops[parada] + ' en 2 min.');
      }
    });
  }

  // Tarjetas y recorrido de cada ruta.
  var contenedorRutas = buscar('#grid');

  var estrella = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" stroke-linejoin="round"/></svg>';

  function frecuencia(ruta) {
    return Math.max(1, Math.round((ruta.stops.length + 1.4) / (ruta.base * ruta.buses.length)));
  }

  function crearRecorrido(ruta) {
    var enlace = location.href.split('#')[0] + '#ruta-' + ruta.id;
    var mensaje = 'Mira la ruta ' + ruta.id + ' (' + ruta.stops[0] + ' – ' + ruta.stops[ruta.stops.length - 1] +
      ') en Rutmovil: ' + enlace;
    var enlaceWhatsapp = 'https://wa.me/?text=' + encodeURIComponent(mensaje);

    var paradas = ruta.stops.map(function (nombre, indice) {
      return '<button class="stop" data-act="stop" data-i="' + indice + '" style="top:' + (indice * altoParada) + 'px;--i:' + indice + '">' +
        '<span class="sdot"></span><span class="sname">' + nombre + '</span>' +
        '<span class="seta" data-k="seta' + indice + '">–</span></button>';
    }).join('');

    var buses = ruta.buses.map(function (bus) {
      return '<span class="bus" data-bus="' + bus.id + '">' + bus.id + '</span>';
    }).join('');

    return '<div class="panel" id="p-' + ruta.id + '"><div class="cols"><div><h3 class="ph">Recorrido en vivo</h3>' +
      '<div class="line" style="height:' + (ruta.stops.length * altoParada) + 'px"><span class="track"></span>' + paradas + buses + '</div></div>' +
      '<div><h3 class="ph">Próximos a <span data-k="mystop"></span></h3><ol class="next" data-k="next"></ol>' +
      '<div class="acciones"><button class="avisar" data-act="avisar" aria-pressed="false">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" stroke-linejoin="round"/></svg>' +
      '<span data-k="avisarTxt">Avísame cuando falten 2 min</span></button>' +
      '<a class="compartir" data-act="compartir" href="' + enlaceWhatsapp + '" target="_blank" rel="noopener">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" stroke-linejoin="round"/></svg>' +
      'Compartir</a></div>' +
      '<p class="hint">Toca otra parada del recorrido para ver cuándo llega el bus ahí.</p></div></div></div>';
  }

  function crearTarjeta(ruta, indice) {
    var abierta = ruta.id === rutaAbierta;
    var esFavorita = !!favoritos[ruta.id];

    return '<article class="card' + (abierta ? ' open' : '') + '" data-id="' + ruta.id + '" style="--i:' + indice + '">' +
      '<div class="head"><button class="row" data-act="toggle" aria-expanded="' + abierta + '"' +
      (abierta ? ' aria-controls="p-' + ruta.id + '"' : '') + '>' +
      '<span class="num"><span class="sr" style="position:absolute;left:-9999px">Ruta </span>' + ruta.id + '</span>' +
      '<span class="info"><span class="name">' + ruta.stops[0] + ' – ' + ruta.stops[ruta.stops.length - 1] + '</span>' +
      '<span class="od">' + ruta.stops.length + ' paradas · un bus cada ~' + frecuencia(ruta) + ' min</span></span>' +
      '<span class="eta"><b data-k="eta">–</b><span class="at" data-k="at"></span><span class="chip" data-k="chip"></span></span></button>' +
      '<button class="fav" data-act="fav" aria-pressed="' + esFavorita + '" aria-label="' +
      (esFavorita ? 'Quitar la ruta ' + ruta.id + ' de mis rutas' : 'Guardar la ruta ' + ruta.id + ' en mis rutas') + '">' +
      estrella + '</button></div>' +
      '<div class="prog" aria-hidden="true"><span class="prog-fill" data-k="prog"></span></div>' +
      (abierta ? crearRecorrido(ruta) : '') + '</article>';
  }

  function filtrarRutas() {
    var texto = textoBusqueda.trim().toLowerCase();

    return rutas.filter(function (ruta) {
      if (soloFavoritos && !favoritos[ruta.id]) return false;
      if (!texto) return true;

      return ('ruta ' + ruta.id + ' ' + ruta.stops.join(' ')).toLowerCase().indexOf(texto) !== -1;
    });
  }

  // Orden de las rutas: predeterminado, la que llega más pronto o favoritas primero.
  var orden = 'normal';

  try {
    var ordenGuardado = localStorage.getItem('rutmovil-orden');
    if (ordenGuardado === 'pronto' || ordenGuardado === 'fav') orden = ordenGuardado;
  } catch (e) {}

  function segundosProximo(ruta) {
    var llegada = calcularLlegada(ruta, paradaElegida[ruta.id])[0];
    return llegada ? llegada.segundos : Infinity;
  }

  function ordenarRutas(lista) {
    if (orden === 'normal') return lista;

    var items = lista.map(function (ruta, indice) {
      return { ruta: ruta, indice: indice };
    });

    items.sort(function (a, b) {
      var claveA = orden === 'pronto' ? segundosProximo(a.ruta) : (favoritos[a.ruta.id] ? 0 : 1);
      var claveB = orden === 'pronto' ? segundosProximo(b.ruta) : (favoritos[b.ruta.id] ? 0 : 1);

      return (claveA - claveB) || (a.indice - b.indice);
    });

    return items.map(function (item) { return item.ruta; });
  }

  // Redibuja las tarjetas haciendo que se deslicen a su nueva posición (técnica FLIP).
  function conFlip(accion) {
    var antes = {};
    var tarjetas = function () {
      return Array.prototype.slice.call(contenedorRutas.querySelectorAll('.card[data-id]'));
    };

    tarjetas().forEach(function (tarjeta) {
      antes[tarjeta.getAttribute('data-id')] = tarjeta.getBoundingClientRect();
    });

    accion();

    var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducir) return;

    tarjetas().forEach(function (tarjeta) {
      var inicio = antes[tarjeta.getAttribute('data-id')];
      if (!inicio || !tarjeta.animate) return;

      var fin = tarjeta.getBoundingClientRect();
      var dx = inicio.left - fin.left;
      var dy = inicio.top - fin.top;

      if (!dx && !dy) return;

      tarjeta.animate(
        [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
        { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    });
  }

  // Esqueletos de carga: se ven un instante antes de mostrar los datos.
  var cargando = false;

  function mostrarEsqueletos() {
    var tarjetas = '';

    for (var i = 0; i < 6; i++) {
      tarjetas += '<div class="card sk" style="--i:' + i + '"><div class="sk-row">' +
        '<span class="skel sk-num"></span>' +
        '<span class="sk-info"><span class="skel sk-l1"></span><span class="skel sk-l2"></span></span>' +
        '<span class="sk-eta"><span class="skel sk-t"></span><span class="skel sk-c"></span></span></div></div>';
    }

    contenedorRutas.innerHTML = tarjetas;
    buscar('#board').innerHTML = tarjetas;
    buscar('#rcount').textContent = '';
    buscar('#ecount').textContent = '';
    contenedorRutas.setAttribute('aria-busy', 'true');
    buscar('#board').setAttribute('aria-busy', 'true');
  }

  function mostrarRutas(idEnfocar) {
    if (cargando) return;

    var lista = ordenarRutas(filtrarRutas());

    buscar('#rcount').textContent = lista.length + (lista.length === 1 ? ' ruta' : ' rutas');

    if (!lista.length) {
      contenedorRutas.innerHTML = '<div class="empty">' +
        (soloFavoritos && !textoBusqueda
          ? 'Todavía no guardaste rutas. Toca la estrella de una ruta para verla aquí.'
          : 'No hay rutas que coincidan con tu búsqueda.') + '</div>';
      return;
    }

    contenedorRutas.innerHTML = lista.map(crearTarjeta).join('');
    lista.forEach(actualizarTarjeta);

    if (idEnfocar) {
      var elemento = contenedorRutas.querySelector('[data-id="' + idEnfocar + '"] .row');
      if (elemento) elemento.focus();
    }
  }

  function actualizarTarjeta(ruta) {
    var tarjeta = contenedorRutas.querySelector('[data-id="' + ruta.id + '"]');
    if (!tarjeta) return;

    var parada = paradaElegida[ruta.id];
    var llegadas = calcularLlegada(ruta, parada);
    var primero = llegadas[0];

    ponerTexto(tarjeta.querySelector('[data-k="eta"]'), primero ? mostrarLlegada(primero.segundos) : '–');
    tarjeta.querySelector('[data-k="at"]').textContent = 'a ' + ruta.stops[parada];

    var estado = tarjeta.querySelector('[data-k="chip"]');

    if (!primero) {
      estado.textContent = 'Sin buses';
      estado.className = 'chip';
    } else if (primero.bus.delayed) {
      estado.textContent = 'Con retraso';
      estado.className = 'chip warn';
    } else if (primero.segundos < 60) {
      estado.textContent = 'Llegando';
      estado.className = 'chip go';
    } else {
      estado.textContent = 'En camino';
      estado.className = 'chip ok';
    }

    // Barra de progreso: cuánto ha avanzado el próximo bus hacia la parada elegida.
    var barra = tarjeta.querySelector('[data-k="prog"]');
    var avance = primero ? Math.min(Math.max((primero.bus.pos + 1) / (parada + 1), 0), 1) : 0;
    var anterior = parseFloat(barra.getAttribute('data-p') || '0');
    var reinicia = avance < anterior - 0.2;

    if (reinicia) barra.style.transition = 'none';
    barra.style.width = (avance * 100) + '%';

    if (reinicia) {
      void barra.offsetWidth;
      barra.style.transition = '';
    }

    barra.setAttribute('data-p', String(avance));
    barra.parentNode.classList.toggle('late', !!(primero && primero.bus.delayed));
    barra.parentNode.classList.toggle('none', !primero);

    if (ruta.id !== rutaAbierta) return;

    var cantidad = ruta.stops.length;

    ruta.buses.forEach(function (bus) {
      var elemento = tarjeta.querySelector('[data-bus="' + bus.id + '"]');
      if (!elemento) return;

      elemento.style.top = (28 + Math.min(Math.max(bus.pos, 0), cantidad - 1) * altoParada) + 'px';
      elemento.style.opacity = (bus.pos < 0 || bus.pos > cantidad - 1) ? '0' : '1';
      elemento.classList.toggle('late', bus.delayed);
    });

    ruta.stops.forEach(function (_, indice) {
      var llegada = calcularLlegada(ruta, indice)[0];

      tarjeta.querySelector('[data-k="seta' + indice + '"]').textContent =
        llegada ? mostrarLlegada(llegada.segundos) : '–';

      var botonParada = tarjeta.querySelector('.stop[data-i="' + indice + '"]');
      botonParada.classList.toggle('mine', indice === parada);
      botonParada.classList.toggle('alerta', !!alertas[ruta.id + '|' + indice]);
    });

    tarjeta.querySelector('[data-k="mystop"]').textContent = ruta.stops[parada];

    var avisoActivo = !!alertas[ruta.id + '|' + parada];
    tarjeta.querySelector('[data-act="avisar"]').setAttribute('aria-pressed', String(avisoActivo));
    tarjeta.querySelector('[data-k="avisarTxt"]').textContent =
      avisoActivo ? 'Aviso activado (2 min antes)' : 'Avísame cuando falten 2 min';

    var proximos = llegadas.slice(0, 3).map(function (llegada) {
      var estadoBus = llegada.bus.delayed
        ? 'Con retraso'
        : (llegada.bus.pos < 0 ? 'Sale de ' + ruta.stops[0] : 'En ruta');

      return '<li><span class="bid">' + llegada.bus.id + '</span><span class="bst">' +
        estadoBus + '</span><span class="cd">' + mostrarTiempo(llegada.segundos) + '</span></li>';
    }).join('');

    tarjeta.querySelector('[data-k="next"]').innerHTML =
      proximos || '<li><span class="bst">Sin buses próximos por ahora.</span></li>';
  }

  contenedorRutas.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-act]');
    if (!boton) return;

    var tarjeta = boton.closest('.card');
    if (!tarjeta) return;

    var ruta = rutas.filter(function (item) {
      return item.id === tarjeta.getAttribute('data-id');
    })[0];

    if (!ruta) return;

    var accion = boton.getAttribute('data-act');

    if (accion === 'toggle') {
      if (rutaAbierta === ruta.id) {
        if (tarjeta.classList.contains('closing')) return;

        cerrarSuave(tarjeta, function () {
          if (rutaAbierta === ruta.id) {
            rutaAbierta = null;
            mostrarRutas(ruta.id);
          }
        });
        return;
      }

      rutaAbierta = ruta.id;
      mostrarRutas(ruta.id);

      if (rutaAbierta) {
        marcarTemporal(contenedorRutas.querySelector('[data-id="' + ruta.id + '"]'), 'fresh', 1500);
      }
    } else if (accion === 'fav') {
      if (favoritos[ruta.id]) {
        delete favoritos[ruta.id];
      } else {
        favoritos[ruta.id] = 1;
      }

      guardarFavoritos();
      conFlip(function () { mostrarRutas(null); });

      var estrellaRuta = contenedorRutas.querySelector('[data-id="' + ruta.id + '"] .fav');
      if (estrellaRuta) estrellaRuta.focus();
      if (estrellaRuta && favoritos[ruta.id]) marcarTemporal(estrellaRuta, 'pop', 600);
    } else if (accion === 'compartir') {
      // Si el equipo tiene menú de compartir, se usa; si no, se abre el enlace de WhatsApp de siempre.
      if (navigator.share) {
        evento.preventDefault();
        navigator.share({
          title: 'Ruta ' + ruta.id + ' en Rutmovil',
          text: 'Mira la ruta ' + ruta.id + ' (' + ruta.stops[0] + ' – ' + ruta.stops[ruta.stops.length - 1] + ') en Rutmovil',
          url: location.href.split('#')[0] + '#ruta-' + ruta.id
        }).catch(function () {});
      }
    } else if (accion === 'avisar') {
      alternarAviso(ruta);
      actualizarTarjeta(ruta);
    } else if (accion === 'stop') {
      paradaElegida[ruta.id] = Number(boton.getAttribute('data-i'));
      actualizarTarjeta(ruta);
    }
  });

  // Salidas de los expresos: tarjetas como las de las rutas.
  function calcularRetraso(expreso, numeroSalida) {
    var valor = (expreso.id.charCodeAt(0) + expreso.id.charCodeAt(2) + numeroSalida * 7) % 9;
    return valor === 0 ? 10 : (valor === 3 ? 5 : 0);
  }

  // El tablero se revisa cada segundo; solo se vuelve a dibujar si cambió,
  // así las animaciones no se reinician.
  var ultimoTablero = null;
  var terminalElegida = '';
  var expresoAbierto = null;
  var altoExpreso = 144;

  function pintarTablero(html) {
    if (html === ultimoTablero) return;

    ultimoTablero = html;
    buscar('#board').innerHTML = html;
  }

  function formatoHoraExpreso(minutos) {
    return mostrarHora(Math.floor(minutos / 60) % 24, Math.floor(minutos % 60 + 1e-6));
  }

  function horaCorta(minutos) {
    var hora = Math.floor(minutos / 60) % 24;

    return (hora % 12 === 0 ? 12 : hora % 12) + ':' + dosDigitos(Math.floor(minutos % 60 + 1e-6));
  }

  function textoFalta(falta) {
    return falta < 1 ? 'Ahora' : Math.ceil(falta) + ' min';
  }

  function textoViaje(minutos) {
    if (minutos < 60) return minutos + ' min';

    return Math.floor(minutos / 60) + ' h' + (minutos % 60 ? ' ' + (minutos % 60) + ' min' : '');
  }

  // Todas las salidas del día de un expreso, con su retraso.
  function salidasDeExpreso(expreso, minutosAhora) {
    var lista = [];

    for (var hora = expreso.first, numero = 0; hora <= expreso.last; hora += expreso.every, numero++) {
      var retraso = calcularRetraso(expreso, numero);

      lista.push({
        numero: numero,
        hora: hora,
        retraso: retraso,
        estimada: hora + retraso,
        falta: hora + retraso - minutosAhora
      });
    }

    return lista;
  }

  function estadoSalida(salida) {
    if (salida.retraso > 0) return { texto: 'Retraso +' + salida.retraso + ' min', clase: 'warn' };
    if (salida.falta <= 1) return { texto: 'Saliendo', clase: 'go' };
    if (salida.falta <= 10) return { texto: 'Abordando', clase: 'go' };

    return { texto: 'Puntual', clase: 'ok' };
  }

  function crearPanelExpreso(item, minutosAhora) {
    var expreso = item.expreso;
    var primera = item.proximas[0];
    var enlace = location.href.split('#')[0] + '#expresos';
    var mensaje = 'Mira los expresos a ' + expreso.dest + ' (' + expreso.terminal + ') en Rutmovil: ' + enlace;

    var buses = item.enCamino.map(function (salida) {
      return '<span class="bus" data-dep="' + salida.estimada + '" data-dur="' + expreso.dur +
        '" style="left:1px;width:42px">' + horaCorta(salida.estimada) + '</span>';
    }).join('');

    var filas = item.enCamino.slice(0, 2).map(function (salida) {
      return '<li><span class="bid">' + horaCorta(salida.estimada) + '</span><span class="bst">En camino</span>' +
        '<span class="cd">' + Math.ceil(salida.estimada + expreso.dur - minutosAhora) + ' min</span></li>';
    }).join('') + item.proximas.slice(0, 3).map(function (salida) {
      return '<li><span class="bid">' + horaCorta(salida.estimada) + '</span><span class="bst">' +
        estadoSalida(salida).texto + '</span><span class="cd">' + textoFalta(salida.falta) + '</span></li>';
    }).join('');

    return '<div class="panel" id="px-' + expreso.id + '"><div class="cols"><div><h3 class="ph">Recorrido en vivo</h3>' +
      '<div class="line" style="height:' + (altoExpreso + altoParada) + 'px"><span class="track"></span>' +
      '<div class="stop" style="top:0;--i:0"><span class="sdot"></span><span class="sname">' + expreso.terminal +
      '</span><span class="seta">' + (primera ? 'sale ' + textoFalta(primera.falta) : '–') + '</span></div>' +
      '<div class="stop" style="top:' + altoExpreso + 'px;--i:1"><span class="sdot"></span><span class="sname">' + expreso.dest +
      '</span><span class="seta">~' + textoViaje(expreso.dur) + '</span></div>' + buses + '</div></div>' +
      '<div><h3 class="ph">Próximas salidas</h3><ol class="next">' +
      (filas || '<li><span class="bst">No hay más salidas hoy. Los expresos salen desde las 5:00 a. m.</span></li>') + '</ol>' +
      '<div class="acciones"><button type="button" class="avisar" data-act="mapa-exp">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7zM9 4v13M15 7v13" stroke-linejoin="round"/></svg>' +
      'Ver en el mapa</button>' +
      '<a class="compartir" data-act="compartir-exp" href="https://wa.me/?text=' + encodeURIComponent(mensaje) + '" target="_blank" rel="noopener">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" stroke-linejoin="round"/></svg>' +
      'Compartir</a></div>' +
      '<p class="hint">Viaje aproximado de ' + textoViaje(expreso.dur) + '. Los buses en camino se calculan con la hora de salida.</p></div></div></div>';
  }

  function crearTarjetaExpreso(item, indice, minutosAhora) {
    var expreso = item.expreso;
    var primera = item.proximas[0];
    var abierta = expreso.id === expresoAbierto;
    var estado = primera ? estadoSalida(primera) : { texto: 'Sin más salidas hoy', clase: '' };
    var avance = primera ? Math.min(Math.max(1 - Math.ceil(primera.falta) / expreso.every, 0), 1) : 0;

    return '<article class="card' + (abierta ? ' open' : '') + '" data-id="' + expreso.id + '" style="--i:' + indice + '">' +
      '<div class="head"><button class="row" data-act="toggle" aria-expanded="' + abierta + '"' +
      (abierta ? ' aria-controls="px-' + expreso.id + '"' : '') + '>' +
      '<span class="num"><span class="sr" style="position:absolute;left:-9999px">Expreso a </span>' + expreso.dest.slice(0, 3).toUpperCase() + '</span>' +
      '<span class="info"><span class="name">' + expreso.dest + '</span><span class="od">' + expreso.terminal +
      ' · Andén ' + expreso.gate + ' · cada ' + expreso.every + ' min</span></span>' +
      '<span class="eta"><b>' + (primera ? textoFalta(primera.falta) : '–') + '</b><span class="at">' +
      (primera ? 'sale ' + formatoHoraExpreso(primera.estimada) : (item.enCamino.length ? item.enCamino.length + ' en camino' : '')) +
      '</span><span class="chip ' + estado.clase + '">' + estado.texto + '</span></span></button></div>' +
      '<div class="prog' + (primera && primera.retraso ? ' late' : '') + (primera ? '' : ' none') + '" aria-hidden="true">' +
      '<span class="prog-fill" style="width:' + (avance * 100) + '%"></span></div>' +
      (abierta ? crearPanelExpreso(item, minutosAhora) : '') + '</article>';
  }

  // Mueve los buses del recorrido abierto según la hora (cada segundo, sin redibujar la tarjeta).
  function posicionarBusesExpreso(minutosAhora) {
    Array.prototype.forEach.call(buscar('#board').querySelectorAll('.bus[data-dep]'), function (bus) {
      var avance = (minutosAhora - Number(bus.getAttribute('data-dep'))) / Number(bus.getAttribute('data-dur'));

      bus.style.top = (28 + Math.min(Math.max(avance, 0), 1) * altoExpreso) + 'px';
    });
  }

  function mostrarExpresos() {
    if (cargando) return;

    var ahora = new Date();
    var minutosAhora = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60;
    var texto = textoBusqueda.trim().toLowerCase();

    var items = expresos.filter(function (expreso) {
      if (terminalElegida && expreso.terminal.indexOf(terminalElegida) === -1) return false;
      if (texto && (expreso.dest + ' ' + expreso.terminal).toLowerCase().indexOf(texto) === -1) return false;

      return true;
    }).map(function (expreso) {
      var salidas = salidasDeExpreso(expreso, minutosAhora);

      return {
        expreso: expreso,
        proximas: salidas.filter(function (salida) { return salida.falta > -1; }),
        enCamino: salidas.filter(function (salida) {
          return salida.estimada <= minutosAhora && minutosAhora < salida.estimada + expreso.dur;
        })
      };
    });

    // El que sale más pronto va primero; los que ya no tienen salidas, al final.
    items.sort(function (a, b) {
      var fa = a.proximas[0] ? a.proximas[0].estimada : Infinity;
      var fb = b.proximas[0] ? b.proximas[0].estimada : Infinity;

      return fa === fb ? 0 : (fa < fb ? -1 : 1);
    });

    var enViaje = items.reduce(function (total, item) { return total + item.enCamino.length; }, 0);

    buscar('#ecount').textContent = items.length + (items.length === 1 ? ' expreso' : ' expresos') +
      (enViaje ? ' · ' + enViaje + (enViaje === 1 ? ' en camino' : ' en camino') : '');

    if (!items.length) {
      pintarTablero('<div class="empty">' +
        (texto ? 'No hay expresos que coincidan con tu búsqueda.' : 'No hay expresos en esta terminal.') + '</div>');
      return;
    }

    pintarTablero(items.map(function (item, indice) {
      return crearTarjetaExpreso(item, indice, minutosAhora);
    }).join(''));

    posicionarBusesExpreso(minutosAhora);
  }

  // Abrir/cerrar un expreso, verlo en el mapa y compartirlo.
  buscar('#board').addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-act]');
    if (!boton) return;

    var tarjeta = boton.closest('.card');
    if (!tarjeta) return;

    var expreso = expresos.filter(function (item) {
      return item.id === tarjeta.getAttribute('data-id');
    })[0];

    if (!expreso) return;

    var accion = boton.getAttribute('data-act');

    if (accion === 'toggle') {
      var enfocar = function () {
        var fila = buscar('#board [data-id="' + expreso.id + '"] .row');
        if (fila) fila.focus();
      };

      if (expresoAbierto === expreso.id) {
        if (tarjeta.classList.contains('closing')) return;

        cerrarSuave(tarjeta, function () {
          if (expresoAbierto === expreso.id) {
            expresoAbierto = null;
            ultimoTablero = null;
            mostrarExpresos();
            enfocar();
          }
        });
        return;
      }

      expresoAbierto = expreso.id;
      ultimoTablero = null;
      mostrarExpresos();
      enfocar();
      marcarTemporal(buscar('#board [data-id="' + expreso.id + '"]'), 'fresh', 1500);
    } else if (accion === 'mapa-exp') {
      if (window.RutmovilMapa) window.RutmovilMapa.verExpreso(expreso.id);
    } else if (accion === 'compartir-exp') {
      if (navigator.share) {
        evento.preventDefault();
        navigator.share({
          title: 'Expreso a ' + expreso.dest + ' en Rutmovil',
          text: 'Mira los expresos a ' + expreso.dest + ' (' + expreso.terminal + ') en Rutmovil',
          url: location.href.split('#')[0] + '#expresos'
        }).catch(function () {});
      }
    }
  });

  // Enlace directo a una ruta: tu-pagina#ruta-110 abre esa ruta.
  function abrirRutaDeHash() {
    var coincide = /^#ruta-([\w-]+)$/.exec(location.hash);

    if (!coincide) return false;

    var existe = rutas.some(function (ruta) {
      return ruta.id === coincide[1];
    });

    if (!existe) return false;

    rutaAbierta = coincide[1];
    return true;
  }

  function destacarRuta() {
    var tarjeta = contenedorRutas.querySelector('[data-id="' + rutaAbierta + '"]');
    if (!tarjeta) return;

    var reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    marcarTemporal(tarjeta, 'fresh', 1500);
    tarjeta.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
  }

  // Píldora blanca que se desliza entre las pestañas.
  function moverPildora() {
    var pestanas = buscar('.tabs');
    var pildora = buscar('.pill');
    var elegida = buscar('.tabs [aria-selected="true"]');

    if (!pestanas || !pildora || !elegida || !elegida.offsetWidth) return;

    pildora.style.width = elegida.offsetWidth + 'px';
    pildora.style.transform = 'translateX(' + elegida.offsetLeft + 'px)';
    pestanas.classList.add('has-pill');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pestanas.classList.add('ready');
      });
    });
  }

  window.addEventListener('resize', moverPildora);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(moverPildora);
  }

  // Cambio de pestañas y búsqueda.
  function cambiarPestana(nombre, desdeHash) {
    pestanaActual = nombre;

    var esVistaRutas = nombre === 'rutas';

    buscar('#tab-rutas').setAttribute('aria-selected', String(esVistaRutas));
    buscar('#tab-expresos').setAttribute('aria-selected', String(!esVistaRutas));
    buscar('#view-rutas').hidden = !esVistaRutas;
    buscar('#view-expresos').hidden = esVistaRutas;
    buscar('#favonly').hidden = !esVistaRutas;
    buscar('#orden').hidden = !esVistaRutas;
    buscar('#q').placeholder = esVistaRutas ? 'Buscar ruta o parada' : 'Buscar destino';

    moverPildora();

    if (esVistaRutas) {
      marcarTemporal(contenedorRutas, 'enter', 1500);
      mostrarRutas(null);
    } else {
      ultimoTablero = null;
      marcarTemporal(buscar('#board'), 'enter', 1500);
      mostrarExpresos();
    }

    if (!desdeHash && location.hash !== '#' + nombre) {
      location.hash = nombre;
    }
  }

  buscar('#tab-rutas').addEventListener('click', function () {
    cambiarPestana('rutas');
  });

  buscar('#tab-expresos').addEventListener('click', function () {
    cambiarPestana('expresos');
  });

  window.addEventListener('hashchange', function () {
    var abrio = abrirRutaDeHash();
    var nombre = location.hash === '#expresos' ? 'expresos' : 'rutas';

    if (nombre !== pestanaActual) {
      cambiarPestana(nombre, true);
    } else if (abrio) {
      mostrarRutas(null);
    }

    if (abrio) destacarRuta();
  });

  buscar('#q').addEventListener('input', function (evento) {
    textoBusqueda = evento.target.value;

    if (pestanaActual === 'rutas') {
      conFlip(function () { mostrarRutas(null); });
    } else {
      mostrarExpresos();
    }
  });

  // Selector de orden de las rutas.
  var selectorOrden = buscar('#orden');
  selectorOrden.value = orden;

  selectorOrden.addEventListener('change', function () {
    orden = selectorOrden.value;

    try {
      localStorage.setItem('rutmovil-orden', orden);
    } catch (e) {}

    conFlip(function () { mostrarRutas(null); });
  });

  // Filtro de expresos por terminal.
  var contenedorTerminales = buscar('#terminales');

  contenedorTerminales.addEventListener('click', function (evento) {
    var boton = evento.target.closest('.tchip');
    if (!boton) return;

    terminalElegida = boton.getAttribute('data-t');

    Array.prototype.forEach.call(contenedorTerminales.querySelectorAll('.tchip'), function (chip) {
      chip.setAttribute('aria-pressed', String(chip === boton));
    });

    ultimoTablero = null;
    marcarTemporal(buscar('#board'), 'enter', 1500);
    mostrarExpresos();
  });

  buscar('#favonly').addEventListener('click', function (evento) {
    soloFavoritos = !soloFavoritos;
    evento.currentTarget.setAttribute('aria-pressed', String(soloFavoritos));
    conFlip(function () { mostrarRutas(null); });
  });

  // Movimiento de los buses y reloj.
  var ultimaActualizacion = Date.now();

  function actualizarBuses() {
    var ahoraMs = Date.now();
    var minutosPasados = Math.min((ahoraMs - ultimaActualizacion) / 60000, 2);
    ultimaActualizacion = ahoraMs;

    rutas.forEach(function (ruta) {
      ruta.buses.forEach(function (bus) {
        if (bus.delayed && ahoraMs > bus.delayUntil) {
          bus.delayed = false;
        }

        if (!bus.delayed && bus.pos > 0 && Math.random() < 0.0015) {
          bus.delayed = true;
          bus.delayUntil = ahoraMs + (60 + Math.random() * 90) * 1000;
        }

        bus.pos += velocidadReal(bus) * minutosPasados;

        if (bus.pos > ruta.stops.length - 1 + 0.4) {
          bus.pos = -(1 + Math.random() * 2.5);
          bus.delayed = false;
          bus.speed = ruta.base * (0.85 + Math.random() * 0.3);
        }
      });
    });

    revisarAlertas();

    var fecha = new Date();

    buscar('#clock').textContent =
      mostrarHora(fecha.getHours(), fecha.getMinutes(), fecha.getSeconds());

    if (pestanaActual === 'rutas') {
      filtrarRutas().forEach(actualizarTarjeta);
    } else {
      mostrarExpresos();
    }
  }

  // Modo oscuro: botón, recuerda la elección y sigue al sistema si no hay elección.
  var raiz = document.documentElement;
  var botonTema = buscar('#theme');
  var consultaOscuro = window.matchMedia('(prefers-color-scheme: dark)');

  function esOscuro() {
    var tema = raiz.getAttribute('data-theme');
    return tema ? tema === 'dark' : consultaOscuro.matches;
  }

  function mostrarTema() {
    botonTema.setAttribute('aria-pressed', String(esOscuro()));
  }

  botonTema.addEventListener('click', function () {
    var nuevo = esOscuro() ? 'light' : 'dark';

    marcarTemporal(raiz, 'theme-anim', 700);
    raiz.setAttribute('data-theme', nuevo);

    try {
      localStorage.setItem('rutmovil-tema', nuevo);
    } catch (e) {}

    mostrarTema();
  });

  if (consultaOscuro.addEventListener) {
    consultaOscuro.addEventListener('change', mostrarTema);
  }

  mostrarTema();

  // App instalable (PWA): botón de instalar y funcionamiento sin internet.
  var eventoInstalar = null;
  var botonInstalar = buscar('#instalar');

  window.addEventListener('beforeinstallprompt', function (evento) {
    evento.preventDefault();
    eventoInstalar = evento;
    botonInstalar.hidden = false;
  });

  botonInstalar.addEventListener('click', function () {
    if (!eventoInstalar) return;

    eventoInstalar.prompt();
    eventoInstalar.userChoice.then(function () {
      eventoInstalar = null;
      botonInstalar.hidden = true;
    });
  });

  window.addEventListener('appinstalled', function () {
    botonInstalar.hidden = true;
    mostrarAviso('¡Rutmovil quedó instalada en tu equipo!');
  });

  // En iPhone no hay botón automático: se explica cómo hacerlo.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) {
    buscar('.foot').textContent += ' Para instalarla en iPhone: toca Compartir y luego "Añadir a pantalla de inicio".';
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  // Arranque: primero esqueletos, y a los ~0.9 s los datos reales.
  var abrirInicial = abrirRutaDeHash();
  cargando = true;
  cambiarPestana(location.hash === '#expresos' ? 'expresos' : 'rutas', true);
  mostrarEsqueletos();
  actualizarBuses();
  setInterval(actualizarBuses, 1000);

  setTimeout(function () {
    cargando = false;
    ultimoTablero = null;
    contenedorRutas.removeAttribute('aria-busy');
    buscar('#board').removeAttribute('aria-busy');
    marcarTemporal(contenedorRutas, 'enter', 1500);
    marcarTemporal(buscar('#board'), 'enter', 1500);

    if (pestanaActual === 'rutas') {
      mostrarRutas(null);
    } else {
      mostrarExpresos();
    }

    if (abrirInicial && pestanaActual === 'rutas') destacarRuta();
  }, 900);
})();
