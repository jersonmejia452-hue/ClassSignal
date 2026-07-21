#!/usr/bin/env node

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARTIFACT_KINDS,
  assertRequestPrivacy,
  buildRequestPayload,
  DEFAULT_MODEL,
  estimateCost,
  extractResponseText,
  loadFixtures,
  PROMPT_VERSION,
  readUsage,
  redactArtifact,
  scoreArtifact,
  validateUsageArithmetic,
} from "./lib.mjs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const EVAL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REASONING_EFFORTS = new Set([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

class SafeEvalError extends Error {
  constructor(code, message, telemetry = null) {
    super(message);
    this.code = code;
    this.telemetry = telemetry;
  }
}

function printHelp() {
  process.stdout.write(
    `Usage: node run-openai-evals.mjs [options]\n\n` +
      `Required environment:\n` +
      `  RUN_OPENAI_EVALS=1       Explicitly authorize paid API calls\n` +
      `  OPENAI_API_KEY=...       Server-side OpenAI API key\n\n` +
      `Options:\n` +
      `  --case <id>              Run one fixture (repeatable)\n` +
      `  --kind <kind>            publication_draft or micro_intervention\n` +
      `  --limit <number>         Limit expanded fixture/kind cases\n` +
      `  --output <path|->        JSONL destination; '-' writes to stdout\n` +
      `  --help                   Show this help without calling the API\n\n` +
      `Optional environment:\n` +
      `  OPENAI_EVAL_MODEL, OPENAI_MODEL_ROUTINE, OPENAI_EVAL_REASONING_EFFORT,\n` +
      `  OPENAI_EVAL_MAX_OUTPUT_TOKENS, OPENAI_EVAL_TIMEOUT_MS\n`,
  );
}

function parseArguments(argv) {
  const options = {
    caseIds: [],
    kind: null,
    limit: null,
    output: null,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (!["--case", "--kind", "--limit", "--output"].includes(argument)) {
      throw new SafeEvalError(
        "invalid_arguments",
        `Unknown option: ${argument}`,
      );
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new SafeEvalError(
        "invalid_arguments",
        `Missing value for ${argument}`,
      );
    }
    index += 1;
    if (argument === "--case") options.caseIds.push(value);
    if (argument === "--kind") options.kind = value;
    if (argument === "--output") options.output = value;
    if (argument === "--limit") {
      options.limit = parsePositiveInteger(value, "--limit", 1, 100);
    }
  }
  return options;
}

function parsePositiveInteger(value, label, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new SafeEvalError(
      "invalid_configuration",
      `${label} must be an integer from ${minimum} to ${maximum}`,
    );
  }
  return parsed;
}

function environmentFlagIsEnabled(name) {
  const value = process.env[name];
  return typeof value === "string" && value.toLocaleLowerCase("en") === "1";
}

function runningInCi() {
  const value = process.env.CI;
  if (value && !["0", "false", "no"].includes(value.toLocaleLowerCase("en"))) {
    return true;
  }
  return ["GITHUB_ACTIONS", "BUILDKITE", "CIRCLECI", "GITLAB_CI", "TF_BUILD"]
    .some((name) => Boolean(process.env[name]));
}

function assertPaidRunAuthorized() {
  if (runningInCi()) {
    throw new SafeEvalError(
      "ci_blocked",
      "Real OpenAI evals are disabled in CI.",
    );
  }
  if (!environmentFlagIsEnabled("RUN_OPENAI_EVALS")) {
    throw new SafeEvalError(
      "explicit_opt_in_required",
      "Set RUN_OPENAI_EVALS=1 to authorize paid OpenAI eval calls.",
    );
  }
  if (
    typeof process.env.OPENAI_API_KEY !== "string" ||
    process.env.OPENAI_API_KEY.trim().length === 0
  ) {
    throw new SafeEvalError(
      "missing_api_key",
      "OPENAI_API_KEY is required for real evals.",
    );
  }
}

