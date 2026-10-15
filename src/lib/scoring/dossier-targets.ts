// Pure numbers behind the Candidate+ gate, shared by the server gate and the
// unlock ladder's wording so the two can never say different things.
export const DOSSIER_EFFORT_MINUTES_TARGET = 480

// The effort target for one member: an admin's override when there is a sane
// one, otherwise the product default. Whole minutes, at least 1.
export function effortTargetFor(override: number | null | undefined): number {
  return typeof override === 'number' && Number.isInteger(override) && override >= 1 && override <= 100_000 ? override : DOSSIER_EFFORT_MINUTES_TARGET
}
export const DOSSIER_UNLOCK_REFERENCE_TARGET = 3
export const DOSSIER_UNLOCK_OUTREACH_TARGET = 5
export const DOSSIER_UNLOCK_APPLICATION_TARGET = 5
