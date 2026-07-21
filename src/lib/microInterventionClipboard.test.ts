import { describe, expect, it } from 'vitest'

import { formatMicroInterventionForClipboard } from './microInterventionClipboard'

describe('formatMicroInterventionForClipboard', () => {
  it('incluye todas las secciones de la intervención en un texto copiable', () => {
    const intervention = {
      title: 'Reconstruir la regla de la cadena',
      objective: 'Distinguir la función exterior de la función interior.',
      duration_minutes: 4,
      explanation:
        'Modele el razonamiento en voz alta antes de pedir una respuesta grupal.',
      example: 'Derivar (2x + 1)³ empezando por identificar ambas funciones.',
      steps: [
        {
          instruction: 'Muestre el ejemplo y pida identificar la función interior.',
          duration_minutes: 1,
        },
        {
          instruction: 'Compare dos procedimientos y discutan cuál conserva la cadena.',
          duration_minutes: 2,
        },
        {
          instruction: 'Solicite una explicación breve al grupo.',
          duration_minutes: 1,
        },
      ],
      check_question: '¿Qué factor falta al derivar (3x - 2)² como 2(3x - 2)?',
      expected_answer: 'Falta multiplicar por 3, la derivada de la función interior.',
      misconception_to_watch:
        'Aplicar la potencia sin derivar la expresión interior.',
      follow_up_action:
        'Si persiste la confusión, use un diagrama de composición antes del nuevo pulso.',
    }

    expect(formatMicroInterventionForClipboard(intervention)).toBe(
      [
        'Microintervención docente',
        '',
        'Título: Reconstruir la regla de la cadena',
        'Objetivo: Distinguir la función exterior de la función interior.',
        'Duración estimada: 4 minutos',
        '',
        'Explicación breve para el profesor:',
        'Modele el razonamiento en voz alta antes de pedir una respuesta grupal.',
        '',
        'Ejemplo alternativo:',
        'Derivar (2x + 1)³ empezando por identificar ambas funciones.',
        '',
        'Pasos de la intervención:',
        '1. Muestre el ejemplo y pida identificar la función interior. (1 minuto)',
        '2. Compare dos procedimientos y discutan cuál conserva la cadena. (2 minutos)',
        '3. Solicite una explicación breve al grupo. (1 minuto)',
        '',
        'Pregunta de comprobación:',
        '¿Qué factor falta al derivar (3x - 2)² como 2(3x - 2)?',
        '',
        'Respuesta esperada:',
        'Falta multiplicar por 3, la derivada de la función interior.',
        '',
        'Error o confusión que debe observarse:',
        'Aplicar la potencia sin derivar la expresión interior.',
        '',
        'Acción recomendada según la respuesta del grupo:',
        'Si persiste la confusión, use un diagrama de composición antes del nuevo pulso.',
      ].join('\n'),
    )
  })

  it('no modifica la intervención recibida', () => {
    const intervention = {
      title: 'Título',
      objective: 'Objetivo',
      duration_minutes: 3,
      explanation: 'Explicación',
      example: 'Ejemplo',
      steps: [{ instruction: 'Primer paso', duration_minutes: 3 }],
      check_question: 'Pregunta',
      expected_answer: 'Respuesta',
      misconception_to_watch: 'Error',
      follow_up_action: 'Acción',
    }
    const original = structuredClone(intervention)

    formatMicroInterventionForClipboard(intervention)

    expect(intervention).toEqual(original)
  })
})
