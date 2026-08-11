// Generates the hiring-manager-facing summary of a candidate's Friction
// Delta Profile — the disagreement between a candidate's self-reported
// work-style assessment and how their references described their actual
// on-the-job behavior (see src/lib/scoring/reference-delta.ts).
//
// Per the "never expose raw psychometric scores to employers" product rule
// (see assessment-vectors.ts), this only ever surfaces plain-English BARS
// behavioral anchor text and dimension labels — never dimensionVectors
// numbers, inconsistencyScore deltas, or internal jargon.
//
// HARD RULE: the candidate's Hireability/Employability Score is for the
// candidate only, full stop — it must never appear anywhere in this report
// (or any other employer-facing surface). Employers see work ethic,
// motivation signals, references, work samples, and this self-vs-reference
// consistency data — never the Score itself, nor goals/motivations/comp
// expectations. Do not add an employabilityScore field back to this report.

import { prisma } from '@/lib/prisma'
import { ASSESSMENT_DIMENSIONS, type AssessmentDimension } from '@/lib/constants/onboarding'
import { WORK_STYLE_DIMENSION_LABEL, type WorkStyleDimension } from '@/lib/constants/how-i-work-best-items'
import type { DimensionVectors } from '@/lib/scoring/assessment-vectors'
import { aggregatePerformance, type PerformanceAggregate } from '@/lib/references/aggregate-performance'
import type { Reference } from '@prisma/client'

export interface FrictionExample {
  dimension: string
  dimensionLabel: string
  candidateDescription: string
  referenceDescription: string
}

// Assessment Layer spec Part 2.1's dimension merge/rename (see
// reference-delta.ts's NEW_DIMENSION_BARS_SOURCE) means a rotationGroup-3
// candidate's frictionSurfaces can contain keys ASSESSMENT_DIMENSIONS (the
// legacy 9-dimension list) doesn't know about. Resolve labels from the new
// list first, falling back to the old one for legacy responses.
function dimensionLabel(dim: string): string {
  const newLabel = WORK_STYLE_DIMENSION_LABEL[dim.toUpperCase() as WorkStyleDimension]
  if (newLabel) return newLabel
  return ASSESSMENT_DIMENSIONS.find((d) => d.key === dim)?.label ?? dim
}

// BARSAnchor rows only exist under the 9 legacy dimension names — no new
// anchor text was authored for the merged Definition/Collaboration
// dimensions. Reusing one component's anchor text as a representative
// behavioral description is a deliberate, disclosed simplification (not a
// guess at new content); renamed dimensions (Directness/Rigor) alias
// directly since they're the same underlying BARS column under a new name.
const ANCHOR_LOOKUP_ALIAS: Record<string, string> = {
  directness: 'leadership',
  rigor: 'conscientiousness',
  definition: 'architecture',
  collaboration: 'communication',
}

export interface ProfileConsistencyAlert {
  label: 'Profile Consistency Alert'
  message: string
}

export interface RedFlagsSection {
  label: 'Red Flags'
  summary: string[]
  interviewAuditFocusAreas: string[]
}

export interface VerifiedItem {
  label: string
  confirmedCount: number
  correction: string | null // set only when exactly one reference flagged a correction and no one else disputed it
}

// Reference Check Part B rollup (spec §9.1's COMPARATIVE STANDING block) —
// counts, not averages, since these are categorical answers, not a scale.
export interface ComparativeStanding {
  responseCount: number
  managerCount: number
  managerWouldHireAgainDefinitely: number
  topTierRankCount: number // TOP_10 or TOP_1
  rankAnsweredCount: number
  foughtToKeepCount: number
  wouldTakeAgainCount: number
  takeAgainAnsweredCount: number
  meaningfullyMoreScopeCount: number
  scopeAnsweredCount: number
}

export interface AttributedQuote {
  text: string
  refereeName: string
  refereeTitle: string | null
}

export interface HiringManagerReport {
  candidateId: string
  candidateName: string
  profileConsistencyAlert: ProfileConsistencyAlert | null
  redFlags: RedFlagsSection
  frictionExamples: FrictionExample[]
  selfAwarenessScore: number | null
  selfAwarenessLabel: 'High' | 'Moderate' | 'Low' | null
  // Assessment Layer Reference Check additions (spec §9.1) — the
  // performance/comparative/verification/quote layer, distinct from the
  // style-based friction examples above.
  verified: VerifiedItem[]
  performance: PerformanceAggregate
  comparative: ComparativeStanding
  attributedQuotes: AttributedQuote[]
  unattributedCommentCount: number
}

// Same calibration anchor as inconsistencyScore's realistic max delta between
// a candidate's self-report and the reference-aggregated vector on a given
// dimension. Distills the (already employer-only) per-dimension deltas
// computed by calculateReferenceDelta into one 0-100 self-awareness score —
// never shown to the candidate.
const SELF_AWARENESS_DELTA_CEILING = 2.0

