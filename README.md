# ClassSignal

ClassSignal es un MVP educativo mobile-first para conocer el pulso de comprensión de una clase sin obligar a los estudiantes a crear una cuenta. El profesor organiza su trabajo por cursos, abre una clase dentro del curso, comparte un código corto o QR y recibe señales anónimas en tiempo real.

El modelo de navegación es **curso → clase (sesión) → señales**. Un curso conserva el contexto académico y agrupa sus clases; cada clase tiene su propio enlace público, estado, resumen y mapa de confusión.

## Alcance de esta versión

Esta rebanada vertical incluye:

- inicio de sesión por correo para profesores con Supabase Auth y registro público configurable;
- creación de cursos con nombre, materia y descripción opcional;
- vista de cada curso con sus clases y acceso directo para iniciar una nueva;
- creación, cierre y reactivación de sesiones;
- código público de seis caracteres y enlace/QR para estudiantes;
- acceso estudiantil sin cuenta desde `/unirse` o `/s/:codigo`;
- estados `Entendí`, `Tengo una duda` y `Estoy perdido`;
- duda escrita opcional de hasta 1.000 caracteres;
- identificador anónimo persistente en `localStorage`;
- una respuesta por identificador y sesión;
- feed de respuestas y resumen porcentual en tiempo real;
- pulso histórico por curso para comparar comprensión, participación y tendencia entre clases;
- modo proyector con QR, código y pulso agregado, sin mostrar dudas individuales;
- mapa de confusión bajo demanda con GPT‑5.6 y Structured Outputs;
- historial de análisis, caché, tokens, duración, costo estimado y recomendaciones docentes;
- demo pública guiada en `/demo`, con 20 estudiantes y resultados precargados, sin escrituras ni consumo de API;
- validación en cliente con Zod y restricciones equivalentes en PostgreSQL;
- migración con índices, privilegios explícitos y políticas RLS;
- datos de demostración opcionales;
- pruebas unitarias para códigos, respuestas, porcentajes y cálculo de costo.

La IA no se ejecuta automáticamente: un profesor autenticado debe pulsar **Analizar sesión**. La Edge Function excluye correos, UUID de respuestas e identificadores anónimos, y envía a OpenAI únicamente el contexto académico, el estado de comprensión y el texto opcional de las dudas. La solicitud usa `store: false`.

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS 4
- React Router
- Supabase Auth, Postgres y Realtime
- Supabase Edge Functions
- OpenAI Responses API con GPT‑5.6
- `qrcode.react`
- Zod

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0`
- npm
- una cuenta y un proyecto vacío de Supabase
- un widget invisible de Cloudflare Turnstile para los envíos anónimos
- una API key de OpenAI con acceso a `gpt-5.6-luna` para habilitar el mapa
- dos navegadores o perfiles independientes para probar el flujo completo

## 1. Instalar dependencias

```bash
npm ci
```

El repositorio incluye `package-lock.json`; `npm ci` conserva exactamente las versiones verificadas. Usa `npm install` solamente si necesitas modificar dependencias.

## 2. Crear y preparar el proyecto de Supabase

1. Crea un proyecto desde el [Dashboard de Supabase](https://supabase.com/dashboard).
2. Espera a que la base de datos termine de aprovisionarse.
3. Abre **SQL Editor** y crea una consulta nueva.
4. Ejecuta todos los archivos de `supabase/migrations` en orden cronológico. Con Supabase CLI puedes usar `npx supabase db push`.

Las migraciones crean:

- `public.courses`, `public.sessions` y `public.responses`;
- relación opcional `sessions.course_id`, protegida por una clave foránea compuesta que impide asignar una clase al curso de otro profesor;
- restricciones de longitud, estados válidos y unicidad;
- índices para sesiones del profesor y respuestas por sesión;
- políticas RLS y privilegios separados para `authenticated` y `anon`;
- la RPC pública y limitada `get_public_session`;
- la RPC autenticada `get_course_pulse_history`, que entrega únicamente conteos agregados de cursos propios;
- la publicación de `public.responses` en `supabase_realtime`;
- `public.session_analyses`, con historial inmutable, caché de snapshots y lectura limitada al profesor propietario;
- telemetría de tokens/costo y cuotas atómicas de análisis;
- una RPC exclusiva de `service_role` para aceptar respuestas desde la Edge Function sin conceder `INSERT` al navegador anónimo.

Ejecuta los archivos de `supabase/migrations` en orden. No vuelvas a ejecutar la migración inicial completa sobre el mismo esquema: administra cambios posteriores con nuevas migraciones.

### Supabase local opcional

El repositorio incluye `supabase/config.toml` para trabajar con Supabase CLI y Docker sin tocar un proyecto remoto:

```bash
npx supabase start
npx supabase db reset
```

La configuración local usa los puertos `55321` (API), `55322` (Postgres), `55323` (Studio) y `55324` (correo de prueba). Usa la URL y la clave pública que muestra `npx supabase status` en tu `.env.local`. El seed se ejecuta como parte del reset, pero omite la demo si todavía no existe un profesor.

### Realtime

La migración añade automáticamente `public.responses` a la publicación `supabase_realtime`. No debería hacer falta activarla manualmente. Si el panel docente permanece en “Conectando”, verifica en el Dashboard que la tabla `responses` pertenezca a esa publicación y que la migración haya terminado sin errores.

El cliente docente escucha únicamente eventos `INSERT` de la sesión abierta y realiza además una consulta inicial, por lo que muestra tanto las respuestas existentes como las nuevas.

## 3. Configurar autenticación por correo

En **Authentication > Providers**, conserva habilitado el proveedor Email.

En producción, desactiva **Allow new users to sign up** salvo durante un onboarding controlado. La interfaz oculta “Crear cuenta” cuando `VITE_PROFESSOR_SIGNUP_ENABLED=false`, pero la configuración de Supabase Auth es la frontera real. También conviene habilitar confirmación de correo, protección de contraseñas filtradas y CAPTCHA/Turnstile para cualquier periodo de registro.

Para un flujo realista se recomienda mantener activa la confirmación de correo:

- con confirmación activa, el registro muestra “Revisa tu correo” y el profesor debe abrir el enlace antes de iniciar sesión;
- con confirmación desactivada, Supabase crea una sesión inmediatamente y la aplicación entra al panel.

En **Authentication > URL Configuration** configura:

- **Site URL:** `http://localhost:5173`
- **Redirect URLs:** `http://localhost:5173/profesor`

