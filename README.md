# ClassSignal

ClassSignal es un MVP educativo mobile-first para conocer el pulso de comprensión de una clase sin obligar a los estudiantes a identificarse al responder. El profesor organiza su trabajo por cursos, abre una clase dentro del curso, comparte un código corto o QR y recibe señales anónimas en tiempo real.

El acceso estudiantil es híbrido: cualquier persona puede responder una clase sin cuenta, mientras que quien quiera conservar sus cursos puede iniciar sesión mediante un enlace mágico por correo. La cuenta permite matricularse, ver clases en vivo y consultar clases anteriores que el profesor haya publicado; nunca se adjunta a las respuestas del pulso.

El modelo de navegación es **curso → clase (sesión) → pulsos → señales**. Un curso conserva el contexto académico y agrupa sus clases; cada clase mantiene un único código, enlace y QR, mientras sus pulsos separan mediciones sucesivas para comparar al grupo antes y después de una intervención docente.

## Alcance de esta versión

Esta rebanada vertical incluye:

- inicio de sesión por correo para profesores con Supabase Auth y rol docente administrado;
- portal estudiantil opcional con acceso sin contraseña mediante Magic Link;
- creación de cursos con nombre, materia y descripción opcional;
- código permanente de matrícula por curso, apertura/cierre de matrículas y listado de cursos guardados;
- vista de cada curso con sus clases y acceso directo para iniciar una nueva;
- creación, cierre y reactivación de sesiones;
- creación automática de `Pulso 1` y apertura de hasta seis pulsos por clase;
- un solo pulso activo a la vez; abrir el siguiente cierra el anterior sin cambiar código, enlace ni QR;
- cierre del pulso activo al finalizar la clase y creación de uno nuevo al reactivarla;
- código público de seis caracteres y enlace/QR para estudiantes;
- acceso estudiantil sin cuenta desde `/unirse` o `/s/:codigo` para responder anónimamente;
- vista estudiantil de clases **en vivo** y **anteriores**, sin prometer ni modelar clases programadas;
- archivo publicado por el profesor con resumen, recursos y, de forma opcional, dudas anónimas moderadas;
- estados `Entendí`, `Tengo una duda` y `Estoy perdido`;
- duda escrita opcional de hasta 1.000 caracteres;
- identificador anónimo persistente en `localStorage`;
- una respuesta por identificador y pulso;
- feed, resumen porcentual y comparación en puntos porcentuales entre pulsos;
- muro anónimo de dudas por pulso, oculto al abrir cada medición, con actualización automática y moderación individual;
- pulso histórico por curso basado en el último pulso con respuestas de cada clase;
- modo proyector con QR, código y resultados del pulso activo, sin mostrar dudas individuales;
- mapa de confusión bajo demanda con GPT‑5.6 y Structured Outputs;
- historial de análisis, caché, tokens, duración, costo estimado y recomendaciones docentes;
- borrador de publicación con GPT‑5.6, siempre separado del formulario y aplicado únicamente tras revisión local;
- microintervenciones colectivas de 3–5 minutos por concepto, con copia y apertura confirmada del siguiente pulso;
- cierre determinista del ciclo mediante comparación agregada del pulso posterior, sin seguimiento individual ni atribución causal;
- demo pública guiada en `/demo`, con 20 estudiantes y resultados precargados, sin escrituras ni consumo de API;
- validación en cliente con Zod y restricciones equivalentes en PostgreSQL;
- migración con índices, privilegios explícitos y políticas RLS;
- datos de demostración opcionales;
- pruebas unitarias para códigos, respuestas, porcentajes y cálculo de costo.

La IA no se ejecuta automáticamente: un profesor autenticado debe pulsar **Analizar pulso**. La Edge Function excluye correos, UUID de respuestas e identificadores anónimos, y envía a OpenAI únicamente el contexto académico, el estado de comprensión y el texto opcional de las dudas del pulso seleccionado. Snapshot, caché e historial quedan ligados a `pulse_id`; no se mezclan rondas. La solicitud usa `store: false`.

### Ciclo de pulsos

Una sesión activa tiene exactamente un pulso activo. La creación de la clase abre Pulso 1; **Abrir nuevo pulso** cierra el actual y crea el ordinal siguiente en una operación atómica. Se exige al menos una respuesta aceptada en el pulso actual y nunca se puede superar el ordinal 6. Los pulsos cerrados son inmutables. Finalizar la clase cierra su pulso; reactivarla crea uno nuevo en lugar de modificar el anterior.

Cada pulso reutiliza los tres estados de comprensión y la duda opcional. No contiene preguntas, respuestas correctas, temporizadores ni actividades generadas. La comparación usa porcentajes agregados y puntos porcentuales entre pulsos consecutivos; no intenta seguir estudiantes individuales.

### Copiloto docente con GPT‑5.6

El copiloto tiene tres piezas deliberadamente distintas:

1. **Borrador:** propone resumen, tipos de práctica y notas que el profesor debe confirmar. Nunca publica, no toca el muro y sólo modifica el estado local del formulario al pulsar **Aplicar al formulario**. El guardado sigue siendo una acción manual separada.
2. **Microintervención:** parte de un concepto de un mapa vigente y genera una orientación colectiva de 3–5 minutos. Incluye objetivo, ejemplo, pasos, comprobación y seguimiento; no califica ni diagnostica personas.
3. **Resultado:** compara en TypeScript los porcentajes agregados del pulso fuente y el siguiente. Cada pulso conserva su propio denominador; la secuencia temporal no se presenta como prueba de causalidad.

