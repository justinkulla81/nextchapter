import type { Reference } from '@prisma/client'
import { RELATIONSHIP_TYPE_LABELS } from '@/lib/constants/references'

export interface ReferenceVerification {
  referenceCount: number
  // "a direct manager and a direct report" — omitted (null) when there's
  // nothing to verify against yet.
  relationshipSummary: string | null
  // "March 2026" — the most recent completion date, for the document's
  // "Verified · N references · Month Year" mark.
  verifiedMonthYear: string | null
  // Recruiter portal §A6.3 — "3 of 3 references available for hiring
  // manager calls." Counts only an explicit YES; "Maybe, ask me first" is
  // real signal too but isn't "available" without an extra step, so it's
  // deliberately not folded into this numerator (see
  // hiringManagerCallAskFirstCount for that).
  hiringManagerCallAvailableCount: number
  hiringManagerCallAskFirstCount: number
}

type EligibilityFields = Pick<Reference, 'status' | 'candidateDisputedAt' | 'disputeResolvedAt'>

// Same filter as getRecruiterReportData: a candidate-disputed reference is
// held out of the Dossier until resolved, and only completed references
// count as evidence at all.
export function dossierEligibleReferences<T extends EligibilityFields>(references: T[]): T[] {
  return references.filter(
    (r) => r.status === 'COMPLETED' && (r.candidateDisputedAt === null || r.disputeResolvedAt !== null)
  )
}

function describeRelationships(labels: string[]): string | null {
  if (labels.length === 0) return null
  const lowered = labels.map((l) => l.charAt(0).toLowerCase() + l.slice(1))
  if (lowered.length === 1) return `a ${lowered[0]}`
  if (lowered.length === 2) return `a ${lowered[0]} and a ${lowered[1]}`
  const allButLast = lowered.slice(0, -1).map((l) => `a ${l}`)
  return `${allButLast.join(', ')}, and a ${lowered[lowered.length - 1]}`
}

// Real, countable backing for the Dossier's honesty rule — never a claim
// this can't derive straight from completed, non-disputed references.
export function buildReferenceVerification(
  references: (EligibilityFields &
    Pick<Reference, 'relationshipType' | 'completedAt' | 'availableForHiringManagerCall'>)[]
): ReferenceVerification {
  const eligible = dossierEligibleReferences(references)
  if (eligible.length === 0) {
    return {
      referenceCount: 0,
      relationshipSummary: null,
      verifiedMonthYear: null,
      hiringManagerCallAvailableCount: 0,
      hiringManagerCallAskFirstCount: 0,
    }
  }

  const relationshipLabels = Array.from(new Set(eligible.map((r) => RELATIONSHIP_TYPE_LABELS[r.relationshipType])))
  const mostRecent = eligible.reduce<Date | null>(
    (latest, r) => (r.completedAt && (!latest || r.completedAt > latest) ? r.completedAt : latest),
    null
  )

  return {
    referenceCount: eligible.length,
    relationshipSummary: describeRelationships(relationshipLabels),
    verifiedMonthYear: mostRecent ? mostRecent.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null,
    hiringManagerCallAvailableCount: eligible.filter((r) => r.availableForHiringManagerCall === 'YES').length,
    hiringManagerCallAskFirstCount: eligible.filter((r) => r.availableForHiringManagerCall === 'MAYBE_ASK_FIRST').length,
  }
}