function readConfiguration(options) {
  const model = process.env.OPENAI_EVAL_MODEL?.trim() ||
    process.env.OPENAI_MODEL_ROUTINE?.trim() || DEFAULT_MODEL;
  const reasoningEffort = process.env.OPENAI_EVAL_REASONING_EFFORT?.trim() ||
    null;
  if (reasoningEffort && !REASONING_EFFORTS.has(reasoningEffort)) {
    throw new SafeEvalError(
      "invalid_configuration",
      "OPENAI_EVAL_REASONING_EFFORT is invalid.",
    );
  }
  const maxOutputTokens = process.env.OPENAI_EVAL_MAX_OUTPUT_TOKENS
    ? parsePositiveInteger(
      process.env.OPENAI_EVAL_MAX_OUTPUT_TOKENS,
      "OPENAI_EVAL_MAX_OUTPUT_TOKENS",
      256,
      8_000,
    )
    : null;
  const timeoutMs = process.env.OPENAI_EVAL_TIMEOUT_MS
    ? parsePositiveInteger(
      process.env.OPENAI_EVAL_TIMEOUT_MS,
      "OPENAI_EVAL_TIMEOUT_MS",
      1_000,
      180_000,
    )
    : 110_000;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = options.output ??
    resolve(EVAL_DIRECTORY, "results", `artifact-eval-${timestamp}.jsonl`);
  return { model, reasoningEffort, maxOutputTokens, timeoutMs, output };
}

function expandCases(fixtures, options) {
  if (options.kind && !ARTIFACT_KINDS.includes(options.kind)) {
    throw new SafeEvalError(
      "invalid_arguments",
      `Unsupported kind: ${options.kind}`,
    );
  }
  const requestedIds = new Set(options.caseIds);
  if (requestedIds.size > 0) {
    const knownIds = new Set(fixtures.map((fixture) => fixture.id));
    const unknown = [...requestedIds].filter((id) => !knownIds.has(id));
    if (unknown.length > 0) {
      throw new SafeEvalError(
        "invalid_arguments",
        `Unknown fixture: ${unknown.join(", ")}`,
      );
    }
  }

  const cases = fixtures.flatMap((fixture) => {
    if (requestedIds.size > 0 && !requestedIds.has(fixture.id)) return [];
    return fixture.kinds
      .filter((kind) => !options.kind || kind === options.kind)
      .map((kind) => ({ fixture, kind }));
  });
  const limited = options.limit === null
    ? cases
    : cases.slice(0, options.limit);
  if (limited.length === 0) {
    throw new SafeEvalError("no_cases", "No eval cases matched the filters.");
  }
  return limited;
}

function initializeJsonl(output) {
  if (output === "-") return;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, "", { encoding: "utf8", flag: "wx" });
}

function writeJsonl(output, record) {
  const line = `${JSON.stringify(record)}\n`;
  if (output === "-") process.stdout.write(line);
  else appendFileSync(output, line, "utf8");
}

function boundedHeader(value) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : null;
}

function blankUsage() {
  return {
    input_tokens: null,
    cached_input_tokens: null,
    cache_write_input_tokens: null,
    output_tokens: null,
    reasoning_tokens: null,
    total_tokens: null,
  };
}

async function requestArtifact({ payload, apiKey, model, timeoutMs }) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    const telemetry = telemetryFrom({
      startedAt,
      model,
      response: null,
      body: null,
    });
    if (error?.name === "AbortError") {
      throw new SafeEvalError(
        "provider_timeout",
        "OpenAI eval request timed out.",
        telemetry,
      );
    }
    throw new SafeEvalError(
      "provider_unavailable",
      "Could not connect to OpenAI for this eval case.",
      telemetry,
    );
  } finally {
    clearTimeout(timeout);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    const telemetry = telemetryFrom({ startedAt, model, response, body: null });
    throw new SafeEvalError(
      "invalid_provider_json",
      "OpenAI returned non-JSON data.",
      telemetry,
    );
  }
  const telemetry = telemetryFrom({ startedAt, model, response, body });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new SafeEvalError(
        "invalid_api_key_or_access",
        "OpenAI rejected the API credential or model access.",
        telemetry,
      );
    }
    if (response.status === 429) {
      throw new SafeEvalError(
        "provider_rate_limit",
        "OpenAI rate-limited the eval request.",
        telemetry,
      );
    }
    if (response.status >= 500) {
      throw new SafeEvalError(
        "provider_unavailable",
        "OpenAI was temporarily unavailable.",
        telemetry,
      );
    }
    throw new SafeEvalError(
      "provider_rejected_request",
      "OpenAI rejected the eval request.",
      telemetry,
    );
  }

  let outputText;
  try {
    outputText = extractResponseText(body);
  } catch (error) {
    throw new SafeEvalError(
      "invalid_provider_output",
      error.message,
      telemetry,
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(outputText);
  } catch {
    throw new SafeEvalError(
      "invalid_output_json",
      "OpenAI output was not valid JSON.",
      telemetry,
    );
  }
  return { artifact, telemetry };
}

