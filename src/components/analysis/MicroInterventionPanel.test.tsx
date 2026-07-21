// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MicroInterventionArtifact } from '../../types/domain'
import { MicroInterventionPanel } from './MicroInterventionPanel'

const artifact: MicroInterventionArtifact = {
  id: '00000000-0000-4000-8000-000000000011',
  professor_id: '00000000-0000-4000-8000-000000000012',
  session_id: '00000000-0000-4000-8000-000000000013',
  pulse_id: '00000000-0000-4000-8000-000000000014',
  source_analysis_id: '00000000-0000-4000-8000-000000000015',
  concept_index: 0,
  kind: 'micro_intervention',
  status: 'completed',
  model: 'gpt-5.6-luna',
  reasoning_effort: 'high',
  prompt_version: 1,
  source_fingerprint: 'a'.repeat(64),
  source_captured_at: '2026-07-21T14:59:55.000Z',
  result: {
    title: 'Contrastar dos representaciones',
    objective: 'Reconocer la relación equivalente entre ambas formas.',
    duration_minutes: 3,
    explanation: 'Presenta las dos formas y pide al grupo justificar la equivalencia.',
    example: 'Usa una representación numérica y otra visual del mismo caso.',
    steps: [
      { instruction: 'Presenta ambas representaciones.', duration_minutes: 1 },
      { instruction: 'Pide una comparación en parejas.', duration_minutes: 1 },
      { instruction: 'Recoge una justificación colectiva.', duration_minutes: 1 },
    ],
    check_question: '¿Qué relación permite afirmar que ambas formas son equivalentes?',
    expected_answer: 'Representan la misma cantidad aunque usen una forma distinta.',
    misconception_to_watch: 'Comparar sólo la apariencia sin comprobar la cantidad.',
    follow_up_action: 'Si persiste la duda, muestra un caso más simple y vuelve a comprobar.',
  },
  error_code: null,
  error_message: null,
  input_tokens: 100,
  cached_input_tokens: 0,
  output_tokens: 80,
  reasoning_tokens: 20,
  total_tokens: 180,
  estimated_cost_usd: 0.001,
  pricing_version: 'test',
  duration_ms: 500,
  provider_request_id: null,
  provider_response_id: 'resp_test',
  created_at: '2026-07-21T15:00:00.000Z',
  completed_at: '2026-07-21T15:00:01.000Z',
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: true })),
  })
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

describe('MicroInterventionPanel', () => {
  it('copia la orientación completa y mantiene acciones mobile-first', async () => {
    const user = userEvent.setup()
    render(
      <MicroInterventionPanel
        artifact={artifact}
        conceptLabel="Equivalencia"
        error={null}
        hasTimedOutPending={false}
        history={[artifact]}
        inProgress={false}
        isGenerating={false}
        isLoading={false}
        isOpeningPulse={false}
        isOutdated={false}
        lastInvocationWasCached={false}
        onOpenNextPulse={vi.fn().mockResolvedValue(true)}
        onRefresh={vi.fn()}
        onRegenerate={vi.fn()}
        openDisabledReason="Esta clase ya alcanzó el máximo de seis pulsos."
        openPulseError={null}
        showOpenPulseAction
      />,
    )

    const copyButton = screen.getByRole('button', { name: 'Copiar intervención' })
    expect(copyButton).toHaveClass('w-full', 'sm:w-auto')
    await user.click(copyButton)

    await waitFor(() => expect(screen.getByRole('button', {
      name: 'Intervención copiada',
    })).toBeInTheDocument())
    const copied = await navigator.clipboard.readText()
    expect(copied).toContain(artifact.result!.title)
    expect(copied).toContain(artifact.result!.check_question)
    expect(screen.getByRole('button', { name: 'Abrir nuevo pulso' })).toBeDisabled()
    expect(screen.getByText(/máximo de seis pulsos/i)).toBeInTheDocument()
  })
})
