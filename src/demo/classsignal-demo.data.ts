import type {
  ClassSession,
  Course,
  CoursePulsePoint,
  SessionAnalysis,
  SessionPulse,
  StudentResponse,
  UnderstandingStatus,
} from '../types/domain'

export const DEMO_COURSE: Course = {
  id: '00000000-0000-4000-8000-000000000010',
  professor_id: '00000000-0000-4000-8000-000000000020',
  name: 'Cálculo Vectorial · Grupo 01',
  subject: 'Cálculo vectorial',
  description:
    'Escenario de demostración para observar cómo evoluciona la comprensión del curso.',
  enrollment_code: 'A2B3C4DF',
  enrollment_open: true,
  created_at: '2026-06-20T15:00:00.000Z',
  updated_at: '2026-06-20T15:00:00.000Z',
}

export const DEMO_SESSION: ClassSession = {
  id: '00000000-0000-4000-8000-000000000011',
  professor_id: DEMO_COURSE.professor_id,
  course_id: DEMO_COURSE.id,
  code: 'CALC24',
  title: 'Introducción a los vectores',
  subject: DEMO_COURSE.subject,
  topic:
    'Vectores, magnitud, dirección, componentes y una primera aproximación al producto punto.',
  is_active: true,
  questions_visible_to_students: false,
  created_at: '2026-06-23T16:00:00.000Z',
  updated_at: '2026-06-23T16:00:00.000Z',
  ended_at: null,
}

export const DEMO_PULSE_ONE: SessionPulse = {
  id: '00000000-0000-4000-8000-000000000031',
  session_id: DEMO_SESSION.id,
  ordinal: 1,
  is_active: false,
  questions_visible_to_students: false,
  started_at: '2026-06-23T16:00:00.000Z',
  ended_at: '2026-06-23T16:35:00.000Z',
}

export const DEMO_PULSE_TWO: SessionPulse = {
  id: '00000000-0000-4000-8000-000000000032',
  session_id: DEMO_SESSION.id,
  ordinal: 2,
  is_active: true,
  questions_visible_to_students: false,
  started_at: '2026-06-23T16:36:00.000Z',
  ended_at: null,
}

export const DEMO_PULSES: readonly SessionPulse[] = [
  DEMO_PULSE_ONE,
  DEMO_PULSE_TWO,
]

export const DEMO_SIGNAL_TIMESTAMP = '2026-06-23T16:30:00.000Z'
export const DEMO_SECOND_SIGNAL_TIMESTAMP = '2026-06-23T16:43:00.000Z'

export const DEMO_BASE_RESPONSES: readonly StudentResponse[] = [
  demoResponse(
    1,
    'understood',
    null,
    '2026-06-23T16:29:00.000Z',
  ),
  demoResponse(
    2,
    'understood',
    'Entendí que la magnitud no depende de dónde dibujo el vector.',
    '2026-06-23T16:28:00.000Z',
  ),
  demoResponse(
    3,
    'understood',
    null,
    '2026-06-23T16:27:00.000Z',
  ),
  demoResponse(
    4,
    'understood',
    '¿Un vector unitario siempre tiene magnitud uno?',
    '2026-06-23T16:26:00.000Z',
  ),
  demoResponse(
    5,
    'understood',
    null,
    '2026-06-23T16:25:00.000Z',
  ),
  demoResponse(
    6,
    'understood',
    'El ejemplo de desplazamiento me ayudó a diferenciar vector y escalar.',
    '2026-06-23T16:24:00.000Z',
  ),
  demoResponse(
    7,
    'understood',
    null,
    '2026-06-23T16:23:00.000Z',
  ),
  demoResponse(
    8,
    'question',
    'No entiendo qué diferencia a un vector de una magnitud escalar.',
    '2026-06-23T16:22:00.000Z',
  ),
  demoResponse(
    9,
    'question',
    '¿Cómo sé hacia dónde apunta un vector si solo veo sus componentes?',
    '2026-06-23T16:21:00.000Z',
  ),
  demoResponse(
    10,
    'question',
    '¿Por qué las componentes pueden ser negativas y la magnitud no?',
    '2026-06-23T16:20:00.000Z',
  ),
  demoResponse(
    11,
    'question',
    '¿La fórmula de magnitud cambia cuando estamos en R3?',
    '2026-06-23T16:19:00.000Z',
  ),
  demoResponse(
    12,
    'question',
    '¿El producto punto devuelve un número u otro vector?',
    '2026-06-23T16:18:00.000Z',
  ),
  demoResponse(
    13,
    'question',
    'No veo cómo se relaciona el ángulo con el producto punto.',
    '2026-06-23T16:17:00.000Z',
  ),
  demoResponse(
    14,
    'question',
    '¿Podemos dibujar el vector (3, 4) paso a paso?',
    '2026-06-23T16:16:00.000Z',
  ),
  demoResponse(
    15,
    'lost',
    'Me perdí cuando pasamos de la flecha a la notación por componentes.',
    '2026-06-23T16:15:00.000Z',
  ),
  demoResponse(
    16,
    'lost',
    'Confundo las coordenadas de un punto con las componentes de un vector.',
    '2026-06-23T16:14:00.000Z',
  ),
  demoResponse(
    17,
    'lost',
    'No entiendo la diferencia entre dirección y sentido.',
    '2026-06-23T16:13:00.000Z',
  ),
  demoResponse(
    18,
    'lost',
    'Desde la fórmula de magnitud ya no sé qué estamos calculando.',
    '2026-06-23T16:12:00.000Z',
  ),
  demoResponse(
    19,
    'lost',
    'No entendí por qué aparece el coseno en el producto punto.',
    '2026-06-23T16:11:00.000Z',
  ),
]