Si pruebas `npm run preview`, añade también `http://localhost:4173/profesor`. Si Vite usa otro puerto u origen, registra la URL exacta que aparece en la terminal, seguida de `/profesor`. La aplicación envía esa ruta como `emailRedirectTo` durante el registro.

## 4. Configurar variables de entorno

Copia el ejemplo:

```powershell
Copy-Item .env.example .env.local
```

En macOS o Linux:

```bash
cp .env.example .env.local
```

Completa `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
VITE_PUBLIC_APP_URL=http://localhost:5173
VITE_PROFESSOR_SIGNUP_ENABLED=false
OPENAI_API_KEY=sk-your-openai-api-key
RESPONSE_HMAC_SECRET=replace-with-32-random-bytes
TURNSTILE_SITE_KEY=replace-with-your-turnstile-site-key
TURNSTILE_SECRET_KEY=replace-with-your-turnstile-secret-key
TURNSTILE_EXPECTED_HOSTNAMES=localhost,127.0.0.1
```

Las dos primeras variables son obligatorias para la aplicación. `VITE_PUBLIC_APP_URL` es opcional; define el origen que se incluirá en el enlace y el QR. Si se omite, la aplicación usa `window.location.origin`. El registro docente está oculto por defecto; actívalo solo durante onboarding y habilita también el registro en Supabase Auth.

En Sites, guarda `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` como
variables de producción del sitio. El worker las entrega al navegador mediante
`/__classsignal-config.js` antes de iniciar la aplicación, sin caché y con una
lista cerrada de campos públicos. La clave debe comenzar por `sb_publishable_`;
el endpoint rechaza claves `sb_secret_` y nunca expone secretos del servidor.

Si despliegas tu propia instancia, reemplaza también los dos orígenes de
Supabase en la política CSP del worker; deben coincidir exactamente con
`VITE_SUPABASE_URL` para mantener la CSP cerrada.

El build renombra el shell de Vite a `__classsignal-shell.txt` y el worker lo
sirve como HTML. Esto evita que una capa de assets entregue la portada antes
de aplicar CSP, HSTS y las demás cabeceras. El archivo no debe volver a
publicarse como `index.html` sin comprobar esas cabeceras en producción.