function telemetryFrom({ startedAt, model, response, body }) {
  const usage = readUsage(body?.usage);
  const cost = estimateCost(model, usage);
  return {
    latency_ms: Math.max(0, Math.round(performance.now() - startedAt)),
    tokens: usage,
    token_arithmetic_issues: validateUsageArithmetic(usage),
    ...cost,
    provider_request_id: boundedHeader(response?.headers?.get("x-request-id")),
    provider_response_id: boundedHeader(body?.id),
  };
}

function casePassed(scoring, fixture) {
  return scoring.valid_format && scoring.privacy_safe &&
    !scoring.invented_information_detected &&
    scoring.uncertainty_acknowledged &&
    scoring.grounding_score >=
      (fixture.expectations?.minimum_grounding_score ?? 0.7) &&
    scoring.teacher_utility_score >=
      (fixture.expectations?.minimum_utility_score ?? 0.7);
}

function safeErrorRecord(
  { runId, fixture, kind, model, reasoningEffort, error },
) {
  const telemetry = error instanceof SafeEvalError && error.telemetry
    ? error.telemetry
    : {
      latency_ms: null,
      tokens: blankUsage(),
      token_arithmetic_issues: [],
      estimated_cost_usd: null,
      pricing_version: null,
      provider_request_id: null,
      provider_response_id: null,
    };
  return {
    record_type: "case_result",
    run_id: runId,
    case_id: fixture.id,
    scenario: fixture.scenario,
    kind,
    subject: fixture.source.session.subject,
    model,
    reasoning_effort: reasoningEffort,
    prompt_version: PROMPT_VERSION,
    passed: false,
    metrics: {
      grounding_score: null,
      teacher_utility_score: null,
      invented_information_detected: null,
      valid_format: false,
      privacy_safe: null,
      latency_ms: telemetry.latency_ms,
      tokens: telemetry.tokens,
      token_arithmetic_issues: telemetry.token_arithmetic_issues,
      estimated_cost_usd: telemetry.estimated_cost_usd,
      pricing_version: telemetry.pricing_version,
    },
    provider: {
      request_id: telemetry.provider_request_id,
      response_id: telemetry.provider_response_id,
    },
    error: {
      code: error instanceof SafeEvalError ? error.code : "eval_case_failed",
      message: error instanceof SafeEvalError
        ? error.message
        : "The eval case failed unexpectedly.",
    },
  };
}

