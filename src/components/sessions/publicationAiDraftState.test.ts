import { describe, expect, it, vi } from 'vitest'

import {
  applyPublicationAiDraftLocally,
  createPublicationAiDraftEditorState,
  localApplicationAnnouncement,
  publicationAiDraftEditorReducer,
  publicationAiDraftNeedsConfirmation,
  type PublicationAiDraftValues,
  type PublicationFormState,
} from './publicationAiDraftState'

const emptyForm: PublicationFormState = {
  questionsPublished: false,
  resources: '',
  summary: '',
}

const proposedDraft: PublicationAiDraftValues = {
  resourcesAndNextSteps: 'Resolver dos ejercicios equivalentes y comprobar el procedimiento.',
  summary: 'El grupo practicó la regla de la cadena con funciones compuestas.',
}

describe('publicationAiDraftState', () => {
  it('aplica directamente a un formulario vacío y lo mantiene como cambio local', () => {
    const onSave = vi.fn()
    const initial = createPublicationAiDraftEditorState(emptyForm)
    const next = publicationAiDraftEditorReducer(initial, {
      type: 'request_application',
      draft: proposedDraft,
    })

    expect(next).toMatchObject({
      announcement: localApplicationAnnouncement,
      pendingApplication: null,
      questionsPublished: false,
      resources: proposedDraft.resourcesAndNextSteps,
      summary: proposedDraft.summary,
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('exige confirmación si cualquier campo actual contiene texto diferente', () => {
    expect(publicationAiDraftNeedsConfirmation({
      ...emptyForm,
      summary: 'Texto escrito por la profesora.',
    }, proposedDraft)).toBe(true)

    expect(publicationAiDraftNeedsConfirmation({
      ...emptyForm,
      resources: 'Recurso elegido por la profesora.',
      summary: proposedDraft.summary,
    }, proposedDraft)).toBe(true)

    const initial = createPublicationAiDraftEditorState({
      ...emptyForm,
      summary: 'Texto escrito por la profesora.',
    })
    const next = publicationAiDraftEditorReducer(initial, {
      type: 'request_application',
      draft: proposedDraft,
    })

    expect(next.summary).toBe('Texto escrito por la profesora.')
    expect(next.pendingApplication).toEqual(proposedDraft)
  })

  it('no pide confirmación por texto equivalente y completa los campos vacíos', () => {
    expect(publicationAiDraftNeedsConfirmation({
      ...emptyForm,
      summary: `  ${proposedDraft.summary}  `,
    }, proposedDraft)).toBe(false)
  })

  it('confirmar reemplaza solamente resumen y recursos y preserva el muro', () => {
    const initial = createPublicationAiDraftEditorState({
      questionsPublished: true,
      resources: 'Material docente actual.',
      summary: 'Resumen docente actual.',
    })
    const awaitingConfirmation = publicationAiDraftEditorReducer(initial, {
      type: 'request_application',
      draft: proposedDraft,
    })
    const applied = publicationAiDraftEditorReducer(awaitingConfirmation, {
      type: 'confirm_application',
    })

    expect(applied.summary).toBe(proposedDraft.summary)
    expect(applied.resources).toBe(proposedDraft.resourcesAndNextSteps)
    expect(applied.questionsPublished).toBe(true)
    expect(applied.pendingApplication).toBeNull()
  })

  it('cancelar conserva todo el contenido actual', () => {
    const initial = createPublicationAiDraftEditorState({
      questionsPublished: true,
      resources: 'Material docente actual.',
      summary: 'Resumen docente actual.',
    })
    const awaitingConfirmation = publicationAiDraftEditorReducer(initial, {
      type: 'request_application',
      draft: proposedDraft,
    })
    const cancelled = publicationAiDraftEditorReducer(awaitingConfirmation, {
      type: 'cancel_application',
    })

    expect(cancelled).toMatchObject({
      questionsPublished: true,
      resources: 'Material docente actual.',
      summary: 'Resumen docente actual.',
    })
    expect(cancelled.pendingApplication).toBeNull()
  })

  it('descartar oculta sólo el artefacto y no altera el formulario', () => {
    const initial = createPublicationAiDraftEditorState({
      questionsPublished: true,
      resources: 'Material docente actual.',
      summary: 'Resumen docente actual.',
    })
    const discarded = publicationAiDraftEditorReducer(initial, {
      type: 'discard_artifact',
      artifactId: 'artifact-1',
    })

    expect(discarded).toMatchObject({
      dismissedArtifactId: 'artifact-1',
      questionsPublished: true,
      resources: 'Material docente actual.',
      summary: 'Resumen docente actual.',
    })
  })

  it('volver a generar revela la vista previa sin tocar el formulario descartado', () => {
    const initial = createPublicationAiDraftEditorState({
      questionsPublished: true,
      resources: 'Material docente actual.',
      summary: 'Resumen docente actual.',
    })
    const discarded = publicationAiDraftEditorReducer(initial, {
      type: 'discard_artifact',
      artifactId: 'artifact-1',
    })
    const revealed = publicationAiDraftEditorReducer(discarded, {
      type: 'reveal_artifact',
    })

    expect(revealed).toMatchObject({
      dismissedArtifactId: null,
      questionsPublished: true,
      resources: 'Material docente actual.',
      summary: 'Resumen docente actual.',
    })
  })

  it('el helper de aplicación no incluye ni solicita una operación de guardado', () => {
    const next = applyPublicationAiDraftLocally({
      ...emptyForm,
      questionsPublished: true,
    }, proposedDraft)

    expect(next).toEqual({
      questionsPublished: true,
      resources: proposedDraft.resourcesAndNextSteps,
      summary: proposedDraft.summary,
    })
    expect(next).not.toHaveProperty('save')
    expect(next).not.toHaveProperty('publish')
  })
})
