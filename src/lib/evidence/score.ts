// Candidate+ Verified and the evidence score — pure, so it is tested without
// a database.
//
// Tiers (Justin, 2026-10-16):
//   Member              — free, every job, never shown to recruiters/employers.
//   Candidate+          — the existing unlock (isDossierUnlocked). Motivation
//                         plus some dossier completeness.
//   Candidate+ Verified — Candidate+ plus at least ONE piece of evidence that
//                         someone else can check: a completed reference, a
//                         portfolio item (work sample), imported review stats
//                         from another platform, or a review from a
//                         NextChapter client. The Dossier itself never counts.
//
// The score is deliberately simple enough to say in one sentence: each piece
// earns fixed points, each extra piece of the same kind counts a bit less, and
// the total is capped at 100.

export const EVIDENCE_POINTS = {
  reference: 12,
  portfolio: 8,
  importedReviewsMax: 20, // a full-weight import: 25+ reviews at a 5.0 rating, link checked
  clientReview: 25, // at a 5.0 rating
} as const

/** Each extra piece of the same kind is worth this fraction of the one before. */
export const REPEAT_FACTOR = 0.7
export const EVIDENCE_SCORE_CAP = 100
/** Reviews at which an import earns full weight. */
const FULL_WEIGHT_REVIEWS = 25
/** Self-reported (link given, not checked) imports count at this share. */
const UNCHECKED_SHARE = 0.8

export type ImportedReviewStatus = 'SELF_REPORTED' | 'LINK_CHECKED' | 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED'

export interface EvidenceInputs {
  completedReferences: number
  portfolioItems: number
  importedReviews: { rating: number; reviewCount: number; status: string }[]
  clientReviewRatings: number[] // published NextChapter client reviews only
}

export interface EvidenceResult {
  score: number // 0-100, whole number
  pieces: number // how many pieces of evidence count
  hasEvidence: boolean
  /** One plain line: what would raise the score most. */
  nextStep: string
}

/** Points one imported-review entry earns before the repeat discount. 0 = not evidence. */
export function importedReviewPoints(r: { rating: number; reviewCount: number; status: string }): number {
  if (r.status === 'REJECTED') return 0
  if (!(r.reviewCount >= 1) || !(r.rating > 0)) return 0
  const rating = Math.min(5, r.rating)
  const volume = Math.min(r.reviewCount, FULL_WEIGHT_REVIEWS) / FULL_WEIGHT_REVIEWS
  const checked = r.status === 'LINK_CHECKED' || r.status === 'CONFIRMED'
  // A small floor so a real but young profile (3 reviews) still visibly counts.
  const raw = Math.max(4, EVIDENCE_POINTS.importedReviewsMax * volume * (rating / 5))
  return raw * (checked ? 1 : UNCHECKED_SHARE)
}

function diminishing(points: number[]): number {
  return [...points].sort((a, b) => b - a).reduce((sum, p, i) => sum + p * REPEAT_FACTOR ** i, 0)
}

function rawTotal(input: EvidenceInputs): number {
  return (
    diminishing(Array(Math.max(0, input.completedReferences)).fill(EVIDENCE_POINTS.reference)) +
    diminishing(Array(Math.max(0, input.portfolioItems)).fill(EVIDENCE_POINTS.portfolio)) +
    diminishing(input.importedReviews.map(importedReviewPoints).filter((p) => p > 0)) +
    diminishing(input.clientReviewRatings.filter((r) => r > 0).map((r) => EVIDENCE_POINTS.clientReview * (Math.min(5, r) / 5)))
  )
}

export function computeEvidence(input: EvidenceInputs): EvidenceResult {
  const pieces =
    Math.max(0, input.completedReferences) +
    Math.max(0, input.portfolioItems) +
    input.importedReviews.filter((r) => importedReviewPoints(r) > 0).length +
    input.clientReviewRatings.filter((r) => r > 0).length
  const total = rawTotal(input)
  const score = Math.min(EVIDENCE_SCORE_CAP, Math.round(total))

  // What one more of each member-controlled kind would add (client reviews
  // aren't something a member can add themselves yet).
  const gain = (next: EvidenceInputs) => Math.min(EVIDENCE_SCORE_CAP, Math.round(rawTotal(next))) - score
  const typicalImport = { rating: 4.8, reviewCount: 15, status: 'SELF_REPORTED' }
  const options = [
    { label: 'get one more reference completed', points: gain({ ...input, completedReferences: input.completedReferences + 1 }) },
    { label: 'add a work sample or case study', points: gain({ ...input, portfolioItems: input.portfolioItems + 1 }) },
    {
      label: input.importedReviews.length === 0 ? 'import your reviews from Upwork, Toptal or another platform' : 'import reviews from another platform',
      points: gain({ ...input, importedReviews: [...input.importedReviews, typicalImport] }),
    },
  ].sort((a, b) => b.points - a.points)

  const best = options[0]
  const nextStep =
    score >= EVIDENCE_SCORE_CAP
      ? 'Your evidence score is at the maximum.'
      : best.points > 0
        ? `To raise it most: ${best.label} (about +${best.points}).`
        : 'Your evidence score is close to the maximum.'

  return { score, pieces, hasEvidence: pieces > 0, nextStep }
}

export type MemberTier = 'MEMBER' | 'CANDIDATE_PLUS' | 'CANDIDATE_PLUS_VERIFIED'

export function memberTier(candidatePlus: boolean, evidence: Pick<EvidenceResult, 'hasEvidence'>): MemberTier {
  if (!candidatePlus) return 'MEMBER'
  return evidence.hasEvidence ? 'CANDIDATE_PLUS_VERIFIED' : 'CANDIDATE_PLUS'
}

export interface RankableEvidence {
  verified: boolean
  evidenceScore: number
}

/**
 * The order recruiters and employers see: Verified members first, then the
 * caller's own fit score, then the evidence score as the tie-breaker.
 */
export function compareByEvidenceThenFit(a: RankableEvidence & { fit: number }, b: RankableEvidence & { fit: number }): number {
  return Number(b.verified) - Number(a.verified) || b.fit - a.fit || b.evidenceScore - a.evidenceScore
}
