# K'jaras

App para que Miguel Ángel organice la venta de k'jaras: lista de compras, gastos, pedidos y ganancia. Está pensada para el celular, en español de Bolivia, con montos en bolivianos (Bs).

El plan inicial es **100 platos** el **viernes 9 de octubre de 2026** a **Bs 40** cada uno. Esa lista de compras ya viene cargada.

Los datos viven en **Cloud Firestore** y se sincronizan entre el celular y la computadora. Firestore también guarda una caché en el teléfono para seguir anotando sin señal. Si todavía no configuraste Firebase, la app funciona igual y guarda todo en el navegador (`localStorage`).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o más nuevo
- Un proyecto de Firebase, solo si quieres la nube (los pasos están más abajo)

## Ejecutar en la computadora

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

Sin archivo `.env.local`, entras directo al resumen. Los datos quedan solo en ese navegador.

Para comprobar que los números cierran:

```bash
npm test
```

Para generar el sitio estático:

```bash
npm run build
npm run preview
```

## Qué hace cada pantalla

- **Resumen.** Platos planificados, pedidos y restantes, ingreso esperado, costo de compras, otros gastos, costo por plato, ganancia estimada, ganancia real, entregas pendientes y pagos pendientes.
- **Compras.** Ítems con cantidad, unidad, precio, subtotal y casilla de comprado. Puedes anotar lo que pagaste de verdad. Agregar, editar y eliminar.
- **Gastos.** Concepto, monto, fecha y categoría (transporte, condimentos, aceite, mano de obra u otro).
- **Pedidos.** Cliente, teléfono, dirección, platos, precio (empieza en Bs 40), hora, entrega, pago y método (efectivo o QR). Búsqueda, filtros, totales, enlace de WhatsApp (`wa.me` con +591) y enlace a Google Maps. Avisa si los pedidos pasan de los platos planificados.
- **Configuración.** Precio, platos y fecha. Exportar e importar un respaldo JSON, exportar pedidos a CSV y restablecer los datos.

## Cómo se calculan los montos

Cada ítem de la lista guarda la **cantidad para 100 platos**. La cantidad que ves es:

`cantidad = cantidadPara100 × platosPlanificados / 100`

- **Subtotal estimado** de una línea: cantidad × precio unitario, redondeado al centavo.
- **Subtotal real:** si escribiste el precio pagado, se usa ese total de la línea. Si no, se usa el estimado. El precio pagado no se recalcula al cambiar los platos.
- **Costo de compras:** la suma de los subtotales reales (en el resumen) y, al lado, la suma estimada.
- **Otros gastos:** la suma de la pantalla Gastos.
- **Ingreso esperado:** platos planificados × precio por plato.
- **Costo por plato:** (compras reales + otros gastos) / platos planificados.
- **Ganancia estimada:** ingreso esperado − compras estimadas − otros gastos. Es lo que quedaría si vendes todo el plan.
- **Ganancia real:** total de los pedidos anotados − compras reales − otros gastos. Sin pedidos sale negativa, porque los ingredientes ya están contados.

Con la receta de 100 platos y sin gastos, las compras suman **Bs 1.577,85**, el ingreso esperado **Bs 4.000,00**, la ganancia estimada **Bs 2.422,15** y el costo por plato **Bs 15,78**.

## Dónde se guardan los datos

| Modo | Cuándo | Dónde |
| --- | --- | --- |
| Nube | Hay un `.env.local` (o secretos al compilar) con la config de Firebase | Documento `users/{uid}` en Firestore, más copia en este teléfono |
| Teléfono | No hay config de Firebase | `localStorage` del navegador |

La primera vez que entras con una cuenta, si en ese teléfono ya había datos locales, se suben a tu documento. Cada cuenta solo ve lo suyo.

Si anotas en dos teléfonos a la vez, se queda el cambio más reciente.

La clave de la app web (`apiKey`) viaja dentro del sitio: así funciona Firebase. No es una contraseña. Quien no haya iniciado sesión no puede leer tus pedidos; eso lo impiden las reglas de `firestore.rules`. Igual no subas `.env` ni `.env.local` a git.

## Crear el proyecto de Firebase

