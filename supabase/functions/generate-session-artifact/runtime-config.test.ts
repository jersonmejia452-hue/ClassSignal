import { describe, expect, it } from "vitest";

import { ARTIFACT_PROMPT_VERSION } from "./artifact-core.ts";
import { PublicFunctionError } from "./errors.ts";
import { readArtifactConfiguration, readOpenAIKey } from "./runtime-config.ts";

function environment(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

function expectPublicError(
  run: () => unknown,
  code: string,
  status = 503,
) {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(PublicFunctionError);
  expect(thrown).toMatchObject({ code, status });
}

describe("readArtifactConfiguration", () => {
  it("usa Luna y los defaults específicos de cada artefacto", () => {
    const emptyEnvironment = environment({});

    expect(readArtifactConfiguration(
      "publication_draft",
      emptyEnvironment,
    )).toEqual({
      model: "gpt-5.6-luna",
      reasoningEffort: "medium",
      maxOutputTokens: 3_200,
      promptVersion: ARTIFACT_PROMPT_VERSION,
    });
    expect(readArtifactConfiguration(
      "micro_intervention",
      emptyEnvironment,
    )).toEqual({
      model: "gpt-5.6-luna",
      reasoningEffort: "high",
      maxOutputTokens: 4_500,
      promptVersion: ARTIFACT_PROMPT_VERSION,
    });
  });

  it("lee únicamente la variable de esfuerzo correspondiente y recorta valores", () => {
    const readEnvironment = environment({
      OPENAI_MODEL_ROUTINE: "  gpt-5.6-luna  ",
      OPENAI_PUBLICATION_DRAFT_REASONING_EFFORT: " high ",
      OPENAI_MICRO_INTERVENTION_REASONING_EFFORT: " medium ",
    });

    expect(
      readArtifactConfiguration(
        "publication_draft",
        readEnvironment,
      ).reasoningEffort,
    ).toBe("high");
    expect(
      readArtifactConfiguration(
        "micro_intervention",
        readEnvironment,
      ).reasoningEffort,
    ).toBe("medium");
  });

  it.each([
    [
      "modelo distinto",
      { OPENAI_MODEL_ROUTINE: "gpt-other" },
      "unsupported_openai_model",
    ],
    [
      "modelo vacío explícito",
      { OPENAI_MODEL_ROUTINE: "   " },
      "unsupported_openai_model",
    ],
    [
      "esfuerzo desconocido",
      { OPENAI_PUBLICATION_DRAFT_REASONING_EFFORT: "xhigh" },
      "invalid_reasoning_effort",
    ],
  ])("rechaza %s", (_label, values, code) => {
    expectPublicError(
      () => readArtifactConfiguration("publication_draft", environment(values)),
      code,
    );
  });
});

describe("readOpenAIKey", () => {
  it("recorta y devuelve una clave configurada", () => {
    expect(readOpenAIKey(environment({
      OPENAI_API_KEY: "  sk-test-value  ",
    }))).toBe("sk-test-value");
  });

  it.each([undefined, "", "   "])(
    "rechaza una clave ausente o vacía (%s)",
    (value) => {
      expectPublicError(
        () => readOpenAIKey(environment({ OPENAI_API_KEY: value })),
        "openai_not_configured",
      );
    },
  );
});
