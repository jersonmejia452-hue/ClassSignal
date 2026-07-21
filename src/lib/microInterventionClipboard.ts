export interface MicroInterventionClipboardInput {
  title: string
  objective: string
  duration_minutes: number
  explanation: string
  example: string
  steps: readonly {
    instruction: string
    duration_minutes: number
  }[]
  check_question: string
  expected_answer: string
  misconception_to_watch: string
  follow_up_action: string
}

function formatMinutes(value: number) {
  return `${value} ${value === 1 ? 'minuto' : 'minutos'}`
}

export function formatMicroInterventionForClipboard(
  intervention: MicroInterventionClipboardInput,
) {
  const steps = intervention.steps.map(
    (step, index) =>
      `${index + 1}. ${step.instruction} (${formatMinutes(step.duration_minutes)})`,
  )

  return [
    'Microintervención docente',
    '',
    `Título: ${intervention.title}`,
    `Objetivo: ${intervention.objective}`,
    `Duración estimada: ${formatMinutes(intervention.duration_minutes)}`,
    '',
    'Explicación breve para el profesor:',
    intervention.explanation,
    '',
    'Ejemplo alternativo:',
    intervention.example,
    '',
    'Pasos de la intervención:',
    ...steps,
    '',
    'Pregunta de comprobación:',
    intervention.check_question,
    '',
    'Respuesta esperada:',
    intervention.expected_answer,
    '',
    'Error o confusión que debe observarse:',
    intervention.misconception_to_watch,
    '',
    'Acción recomendada según la respuesta del grupo:',
    intervention.follow_up_action,
  ].join('\n')
}