`OPENAI_API_KEY`, `RESPONSE_HMAC_SECRET` y las variables `TURNSTILE_*` son exclusivas del servidor. No forman parte del bundle porque no tienen el prefijo `VITE_`. Para producción, añádelas en **Supabase > Edge Functions > Secrets**; genera 32 bytes aleatorios, codifícalos como base64url (43 o más caracteres) y no reutilices una contraseña. Nunca crees variantes `VITE_` de claves privadas.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### Configurar Turnstile invisible

1. En Cloudflare Turnstile crea un widget **Invisible** y autoriza el hostname exacto donde se publica ClassSignal.
2. Guarda la site key como `TURNSTILE_SITE_KEY` y la clave privada como `TURNSTILE_SECRET_KEY` en los secretos de Edge Functions.
3. Define obligatoriamente `TURNSTILE_EXPECTED_HOSTNAMES` con los hostnames permitidos, separados por comas y sin protocolo, puerto ni ruta.

La Edge Function entrega por `GET` solamente la site key y la acción pública. Cada `POST` exige un token nuevo, lo valida con Siteverify y comprueba `action=submit_response`, `cData=sessionId` y el hostname exacto. Los tokens duran cinco minutos, son de un solo uso y cualquier error o indisponibilidad falla cerrado.

Para desarrollo local y pruebas automatizadas usa las credenciales oficiales de prueba de Cloudflare, nunca un bypass en el código:

```dotenv
TURNSTILE_SITE_KEY=1x00000000000000000000BB
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_EXPECTED_HOSTNAMES=localhost,127.0.0.1
```

La site key `...BB` corresponde al widget invisible que siempre aprueba en pruebas. Nunca guardes estas credenciales de prueba en producción; una clave privada real rechaza sus tokens simulados.

Obtén la URL y una **publishable key** desde la configuración de API del proyecto. Todas las variables con prefijo `VITE_` forman parte del bundle del navegador, por lo que:

- usa únicamente una clave publicable (`sb_publishable_...`);
- nunca copies una secret key, `service_role`, contraseña de base de datos ni token administrativo;
- nunca expongas la API key de OpenAI en una variable `VITE_`, componente React o worker público;
- no subas `.env.local`; ya está excluido por `.gitignore`.

La clave publicable identifica el proyecto, pero no reemplaza la autorización: RLS determina qué filas puede leer o modificar cada cliente.

Reinicia el servidor de Vite después de cambiar variables de entorno.

### Desplegar las Edge Functions

Después de aplicar las migraciones, despliega la función pública de respuestas y la función autenticada de análisis:

```bash
npx supabase functions deploy submit-response --no-verify-jwt
npx supabase functions deploy analyze-session
```

Si actualizas una versión antigua que todavía insertaba respuestas directamente desde el navegador, coordina migración, Edge Function y frontend en la misma ventana de despliegue: la migración retira deliberadamente ese permiso legado. En una instalación nueva no existe esa transición.

Para desarrollo local, inicia Supabase y sirve la función con el mismo archivo privado de entorno:

```bash
npx supabase functions serve --env-file .env.local
```

`analyze-session` exige un JWT de profesor válido. `submit-response` no exige cuenta porque el estudiante es anónimo, pero exige Turnstile, valida el cuerpo, seudonimiza el identificador y llama una RPC disponible únicamente para `service_role`; nunca expone credenciales privadas. Si falta Turnstile, su lista de hostnames o el secreto HMAC dedicado, el envío falla cerrado. Si falta `OPENAI_API_KEY`, el resto del MVP sigue funcionando y el panel muestra un error de configuración sin exponer secretos.

## 5. Ejecutar la aplicación

```bash
npm run dev
```

Abre `http://localhost:5173`. Sin variables válidas, la aplicación muestra una pantalla de configuración en lugar de intentar conectarse.

Comandos disponibles:

```bash
npm run dev      # servidor de desarrollo
npm test         # pruebas unitarias
npm run build    # comprobación TypeScript y build de producción
npm run preview  # vista local del build generado
```

## Rutas

