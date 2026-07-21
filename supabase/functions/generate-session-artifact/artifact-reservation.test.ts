import { describe, expect, it, vi } from "vitest";

import { PublicFunctionError } from "./errors.ts";
import { resolveArtifactReservation } from "./artifact-reservation.ts";

const artifact = { id: "artifact-1" };

describe("resolveArtifactReservation", () => {
  it.each(["cached", "in_progress"] as const)(
    "sirve %s sin leer la clave ni reservar trabajo",
    async (outcome) => {
      const readProviderKey = vi.fn(() => {
        throw new Error("the provider key must not be read");
      });
      const reservePaidWork = vi.fn();

      await expect(resolveArtifactReservation({
        findReusable: vi.fn(async () => ({ outcome, artifact })),
        readProviderKey,
        reservePaidWork,
      })).resolves.toEqual({
        reservation: { outcome, artifact },
        providerKey: null,
      });
      expect(readProviderKey).not.toHaveBeenCalled();
      expect(reservePaidWork).not.toHaveBeenCalled();
    },
  );

  it("no reserva ni consume cuota cuando falta la clave", async () => {
    const reservePaidWork = vi.fn();

    await expect(resolveArtifactReservation({
      findReusable: vi.fn(async () => null),
      readProviderKey: vi.fn(() => {
        throw new PublicFunctionError(
          503,
          "openai_not_configured",
          "OpenAI no está configurado.",
        );
      }),
      reservePaidWork,
    })).rejects.toMatchObject({
      code: "openai_not_configured",
      status: 503,
    });
    expect(reservePaidWork).not.toHaveBeenCalled();
  });

  it("valida la clave antes de reservar una generación nueva", async () => {
    const events: string[] = [];
    const readProviderKey = vi.fn(() => {
      events.push("key");
      return "configured-key";
    });
    const reservePaidWork = vi.fn(async () => {
      events.push("reserve");
      return { outcome: "created" as const, artifact };
    });

    await expect(resolveArtifactReservation({
      findReusable: vi.fn(async () => null),
      readProviderKey,
      reservePaidWork,
    })).resolves.toEqual({
      reservation: { outcome: "created", artifact },
      providerKey: "configured-key",
    });
    expect(events).toEqual(["key", "reserve"]);
  });

  it("tolera que la reserva atómica encuentre caché después del preflight", async () => {
    await expect(resolveArtifactReservation({
      findReusable: vi.fn(async () => null),
      readProviderKey: vi.fn(() => "configured-key"),
      reservePaidWork: vi.fn(async () => ({
        outcome: "cached" as const,
        artifact,
      })),
    })).resolves.toEqual({
      reservation: { outcome: "cached", artifact },
      providerKey: null,
    });
  });
});
