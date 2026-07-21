export interface PublicationFormState {
  questionsPublished: boolean
  resources: string
  summary: string
}

export interface PublicationAiDraftValues {
  resourcesAndNextSteps: string
  summary: string
}

export interface PublicationAiDraftEditorState extends PublicationFormState {
  announcement: string | null
  dismissedArtifactId: string | null
  pendingApplication: PublicationAiDraftValues | null
}

export type PublicationAiDraftEditorAction =
  | { type: 'cancel_application' }
  | { type: 'confirm_application' }
  | { type: 'discard_artifact'; artifactId: string }
  | { type: 'edit_resources'; value: string }
  | { type: 'edit_summary'; value: string }
  | { type: 'hydrate_form'; form: PublicationFormState }
  | { type: 'request_application'; draft: PublicationAiDraftValues }
  | { type: 'reset_form'; form: PublicationFormState }
  | { type: 'reveal_artifact' }
  | { type: 'toggle_questions' }

export const localApplicationAnnouncement =
  'Borrador aplicado al formulario local. Todavía no se ha publicado.'

export function createPublicationAiDraftEditorState(
  form: PublicationFormState,
): PublicationAiDraftEditorState {
  return {
    ...form,
    announcement: null,
    dismissedArtifactId: null,
    pendingApplication: null,
  }
}

function comparableText(value: string) {
  return value.trim()
}

export function publicationAiDraftNeedsConfirmation(
  form: PublicationFormState,
  draft: PublicationAiDraftValues,
) {
  const currentSummary = comparableText(form.summary)
  const currentResources = comparableText(form.resources)
  const proposedSummary = comparableText(draft.summary)
  const proposedResources = comparableText(draft.resourcesAndNextSteps)

  return (
    (currentSummary.length > 0 && currentSummary !== proposedSummary)
    || (currentResources.length > 0 && currentResources !== proposedResources)
  )
}

export function applyPublicationAiDraftLocally(
  form: PublicationFormState,
  draft: PublicationAiDraftValues,
): PublicationFormState {
  return {
    ...form,
    resources: draft.resourcesAndNextSteps,
    summary: draft.summary,
  }
}

export function publicationAiDraftEditorReducer(
  state: PublicationAiDraftEditorState,
  action: PublicationAiDraftEditorAction,
): PublicationAiDraftEditorState {
  switch (action.type) {
    case 'hydrate_form':
    case 'reset_form':
      return {
        ...state,
        ...action.form,
        announcement: null,
        pendingApplication: null,
      }
    case 'edit_summary':
      return { ...state, summary: action.value }
    case 'edit_resources':
      return { ...state, resources: action.value }
    case 'toggle_questions':
      return { ...state, questionsPublished: !state.questionsPublished }
    case 'request_application':
      if (publicationAiDraftNeedsConfirmation(state, action.draft)) {
        return {
          ...state,
          announcement: null,
          pendingApplication: action.draft,
        }
      }

      return {
        ...state,
        ...applyPublicationAiDraftLocally(state, action.draft),
        announcement: localApplicationAnnouncement,
        pendingApplication: null,
      }
    case 'confirm_application':
      if (!state.pendingApplication) return state
      return {
        ...state,
        ...applyPublicationAiDraftLocally(state, state.pendingApplication),
        announcement: localApplicationAnnouncement,
        pendingApplication: null,
      }
    case 'cancel_application':
      return {
        ...state,
        announcement: null,
        pendingApplication: null,
      }
    case 'discard_artifact':
      return {
        ...state,
        announcement: 'Borrador descartado. El formulario no cambió.',
        dismissedArtifactId: action.artifactId,
        pendingApplication: null,
      }
    case 'reveal_artifact':
      return {
        ...state,
        announcement: null,
        dismissedArtifactId: null,
        pendingApplication: null,
      }
  }
}
