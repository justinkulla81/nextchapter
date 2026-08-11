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
  references: (EligibilityFields & Pick<Reference, 'relationshipType' | 'completedAt'>)[]
): ReferenceVerification {
  const eligible = dossierEligibleReferences(references)
  if (eligible.length === 0) {
    return { referenceCount: 0, relationshipSummary: null, verifiedMonthYear: null }
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
  }
}
