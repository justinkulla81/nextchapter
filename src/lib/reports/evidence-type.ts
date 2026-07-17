// Every statement in the Dossier (Recruiter Report) and Evidence Brief comes
// from one of three places, and a hiring manager reading it off-platform has
// no way to tell them apart without an explicit label. This is that
// taxonomy — attached to report output at generation time, not persisted,
// since it's derived from which field a statement came from, not new data.
export type EvidenceType = 'self_reported' | 'reference_verified' | 'verified_fact' | 'ai_inferred'

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  self_reported: 'Self-reported',
  reference_verified: 'Reference-verified',
  verified_fact: 'System-verified',
  ai_inferred: 'AI-inferred, grounded in facts below',
}

// A single reference's character-y prose (strengthSummary/growthAreaSummary)
// is one person's account — the whole point of the reference-delta/BARS
// architecture elsewhere in the app is that a single data point isn't
// trustworthy alone. Character Signals (qualitative "how they work" claims,
// as opposed to objective facts like a referee's name or applications sent)
// only surface in the Dossier once there are 2+ independent references to
// triangulate against.
export const CHARACTER_SIGNAL_MIN_REFERENCES = 2

export function characterSignalsUnlocked(referenceCount: number): boolean {
  return referenceCount >= CHARACTER_SIGNAL_MIN_REFERENCES
}
