# Conectar Rutmovil a datos reales con Firebase (plan gratis)

Con esto, el celular de un conductor comparte su posición y los demás usuarios ven ese bus en el mapa como **"En vivo real"**.
Dura unos 10 minutos. No necesitas tarjeta de crédito: el plan gratuito (Spark) alcanza de sobra para una demo.

> Rutmovil usa **Firebase Realtime Database** (no Firestore). Supabase no está soportado por el código actual: usar Supabase exigiría reescribir `vivo.js`.

## Paso 1. Crear el proyecto
1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. Pulsa **Crear un proyecto** (o "Add project") y ponle un nombre, por ejemplo `rutmovil-demo`.
3. Google Analytics: puedes desactivarlo. Pulsa **Crear proyecto** y espera a que termine.

## Paso 2. Crear la base de datos
1. En el menú de la izquierda: **Compilación (Build) → Realtime Database**.
2. Pulsa **Crear base de datos**.
3. Ubicación: elige la más cercana (la de Estados Unidos funciona bien desde Nicaragua).
4. Modo de seguridad: elige **Modo de prueba** (lo cambiamos en el paso 3).
5. Pulsa **Habilitar**.

## Paso 3. Poner las reglas de seguridad
El modo de prueba se apaga solo a los 30 días y deja la base totalmente abierta. Cámbialo ahora:
1. Dentro de Realtime Database abre la pestaña **Reglas**.
2. Borra todo lo que haya y pega el contenido del archivo **`firebase-reglas.json`** de este proyecto.
3. Pulsa **Publicar**.

Qué hacen esas reglas: todos pueden **leer** los buses; solo se puede **escribir** en `buses/<id>` con un id válido, y únicamente con los campos que manda la app (`ruta`, `nombre`, `lat`, `lng`, `t` y, si existen, `parada`, `rumbo`, `vel`), con su tipo y tamaño. Los **reportes** de los pasajeros (retraso, bus lleno, accidente) van en `reportes/` con las mismas ideas: solo `ruta`, `tipo` (uno de los tres) y `t`. Cualquier otro dato se rechaza. No hay inicio de sesión, así que cualquiera con la dirección puede publicar un bus falso: es aceptable para una demo, no para producción.

## Paso 4. Copiar la dirección de la base de datos
1. En la pestaña **Datos** de Realtime Database, arriba aparece una dirección parecida a:
   `https://rutmovil-demo-default-rtdb.firebaseio.com`
   (en otras regiones termina distinto, por ejemplo `https://rutmovil-demo-default-rtdb.europe-west1.firebasedatabase.app`).
2. Cópiala completa, **sin barra al final**.

## Paso 5. Pegar la clave en Rutmovil
Abre el archivo **`vivo.js`**. Las dos primeras líneas de código son:

```js
var FIREBASE_URL = '';
var FIREBASE_CLAVE = '';
```

Pega tu dirección entre las comillas de `FIREBASE_URL`:

```js
var FIREBASE_URL = 'https://rutmovil-demo-default-rtdb.firebaseio.com';
```

`FIREBASE_CLAVE` déjala **vacía**: solo se usa si tus reglas exigieran autenticación, y con las reglas del paso 3 no hace falta.
Guarda el archivo y vuelve a publicar la app (ver la guía de publicación).
Si la dirección queda vacía o mal escrita, Rutmovil sigue funcionando en **modo demo**, sin errores.

## Paso 6. Probar que funciona
Necesitas dos dispositivos (o un celular y una computadora):
1. **Celular A (conductor):** abre Rutmovil → botón **Soy conductor** → elige la ruta → **Empezar a compartir mi posición**. Acepta el permiso de ubicación. El estado debe decir **En vivo real** y contar envíos.
2. En la consola de Firebase, pestaña **Datos**, debe aparecer `buses` con un id y sus coordenadas, actualizándose cada pocos segundos.
3. **Dispositivo B (pasajero):** abre Rutmovil → **Mapa**. Debe verse un bus con anillo verde y la etiqueta **EN VIVO**, y debajo del mapa el aviso "En vivo real".
4. Pulsa **Dejar de compartir** en el celular A: el bus desaparece de la base de datos y del mapa en pocos segundos.
5. **Reportes:** en el dispositivo B abre una ruta y pulsa **Reportar un problema** → elige *Retraso*. En Firebase debe aparecer `reportes/…`, y en el dispositivo A (en unos 15 segundos) la tarjeta de esa ruta muestra la etiqueta *Retraso*. Los reportes se ocultan solos (retraso 30 min, bus lleno 20 min, accidente 60 min) pero quedan guardados en la base: puedes borrar la carpeta `reportes` desde la consola cuando quieras.

## Si algo falla
| Síntoma | Causa probable y solución |
|---|---|
| El conductor dice "Demo (no se envía)" | `FIREBASE_URL` vacía o mal escrita. Revisa el paso 5 y que la dirección empiece con `https://`. |
| "Sin conexión, reintentando" | Sin internet, o las reglas rechazan los datos. En Firebase, pestaña Reglas, revisa que sean las del paso 3. Un error `http401` o `http403` también apunta a las reglas. |
| El GPS no pide permiso | La ubicación solo funciona en **HTTPS** (o `localhost`). Publica la app con GitHub Pages o Netlify, que dan HTTPS. |
| El bus llega a Firebase pero no se ve en el mapa del pasajero | Revisa que el reloj del celular conductor y el del pasajero estén en hora automática: un bus que avisó hace más de 45 segundos (según el reloj del pasajero) se descarta. Además, la ruta debe existir en la app. |
| Los datos desaparecen a los 30 días | Se quedó el modo de prueba. Aplica las reglas del paso 3. |

## Privacidad
La posición de un conductor solo se publica mientras tiene activado "compartir", y se borra al dejar de compartir o cerrar la página. Aun así, la base es pública para lectura: avisa a los conductores de demo que su ubicación será visible para cualquiera con la dirección.
