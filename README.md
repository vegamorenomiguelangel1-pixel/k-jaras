# K'jaras

App para que Miguel Ángel organice la venta de k'jaras: lista de compras, gastos, pedidos y ganancia. Está pensada para el celular, en español de Bolivia, con montos en bolivianos (Bs).

El plan inicial es **100 platos** el **viernes 9 de octubre de 2026** a **Bs 40** cada uno. Esa lista de compras ya viene cargada.

Los datos viven en **Cloud Firestore** (proyecto `k-jaras`, región `southamerica-east1`) y se sincronizan entre el celular y la computadora. Firestore también guarda una caché en el teléfono para seguir anotando sin señal. El sitio publicado está en [https://k-jaras.web.app](https://k-jaras.web.app).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o más nuevo
- Una cuenta de Google o un correo para entrar. En el proyecto ya están activos Google y correo/contraseña.

## Ejecutar en la computadora

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La app ya apunta al proyecto `k-jaras`: entra con Google o con correo y verás los mismos pedidos que en el celular. `localhost` tiene que estar en los dominios autorizados de Authentication (Firebase lo agrega solo).

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
| Nube | Siempre, con el proyecto `k-jaras` | Documento `users/{uid}` en Firestore, más copia en este teléfono |
| Otro proyecto | Variables `VITE_FIREBASE_*` al compilar o en `.env.local` | El proyecto que indiquen esas variables |

La primera vez que entras con una cuenta, si en ese teléfono ya había datos guardados solo en el navegador, se suben a tu documento. Cada cuenta solo ve lo suyo.

Si anotas en dos teléfonos a la vez, se queda el cambio más reciente.

La configuración pública de la app web está en `src/firebaseConfig.ts`. La `apiKey` viaja dentro del sitio: así funciona Firebase y no es una contraseña. Quien no haya iniciado sesión no puede leer tus pedidos; eso lo impiden las reglas de `firestore.rules`. No subas `.env`, `.env.local` ni el JSON de una cuenta de servicio.

## Proyecto de Firebase

El proyecto ya está creado:

- Identificador: `k-jaras`
- Firestore en `southamerica-east1`
- Authentication con Google y con correo/contraseña
- Hosting: [https://k-jaras.web.app](https://k-jaras.web.app) y `https://k-jaras.firebaseapp.com`
- Archivo `.firebaserc` con ese proyecto como predeterminado

Esas claves públicas son el valor por defecto. Para apuntar a otro proyecto, copia `.env.example` a `.env.local` y llena solo los campos que quieras cambiar. Un campo vacío deja el valor de `k-jaras`.

Opcional: en `VITE_ALLOWED_EMAIL` escribe tu correo. La app cierra la sesión si entra otra cuenta. Eso es una ayuda en el celular. El cierre de verdad está en las reglas: solo el usuario autenticado puede leer y escribir `users/{su uid}`. Para que además nadie más pueda crearse una cuenta útil, cambia `esDueno` en `firestore.rules` y pon tu correo:

```
function esDueno(userId) {
  return request.auth != null
    && request.auth.uid == userId
    && request.auth.token.email == 'tu-correo@gmail.com';
}
```

Ese cambio se publica con el deploy de abajo. En Authentication → Settings → Authorized domains tienen que estar `localhost`, `k-jaras.web.app` y `k-jaras.firebaseapp.com`.

## Publicar

Cada push a `main` ejecuta `.github/workflows/firebase-hosting.yml`: corre las pruebas, compila con la base `/` y publica el sitio (`dist`, con reescritura de SPA a `index.html`) y las reglas de Firestore.

Hace falta un secreto del repositorio:

1. En [Firebase console](https://console.firebase.google.com/project/k-jaras/settings/serviceaccounts/adminsdk) abre la configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un JSON. No lo subas a git.
2. En GitHub abre **Settings → Secrets and variables → Actions → New repository secret**.
3. Nombre: `FIREBASE_SERVICE_ACCOUNT_K_JARAS`. Valor: el contenido completo de ese JSON.
4. Al juntar cambios en `main`, el flujo publica [https://k-jaras.web.app](https://k-jaras.web.app).

La cuenta de servicio que genera Firebase (firebase-adminsdk) puede desplegar Hosting y las reglas. Si creas otra, dale los roles **Firebase Hosting Admin** y **Firebase Rules Admin**.

También puedes publicar desde tu computadora, con el mismo `.firebaserc`:

```bash
npx firebase-tools@14 login
npm run build
npx firebase-tools@14 deploy
```

`firebase deploy` sube Hosting y `firestore.rules`. Si la ventana de Google no abre en el celular, entra con correo y contraseña.

## Respaldo

En **Configuración** puedes bajar un JSON con todo y volver a cargarlo. El CSV de pedidos usa punto y coma y coma decimal, para que Excel en español lo abra en columnas. El CSV no se vuelve a importar: para restaurar, usa el JSON.