`generate-session-artifact` valida JWT, rol y propiedad, deriva las fuentes desde Supabase y reserva el trabajo mediante `create_session_ai_artifact`. Publicaciones usan sólo contexto académico, conteos/porcentajes, comparaciones y proyecciones de mapas completados; microintervenciones usan el agregado y el concepto seleccionado del mapa vigente. Las proyecciones eliminan `evidence`, textos individuales, correos, UUID, identificadores anónimos, matrículas, URLs y secretos antes de construir la solicitud. Los textos académicos se tratan como datos no confiables. Responses API usa `store:false`, JSON Schema estricto y no tiene fallback a un modelo más costoso.

La tabla `session_ai_artifacts` conserva filas terminales inmutables, fingerprint, configuración efectiva, telemetría, costo estimado y un límite temporal conservador de las fuentes. Sólo el profesor propietario puede leerlas; el navegador no puede crear ni actualizar artefactos. Reserva y finalización comparten un bloqueo por objetivo para evitar trabajo pagado duplicado. Una fuente nueva marca visualmente el resultado como desactualizado y obliga a regenerar antes de aplicar o abrir el siguiente pulso.

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

- `public.profiles`, con roles `professor` y `student` controlados por el servidor;
- `public.courses`, `public.sessions`, `public.session_pulses` y `public.responses`;
- `public.course_enrollments`, que guarda la matrícula sin almacenar ni referenciar respuestas;
- `public.session_publications`, donde el profesor decide qué resumen, recursos y dudas moderadas publica en el archivo;
- un código permanente de matrícula de ocho caracteres y el estado `enrollment_open` para cada curso;
- relación opcional `sessions.course_id`, protegida por una clave foránea compuesta que impide asignar una clase al curso de otro profesor;
- `session_pulses(id, session_id, ordinal, is_active, questions_visible_to_students, started_at, ended_at)`;
- creación automática de Pulso 1, un máximo de seis pulsos y un único pulso activo por sesión;
- operaciones atómicas para cerrar el pulso actual y abrir el siguiente, seguras ante doble clic o pestañas concurrentes;
- `responses.pulse_id` y `session_analyses.pulse_id`, con backfill de datos anteriores hacia Pulso 1;
- restricciones de longitud, estados válidos y unicidad por `(pulse_id, anonymous_id)`;
- índices para sesiones del profesor y respuestas por pulso;
- políticas RLS y privilegios separados para `authenticated` y `anon`;
- la RPC pública y limitada `get_public_session`;
- la RPC pública y acotada `get_student_question_wall`, que entrega solo las dudas no excluidas del pulso visible mientras la sesión está activa;
- la RPC autenticada `get_course_pulse_history`, que entrega únicamente el último pulso con respuestas de cada clase propia;
- RPC autenticadas y acotadas para matricularse, listar cursos propios y consultar solo el archivo publicado de una clase;
- una RPC docente que devuelve únicamente el conteo de matrículas del curso propio;
- la publicación de `public.responses` en `supabase_realtime`;
- `public.session_analyses`, con historial inmutable, caché de snapshots y lectura limitada al profesor propietario;
- `public.session_ai_artifacts`, con historial inmutable de borradores e intervenciones, RLS docente y escritura exclusiva de `service_role`;
- telemetría de tokens/costo y cuotas atómicas de análisis;
- RPC exclusivas de `service_role` para reservar y finalizar artefactos bajo caché, deduplicación y cuotas compartidas con los análisis;
- una RPC exclusiva de `service_role` para aceptar respuestas desde la Edge Function sin conceder `INSERT` al navegador anónimo.

Ejecuta los archivos de `supabase/migrations` en orden. No vuelvas a ejecutar la migración inicial completa sobre el mismo esquema: administra cambios posteriores con nuevas migraciones. La migración de rondas crea Pulso 1 para cada clase existente y asigna allí sus respuestas y análisis previos antes de exigir `pulse_id` en nuevas escrituras.

### Supabase local opcional

El repositorio incluye `supabase/config.toml` para trabajar con Supabase CLI y Docker sin tocar un proyecto remoto:

```bash
npx supabase start
npx supabase db reset
```

La configuración local usa los puertos `55321` (API), `55322` (Postgres), `55323` (Studio) y `55324` (correo de prueba). Usa la URL y la clave pública que muestra `npx supabase status` en tu `.env.local`. El seed se ejecuta como parte del reset, pero omite la demo si todavía no existe un profesor.

### Realtime

Las migraciones añaden automáticamente `public.responses` y `public.session_pulses` a la publicación `supabase_realtime`. No debería hacer falta activarlas manualmente. Si el panel docente permanece en “Conectando”, verifica en el Dashboard que ambas tablas pertenezcan a esa publicación y que la migración haya terminado sin errores.

El cliente docente carga de forma paginada un máximo de 3.000 respuestas por clase —seis pulsos de 500— y escucha sus eventos `INSERT`. Cada fila conserva un `pulse_id` obligatorio y resumen, feed, comparación, proyector y análisis filtran explícitamente el pulso correspondiente, por lo que nunca suman rondas distintas. El estudiante consulta la sesión pública cada cinco segundos para detectar un pulso nuevo sin recargar. El muro no abre Realtime sobre la tabla base: consulta una proyección pública mínima del pulso visible y permite actualizarla manualmente.

## 3. Configurar autenticación por correo

En **Authentication > Providers**, conserva habilitado el proveedor Email.

El portal estudiantil usa Magic Link, por lo que **Allow new users to sign up** debe permanecer activado. Cada usuario nuevo recibe el rol `student` desde un trigger de base de datos; no se confía en metadatos editables del navegador para autorizarlo. La pantalla docente no ofrece registro público: crea o promueve las cuentas de profesor mediante un proceso administrativo controlado.