function summarize(runId, records, configuration, startedAt) {
  const metricRecords = records.filter((record) =>
    record.record_type === "case_result"
  );
  const scored = metricRecords.filter((record) =>
    typeof record.metrics.grounding_score === "number"
  );
  const latencies = metricRecords
    .map((record) => record.metrics.latency_ms)
    .filter((value) => typeof value === "number")
    .sort((a, b) => a - b);
  const tokenFields = [
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_tokens",
    "total_tokens",
  ];
  const tokens = Object.fromEntries(tokenFields.map((field) => [
    field,
    metricRecords.reduce(
      (total, record) => total + (record.metrics.tokens?.[field] ?? 0),
      0,
    ),
  ]));
  const costs = metricRecords
    .map((record) => record.metrics.estimated_cost_usd)
    .filter((value) => typeof value === "number");
  return {
    record_type: "run_summary",
    run_id: runId,
    model: configuration.model,
    prompt_version: PROMPT_VERSION,
    total_cases: metricRecords.length,
    passed_cases: metricRecords.filter((record) => record.passed).length,
    failed_cases: metricRecords.filter((record) => !record.passed).length,
    average_grounding_score: average(
      scored.map((record) => record.metrics.grounding_score),
    ),
    average_teacher_utility_score: average(
      scored.map((record) => record.metrics.teacher_utility_score),
    ),
    invented_information_cases:
      scored.filter((record) => record.metrics.invented_information_detected)
        .length,
    invalid_format_cases:
      scored.filter((record) => !record.metrics.valid_format).length,
    privacy_failure_cases:
      scored.filter((record) => !record.metrics.privacy_safe).length,
    latency_ms: {
      total: Math.max(0, Math.round(performance.now() - startedAt)),
      average: average(latencies),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    tokens,
    estimated_cost_usd: costs.length > 0
      ? round(costs.reduce((total, value) => total + value, 0), 8)
      : null,
  };
}

function average(values) {
  return values.length === 0 ? null : round(
    values.reduce((total, value) => total + value, 0) / values.length,
    4,
  );
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil(sortedValues.length * fraction) - 1;
  return sortedValues[Math.max(0, index)];
}

function round(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  assertPaidRunAuthorized();
  const configuration = readConfiguration(options);
  const fixtures = loadFixtures();
  const cases = expandCases(fixtures, options);
  initializeJsonl(configuration.output);

  const runId = `artifact-eval-${Date.now()}`;
  const runStartedAt = performance.now();
  const records = [];
  process.stderr.write(
    `Running ${cases.length} paid eval case(s) with ${configuration.model}; no fallback is configured.\n`,
  );

  for (let index = 0; index < cases.length; index += 1) {
    const { fixture, kind } = cases[index];
    const reasoningEffort = configuration.reasoningEffort ??
      (kind === "publication_draft" ? "medium" : "high");
    process.stderr.write(
      `[${index + 1}/${cases.length}] ${fixture.id} / ${kind}\n`,
    );
    let record;
    try {
      const payload = buildRequestPayload({
        fixture,
        kind,
        model: configuration.model,
        reasoningEffort,
        maxOutputTokens: configuration.maxOutputTokens ??
          (kind === "publication_draft" ? 3_200 : 4_500),
      });
      assertRequestPrivacy(payload, fixture);
      const { artifact, telemetry } = await requestArtifact({
        payload,
        apiKey: process.env.OPENAI_API_KEY,
        model: configuration.model,
        timeoutMs: configuration.timeoutMs,
      });
      const scoring = scoreArtifact({ fixture, kind, artifact });
      record = {
        record_type: "case_result",
        run_id: runId,
        case_id: fixture.id,
        scenario: fixture.scenario,
        kind,
        subject: fixture.source.session.subject,
        model: configuration.model,
        reasoning_effort: reasoningEffort,
        prompt_version: PROMPT_VERSION,
        passed: casePassed(scoring, fixture),
        thresholds: {
          minimum_grounding_score:
            fixture.expectations?.minimum_grounding_score ?? 0.7,
          minimum_teacher_utility_score:
            fixture.expectations?.minimum_utility_score ?? 0.7,
        },
        metrics: {
          grounding_score: scoring.grounding_score,
          teacher_utility_score: scoring.teacher_utility_score,
          invented_information_detected: scoring.invented_information_detected,
          valid_format: scoring.valid_format,
          privacy_safe: scoring.privacy_safe,
          uncertainty_acknowledged: scoring.uncertainty_acknowledged,
          latency_ms: telemetry.latency_ms,
          tokens: telemetry.tokens,
          token_arithmetic_issues: telemetry.token_arithmetic_issues,
          estimated_cost_usd: telemetry.estimated_cost_usd,
          pricing_version: telemetry.pricing_version,
        },
        checks: scoring.checks,
        diagnostics: scoring.diagnostics,
        provider: {
          request_id: telemetry.provider_request_id,
          response_id: telemetry.provider_response_id,
        },
        artifact: redactArtifact(artifact, fixture.private_markers ?? []),
      };
    } catch (error) {
      record = safeErrorRecord({
        runId,
        fixture,
        kind,
        model: configuration.model,
        reasoningEffort,
        error,
      });
    }
    records.push(record);
    writeJsonl(configuration.output, record);
  }

  const summary = summarize(runId, records, configuration, runStartedAt);
  writeJsonl(configuration.output, summary);
  process.stderr.write(
    `Finished: ${summary.passed_cases}/${summary.total_cases} passed; estimated cost ` +
      `${
        summary.estimated_cost_usd ?? "unavailable"
      } USD. JSONL: ${configuration.output}\n`,
  );
  if (summary.failed_cases > 0) process.exitCode = 1;
}

main().catch((error) => {
  const code = error instanceof SafeEvalError
    ? error.code
    : "eval_runner_failed";
  const message = error instanceof SafeEvalError
    ? error.message
    : "The eval runner failed unexpectedly.";
  process.stderr.write(`${code}: ${message}\n`);
  process.exitCode = 2;
});
