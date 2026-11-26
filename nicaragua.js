/* Datos de Nicaragua para el mapa de Rutmovil.
   - contorno: línea fronteriza y costera APROXIMADA [lat, lng], trazada a mano (sirve para resaltar el país).
     Si tienes un GeoJSON oficial, puedes reemplazar estos puntos y el mapa se ajusta solo.
   - ciudades: [nombre, lat, lng, nivel, esCapitalDelPais]. Nivel 1 = cabecera departamental principal,
     2 = ciudad importante, 3 = ciudad menor (se muestran al acercar el mapa). */
window.RutmovilNicaragua = {
  contorno: [
    [12.98, -87.69], [13.03, -87.60], [13.00, -87.45], [13.03, -87.30], [13.04, -87.17],
    [13.18, -87.02], [13.34, -86.90], [13.52, -86.78], [13.68, -86.62], [13.78, -86.45],
    [13.85, -86.28], [13.95, -86.12], [13.90, -85.92], [14.02, -85.75], [14.10, -85.50],
    [14.28, -85.20], [14.40, -84.95], [14.58, -84.80], [14.72, -84.50], [14.85, -84.10],
    [14.99, -83.80], [15.02, -83.40], [14.99, -83.14],
    [14.55, -83.28], [14.04, -83.35], [13.50, -83.55], [13.00, -83.55], [12.50, -83.62],
    [12.00, -83.65], [11.50, -83.68], [11.00, -83.70], [10.93, -83.68],
    [10.80, -83.85], [10.78, -84.05], [10.80, -84.30], [10.92, -84.52], [11.03, -84.70],
    [11.13, -84.78], [11.04, -85.15], [11.10, -85.40], [11.21, -85.62], [11.07, -85.73],
    [11.25, -85.89], [11.45, -86.15], [11.62, -86.40], [11.80, -86.52], [12.00, -86.65],
    [12.19, -86.77], [12.40, -86.99], [12.48, -87.18], [12.62, -87.43], [12.78, -87.65]
  ],
  ciudades: [
    ['Managua', 12.1364, -86.2514, 1, true],
    ['León', 12.4379, -86.8780, 1], ['Chinandega', 12.6292, -87.1310, 1], ['Estelí', 13.0910, -86.3540, 1],
    ['Matagalpa', 12.9260, -85.9170, 1], ['Masaya', 11.9744, -86.0952, 1], ['Granada', 11.9299, -85.9560, 1],
    ['Rivas', 11.4370, -85.8250, 1], ['Juigalpa', 12.1060, -85.3650, 1], ['Bluefields', 12.0130, -83.7640, 1],
    ['Bilwi', 14.0390, -83.3850, 1],
    ['Jinotega', 13.0910, -86.0020, 2], ['Ocotal', 13.6320, -86.4760, 2], ['Somoto', 13.4800, -86.5830, 2],
    ['Boaco', 12.4700, -85.6600, 2], ['San Carlos', 11.1220, -84.7780, 2], ['Jinotepe', 11.8500, -86.1990, 2],
    ['San Juan del Sur', 11.2520, -85.8700, 2], ['Corn Island', 12.1700, -83.0400, 2], ['Siuna', 13.7300, -84.7700, 2],
    ['Waspam', 14.7400, -83.9700, 2], ['Rama', 12.1600, -84.2500, 2], ['Nueva Guinea', 11.6900, -84.4500, 2],
    ['Tipitapa', 12.1950, -86.0980, 3], ['Ciudad Sandino', 12.1622, -86.3440, 3], ['Corinto', 12.4820, -87.1740, 3],
    ['Nandaime', 11.7600, -86.0500, 3], ['Masatepe', 11.9100, -86.1450, 3], ['Sébaco', 12.8500, -86.1000, 3],
    ['Condega', 13.3500, -86.4000, 3], ['Camoapa', 12.3850, -85.5150, 3], ['Chichigalpa', 12.5700, -87.0300, 3],
    ['Bonanza', 13.9500, -84.5800, 3], ['Muelle de los Bueyes', 12.0700, -84.5300, 3], ['Jalapa', 13.9200, -86.1200, 3],
    ['Ticuantepe', 12.0245, -86.2030, 3], ['Diriamba', 11.8570, -86.2400, 3], ['Puerto Sandino', 12.1900, -86.7600, 3]
  ],

  /* Recorrido de cada expreso. via = puntos por donde pasa la carretera (se usan si no hay internet para calcular
     las calles); pasa = pueblos intermedios que se marcan al elegir el expreso. Coordenadas aproximadas. */
  expresos: {
    mas: { via: [[12.1015, -86.2230], [12.0560, -86.1790], [12.0150, -86.1250]], pasa: [['Nindirí', 11.9930, -86.1100]] },
    gra: { via: [[12.1015, -86.2230], [12.0560, -86.1790], [12.0150, -86.1250], [11.9744, -86.0952], [11.9600, -86.0450]], pasa: [['Masaya', 11.9744, -86.0952]] },
    leo: { via: [[12.2290, -86.4300], [12.2570, -86.5730], [12.3220, -86.6880]], pasa: [['Mateare', 12.2290, -86.4300], ['Nagarote', 12.2570, -86.5730], ['La Paz Centro', 12.3220, -86.6880]] },
    jin: { via: [[12.1000, -86.2750], [12.0300, -86.2800], [11.9400, -86.2650], [11.8570, -86.2400]], pasa: [['Diriamba', 11.8570, -86.2400]] },
    est: { via: [[12.1950, -86.0980], [12.3300, -86.1200], [12.5200, -86.1300], [12.7319, -86.1260], [12.8500, -86.1000], [12.9200, -86.2000]], pasa: [['Tipitapa', 12.1950, -86.0980], ['Ciudad Darío', 12.7319, -86.1260], ['Sébaco', 12.8500, -86.1000]] },
    mat: { via: [[12.1950, -86.0980], [12.3300, -86.1200], [12.5200, -86.1300], [12.7319, -86.1260], [12.8500, -86.1000]], pasa: [['Tipitapa', 12.1950, -86.0980], ['Ciudad Darío', 12.7319, -86.1260], ['Sébaco', 12.8500, -86.1000]] }
  },

  /* Sitios de interés. Categoría -> [emoji, zoom mínimo para verlo]. */
  categorias: {
    terminal: ['🚌', 11], aeropuerto: ['✈️', 10], mercado: ['🛒', 13], salud: ['🏥', 13], edu: ['🎓', 13],
    estadio: ['🏟️', 13], cultura: ['⛪', 12], parque: ['🌳', 12], natural: ['🌋', 8], playa: ['🏖️', 9]
  },
  sitios: [
    ['Terminal Huembes', 12.1212, -86.2402, 'terminal'], ['Terminal Mayoreo', 12.1585, -86.1885, 'terminal'],
    ['Terminal Israel Lewites', 12.1395, -86.3320, 'terminal'],
    ['Aeropuerto Augusto C. Sandino', 12.1415, -86.1682, 'aeropuerto'],
    ['Mercado Oriental', 12.1468, -86.2480, 'mercado'], ['Mercado Roberto Huembes', 12.1212, -86.2402, 'mercado'],
    ['Metrocentro', 12.1366, -86.2698, 'mercado'], ['Mercado de Artesanías de Masaya', 11.9740, -86.0930, 'mercado'],
    ['Hospital Militar', 12.1432, -86.2570, 'salud'], ['Hospital Vivian Pellas', 12.0968, -86.2057, 'salud'],
    ['UNAN-Managua', 12.1330, -86.2680, 'edu'], ['UNI', 12.1285, -86.2590, 'edu'], ['UCA Managua', 12.1140, -86.2540, 'edu'],
    ['UNAN-León', 12.4350, -86.8820, 'edu'],
    ['Estadio Nacional Denis Martínez', 12.1383, -86.2799, 'estadio'],
    ['Antigua Catedral de Managua', 12.1524, -86.2730, 'cultura'], ['Catedral de León', 12.4357, -86.8793, 'cultura'],
    ['Catedral de Granada', 11.9302, -85.9560, 'cultura'], ['Fortaleza La Pólvora', 11.9300, -85.9500, 'cultura'],
    ['Castillo de la Inmaculada', 11.0140, -84.4160, 'cultura'],
    ['Loma de Tiscapa', 12.1330, -86.2720, 'parque'], ['Malecón de Managua', 12.1566, -86.2742, 'parque'],
    ['Parque Central de Masaya', 11.9735, -86.0945, 'parque'],
    ['Volcán Masaya', 11.9840, -86.1700, 'natural'], ['Laguna de Apoyo', 11.9170, -86.0200, 'natural'],
    ['Isletas de Granada', 11.9100, -85.9600, 'natural'], ['Volcán Momotombo', 12.4230, -86.5390, 'natural'],
    ['Volcán Concepción (Ometepe)', 11.5370, -85.6220, 'natural'], ['Moyogalpa (Ometepe)', 11.5400, -85.6860, 'natural'],
    ['Laguna de Xiloá', 12.2100, -86.3300, 'natural'], ['Cañón de Somoto', 13.4100, -86.6200, 'natural'],
    ['Selva Negra', 13.0000, -85.9500, 'natural'], ['Volcán Cosigüina', 12.9800, -87.5700, 'natural'],
    ['Playa Pochomil', 11.8000, -86.4900, 'playa'], ['Playa Montelimar', 11.7870, -86.4750, 'playa'],
    ['Playa Maderas', 11.2700, -85.9100, 'playa'], ['Poneloya', 12.4300, -87.0000, 'playa'],
    ['Las Peñitas', 12.3880, -86.9900, 'playa'], ['San Juan del Sur (bahía)', 11.2520, -85.8700, 'playa']
  ]
};