| Ruta | Acceso | Función |
| --- | --- | --- |
| `/` | Público | Redirige al acceso estudiantil |
| `/demo` | Público, sin cuenta | Recorrido guiado con una clase simulada y análisis precargado |
| `/unirse` | Público, sin cuenta | Entrada mediante código de seis caracteres |
| `/profesor/login` | Público | Inicio de sesión y registro opcional por correo |
| `/profesor` | Profesor autenticado | Inicio y lista de cursos propios |
| `/profesor/cursos/nuevo` | Profesor autenticado | Creación de un curso |
| `/profesor/curso/:courseId` | Profesor propietario | Detalle del curso y sus clases |
| `/profesor/curso/:courseId/sesion/nueva` | Profesor propietario | Creación de una clase dentro del curso |
| `/profesor/sesiones/nueva` | Profesor autenticado | Ruta compatible para crear una sesión sin curso |
| `/profesor/sesion/:id` | Profesor propietario | QR, código, estado, resumen y respuestas en vivo |
| `/profesor/sesion/:id/presentar` | Profesor propietario | QR, código y pulso agregado para proyectar |
| `/s/:codigo` | Público, sin cuenta | Respuesta anónima del estudiante |
| `/privacidad` | Público | Aviso técnico de privacidad y proveedores del MVP |

## Estructura del proyecto

```text
src/
├── app/          # proveedores y router
├── components/   # análisis, auth, layout, respuestas, sesiones y UI base
├── context/      # sesión de autenticación docente
├── demo/         # escenario público autocontenido y datos simulados
├── hooks/        # identificador anónimo y suscripción Realtime
├── lib/          # entorno, errores, formato y utilidades
├── pages/        # pantallas de profesor y estudiante
├── schemas/      # validaciones Zod
├── services/     # acceso a Auth, sesiones, respuestas y Supabase
├── styles/       # estilos globales y Tailwind
└── types/        # tipos del dominio
supabase/
├── config.toml   # configuración local de Supabase CLI
├── functions/    # envío público protegido y análisis autenticado
├── migrations/  # esquema, RLS, privilegios, RPC y Realtime
└── seed.sql      # demo opcional
```

## Verificación de punta a punta con dos navegadores

Usa navegadores distintos o perfiles separados para que sus sesiones y `localStorage` no se mezclen.

1. En el **navegador A**, abre `/profesor/login` e inicia sesión con una cuenta docente autorizada. Para probar registro, habilítalo temporalmente en Supabase Auth y en la variable de entorno.
2. Si la confirmación de correo está activa, confirma la cuenta y vuelve a iniciar sesión.
3. Crea un curso y entra a su detalle.
4. Crea una clase dentro del curso con título y tema.
5. Mantén abierta la pantalla de detalle; debe mostrar código, QR, enlace y el indicador “En vivo”.
6. Abre **modo proyector** en otra ventana y comprueba que muestre solo métricas agregadas.
7. En el **navegador B**, abre `/unirse`, escribe el código o escanea el QR.
8. Elige un estado, escribe una duda opcional y envíala. Turnstile se ejecuta en segundo plano al pulsar el botón, sin un paso adicional en el flujo normal.
9. Sin recargar el navegador A ni la proyección, comprueba que cambien el total y los porcentajes.
10. En el navegador A, pulsa **Analizar sesión** y comprueba el mapa, los tokens, la duración y el costo estimado.
11. Envía otra respuesta desde un perfil distinto: el mapa anterior se marca como desactualizado hasta que pulses **Actualizar mapa**.
12. Intenta responder otra vez desde el mismo navegador B: debe mostrarse el límite de una respuesta por dispositivo y sesión.
13. Finaliza la sesión desde el navegador A. Una carga nueva del enlace muestra la sesión cerrada y cualquier envío posterior queda bloqueado por la operación atómica del servidor.
14. Regresa al curso y verifica que el pulso histórico compare las clases medidas sin exponer textos de dudas.

Para simular varios estudiantes usa perfiles o navegadores independientes. Varias pestañas del mismo perfil comparten el identificador anónimo.

## Demo pública para presentaciones

Abre `/demo` para recorrer el producto sin iniciar sesión ni depender de servicios externos. El escenario contiene 20 señales simuladas de una primera clase de Cálculo Vectorial, un mapa de confusión precargado y cuatro mediciones históricas.

La selección del visitante se procesa únicamente en memoria dentro de la pestaña: no consulta Supabase, no ejecuta Turnstile, no llama a OpenAI y no modifica cursos reales. Esto permite presentar ClassSignal con un costo de API de **US$0**.

