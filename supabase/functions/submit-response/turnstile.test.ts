import { describe, expect, it, vi } from "vitest";

import {
  parseExpectedHostnames,
  TURNSTILE_SITEVERIFY_URL,
  verifyTurnstileToken,
} from "./turnstile";

function siteverifyResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("verifyTurnstileToken", () => {
  it("acepta solo una verificación con acción y hostname esperados", async () => {
    const fetcher = vi.fn(async () => siteverifyResponse({
      success: true,
      action: "submit_response",
      hostname: "classsignal.example",
      cdata: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
      "error-codes": [],
    }));

    await expect(verifyTurnstileToken({
      token: "valid-token",
      secretKey: "private-test-secret",
      expectedCData: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
      remoteIp: "203.0.113.8",
      expectedHostnames: ["classsignal.example"],
      fetcher,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    })).resolves.toEqual({ valid: true });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("response")).toBe("valid-token");
    expect((init?.body as FormData).get("remoteip")).toBe("203.0.113.8");
  });

  it("rechaza tokens reutilizados o contexto de widget distinto", async () => {
    const duplicateFetcher = vi.fn(async () => siteverifyResponse({
      success: false,
      "error-codes": ["timeout-or-duplicate"],
    }));
    const actionFetcher = vi.fn(async () => siteverifyResponse({
      success: true,
      action: "login",
      hostname: "classsignal.example",
    }));
    const cdataFetcher = vi.fn(async () => siteverifyResponse({
      success: true,
      action: "submit_response",
      hostname: "classsignal.example",
      cdata: "another-session",
    }));
    const hostnameFetcher = vi.fn(async () => siteverifyResponse({
      success: true,
      action: "submit_response",
      hostname: "attacker.example",
      cdata: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
    }));

    await expect(verifyTurnstileToken({
      token: "spent-token",
      secretKey: "private-test-secret",
      expectedCData: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
      fetcher: duplicateFetcher,
    })).resolves.toMatchObject({ valid: false, reason: "rejected" });

    await expect(verifyTurnstileToken({
      token: "wrong-action-token",
      secretKey: "private-test-secret",
      expectedCData: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
      fetcher: actionFetcher,
    })).resolves.toEqual({
      valid: false,
      reason: "rejected",
      errorCodes: ["action-mismatch"],
    });

    await expect(verifyTurnstileToken({
      token: "wrong-cdata-token",
      secretKey: "private-test-secret",
      expectedCData: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
      expectedHostnames: ["classsignal.example"],
      fetcher: cdataFetcher,
    })).resolves.toEqual({
      valid: false,
      reason: "rejected",
      errorCodes: ["cdata-mismatch"],
    });

    await expect(verifyTurnstileToken({
      token: "wrong-hostname-token",
      secretKey: "private-test-secret",
      expectedCData: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
      expectedHostnames: ["classsignal.example"],
      fetcher: hostnameFetcher,
    })).resolves.toEqual({
      valid: false,
      reason: "rejected",
      errorCodes: ["hostname-mismatch"],
    });
  });

  it("falla cerrado cuando Siteverify no está disponible", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network unavailable");
    });

    await expect(verifyTurnstileToken({
      token: "token",
      secretKey: "private-test-secret",
      expectedCData: "476d5704-4dfb-4cf5-9652-dfde0696abcb",
      fetcher,
    })).resolves.toEqual({
      valid: false,
      reason: "unavailable",
      errorCodes: ["siteverify-unavailable"],
    });
  });
});

describe("parseExpectedHostnames", () => {
  it("normaliza, elimina duplicados e ignora entradas vacías", () => {
    expect(parseExpectedHostnames(
      " ClassSignal.example,localhost,classsignal.example., ",
    )).toEqual(["classsignal.example", "localhost"]);
  });
});