export interface DemoSignalDraft {
  status: UnderstandingStatus
  questionText?: string | null
  createdAt?: string
}

export const DEMO_DEFAULT_SIGNAL: DemoSignalDraft = {
  status: 'question',
  questionText:
    '¿Cómo se conectan las componentes con la dirección del vector?',
}

export const DEMO_SECOND_PULSE_DEFAULT_SIGNAL: DemoSignalDraft = {
  status: 'understood',
  questionText: null,
}

export function createDemoResponses({
  status,
  questionText,
  createdAt = DEMO_SIGNAL_TIMESTAMP,
}: DemoSignalDraft): StudentResponse[] {
  const normalizedQuestion = questionText?.trim() || null

  return [
    {
      id: '00000000-0000-4000-8000-000000000120',
      session_id: DEMO_SESSION.id,
      pulse_id: DEMO_PULSE_ONE.id,
      anonymous_id: '10000000-0000-4000-8000-000000000120',
      status,
      question_text: normalizedQuestion,
      is_visible_to_students: Boolean(normalizedQuestion),
      created_at: createdAt,
    },
    ...DEMO_BASE_RESPONSES,
  ]
}

const DEMO_SECOND_PULSE_BLUEPRINT = [
  ['understood', null],
  ['understood', 'Ahora veo que las componentes describen el desplazamiento en cada eje.'],
  ['understood', null],
  ['understood', 'El triángulo con (3, 4) aclaró de dónde sale la magnitud.'],
  ['understood', null],
  ['understood', null],
  ['understood', 'Cambiar el signo modifica la dirección, no la longitud.'],
  ['understood', null],
  ['understood', null],
  ['understood', 'Ya distingo un punto de un vector por el contexto.'],
  ['understood', null],
  ['understood', null],
  ['understood', 'La comparación visual me ayudó a conectar flecha y componentes.'],
  ['question', 'Todavía dudo cuándo conviene normalizar un vector.'],
  ['question', '¿El sentido cambia siempre que una componente cambia de signo?'],
  ['question', '¿Podemos repetir el ejemplo en tres dimensiones?'],
  ['question', null],
  ['lost', 'Aún confundo la dirección del vector con el ángulo medido desde el eje.'],
  ['lost', null],
] as const satisfies readonly (readonly [UnderstandingStatus, string | null])[]

export const DEMO_SECOND_PULSE_BASE_RESPONSES: readonly StudentResponse[] =
  DEMO_SECOND_PULSE_BLUEPRINT.map(([responseStatus, responseQuestion], index) =>
    demoResponse(
      index + 21,
      responseStatus,
      responseQuestion,
      new Date(
        Date.parse('2026-06-23T16:42:30.000Z') - index * 20_000,
      ).toISOString(),
      DEMO_PULSE_TWO.id,
    ),
  )

export function createDemoSecondPulseResponses({
  status,
  questionText,
  createdAt = DEMO_SECOND_SIGNAL_TIMESTAMP,
}: DemoSignalDraft): StudentResponse[] {
  const normalizedQuestion = questionText?.trim() || null

  return [
    {
      id: '00000000-0000-4000-8000-000000000220',
      session_id: DEMO_SESSION.id,
      pulse_id: DEMO_PULSE_TWO.id,
      anonymous_id: '20000000-0000-4000-8000-000000000220',
      status,
      question_text: normalizedQuestion,
      is_visible_to_students: Boolean(normalizedQuestion),
      created_at: createdAt,
    },
    ...DEMO_SECOND_PULSE_BASE_RESPONSES,
  ]
}