## Datos de demostración opcionales

El seed crea la sesión `AULA24` con cinco respuestas sobre “Regla de la cadena”. Primero debe existir al menos un profesor en Supabase Auth.

1. Configura y ejecuta la aplicación.
2. Registra y confirma una cuenta docente.
3. En el SQL Editor, ejecuta todo [`supabase/seed.sql`](supabase/seed.sql).
4. Inicia sesión con el primer usuario creado y abre el panel.

El seed asigna la demo al usuario Auth más antiguo y es repetible: los identificadores son deterministas y los conflictos se ignoran. Si todavía no existe ningún usuario, termina de forma segura sin insertar datos y muestra un aviso en el resultado SQL.

## Modelo de seguridad

- Los profesores usan Supabase Auth y el rol `authenticated`.
- Los cursos se autorizan con `professor_id = auth.uid()`; cada profesor solo puede crearlos, consultarlos, modificarlos o eliminarlos dentro de su cuenta.
- Las sesiones se autorizan con `professor_id = auth.uid()`; un profesor solo puede consultar, modificar o eliminar las propias.
- La clave foránea `(course_id, professor_id)` garantiza en la base de datos que una sesión solo pueda pertenecer a un curso del mismo profesor.
- Un profesor solo puede leer respuestas asociadas a sus propias sesiones.
- El pulso histórico usa una RPC `SECURITY INVOKER`, filtra por `auth.uid()` y devuelve conteos agregados; no incluye dudas ni identificadores anónimos.
- Un profesor solo puede leer análisis de sus propias sesiones; el navegador no tiene privilegios para insertar ni modificar resultados de IA.
- La función limita análisis pagados a 12 por hora y 20 por cada ventana de 24 horas por profesor, con un tope global de 200 por ventana de 24 horas. La caché no consume cuota.
- Los estudiantes permanecen sin autenticar y usan el rol `anon` mediante un cliente separado.
- `anon` no tiene lectura directa de las tablas. La RPC `get_public_session` devuelve solamente los campos mínimos para la pantalla pública.
- `anon` no puede insertar directamente en `responses` ni ejecutar la RPC privilegiada. La Edge Function pública valida, limita y ejecuta una RPC exclusiva de `service_role`.
- Cada envío exige un token Turnstile nuevo verificado en servidor; se comprueban la acción, la sesión ligada mediante `cData` y un hostname de la lista obligatoria.
- El código corto sirve para encontrar una sesión; no es la frontera de autorización. Esa frontera está en los privilegios y políticas RLS de PostgreSQL.
- La combinación `(session_id, anonymous_id)` es única; el servidor deriva ese UUID mediante HMAC por sesión, por lo que un profesor no puede correlacionar el mismo navegador entre clases.
- Cada clase acepta como máximo 500 respuestas y cada huella de red diaria tiene un límite de 80 intentos por ventana de 15 minutos; los duplicados y rechazos también consumen la cuota. La huella es un HMAC de corta vida calculado con un secreto dedicado; nunca se almacena la IP.
- No existe ninguna clave privilegiada en el frontend.
- La Edge Function de análisis valida el JWT y la propiedad de la sesión; `OPENAI_API_KEY` vive únicamente en secretos de Supabase.
- Las dudas se tratan como datos no confiables para reducir prompt injection, y los conteos del mapa se derivan en servidor de referencias reales.

El identificador del estudiante es un UUID aleatorio guardado en `localStorage`. Antes de guardarlo en Postgres, el servidor genera otro UUID seudónimo específico para la sesión. No se solicita nombre, correo ni cuenta. Sigue siendo un mecanismo de baja fricción: borrar el almacenamiento o cambiar de navegador genera otro identificador, por eso existen además límites de red y capacidad total.

Al validar Turnstile, la Edge Function envía a Cloudflare el token y, cuando está disponible, la dirección de red para la comprobación antiabuso. ClassSignal no guarda la IP en sus tablas: conserva únicamente una huella HMAC diaria no reversible para aplicar límites. En una publicación institucional, refleja este procesador también en el aviso de privacidad de la organización.

Turnstile, el límite de red y la capacidad total reducen automatizaciones y abuso, pero no prueban que cada envío corresponda a una persona. Para cursos masivos o códigos publicados fuera del aula, considera además tickets de participación firmados y de corta duración.