function computeSelfAwarenessScore(deltas: Record<string, number> | null): number | null {
  if (!deltas || Object.keys(deltas).length === 0) return null
  const avg = Object.values(deltas).reduce((s, d) => s + d, 0) / Object.values(deltas).length
  return Math.round(100 * (1 - Math.min(avg / SELF_AWARENESS_DELTA_CEILING, 1)))
}

function selfAwarenessLabel(score: number | null): 'High' | 'Moderate' | 'Low' | null {
  if (score === null) return null
  if (score >= 75) return 'High'
  if (score >= 50) return 'Moderate'
  return 'Low'
}

// Maps a normalized vector value back to its nearest BARS scale point (1-5)
// so both the candidate's self-report and the reference aggregate can be
// shown as the same kind of concrete behavioral statement. Candidate
// vectors aren't bounded to -1..+1 like reference vectors are (see
// assessment-vectors.ts caveat), so out-of-range values clamp to the
// nearest end of the scale rather than distorting the mapping.
function nearestAnchorText(
  value: number,
  dimension: string,
  anchorsByDimension: Map<string, Map<number, string>>
): string | null {
  const clamped = Math.max(-1, Math.min(1, value))
  const scalePoint = Math.max(1, Math.min(5, Math.round(clamped * 2 + 3)))
  return anchorsByDimension.get(dimension)?.get(scalePoint) ?? null
}

// Part D verification rollup — one row per claim type, counting how many
// completed references confirmed it and surfacing a correction only when
// exactly one reference flagged one and nobody else disputed it (spec
// §9.1's example: "a former manager notes the team was 12 at peak, not
// 10"). Two-plus conflicting corrections are dropped rather than guessed
// at — that's a candidate-side dispute conversation, not something to
// silently pick a winner on.
function buildVerifiedItems(completedReferences: Reference[]): VerifiedItem[] {
  const items: { label: string; correctField: keyof Reference; correctionField: keyof Reference }[] = [
    { label: 'Title', correctField: 'verifiedTitleCorrect', correctionField: 'correctedTitle' },
    { label: 'Dates', correctField: 'verifiedDatesCorrect', correctionField: 'correctedDates' },
    { label: 'Reporting relationship', correctField: 'verifiedReportingCorrect', correctionField: 'correctedReporting' },
    { label: 'Scope', correctField: 'verifiedScopeCorrect', correctionField: 'correctedScope' },
  ]

  return items
    .map(({ label, correctField, correctionField }) => {
      const answered = completedReferences.filter((r) => r[correctField] !== null)
      const confirmedCount = answered.filter((r) => r[correctField] === true).length
      const corrections = answered
        .map((r) => r[correctionField] as string | null)
        .filter((c): c is string => !!c && c.trim().length > 0)
      return {
        label,
        confirmedCount,
        correction: corrections.length === 1 ? corrections[0] : null,
      }
    })
    .filter((item) => item.confirmedCount > 0 || item.correction)
}

function buildComparativeStanding(completedReferences: Reference[]): ComparativeStanding {
  const managerRefs = completedReferences.filter(
    (r) => r.relationshipType === 'DIRECT_MANAGER' || r.relationshipType === 'SKIP_LEVEL_MANAGER'
  )
  const rankAnswered = completedReferences.filter((r) => r.compRelativeRank !== null)
  const takeAgainAnswered = completedReferences.filter((r) => r.compWouldTakeAgain !== null)
  const scopeAnswered = completedReferences.filter((r) => r.compTrustedScope !== null)

  return {
    responseCount: completedReferences.length,
    managerCount: managerRefs.length,
    managerWouldHireAgainDefinitely: managerRefs.filter((r) => r.compWouldHireAgain === 'DEFINITELY').length,
    topTierRankCount: rankAnswered.filter((r) => r.compRelativeRank === 'TOP_10' || r.compRelativeRank === 'TOP_1')
      .length,
    rankAnsweredCount: rankAnswered.length,
    foughtToKeepCount: managerRefs.filter((r) => r.compDepartureContext === 'FOUGHT_TO_KEEP').length,
    wouldTakeAgainCount: takeAgainAnswered.filter(
      (r) => r.compWouldTakeAgain === 'YES' || r.compWouldTakeAgain === 'YES_FIRST_CALL'
    ).length,
    takeAgainAnsweredCount: takeAgainAnswered.length,
    meaningfullyMoreScopeCount: scopeAnswered.filter(
      (r) => r.compTrustedScope === 'MEANINGFULLY_MORE' || r.compTrustedScope === 'STEP_CHANGE'
    ).length,
    scopeAnsweredCount: scopeAnswered.length,
  }
}

