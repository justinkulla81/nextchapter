import 'server-only'
import { prisma } from '@/lib/prisma'
import type { HiringConflictSource } from '@prisma/client'
import { getCurrentEmployerName, companyMatchesCurrentEmployer } from '@/lib/network/current-employer-flag'

// Partners Master Build Script §A8 / §E3.5 — "cannot see candidates for
// their own reqs where a conflict is flagged: same current employer, a
// declared relationship, or same household." This module is the ENTIRE
// enforcement surface: a HiringConflictFlag row with clearedAt = null is
// what src/lib/hiring/visibility.ts filters every hiring-manager-facing
// query on. Nothing here renders a warning banner and lets the view through
// anyway — a flagged pairing is excluded from the query result, full stop.

// Auto-detection: reuses the exact same fuzzy-match primitive the
// candidate-side "don't apply to your own employer" warning already uses
// (getCurrentEmployerName / companyMatchesCurrentEmployer, both built on
// orgNamesMatch) — not a new invention. Called whenever a submission is
// linked to a req (see autoLinkSubmissionToReq in req-matching.ts), since
// that's the first moment a hiring manager and a candidate are actually
// paired.
export async function autoDetectConflict(hiringManagerId: string, candidateId: string): Promise<void> {
  const [hiringManager, currentEmployerName] = await Promise.all([
    prisma.hiringManager.findUnique({ where: { id: hiringManagerId }, select: { companyName: true } }),
    getCurrentEmployerName(candidateId),
  ])
  if (!hiringManager) return
  if (!companyMatchesCurrentEmployer(currentEmployerName, hiringManager.companyName)) return

  // Upsert-shaped: a repeat call (e.g. a candidate re-submitted to a second
  // req for the same hiring manager) must not error on the
  // @@unique([hiringManagerId, candidateId]) constraint or duplicate the row.
  await prisma.hiringConflictFlag.upsert({
    where: { hiringManagerId_candidateId: { hiringManagerId, candidateId } },
    create: { hiringManagerId, candidateId, source: 'AUTO_SAME_EMPLOYER' },
    update: {},
  })
}

// A hiring manager declaring a relationship/household conflict themselves —
// §A8's other two conflict types, neither of which is auto-detectable from
// data we have.
export async function declareConflict(
  hiringManagerId: string,
  candidateId: string,
  source: Extract<HiringConflictSource, 'DECLARED_RELATIONSHIP' | 'DECLARED_HOUSEHOLD' | 'DECLARED_OTHER'>,
  note?: string
): Promise<void> {
  await prisma.hiringConflictFlag.upsert({
    where: { hiringManagerId_candidateId: { hiringManagerId, candidateId } },
    create: { hiringManagerId, candidateId, source, note: note?.trim() || null },
    update: { source, note: note?.trim() || null, clearedAt: null, clearedBy: null },
  })
}

// Retracts a false-positive flag WITHOUT deleting the row — the row itself
// is the audit trail of "a conflict was flagged and why," which must
// survive being cleared. clearedBy is the hiring manager's own id for now
// (no admin override path built this phase).
export async function clearConflictFlag(hiringManagerId: string, candidateId: string, clearedBy: string): Promise<void> {
  await prisma.hiringConflictFlag.updateMany({
    where: { hiringManagerId, candidateId, clearedAt: null },
    data: { clearedAt: new Date(), clearedBy },
  })
}

export async function getActiveConflictFlags(hiringManagerId: string) {
  return prisma.hiringConflictFlag.findMany({
    where: { hiringManagerId, clearedAt: null },
    orderBy: { detectedAt: 'desc' },
  })
}

// The one predicate visibility.ts needs — "is this specific pairing
// currently blocked."
export async function isCandidateBlockedForHiringManager(hiringManagerId: string, candidateId: string): Promise<boolean> {
  const flag = await prisma.hiringConflictFlag.findUnique({
    where: { hiringManagerId_candidateId: { hiringManagerId, candidateId } },
    select: { clearedAt: true },
  })
  return Boolean(flag && flag.clearedAt === null)
}