Las cuentas existentes que ya poseen cursos o clases se conservan como profesores; las cuentas sin actividad docente quedan como estudiantes. Para promover otra cuenta deliberadamente, verifica primero su correo en **Authentication > Users** y cambia `public.profiles.role` a `professor` desde SQL Editor o una herramienta administrativa protegida. Nunca expongas esa operación en el cliente.

El estudiante escribe su correo en `/estudiante/login`, recibe un enlace de un solo uso y vuelve al portal sin crear contraseña. En **Authentication > URL Configuration** configura:

- **Site URL:** el origen canónico de la aplicación, por ejemplo `http://localhost:5173`;
- **Redirect URLs:** registra tanto la raíz como el comodín limitado del portal: `http://localhost:5173/estudiante` y `http://localhost:5173/estudiante/**`.

En producción añade `https://tu-dominio/estudiante` y `https://tu-dominio/estudiante/**`. Si pruebas `npm run preview`, registra esas mismas dos rutas bajo `http://localhost:4173`. El comodín queda limitado al portal y permite que el Magic Link regrese al curso o clase que el estudiante intentaba abrir; no uses un comodín de dominio completo. Supabase solo acepta el destino enviado como `emailRedirectTo` cuando coincide con esta lista. Mantén habilitadas las protecciones de correo y revisa los límites del proveedor SMTP antes de una prueba masiva.

El acceso docente existente continúa en `/profesor/login`. Las credenciales de profesor y el Magic Link estudiantil comparten Supabase Auth, pero el rol de `public.profiles` decide qué panel puede abrir cada sesión.

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
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL_ROUTINE=gpt-5.6-luna
OPENAI_PUBLICATION_DRAFT_REASONING_EFFORT=medium
OPENAI_MICRO_INTERVENTION_REASONING_EFFORT=high
RESPONSE_HMAC_SECRET=replace-with-32-random-bytes
TURNSTILE_SITE_KEY=replace-with-your-turnstile-site-key
TURNSTILE_SECRET_KEY=replace-with-your-turnstile-secret-key
TURNSTILE_EXPECTED_HOSTNAMES=localhost,127.0.0.1
```

Las dos primeras variables son obligatorias para la aplicación. `VITE_PUBLIC_APP_URL` es opcional; define el origen que se incluirá en el enlace y el QR. Si se omite, la aplicación usa `window.location.origin`. La creación de cuentas estudiantiles se controla en Supabase Auth; el rol docente se asigna únicamente mediante administración protegida.

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

`OPENAI_API_KEY`, `OPENAI_MODEL_ROUTINE`, los dos esfuerzos, `RESPONSE_HMAC_SECRET` y las variables `TURNSTILE_*` son exclusivas del servidor. No forman parte del bundle porque no tienen el prefijo `VITE_`. Para producción, `OPENAI_API_KEY` es el único secreto nuevo obligatorio del copiloto; el modelo y los esfuerzos ya tienen los valores seguros mostrados arriba y sólo deben configurarse si se desea hacer explícita esa política. Añade los secretos en **Supabase > Edge Functions > Secrets**; genera 32 bytes aleatorios, codifícalos como base64url (43 o más caracteres) y no reutilices una contraseña. Nunca crees variantes `VITE_` de claves privadas.

`OPENAI_MODEL_ROUTINE` acepta actualmente sólo `gpt-5.6-luna`. Borradores usan `medium` y microintervenciones `high`; un valor distinto falla cerrado. No existe fallback silencioso a Terra o Sol. `analyze-session` conserva su configuración independiente (`xhigh`, 6.000 tokens) sin reducción.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### Configurar Turnstile invisible

1. En Cloudflare Turnstile crea un widget **Invisible** y autoriza el hostname exacto donde se publica ClassSignal.
2. Guarda la site key como `TURNSTILE_SITE_KEY` y la clave privada como `TURNSTILE_SECRET_KEY` en los secretos de Edge Functions.
3. Define obligatoriamente `TURNSTILE_EXPECTED_HOSTNAMES` con los hostnames permitidos, separados por comas y sin protocolo, puerto ni ruta.

La Edge Function entrega por `GET` solamente la site key y la acción pública. Cada `POST` exige un token nuevo, lo valida con Siteverify y comprueba `action=submit_response`, `cData=pulseId` y el hostname exacto. El cuerpo incluye sesión y pulso; el servidor verifica que ambos se correspondan y que ese pulso siga activo. Un token emitido para una ronda cerrada no autoriza la siguiente. Los tokens duran cinco minutos, son de un solo uso y cualquier error o indisponibilidad falla cerrado.

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
npx supabase functions deploy generate-session-artifact
```

La incorporación de rondas cambia el contrato entre base de datos, funciones y navegador, por lo que debe desplegarse en una ventana coordinada:

1. pausa publicaciones del frontend;
2. aplica todas las migraciones y confirma el backfill hacia Pulso 1;
3. despliega `submit-response`, `analyze-session` y `generate-session-artifact`;
4. publica frontend y worker;
5. ejecuta una prueba de humo con dos pulsos y el mismo código.

No publiques el frontend nuevo antes del esquema y las dos funciones: las escrituras requieren `pulse_id` y los análisis quedan acotados al pulso seleccionado. No hacen falta secretos nuevos. Si debes revertir, coordina esquema, funciones y frontend como una sola versión; no dejes un cliente que use rondas contra funciones antiguas.

Si además actualizas una versión que todavía insertaba respuestas directamente desde el navegador, esta misma ventana debe incluir el retiro del permiso legado. En una instalación nueva no existe esa transición.

Para desarrollo local, inicia Supabase y sirve la función con el mismo archivo privado de entorno:

```bash
npx supabase functions serve --env-file .env.local
```