export async function generateHiringManagerReport(candidateId: string): Promise<HiringManagerReport> {
  const [candidate, latestResponse, barsAnchors, completedReferences, approvedQuotes] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
    prisma.candidateAssessmentResponse.findFirst({
      where: { candidateId },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.bARSAnchor.findMany({ where: { isActive: true } }),
    prisma.reference.findMany({ where: { candidateId, status: 'COMPLETED' } }),
    prisma.referenceQuote.findMany({
      where: { candidateId, approvedByCandidateAt: { not: null }, rejectedAt: null },
      include: { reference: { select: { refereeName: true, refereeTitle: true, quotableWithAttribution: true } } },
    }),
  ])

  const anchorsByDimension = new Map<string, Map<number, string>>()
  for (const anchor of barsAnchors) {
    if (!anchorsByDimension.has(anchor.dimension)) {
      anchorsByDimension.set(anchor.dimension, new Map())
    }
    anchorsByDimension.get(anchor.dimension)!.set(anchor.scalePoint, anchor.anchorText)
  }

  let profileConsistencyAlert: ProfileConsistencyAlert | null = null
  const redFlagsSummary: string[] = []
  let interviewAuditFocusAreas: string[] = []
  let frictionExamples: FrictionExample[] = []

  const referenceDeltaForScore = latestResponse?.referenceDelta as unknown as {
    deltas: Record<string, number>
  } | null
  const selfAwarenessScoreValue = computeSelfAwarenessScore(referenceDeltaForScore?.deltas ?? null)

  if (latestResponse) {
    if (latestResponse.manipulationRiskFlag) {
      profileConsistencyAlert = {
        label: 'Profile Consistency Alert',
        message:
          "This candidate's assessment answers showed meaningful internal contradictions — their quad-block choices and follow-up ratings didn't consistently agree. Treat the self-reported How They Work Best profile as a starting point to probe in interview, not a settled fact.",
      }
    }

    const frictionSurfaces = latestResponse.frictionSurfaces ?? []
    if (frictionSurfaces.length > 0) {
      interviewAuditFocusAreas = frictionSurfaces.map(dimensionLabel)
      redFlagsSummary.push(
        `References described this candidate's actual day-to-day behavior differently than the candidate described themselves, in ${frictionSurfaces.length} area${frictionSurfaces.length > 1 ? 's' : ''}. See Interview Audit Focus Areas below.`
      )

      const candidateVectors = latestResponse.dimensionVectors as unknown as DimensionVectors
      const referenceDelta = latestResponse.referenceDelta as unknown as {
        aggregatedRefVectors: Record<string, number>
      } | null

      if (referenceDelta) {
        frictionExamples = frictionSurfaces.map((dim) => {
          const anchorKey = ANCHOR_LOOKUP_ALIAS[dim] ?? dim
          const candidateDescription = nearestAnchorText(
            candidateVectors[dim as AssessmentDimension],
            anchorKey,
            anchorsByDimension
          )
          const referenceDescription = nearestAnchorText(
            referenceDelta.aggregatedRefVectors[dim] ?? 0,
            anchorKey,
            anchorsByDimension
          )
          return {
            dimension: dim,
            dimensionLabel: dimensionLabel(dim),
            candidateDescription: candidateDescription ?? 'No self-reported behavioral anchor available.',
            referenceDescription: referenceDescription ?? 'No reference behavioral anchor available.',
          }
        })
      }
    }
  }

  if (redFlagsSummary.length === 0) {
    redFlagsSummary.push('No red flags identified from available signals.')
  }

  // Only attributed quotes ever render as text (spec §5.7/§9.1) — an
  // approved-but-not-attributed quote still counts toward the "N additional
  // references provided written comments" line, it just never shows its
  // words.
  const attributedQuotes: AttributedQuote[] = approvedQuotes
    .filter((q) => q.reference.quotableWithAttribution === true)
    .map((q) => ({
      text: q.quoteText,
      refereeName: q.reference.refereeName,
      refereeTitle: q.reference.refereeTitle,
    }))
  const unattributedCommentCount = approvedQuotes.filter((q) => q.reference.quotableWithAttribution !== true).length

  return {
    candidateId,
    candidateName: candidate.displayName || 'This candidate',
    profileConsistencyAlert,
    redFlags: {
      label: 'Red Flags',
      summary: redFlagsSummary,
      interviewAuditFocusAreas,
    },
    frictionExamples,
    selfAwarenessScore: selfAwarenessScoreValue,
    selfAwarenessLabel: selfAwarenessLabel(selfAwarenessScoreValue),
    verified: buildVerifiedItems(completedReferences),
    performance: aggregatePerformance(completedReferences),
    comparative: buildComparativeStanding(completedReferences),
    attributedQuotes,
    unattributedCommentCount,
  }
}
