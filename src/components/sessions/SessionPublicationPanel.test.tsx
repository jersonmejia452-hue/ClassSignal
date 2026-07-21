// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import type { SessionPublicationDraft } from '../../types/domain'

const {
  generateArtifactMock,
  refreshMock,
  useSessionAiArtifactsMock,
} = vi.hoisted(() => ({
  generateArtifactMock: vi.fn(),
  refreshMock: vi.fn(),
  useSessionAiArtifactsMock: vi.fn(),
}))

vi.mock('../../hooks/useSessionAiArtifacts', () => ({
  useSessionAiArtifacts: useSessionAiArtifactsMock,
}))

import { SessionPublicationPanel } from './SessionPublicationPanel'

afterEach(cleanup)

const sessionId = '00000000-0000-4000-8000-000000000002'
const publication = {
  session_id: sessionId,
  summary: 'Resumen escrito por la profesora.',
  resources: 'Material seleccionado por la profesora.',
  questions_published: true,
  published_at: '2026-07-20T10:00:00.000Z',
  updated_at: '2026-07-20T10:00:00.000Z',
}
const artifact = {
  id: '00000000-0000-4000-8000-000000000099',
  session_id: sessionId,
  kind: 'publication_draft',
  status: 'completed',
  source_captured_at: '2026-07-21T09:59:55.000Z',
  created_at: '2026-07-21T10:00:00.000Z',
  result: {
    summary: 'El grupo practicó la regla de la cadena con funciones compuestas.',
    resources_and_next_steps: 'Resolver dos ejercicios equivalentes y comprobar el procedimiento.',
    review_notes: [{
      field: 'resources',
      message: 'Confirma que este tipo de ejercicio corresponde a lo visto.',
    }],
  },
}

function setArtifactHookState(overrides: Record<string, unknown> = {}) {
  useSessionAiArtifactsMock.mockReturnValue({
    artifacts: [artifact],
    latestCompleted: artifact,
    isLoading: false,
    isGenerating: false,
    error: null,
    lastInvocationWasCached: false,
    inProgress: false,
    hasTimedOutPending: false,
    refresh: refreshMock,
    generateArtifact: generateArtifactMock,
    ...overrides,
  })
}

function renderPanel(options: {
  onRefreshSources?: Mock<() => Promise<unknown>>
  onSave?: Mock<(draft: SessionPublicationDraft) => Promise<unknown>>
  sourcesReady?: boolean
  sourceUpdatedAt?: string | null
} = {}) {
  const onSave = options.onSave ?? vi.fn(
    async (_draft: SessionPublicationDraft): Promise<unknown> => undefined,
  )
  render(
    <SessionPublicationPanel
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onRefreshSources={options.onRefreshSources}
      onSave={onSave}
      publication={publication}
      sessionId={sessionId}
      sourcesReady={options.sourcesReady}
      sourceUpdatedAt={options.sourceUpdatedAt}
    />,
  )
  return { onSave }
}

describe('SessionPublicationPanel AI draft', () => {
  beforeEach(() => {
    generateArtifactMock.mockReset()
    generateArtifactMock.mockResolvedValue({ artifact, cached: false })
    refreshMock.mockReset()
    refreshMock.mockResolvedValue(undefined)
    useSessionAiArtifactsMock.mockReset()
    setArtifactHookState()
  })

  it('confirma antes de reemplazar, preserva el muro y no guarda hasta el submit normal', async () => {
    const user = userEvent.setup()
    const { onSave } = renderPanel()
    const summary = screen.getByLabelText('Resumen de la clase')
    const resources = screen.getByLabelText('Recursos y próximos pasos')

    await user.click(screen.getByRole('button', { name: 'Aplicar al formulario' }))

    expect(screen.getByRole('region', {
      name: '¿Reemplazar el contenido local del formulario?',
    })).toBeInTheDocument()
    expect(summary).toHaveValue(publication.summary)
    expect(resources).toHaveValue(publication.resources)
    expect(onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(summary).toHaveValue(publication.summary)
    expect(resources).toHaveValue(publication.resources)

    await user.click(screen.getByRole('button', { name: 'Aplicar al formulario' }))
    await user.click(screen.getByRole('button', { name: 'Sí, aplicar localmente' }))

    expect(summary).toHaveValue(artifact.result.summary)
    expect(resources).toHaveValue(artifact.result.resources_and_next_steps)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/Todavía no se ha publicado/)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      summary: artifact.result.summary,
      resources: artifact.result.resources_and_next_steps,
      questions_published: true,
    }))
  })

  it('descartar oculta sólo la propuesta y conserva el formulario', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.queryByRole('article', { name: 'Borrador generado con IA' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Resumen de la clase')).toHaveValue(publication.summary)
    expect(screen.getByLabelText('Recursos y próximos pasos')).toHaveValue(publication.resources)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('regenerar fuerza una generación sin cambiar el formulario', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Regenerar' }))

    await waitFor(() => expect(generateArtifactMock).toHaveBeenCalledWith({
      regenerate: true,
    }))
    expect(screen.getByLabelText('Resumen de la clase')).toHaveValue(publication.summary)
    expect(screen.getByLabelText('Recursos y próximos pasos')).toHaveValue(publication.resources)
  })

  it('marca un resultado desactualizado y bloquea su aplicación', () => {
    renderPanel({ sourceUpdatedAt: '2026-07-21T10:00:01.000Z' })

    expect(screen.getByText('Desactualizado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aplicar al formulario' })).toBeDisabled()
  })

  it('falla cerrado y permite reintentar mientras las fuentes no terminan de cargar', async () => {
    const user = userEvent.setup()
    const onRefreshSources = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onRefreshSources, sourcesReady: false })

    expect(screen.getByText('Actualizando fuentes de la clase')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aplicar al formulario' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Regenerar' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Reintentar fuentes' }))
    expect(onRefreshSources).toHaveBeenCalledOnce()
  })

  it('cancela la confirmación con Escape y devuelve el foco', async () => {
    const user = userEvent.setup()
    renderPanel()
    const applyButton = screen.getByRole('button', { name: 'Aplicar al formulario' })

    await user.click(applyButton)
    expect(screen.getByRole('region', {
      name: '¿Reemplazar el contenido local del formulario?',
    })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', {
      name: '¿Reemplazar el contenido local del formulario?',
    })).not.toBeInTheDocument()
    expect(applyButton).toHaveFocus()
  })

  it('rechaza visualmente un artefacto perteneciente a otra sesión', () => {
    setArtifactHookState({
      latestCompleted: {
        ...artifact,
        session_id: '00000000-0000-4000-8000-000000000003',
      },
    })

    renderPanel()

    expect(screen.queryByText(artifact.result.summary)).not.toBeInTheDocument()
    expect(screen.getByText(/no corresponde a esta clase/i)).toBeInTheDocument()
  })
})