El costo mostrado es una estimación histórica calculada con la tarifa Luna capturada en la ejecución (`US$1/M` tokens de entrada, `US$0.10/M` en caché y `US$6/M` de salida, incluidos los multiplicadores documentados para contextos de más de 272K tokens). La factura oficial de OpenAI sigue siendo la fuente definitiva.

## Solución de problemas

### Aparece “Conecta tu proyecto de Supabase”

Revisa que `.env.local` exista, que la URL incluya `https://` y que la publishable key esté completa. Después reinicia `npm run dev`.

### El enlace de confirmación redirige al lugar equivocado

Verifica **Site URL** y la lista de **Redirect URLs** en Supabase Auth. El origen y el puerto deben coincidir exactamente con los que usa el navegador. Para desarrollo local, registra al menos `http://localhost:5173/profesor`.

### No llega el correo de confirmación

Revisa spam, el estado del proveedor Email y los logs de Auth en Supabase. Evita solicitar muchos correos seguidos porque el servicio puede aplicar límites temporales.

### Aparece “relation does not exist”, “function not found” o un error de permisos

Confirma que la migración completa se ejecutó sin errores en el mismo proyecto indicado por `VITE_SUPABASE_URL`. Las tablas, la RPC, los `GRANT` y las políticas RLS forman una sola versión del esquema.

### El panel permanece en “Conectando”

Comprueba que `public.responses` esté en `supabase_realtime`, que el profesor continúe autenticado y que el navegador permita WebSockets. El botón de actualizar realiza una consulta manual mientras revisas la conexión.

### “El análisis con IA aún no está configurado”

Añade `OPENAI_API_KEY` en **Supabase > Edge Functions > Secrets**. No la añadas a las variables públicas del sitio. No es necesario volver a compilar el frontend después de guardar el secreto.

### OpenAI rechaza la credencial o aplica un límite temporal

Verifica que la key esté activa, tenga acceso a `gpt-5.6-luna` y que el proyecto de OpenAI tenga capacidad disponible. El historial registra el intento como fallido sin guardar detalles sensibles del proveedor; puedes volver a intentarlo desde el panel.

### El estudiante recibe “Ya enviaste una respuesta”

Es el comportamiento esperado para una segunda respuesta desde el mismo perfil y sesión. Para una demo con varios participantes utiliza navegadores o perfiles separados.

### El estudiante recibe un error de política o la sesión aparece cerrada

Comprueba en el panel docente que la sesión siga activa y que `submit-response` esté desplegada con `verify_jwt=false`. La función y la RPC rechazan sesiones finalizadas aunque alguien conserve una pestaña antigua abierta.

### Aparece “Envío seguro no disponible”

Comprueba que `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAMES` y un `RESPONSE_HMAC_SECRET` base64url de al menos 43 caracteres existan en **Supabase > Edge Functions > Secrets**. Verifica también que el hostname actual esté autorizado en el widget. Los secretos están disponibles inmediatamente al guardarlos; despliega además la versión de `submit-response` que valida Turnstile.

### El QR abre `localhost` en el teléfono

`localhost` en el teléfono apunta al propio teléfono. Para una prueba dentro de la misma red:

1. ejecuta `npm run dev -- --host`;
2. define `VITE_PUBLIC_APP_URL` con el origen LAN del computador, por ejemplo `http://192.168.1.50:5173`;
3. reinicia Vite y permite el acceso en el firewall local.

No uses esa dirección de ejemplo literalmente; reemplázala por la IP local real del equipo.

### El seed no crea la sesión `AULA24`

Crea primero un usuario mediante Supabase Auth. Si hay varios, la sesión pertenece al más antiguo. Revisa también los avisos del SQL Editor por una posible colisión previa del código o del identificador de demo.

## Guion corto de demostración

1. El profesor entra a ClassSignal y crea un curso.
2. Desde el curso inicia una clase en menos de un minuto.
3. Proyecta el QR y el código corto.
4. Un estudiante responde desde su teléfono sin registrarse.
5. El panel cambia en vivo y muestra la duda junto al nuevo porcentaje.
6. El profesor pulsa **Analizar sesión** y obtiene un mapa de confusión con evidencia y acciones sugeridas.
7. El profesor finaliza la sesión y se bloquean nuevas respuestas.