`analyze-session` conserva su nombre técnico y exige un JWT de profesor válido, pero analiza un solo `pulse_id`. `generate-session-artifact` también exige JWT docente; deriva sus fuentes en servidor y nunca recibe texto académico desde el navegador. `submit-response` no exige cuenta porque el estudiante es anónimo, pero exige Turnstile, valida sesión y pulso, seudonimiza el identificador por pulso y llama una RPC disponible únicamente para `service_role`; nunca expone credenciales privadas. Si falta Turnstile, su lista de hostnames o el secreto HMAC dedicado, el envío falla cerrado. Si falta `OPENAI_API_KEY`, el resto del MVP sigue funcionando y los paneles muestran un error de configuración sin exponer secretos.

## 5. Ejecutar la aplicación

```bash
npm run dev
```

Abre `http://localhost:5173`. Sin variables válidas, la aplicación muestra una pantalla de configuración en lugar de intentar conectarse.

Comandos disponibles:

```bash
npm run dev      # servidor de desarrollo
npm test         # pruebas unitarias
npm run test:db  # pgTAP de esquema, permisos, RLS, caché y cuotas
npm run test:evals # evaluaciones offline, sin red ni clave
npm run build    # comprobación TypeScript y build de producción
npm run preview  # vista local del build generado
```

Las evaluaciones reales están desactivadas en CI y requieren simultáneamente `RUN_OPENAI_EVALS=1` y `OPENAI_API_KEY`. Para una ejecución acotada: `node supabase/functions/generate-session-artifact/evals/run-openai-evals.mjs --case critical-confusion-chemistry --kind micro_intervention`. Sin opt-in explícito el runner termina antes de llamar a OpenAI. Fixtures y métricas cubren fundamentación, utilidad docente, información inventada, formato, privacidad, latencia, tokens y costo; los resultados JSONL quedan fuera de Git.

## Rutas

| Ruta | Acceso | Función |
| --- | --- | --- |
| `/` | Público | Redirige al acceso estudiantil |
| `/demo` | Público, sin cuenta | Recorrido guiado con dos pulsos, comparación antes/después y análisis precargado |
| `/unirse` | Público, sin cuenta | Entrada mediante código de seis caracteres |
| `/estudiante/login` | Público | Solicitud del Magic Link para entrar al portal estudiantil |
| `/estudiante` | Estudiante autenticado | Cursos matriculados y acceso a clases en vivo o anteriores |
| `/estudiante/unirse` | Estudiante autenticado | Matrícula mediante el código permanente de un curso |
| `/estudiante/curso/:courseId` | Estudiante matriculado | Detalle del curso y listado de sus clases |
| `/estudiante/clase/:sessionId` | Estudiante matriculado | Acceso a la clase en vivo o al archivo publicado por el profesor |
| `/profesor/login` | Público | Inicio de sesión para cuentas con rol docente |
| `/profesor` | Profesor autenticado | Inicio y lista de cursos propios |
| `/profesor/cursos/nuevo` | Profesor autenticado | Creación de un curso |
| `/profesor/curso/:courseId` | Profesor propietario | Detalle del curso y sus clases |
| `/profesor/curso/:courseId/sesion/nueva` | Profesor propietario | Creación de una clase dentro del curso |
| `/profesor/sesiones/nueva` | Profesor autenticado | Ruta compatible para crear una sesión sin curso |
| `/profesor/sesion/:id` | Profesor propietario | Administra el pulso activo, historial, comparación, respuestas, análisis y muro |
| `/profesor/sesion/:id/presentar` | Profesor propietario | Mismo QR y código, con métricas agregadas del pulso activo |
| `/s/:codigo` | Público, sin cuenta | Detecta el pulso activo y permite una respuesta anónima por ronda |
| `/privacidad` | Público | Aviso técnico de privacidad y proveedores del MVP |

Los pulsos no crean rutas, códigos ni enlaces nuevos. El mismo acceso acompaña toda la clase y la sesión pública expone solo el pulso activo necesario para presentar el formulario correcto.

El código de `/unirse` identifica una **clase** y permite responder sin cuenta. El código de `/estudiante/unirse` identifica un **curso** y lo guarda en el portal. Son flujos distintos: estar matriculado no identifica la respuesta ni cambia el límite anónimo por navegador y pulso.

## Estructura del proyecto

