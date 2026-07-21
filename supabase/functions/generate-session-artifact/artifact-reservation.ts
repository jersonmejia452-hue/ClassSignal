export type ArtifactReservationOutcome = "created" | "cached" | "in_progress";

export interface ArtifactReservation<TArtifact> {
  outcome: ArtifactReservationOutcome;
  artifact: TArtifact;
}

interface ReservationDependencies<TArtifact> {
  findReusable: () => Promise<ArtifactReservation<TArtifact> | null>;
  readProviderKey: () => string;
  reservePaidWork: () => Promise<ArtifactReservation<TArtifact>>;
}

/**
 * Keeps provider configuration outside the read-only reuse path while making
 * it a hard prerequisite for the RPC that records paid work and consumes a
 * quota slot.
 */
export async function resolveArtifactReservation<TArtifact>(
  dependencies: ReservationDependencies<TArtifact>,
): Promise<{
  reservation: ArtifactReservation<TArtifact>;
  providerKey: string | null;
}> {
  const reusable = await dependencies.findReusable();
  if (reusable) {
    return { reservation: reusable, providerKey: null };
  }

  const providerKey = dependencies.readProviderKey();
  const reservation = await dependencies.reservePaidWork();
  return {
    reservation,
    providerKey: reservation.outcome === "created" ? providerKey : null,
  };
}
