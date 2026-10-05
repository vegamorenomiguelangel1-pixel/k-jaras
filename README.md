# K'jaras

App para que Miguel Ángel organice la venta de k'jaras: lista de compras, gastos, pedidos y ganancia. Está pensada para el celular, en español de Bolivia, con montos en bolivianos (Bs).

El plan inicial es **100 platos** el **viernes 9 de octubre de 2026** a **Bs 40** cada uno. Esa lista de compras ya viene cargada.

Los datos viven en **Cloud Firestore** (proyecto `k-jaras`, región `southamerica-east1`) y se sincronizan entre el celular y la computadora. Firestore también guarda una caché en el teléfono para seguir anotando sin señal. El sitio publicado está en [https://k-jaras.web.app](https://k-jaras.web.app).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o más nuevo
- En Firebase Authentication tiene que seguir activo el método **correo y contraseña**. La pantalla no lo muestra: cada persona entra con su nombre y un código numérico.

## Ejecutar en la computadora

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La app ya apunta al proyecto `k-jaras`. La primera vez, si todavía no hay administrador, la pantalla pide el nombre y el código de esa persona. Después, el equipo entra con los suyos. `localhost` tiene que estar en los dominios autorizados de Authentication (Firebase lo agrega solo).

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
- **Configuración.** Precio, platos y fecha. Exportar e importar un respaldo JSON, exportar pedidos a CSV y restablecer los datos. El administrador agrega y quita personas del equipo.

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
| Nube | Siempre, con el proyecto `k-jaras` | Documento `ventas/principal` en Firestore, más copia en este teléfono |
| Otro proyecto | Variables `VITE_FIREBASE_*` al compilar o en `.env.local` | El proyecto que indiquen esas variables |

Todo el equipo lee y escribe la misma venta. Si todavía existe la venta vieja de una sola persona (`users/{uid}`) y `ventas/principal` no existe, la primera entrada de esa persona la copia. Conviene que entre primero quien tenía los pedidos, para que no se cree antes una venta vacía.

Si anotan en dos teléfonos a la vez, se queda el cambio más reciente.

La configuración pública de la app web está en `src/firebaseConfig.ts`. La `apiKey` viaja dentro del sitio: así funciona Firebase y no es una contraseña. Quien no esté en el equipo no puede leer los pedidos; eso lo impiden las reglas de `firestore.rules`. No subas `.env`, `.env.local` ni el JSON de una cuenta de servicio.

## Proyecto de Firebase

El proyecto ya está creado:

- Identificador: `k-jaras`
- Firestore en `southamerica-east1`
- Authentication con correo y contraseña, usado por dentro para el nombre y el código
- Hosting: [https://k-jaras.web.app](https://k-jaras.web.app) y `https://k-jaras.firebaseapp.com`
- Archivo `.firebaserc` con ese proyecto como predeterminado

Esas claves públicas son el valor por defecto. Para apuntar a otro proyecto, copia `.env.example` a `.env.local` y llena solo los campos que quieras cambiar. Un campo vacío deja el valor de `k-jaras`.

## Nombre y código

La pantalla pide **Nombre** y **Código**. El código es un PIN numérico de 6 a 12 dígitos (Firebase exige al menos 6 caracteres en la contraseña). No hay botón de Google, ni “Crear cuenta”, ni “Olvidé mi código”.

Por dentro, el nombre se vuelve un identificador (`Miguel Ángel` → `miguel-angel`) y se usa como cuenta de correo en Authentication, en el dominio `kjaras.app`. Ese correo no se muestra en la app. El código es la contraseña. En la consola de Firebase las cuentas se ven como correos; en el celular solo se ve el nombre.

La primera persona que crea el administrador queda como admin. Está pensado para que lo haga Miguel en cuanto se publique esta versión, antes de pasar el enlace. Después, en **Configuración**, el administrador agrega al equipo con nombre y código, y puede quitar a alguien. Quitar y volver a agregar es la forma de cambiar un código: la cuenta vieja deja de poder entrar. Al agregar no se cierra la sesión del administrador.

El equipo vive en la colección `miembros` (nombre y rol). `sistema/admin` apunta al administrador. `acceso/{nombre}` guarda solo el identificador interno necesario para entrar, nunca el código.

En Authentication → Settings → Authorized domains tienen que estar `localhost`, `k-jaras.web.app` y `k-jaras.firebaseapp.com`. El proveedor de correo/contraseña tiene que seguir habilitado.

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

`firebase deploy` sube Hosting y `firestore.rules`. Después de publicarlo, la primera pantalla es la de crear al administrador, con nombre y código.

## Respaldo

En **Configuración** puedes bajar un JSON con todo y volver a cargarlo. El CSV de pedidos usa punto y coma y coma decimal, para que Excel en español lo abra en columnas. El CSV no se vuelve a importar: para restaurar, usa el JSON.