```text
src/
├── app/          # proveedores y router
├── components/   # análisis, auth, layout, preguntas, respuestas, sesiones y UI base
├── context/      # sesión, perfil y rol de la cuenta autenticada
├── demo/         # escenario público autocontenido y datos simulados
├── hooks/        # identificador anónimo, polling público y suscripción Realtime
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

1. En el **navegador A**, abre `/profesor/login`, inicia sesión, crea un curso y crea una clase.
2. Comprueba que la clase nace con **Pulso 1** activo y que muestra código, QR y enlace.
3. Intenta abrir Pulso 2 sin respuestas: la interfaz debe exigir al menos una señal aceptada.
4. Abre **modo proyector** y comprueba que muestre Pulso 1 y solo métricas agregadas.
5. En el **navegador B**, entra con el código, elige un estado, escribe una duda opcional y envíala. Turnstile debe ejecutarse sin pasos adicionales.
6. Sin recargar A ni la proyección, comprueba que cambien total y porcentajes de Pulso 1.
7. Intenta responder otra vez desde B: debe aparecer **Ya respondiste este pulso**.
8. En A, pulsa **Analizar pulso** y comprueba mapa, tokens, duración y costo estimado. Otra respuesta en Pulso 1 debe marcar ese mapa como desactualizado.
9. Abre **Pulso 2** y confirma que Pulso 1 queda cerrado, el muro nuevo empieza oculto y código, enlace y QR no cambian.
10. Mantén B abierto: debe detectar Pulso 2 en menos de diez segundos, sin recargar.
11. Responde desde el mismo navegador B en Pulso 2 y comprueba que un segundo intento en esa ronda se rechaza.
12. Verifica que feed, resumen, muro, proyector y análisis de Pulso 2 no incluyan respuestas de Pulso 1; consulta luego Pulso 1 desde el historial.
13. Abre el siguiente pulso simultáneamente desde dos pestañas docentes y comprueba que solo se cree un ordinal.
14. Finaliza la clase y confirma que el pulso activo se cierra y los envíos posteriores se rechazan.
15. Reactiva la clase: debe crearse el ordinal siguiente, sin reabrir un pulso cerrado.
16. Continúa hasta seis pulsos y confirma que el séptimo se rechaza.
17. Regresa al curso y verifica que el histórico use el último pulso con respuestas, sin exponer dudas.
18. Prueba una clase creada antes de la migración y confirma que sus datos aparecen como Pulso 1.
19. Borra `localStorage` y vuelve a enviar al mismo pulso: aunque el cliente pierda su estado visual, el servidor debe seguir aplicando unicidad y límites.

Para simular varios estudiantes usa perfiles o navegadores independientes. Varias pestañas del mismo perfil comparten el identificador local, pero el servidor deriva un seudónimo distinto para cada pulso.

### Verificación del portal estudiantil

1. En el panel docente, copia el código permanente de matrícula del curso y confirma que las matrículas estén abiertas.
2. En otro navegador, abre una ruta protegida del portal, solicita el Magic Link y verifica en el correo que el enlace regrese a esa misma ruta bajo `/estudiante`.
3. Abre `/estudiante/unirse`, introduce el código del curso y comprueba que el curso quede guardado. Repetir el mismo código debe ser idempotente.
4. Con una clase activa, confirma que el curso la marque como **En vivo** y que permita abrir el flujo anónimo de respuesta.
5. Responde el pulso. Comprueba en Supabase que `course_enrollments` contiene la cuenta, pero `responses` no contiene `student_id`, correo ni referencia a la matrícula.
6. Finaliza la clase. Antes de publicar, el portal debe tratarla como clase anterior sin inventar un resumen ni mostrar dudas.
7. Desde el panel docente publica un resumen y recursos; habilita las dudas solo después de moderarlas. Comprueba que el archivo estudiantil muestre exclusivamente esos campos y las dudas anónimas autorizadas.
8. Cierra las matrículas y confirma que un estudiante nuevo recibe un mensaje genérico de código inválido o cerrado, sin revelar si el curso existe.

## Demo pública para presentaciones

Abre `/demo` para recorrer el producto sin iniciar sesión ni depender de servicios externos. Sus cuatro pasos permiten responder Pulso 1, observar el panel, consultar un mapa de confusión precargado, responder Pulso 2 con el mismo código y comparar el grupo antes/después. El resultado final también alimenta cuatro mediciones históricas.

La selección del visitante se procesa únicamente en memoria dentro de la pestaña: no consulta Supabase, no ejecuta Turnstile, no llama a OpenAI y no modifica cursos reales. Esto permite presentar ClassSignal con un costo de API de **US$0**.

## Datos de demostración opcionales

El seed crea la sesión `AULA24`, resuelve su Pulso 1 automático y asocia allí cinco respuestas sobre “Regla de la cadena”. Primero debe existir al menos un profesor en Supabase Auth y deben haberse aplicado todas las migraciones.

1. Configura y ejecuta la aplicación.
2. Registra y confirma una cuenta docente.
3. En el SQL Editor, ejecuta todo [`supabase/seed.sql`](supabase/seed.sql).
4. Inicia sesión con el primer usuario creado y abre el panel.

El seed asigna la demo al perfil docente más antiguo y es repetible: la sesión y las respuestas usan identificadores deterministas, mientras el pulso se resuelve mediante `(session_id, ordinal)`. Los conflictos se ignoran. Si no existe un perfil docente o Pulso 1 no fue creado por la migración, termina de forma segura y muestra un aviso en el resultado SQL.

## Modelo de seguridad

- Profesores y estudiantes con portal usan Supabase Auth. `public.profiles.role` distingue `professor` de `student`; el cliente puede leer su rol, pero no asignarlo ni modificarlo.
- Los usuarios creados después de la migración nacen como estudiantes. Las cuentas docentes requieren una promoción administrativa explícita.
- Los cursos se autorizan con `professor_id = auth.uid()`; cada profesor solo puede crearlos, consultarlos, modificarlos o eliminarlos dentro de su cuenta.
- Las sesiones se autorizan con `professor_id = auth.uid()`; un profesor solo puede consultar, modificar o eliminar las propias.
- Los pulsos heredan la propiedad de su sesión mediante RLS. Solo el profesor propietario puede consultar el historial o abrir el siguiente; un pulso cerrado no puede reabrirse ni modificarse.
- La clave foránea `(course_id, professor_id)` garantiza en la base de datos que una sesión solo pueda pertenecer a un curso del mismo profesor.
- Un profesor solo puede leer respuestas asociadas a pulsos de sus propias sesiones.
- El pulso histórico usa una RPC `SECURITY INVOKER`, filtra por `auth.uid()` y devuelve el último pulso con respuestas de cada clase; no incluye dudas ni identificadores anónimos.
- Un profesor solo puede leer análisis de pulsos propios; el navegador no tiene privilegios para insertar ni modificar resultados de IA.
- Un profesor sólo puede leer sus propios artefactos docentes; estudiantes y `anon` no tienen privilegios, y el navegador docente tampoco puede insertarlos ni actualizarlos.
- Análisis y artefactos comparten el presupuesto: 12 reservas por hora y 20 por cada ventana de 24 horas por profesor, con tope global de 200 por ventana de 24 horas. Una lectura de caché no consume cuota.
- El portal estudiantil solo devuelve cursos donde existe una matrícula para `auth.uid()`. El estudiante no recibe acceso directo a `course_enrollments`, tablas docentes ni respuestas.
- El código permanente de curso solo crea matrículas mientras `enrollment_open` esté activo. Un código inválido y uno cerrado producen el mismo error para no revelar la existencia del curso.
- El archivo de una clase se publica por decisión explícita del profesor. Resumen, recursos y dudas moderadas se entregan mediante RPC acotadas; las dudas permanecen ocultas salvo que `questions_published` esté activo.
- Responder una clase sigue siendo un flujo público con rol `anon` y un cliente Supabase separado, incluso cuando el navegador también tiene una cuenta estudiantil iniciada.
- La matrícula nunca se une a `responses`: el envío no incluye JWT de la cuenta, `student_id`, correo ni identificador de matrícula.
- `anon` no tiene lectura directa de `session_pulses`, `responses` ni `session_analyses`. La RPC `get_public_session` devuelve solamente los campos de la clase y el `id`/`ordinal` del pulso activo necesarios para la pantalla pública.
- El muro comienza oculto en cada pulso nuevo. Su RPC devuelve únicamente `id` y texto de preguntas no excluidas del pulso visible; nunca expone `anonymous_id`, estado de comprensión, hora de envío, `session_id` ni pulsos cerrados.
- El profesor propietario puede activar u ocultar el muro y moderar cada duda. El estudiante nunca se suscribe directamente a filas de `responses`.
- `anon` no puede insertar directamente en `responses` ni ejecutar la RPC privilegiada. La Edge Function pública valida, limita y ejecuta una RPC exclusiva de `service_role`.
- Cada envío exige un token Turnstile nuevo verificado en servidor; se comprueban la acción, el pulso ligado mediante `cData`, su pertenencia a la sesión, su estado activo y un hostname de la lista obligatoria.
- El código corto sirve para encontrar una sesión; no es la frontera de autorización. Esa frontera está en los privilegios y políticas RLS de PostgreSQL.
- La combinación `(pulse_id, anonymous_id)` es única. El servidor deriva el UUID mediante HMAC por pulso, por lo que ni la base de datos ni el profesor pueden correlacionar el mismo navegador entre rondas.
- Cada pulso acepta como máximo 500 respuestas. Cada clase admite hasta seis pulsos y exige al menos una respuesta aceptada antes de abrir el siguiente.
- Cada huella de red diaria tiene un límite de 80 intentos por pulso y ventana de 15 minutos; duplicados y rechazos también consumen la cuota. La huella es un HMAC de corta vida calculado con un secreto dedicado; nunca se almacena la IP.
- No existe ninguna clave privilegiada en el frontend.
- La Edge Function de análisis valida JWT, propiedad de la sesión y pertenencia del pulso. Análisis, snapshot y caché usan únicamente respuestas de ese `pulse_id`; `OPENAI_API_KEY` vive solo en secretos de Supabase.
- Las dudas se tratan como datos no confiables para reducir prompt injection, y los conteos del mapa se derivan en servidor de referencias reales.
- La Edge Function de artefactos valida además el rol docente, proyecta sólo agregados y mapas vigentes, elimina evidencia y textos individuales, usa `store:false` y rechaza salidas con correos, UUID, URLs o secretos.
- Borradores, intervenciones y comparaciones nunca publican, moderan, califican ni cambian visibilidad. Aplicar un borrador conserva `questions_published` y sólo prepara el formulario local.

El identificador usado para responder es un UUID aleatorio guardado en `localStorage`. Antes de guardar una respuesta, el servidor genera otro UUID seudónimo específico para ese pulso. La cuenta del portal no participa en este proceso y la comparación antes/después es estrictamente agregada. Borrar el almacenamiento o cambiar de navegador genera otro identificador local, por eso el servidor conserva además límites por red, pulso y capacidad total.

Al validar Turnstile, la Edge Function envía a Cloudflare el token y, cuando está disponible, la dirección de red para la comprobación antiabuso. ClassSignal no guarda la IP en sus tablas: conserva únicamente una huella HMAC diaria no reversible para aplicar límites. En una publicación institucional, refleja este procesador también en el aviso de privacidad de la organización.

Turnstile, el límite de red y la capacidad total reducen automatizaciones y abuso, pero no prueban que cada envío corresponda a una persona. Para cursos masivos o códigos publicados fuera del aula, considera además tickets de participación firmados y de corta duración.

El costo mostrado es una estimación histórica calculada con la tarifa Luna capturada en la ejecución (`US$1/M` tokens de entrada, `US$0.10/M` en caché y `US$6/M` de salida, incluidos los multiplicadores documentados para contextos de más de 272K tokens). La factura oficial de OpenAI sigue siendo la fuente definitiva.

## Solución de problemas

### Aparece “Conecta tu proyecto de Supabase”

Revisa que `.env.local` exista, que la URL incluya `https://` y que la publishable key esté completa. Después reinicia `npm run dev`.