export const DEMO_ANALYSIS: SessionAnalysis = {
  id: '00000000-0000-4000-8000-000000000210',
  session_id: DEMO_SESSION.id,
  pulse_id: DEMO_PULSE_ONE.id,
  professor_id: DEMO_COURSE.professor_id,
  status: 'completed',
  model: 'gpt-5.6-luna · resultado de ejemplo',
  prompt_version: 1,
  response_count: 20,
  source_latest_response_at: DEMO_SIGNAL_TIMESTAMP,
  result: {
    overview:
      'La clase muestra una comprensión inicial de la importancia de la dirección y la magnitud, pero persisten dudas fundacionales sobre qué es un vector, cómo se representa y cómo se relacionan sus componentes con la magnitud, la dirección y el producto punto. Conviene reforzar primero el lenguaje y las representaciones antes de avanzar a más operaciones.',
    confusion_level: 'high',
    concepts: [
      {
        concept: 'Qué es un vector y cómo se representa',
        explanation:
          'Parte del grupo aún mezcla vectores con escalares, puntos o flechas dibujadas sin conectar esas representaciones entre sí.',
        severity: 'high',
        affected_students: 9,
        evidence: [
          'No entiendo qué diferencia a un vector de una magnitud escalar.',
          'Me perdí cuando pasamos de la flecha a la notación por componentes.',
          'Confundo las coordenadas de un punto con las componentes de un vector.',
        ],
      },
      {
        concept: 'Componentes, magnitud y dirección',
        explanation:
          'Las componentes todavía se perciben como números aislados y no como información que determina la longitud y orientación del vector.',
        severity: 'high',
        affected_students: 8,
        evidence: [
          '¿Cómo sé hacia dónde apunta un vector si solo veo sus componentes?',
          '¿Por qué las componentes pueden ser negativas y la magnitud no?',
          'No entiendo la diferencia entre dirección y sentido.',
        ],
      },
      {
        concept: 'Producto punto y significado geométrico',
        explanation:
          'La fórmula del producto punto todavía no está conectada con el ángulo entre vectores ni con el hecho de que su resultado sea un escalar.',
        severity: 'medium',
        affected_students: 5,
        evidence: [
          '¿El producto punto devuelve un número u otro vector?',
          'No veo cómo se relaciona el ángulo con el producto punto.',
          'No entendí por qué aparece el coseno en el producto punto.',
        ],
      },
    ],
    recommendations: [
      {
        title: 'Reconstruir el concepto desde una flecha',
        action:
          'Dedica tres minutos a comparar un escalar, un punto y un vector sobre el mismo plano, nombrando explícitamente qué información conserva cada representación.',
        priority: 'now',
      },
      {
        title: 'Conectar componentes con magnitud y dirección',
        action:
          'Resuelve visualmente el ejemplo (3, 4), muestra por qué su magnitud es 5 y contrasta qué cambia al invertir el signo de una componente.',
        priority: 'next',
      },
      {
        title: 'Introducir el producto punto de forma geométrica',
        action:
          'Antes de volver a la fórmula, compara vectores paralelos, perpendiculares y opuestos para anticipar el signo y el valor del producto punto.',
        priority: 'later',
      },
    ],
  },
  error_message: null,
  input_tokens: null,
  cached_input_tokens: null,
  output_tokens: null,
  reasoning_tokens: null,
  total_tokens: null,
  estimated_cost_usd: null,
  pricing_version: null,
  duration_ms: null,
  provider_request_id: null,
  provider_response_id: null,
  created_at: '2026-06-23T16:31:00.000Z',
  completed_at: '2026-06-23T16:31:05.000Z',
}

export const DEMO_PULSE_HISTORY: readonly CoursePulsePoint[] = [
  {
    session_id: DEMO_SESSION.id,
    title: DEMO_SESSION.title,
    created_at: '2026-06-23T16:00:00.000Z',
    is_active: false,
    response_count: 20,
    understood_count: 14,
    question_count: 4,
    lost_count: 2,
  },
  {
    session_id: '00000000-0000-4000-8000-000000000012',
    title: 'Componentes y vectores unitarios',
    created_at: '2026-06-30T16:00:00.000Z',
    is_active: false,
    response_count: 20,
    understood_count: 15,
    question_count: 3,
    lost_count: 2,
  },
  {
    session_id: '00000000-0000-4000-8000-000000000013',
    title: 'Operaciones con vectores',
    created_at: '2026-07-07T16:00:00.000Z',
    is_active: false,
    response_count: 20,
    understood_count: 16,
    question_count: 3,
    lost_count: 1,
  },
  {
    session_id: '00000000-0000-4000-8000-000000000014',
    title: 'Producto punto e interpretación geométrica',
    created_at: '2026-07-14T16:00:00.000Z',
    is_active: false,
    response_count: 20,
    understood_count: 17,
    question_count: 2,
    lost_count: 1,
  },
]

function demoResponse(
  index: number,
  status: UnderstandingStatus,
  questionText: string | null,
  createdAt: string,
  pulseId = DEMO_PULSE_ONE.id,
): StudentResponse {
  const suffix = index.toString().padStart(3, '0')

  return {
    id: `00000000-0000-4000-8000-000000000${suffix}`,
    session_id: DEMO_SESSION.id,
    pulse_id: pulseId,
    anonymous_id: `10000000-0000-4000-8000-000000000${suffix}`,
    status,
    question_text: questionText,
    is_visible_to_students: Boolean(questionText),
    created_at: createdAt,
  }
}