1. Entra a [Firebase console](https://console.firebase.google.com/) y crea un proyecto. Por ejemplo, `k-jaras`.
2. En la página del proyecto, agrega una **app web** (el ícono `</>`). No hace falta Hosting en este paso. Copia el objeto `firebaseConfig`.
3. Crea la base de datos: **Build → Firestore Database → Create database**. Elige el **modo producción** (las reglas de este repositorio son las que abren el acceso, y solo al dueño). Como ubicación, `southamerica-east1` (São Paulo) queda más cerca de Bolivia.
4. Activa la entrada: **Build → Authentication → Sign-in method**.
   - **Google:** actívalo y elige un correo de soporte.
   - **Correo electrónico/contraseña:** actívalo.
5. En **Authentication → Settings → Authorized domains** deja `localhost`. Más adelante agrega el dominio donde publiques (`tu-proyecto.web.app`, `tu-proyecto.firebaseapp.com` y, si usas GitHub Pages, `tu-usuario.github.io`).
6. En la carpeta del proyecto:

   ```bash
   cp .env.example .env.local
   ```

   Completa `.env.local` con los valores de la app web:

   | Variable | Campo de `firebaseConfig` |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |

7. Opcional: en `VITE_ALLOWED_EMAIL` escribe tu correo. La app cierra la sesión si entra otra cuenta. Eso es una ayuda en el celular; el cierre de verdad está en las reglas (paso siguiente).
8. Arranca de nuevo con `npm run dev`. Entra con Google o crea la cuenta con tu correo. La primera vez se crea tu documento con la lista de 100 platos.

Las reglas de `firestore.rules` dicen: solo el usuario autenticado puede leer y escribir `users/{su uid}`. Nadie más, aunque tenga la `apiKey`. Para que además nadie más pueda crearse una cuenta útil, cambia la función `esDueno` por esta y pon tu correo:

```
function esDueno(userId) {
  return request.auth != null
    && request.auth.uid == userId
    && request.auth.token.email == 'tu-correo@gmail.com';
}
```

Ese cambio llega a Firebase cuando haces el deploy del paso de abajo.

## Publicar con Firebase Hosting

Hace falta [una cuenta de Google](https://firebase.google.com/) en la que ya creaste el proyecto.

```bash
npx firebase-tools@14 login
npx firebase-tools@14 use --add
npm run build
npx firebase-tools@14 deploy
```

`firebase use --add` elige el proyecto y guarda `.firebaserc` en tu máquina. `firebase deploy` publica dos cosas: el sitio (`dist`) y las reglas de Firestore.

Al terminar, la consola muestra una dirección como `https://tu-proyecto.web.app`. Ábrela en el celular e inicia sesión con la misma cuenta: vas a ver los mismos pedidos.

Si Google no abre la ventana en el celular, entra con correo y contraseña. El dominio del sitio tiene que estar en **Authorized domains**.

## Publicar en GitHub Pages

El flujo ya está en `.github/workflows/pages.yml`. Se ejecuta al hacer push a `main` (y también se puede lanzar a mano).

1. En el repositorio de GitHub abre **Settings → Pages**.
2. En **Build and deployment → Source** elige **GitHub Actions**.
3. Si quieres que esa copia también use Firestore, crea secretos del repositorio (**Settings → Secrets and variables → Actions**) con los mismos nombres que en `.env.example`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` y, si lo usas, `VITE_ALLOWED_EMAIL`. Vite los mete en el sitio al compilar. Sin secretos, la copia de Pages queda en modo teléfono.
4. Junta los cambios en `main` (o lanza el flujo a mano en la pestaña Actions).
5. El sitio queda en `https://<usuario>.github.io/k-jaras/`.
6. Agrega `<usuario>.github.io` a los dominios autorizados de Authentication.

Puedes usar Pages y Firebase Hosting a la vez. Las dos copias hablan con la misma base si se compilaron con la misma configuración.

## Respaldo

En **Configuración** puedes bajar un JSON con todo y volver a cargarlo. El CSV de pedidos usa punto y coma y coma decimal, para que Excel en español lo abra en columnas. El CSV no se vuelve a importar: para restaurar, usa el JSON.