### El Magic Link redirige al lugar equivocado o muestra una URL no permitida

Verifica **Site URL** y la lista de **Redirect URLs** en Supabase Auth. Protocolo, dominio, puerto y ruta deben coincidir con `emailRedirectTo`. Registra la raíz `/estudiante` y su variante `/estudiante/**` tanto en desarrollo como en producción. El comodín debe quedar limitado a esa ruta, nunca a todo el dominio.

### No llega el Magic Link

Revisa spam, que Email y **Allow new users to sign up** estén habilitados, la plantilla de Magic Link, los logs de Auth y el proveedor SMTP. Espera antes de solicitar otro correo: Supabase o el proveedor pueden aplicar un límite temporal. Un mensaje de éxito en la interfaz no confirma por sí solo que el proveedor haya entregado el correo.

### El código del curso aparece como inválido o cerrado

El portal muestra el mismo mensaje para un código inexistente, mal escrito o con matrículas cerradas. Confirma que estás usando el código permanente del **curso**, no el código de una clase; normalízalo a mayúsculas y revisa `courses.enrollment_open` desde el panel docente. Esta respuesta genérica es deliberada y evita enumerar cursos.

### La cuenta abre el panel equivocado o muestra “Rol no autorizado”

Comprueba que exista una fila propia en `public.profiles` y que su rol sea `student` o `professor` según corresponda. Las cuentas nuevas son estudiantes. Promueve profesores solo desde SQL Editor o una herramienta administrativa con privilegios; cambiar metadatos del usuario no concede acceso. Después cierra la sesión local y vuelve a entrar para recargar el perfil.

