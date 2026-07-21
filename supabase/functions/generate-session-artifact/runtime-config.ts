import { ARTIFACT_PROMPT_VERSION } from "./artifact-core.ts";
import { PublicFunctionError } from "./errors.ts";
import type {
  ArtifactConfiguration,
  ArtifactKind,
  ReasoningEffort,
} from "./types.ts";

const SUPPORTED_MODEL = "gpt-5.6-luna" as const;

type EnvironmentReader = (name: string) => string | undefined;

function defaultEnvironmentReader(name: string) {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
  };
  return runtime.Deno?.env?.get?.(name);
}

export function readArtifactConfiguration(
  kind: ArtifactKind,
  readEnvironment: EnvironmentReader = defaultEnvironmentReader,
): ArtifactConfiguration {
  const configuredModel = readEnvironment("OPENAI_MODEL_ROUTINE");
  const model = configuredModel === undefined
    ? SUPPORTED_MODEL
    : configuredModel.trim();
  if (model !== SUPPORTED_MODEL) {
    throw new PublicFunctionError(
      503,
      "unsupported_openai_model",
      "El modelo configurado para el copiloto aún no está habilitado.",
    );
  }

  const effortVariable = kind === "publication_draft"
    ? "OPENAI_PUBLICATION_DRAFT_REASONING_EFFORT"
    : "OPENAI_MICRO_INTERVENTION_REASONING_EFFORT";
  const defaultEffort: ReasoningEffort = kind === "publication_draft"
    ? "medium"
    : "high";
  const configuredEffort = readEnvironment(effortVariable);
  const reasoningEffort = configuredEffort === undefined
    ? defaultEffort
    : configuredEffort.trim();
  if (reasoningEffort !== "medium" && reasoningEffort !== "high") {
    throw new PublicFunctionError(
      503,
      "invalid_reasoning_effort",
      "El esfuerzo de razonamiento configurado no es válido.",
    );
  }

  return {
    model,
    reasoningEffort,
    maxOutputTokens: kind === "publication_draft" ? 3_200 : 4_500,
    promptVersion: ARTIFACT_PROMPT_VERSION,
  };
}

export function readOpenAIKey(
  readEnvironment: EnvironmentReader = defaultEnvironmentReader,
) {
  const key = readEnvironment("OPENAI_API_KEY")?.trim();
  if (!key) {
    throw new PublicFunctionError(
      503,
      "openai_not_configured",
      "La generación con IA aún no está configurada.",
    );
  }
  return key;
}
