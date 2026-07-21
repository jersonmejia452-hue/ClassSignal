# Evaluaciones de artefactos docentes

Este directorio contiene un conjunto pequeño y autocontenido de evaluaciones
para `publication_draft` y `micro_intervention`. No importa el handler de
producción y no consulta Supabase: los fixtures ya contienen únicamente la
proyección agregada que puede llegar al modelo.

## Seguridad y costo

El runner real está bloqueado salvo que se cumplan simultáneamente estas
condiciones:

- no se detecta un entorno de CI;
- `RUN_OPENAI_EVALS` vale exactamente `1`;
- `OPENAI_API_KEY` está disponible en el proceso.

No existe fallback de modelo. El valor predeterminado es `gpt-5.6-luna`; una
comparación intencional puede seleccionar otro modelo con `OPENAI_EVAL_MODEL`.
Cada solicitud usa Responses API, `store:false`, Structured Outputs estricto y
no incluye `metadata`, `user`, `safety_identifier` ni identificadores de
ClassSignal.

El fixture de PII usa datos totalmente sintéticos bajo `excluded_source_data`.
Una proyección por allowlist los elimina antes de construir el request y una
comprobación local cancela el caso si detecta correos, UUID o marcadores
privados. Los artefactos guardados en JSONL vuelven a redactar esos patrones
como defensa adicional.

## Cobertura offline

`fixtures.json` cubre:

- comprensión alta;
- confusión crítica;
- una sola respuesta;
- respuestas sin texto;
- preguntas contradictorias;
- prompt injection dentro de datos académicos;
- contenido insuficiente;
- materias distintas;
- una duda original con posible PII sintética.

La matriz actual expande esos fixtures a ambos tipos de artefacto cuando existe
un concepto válido para una microintervención. Los casos sin concepto solo
evalúan el borrador y deben reconocer la falta de evidencia.

## Pruebas offline

Estas pruebas no usan red ni requieren secretos:

```powershell
node --test .\supabase\functions\generate-session-artifact\evals\offline.test.mjs
```

Verifican cobertura, proyección de privacidad, esquemas estrictos, validación
semántica, métricas deterministas, extracción de Responses API y los bloqueos de
CI.

## Runner real (opt-in)

Ejemplo de una ejecución acotada en PowerShell, usando una clave ya cargada en
el entorno seguro de desarrollo:

```powershell
$env:RUN_OPENAI_EVALS = "1"
node .\supabase\functions\generate-session-artifact\evals\run-openai-evals.mjs `
  --case critical-confusion-chemistry `
  --kind micro_intervention
```

Sin filtros se ejecutan todos los pares fixture/tipo. Opciones disponibles:

```text
--case <id>       Repetible; selecciona fixtures concretos
--kind <kind>     publication_draft o micro_intervention
--limit <n>       Limita la matriz expandida
--output <path>   Archivo JSONL nuevo; use - para stdout
```

Configuración opcional:

```text
OPENAI_EVAL_MODEL                  Predomina sobre OPENAI_MODEL_ROUTINE
OPENAI_MODEL_ROUTINE               Modelo de rutina compartido con el backend
OPENAI_EVAL_REASONING_EFFORT       Sobrescribe medium (borrador) / high (intervención)
OPENAI_EVAL_MAX_OUTPUT_TOKENS      256–8000; por defecto 3200/4500 según el tipo
OPENAI_EVAL_TIMEOUT_MS             1000–180000; valor inicial 110000
```

Por defecto se crea `results/artifact-eval-<timestamp>.jsonl`; `results/` no se
versiona. Cada línea es un `case_result` y la última es un `run_summary`. Un
fallo de umbral devuelve código de salida 1; un error de configuración
devuelve 2.

## Métricas

- `grounding_score`: proporción de grupos de términos sustentados que aparecen
  en la salida. Es una aproximación determinista, no una evaluación semántica
  completa.
- `teacher_utility_score`: completitud, accionabilidad, comprobación y
  coherencia de duración según el tipo de artefacto.
- `invented_information_detected`: URLs, detalles concretos no autorizados,
  fragmentos prohibidos o porcentajes que no existen en el fixture.
- `valid_format`: contrato exacto y límites semánticos; en intervenciones
  también comprueba que la suma de pasos coincida con 3–5 minutos.
- `privacy_safe`: ausencia de correo, teléfono, UUID y marcadores privados en la
  salida.
- `latency_ms`, tokens y costo estimado: telemetría de la llamada real. También
  se valida la aritmética de tokens reportada por el proveedor.

El precio incorporado, con versión `openai-gpt-5.6-2026-07-21`, sigue el
catálogo oficial a esa fecha: Luna US$1/M de entrada, US$0,10/M de entrada en
caché y US$6/M de salida; Terra US$2,50/US$0,25/US$15; Sol US$5/US$0,50/US$30.
Si el proveedor informa `cache_write_tokens`, se aplica 1,25× a esas escrituras.
Los tokens de razonamiento ya forman parte de `output_tokens` y no se suman dos
veces. Para entradas superiores a 272K se aplican los multiplicadores
publicados. La factura de OpenAI sigue siendo la fuente definitiva.

Referencias oficiales:

- [Crear una respuesta](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)

## Mantenimiento

Los prompts y esquemas son deliberadamente autocontenidos para que el runner
siga siendo ejecutable mientras cambia el handler. Cuando el contrato o prompt
de producción cambie, actualice este espejo, incremente `PROMPT_VERSION` y
conserve resultados anteriores como archivos externos, no en Git.