### La clase anterior no muestra resumen, recursos o muro

Una clase finalizada no se publica automáticamente. El profesor debe guardar una publicación con resumen; los recursos son opcionales y el muro archivado requiere activar explícitamente la publicación de dudas. Solo aparecen preguntas con texto aprobadas antes de guardar esa versión. Las dudas posteriores permanecen privadas hasta que el profesor las modere y vuelva a guardar. Si no existe publicación, el portal muestra la clase anterior sin inventar contenido.

### Errores encontrados y resueltos en el portal estudiantil

| Error detectado | Corrección aplicada |
| --- | --- |
| Una cuenta nueva podía heredar capacidades docentes del flujo anterior | Los roles ahora son propiedad del servidor; toda cuenta nueva nace como estudiante y un profesor requiere promoción administrativa |
| Una operación lenta de publicación podía actualizar la clase equivocada al cambiar de ruta | Cada lectura, guardado y retirada se valida contra el identificador de la clase todavía visible |
| Un fallo al leer la publicación se confundía con “Sin publicar” y permitía sobrescribir datos | El editor queda bloqueado y ofrece reintento hasta confirmar el estado real en Supabase |
| Preguntas futuras podían aparecer solas en un archivo ya publicado | Las dudas nacen privadas y cada guardado crea una instantánea de las aprobadas en ese momento |
| Guardar y retirar una publicación podía ejecutarse a la vez | El formulario y la confirmación comparten un bloqueo de operación y la confirmación recupera el foco del teclado |
| Un Magic Link iniciado desde una clase protegida perdía el destino original | El enlace conserva únicamente rutas validadas bajo `/estudiante` y rechaza redirecciones externas |
| Reactivar una clase con seis pulsos siempre terminaba en un error del servidor | La interfaz detecta el límite, bloquea la acción y propone crear una clase nueva |
| El preview de Cloudflare no iniciaba porque una constante se exportaba como entrada RPC del worker | La ruta de configuración quedó privada al módulo; solo las funciones válidas permanecen como exports del worker |
| El asesor marcaba las matrículas con RLS pero sin una política visible | Se añadió una política explícita que deniega todo acceso directo; las matrículas siguen disponibles únicamente mediante RPC estrechas |
| La tabla privada de intentos de matrícula no tenía una clave primaria | Cada intento recibe ahora un identificador interno estable sin exponerlo al cliente |
| Una finalización podía ocurrir entre las lecturas de caché y pendiente y reservar trabajo duplicado | Reserva y finalización de artefactos toman el mismo bloqueo transaccional por objetivo |
| Un borrador podía parecer vigente mientras sus fuentes aún cargaban o cambiaban durante la generación | La aplicación falla cerrada hasta cargar todas las fuentes y compara su última modificación con un límite conservador guardado en servidor |
| Un mapa nuevo podía conservar la etiqueta visual del concepto anterior al regenerar | La selección se reconcilia con el `source_analysis_id` realmente usado por el servidor |
| Una intervención obsoleta todavía permitía abrir el siguiente pulso | La acción queda bloqueada hasta regenerar con el mapa vigente |
| Consultar un historial global acotado podía omitir el mapa de un pulso antiguo | La función obtiene exactamente el último mapa completado de cada pulso |
| Una clave ausente podía consumir cuota sin llamar a OpenAI | La configuración se valida antes de reservar una fila de trabajo pagado |
| El historial remoto de migraciones no coincidía con todos los archivos locales antiguos | El despliegue aplica y verifica únicamente la migración nueva; no se usa `db push` a ciegas ni se repara historia sin auditarla |

### Catálogo operativo de errores del portal

| Señal interna o síntoma | Significado seguro | Acción operativa |
| --- | --- | --- |
| `course_enrollment_unavailable` | Código inválido o matrículas cerradas | Verificar el código de curso y `enrollment_open`; no revelar cuál de las dos causas ocurrió |
| `student_role_required` | La sesión no pertenece a un estudiante | Cerrar sesión, revisar `public.profiles` y volver a autenticar |
| `course_not_found` | El curso no existe para ese docente o no le pertenece | Confirmar la cuenta docente y el identificador del curso sin desactivar RLS |
| Perfil no disponible | Falta o no pudo leerse la fila propia de `profiles` | Confirmar que la migración y el trigger se aplicaron; reparar la fila desde administración |
| Clase sin publicación | No hay resumen publicado todavía | Publicar desde el panel docente; no consultar directamente `responses` como sustituto |
| Magic Link rechazado | Destino fuera de la allowlist, enlace vencido/usado o límite de correo | Revisar Redirect URLs y logs de Auth; solicitar un enlace nuevo una sola vez |

### Aparece “relation does not exist”, “function not found” o un error de permisos

Confirma que la migración completa se ejecutó sin errores en el mismo proyecto indicado por `VITE_SUPABASE_URL`. Las tablas, la RPC, los `GRANT` y las políticas RLS forman una sola versión del esquema.

### El panel permanece en “Conectando”

Comprueba que `public.responses` esté en `supabase_realtime`, que el profesor continúe autenticado y que el navegador permita WebSockets. El botón de actualizar realiza una consulta manual mientras revisas la conexión.

### “El análisis con IA aún no está configurado”

Añade `OPENAI_API_KEY` en **Supabase > Edge Functions > Secrets**. No la añadas a las variables públicas del sitio. No es necesario volver a compilar el frontend después de guardar el secreto.

### El borrador o la intervención aparece desactualizado

Llegó una señal, cambió un pulso, se completó un mapa o cambió el contexto después del límite temporal registrado por el artefacto. Es una protección conservadora: regenera antes de aplicar el borrador o abrir la siguiente medición. Si una generación anterior sigue pendiente, usa **Revisar estado**; después de diez minutos el servidor puede cerrarla de forma segura y permitir otro intento.

### El copiloto informa un límite de IA

Las reservas de mapas, borradores e intervenciones comparten cuotas. Espera hasta salir de la ventana horaria o diaria; no aumentes el límite desde el cliente. Caché válida se devuelve antes de cobrar cuota. Si el límite aparece sin llamadas reales, verifica la credencial y los logs: una configuración faltante se valida antes de reservar trabajo.

### El copiloto rechaza modelo, esfuerzo o formato

Confirma que `OPENAI_MODEL_ROUTINE=gpt-5.6-luna`, que el borrador use `medium` y la intervención `high`. El backend no cae automáticamente a modelos más caros. Una salida incompleta, un rechazo del proveedor, un timeout de 110 segundos o una estructura fuera del schema queda como error seguro; el navegador nunca recibe el cuerpo interno de OpenAI.

### OpenAI rechaza la credencial o aplica un límite temporal

Verifica que la key esté activa, tenga acceso a `gpt-5.6-luna` y que el proyecto de OpenAI tenga capacidad disponible. El historial registra el intento como fallido sin guardar detalles sensibles del proveedor; puedes volver a intentarlo desde el panel.

### El estudiante recibe “Ya respondiste este pulso”

Es el comportamiento esperado para un segundo envío desde el mismo perfil y pulso. El mismo navegador sí puede responder cuando el profesor abre la ronda siguiente. Para simular varios participantes en un solo pulso utiliza navegadores o perfiles separados.

### El estudiante no detecta el pulso nuevo

Comprueba que la migración de `session_pulses`, la versión actual de `get_public_session` y el frontend se desplegaron juntos. La pantalla pública vuelve a consultar cada cinco segundos; revisa en la respuesta que cambien `active_pulse_id` y `active_pulse_ordinal`. Una pestaña con un frontend anterior no comprende ese contrato y debe recargarse después del despliegue.

### El estudiante recibe un error de política o la sesión aparece cerrada

Comprueba en el panel docente que la sesión y el pulso mostrado sigan activos y que `submit-response` esté desplegada con `verify_jwt=false`. La función distingue una sesión finalizada, un pulso ya cerrado y la ausencia de pulso activo; en todos esos casos rechaza una pestaña antigua en lugar de reasignar la respuesta a otra ronda.

### Aparece “Envío seguro no disponible”

Comprueba que `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAMES` y un `RESPONSE_HMAC_SECRET` base64url de al menos 43 caracteres existan en **Supabase > Edge Functions > Secrets**. Verifica también que el hostname actual esté autorizado en el widget. Los secretos están disponibles inmediatamente al guardarlos; despliega además la versión de `submit-response` que valida Turnstile.

### El QR abre `localhost` en el teléfono

`localhost` en el teléfono apunta al propio teléfono. Para una prueba dentro de la misma red:

1. ejecuta `npm run dev -- --host`;
2. define `VITE_PUBLIC_APP_URL` con el origen LAN del computador, por ejemplo `http://192.168.1.50:5173`;
3. reinicia Vite y permite el acceso en el firewall local.

No uses esa dirección de ejemplo literalmente; reemplázala por la IP local real del equipo.

### El seed no crea la sesión `AULA24`

Crea primero un perfil docente mediante Supabase Auth y promoción administrativa, y aplica todas las migraciones, incluida la que crea `public.session_pulses`. Si hay varios profesores, la sesión pertenece al perfil docente más antiguo. Comprueba que `AULA24` tenga un pulso con `ordinal = 1`; el seed no inventa uno si el trigger no se ejecutó. Revisa también los avisos del SQL Editor por una posible colisión previa del código o del identificador de demo.

## Guion corto de demostración

1. El profesor entra a ClassSignal y crea un curso.
2. Desde el curso inicia una clase en menos de un minuto.
3. Proyecta el QR y el código corto.
4. Un estudiante responde Pulso 1 desde su teléfono sin registrarse.
5. El panel cambia en vivo; el profesor comparte dudas y pulsa **Analizar pulso** para orientar una explicación breve.
6. El profesor abre Pulso 2. El código y el QR no cambian, el muro comienza oculto y el mismo estudiante puede responder otra vez.
7. El panel muestra la distribución de Pulso 2 y el cambio en puntos porcentuales frente a Pulso 1; muro, proyector y análisis permanecen acotados a la ronda seleccionada.
8. El profesor finaliza la clase: se cierra el pulso activo, se bloquean nuevas respuestas y la RPC pública deja de mostrar el muro.
