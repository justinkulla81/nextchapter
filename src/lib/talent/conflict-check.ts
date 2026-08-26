import 'server-only'
import { prisma } from '@/lib/prisma'
import type { HiringConflictSource } from '@prisma/client'
import { getCurrentEmployerName, companyMatchesCurrentEmployer } from '@/lib/network/current-employer-flag'

// Ported from src/lib/hiring/conflict-check.ts as part of the /hiring ->
// /talent consolidation, re-keyed from HiringConflictFlag.hiringManagerId to
// HiringConflictFlag.employerId (EmployerProfile) -- a clean column swap,
// not a data-preserving migration, since 0 real HiringConflictFlag rows
// existed under the retired Hiring Manager portal at the time of this port.
//
// Partners Master Build Script §A8 / §E3.5 — "cannot see candidates for
// their own roles where a conflict is flagged: same current employer, a
// declared relationship, or same household." This module is the ENTIRE
// enforcement surface: a HiringConflictFlag row with clearedAt = null is
// what src/lib/talent/candidate-discovery.ts (and the Candidate Inbox) now
// filters every employer-facing query on. Nothing here renders a warning
// banner and lets the view through anyway — a flagged pairing is excluded
// from the query result, full stop.

// Auto-detection: reuses the exact same fuzzy-match primitive the
// candidate-side "don't apply to your own employer" warning already uses
// (getCurrentEmployerName / companyMatchesCurrentEmployer, both built on
// orgNamesMatch) — not a new invention.
export async function autoDetectConflict(employerId: string, candidateId: string): Promise<void> {
  const [employer, currentEmployerName] = await Promise.all([
    prisma.employerProfile.findUnique({ where: { id: employerId }, select: { companyName: true } }),
    getCurrentEmployerName(candidateId),
  ])
  if (!employer) return
  if (!companyMatchesCurrentEmployer(currentEmployerName, employer.companyName)) return

  // Upsert-shaped: a repeat call (e.g. a candidate matched against a second
  // role from the same employer) must not error on the
  // @@unique([employerId, candidateId]) constraint or duplicate the row.
  await prisma.hiringConflictFlag.upsert({
    where: { employerId_candidateId: { employerId, candidateId } },
    create: { employerId, candidateId, source: 'AUTO_SAME_EMPLOYER' },
    update: {},
  })
}

// An employer declaring a relationship/household conflict themselves —
// §A8's other two conflict types, neither of which is auto-detectable from
// data we have.
export async function declareConflict(
  employerId: string,
  candidateId: string,
  source: Extract<HiringConflictSource, 'DECLARED_RELATIONSHIP' | 'DECLARED_HOUSEHOLD' | 'DECLARED_OTHER'>,
  note?: string
): Promise<void> {
  await prisma.hiringConflictFlag.upsert({
    where: { employerId_candidateId: { employerId, candidateId } },
    create: { employerId, candidateId, source, note: note?.trim() || null },
    update: { source, note: note?.trim() || null, clearedAt: null, clearedBy: null },
  })
}

// Retracts a false-positive flag WITHOUT deleting the row — the row itself
// is the audit trail of "a conflict was flagged and why," which must
// survive being cleared. clearedBy is the employer's own id for now
// (no admin override path built this phase).
export async function clearConflictFlag(employerId: string, candidateId: string, clearedBy: string): Promise<void> {
  await prisma.hiringConflictFlag.updateMany({
    where: { employerId, candidateId, clearedAt: null },
    data: { clearedAt: new Date(), clearedBy },
  })
}

export async function getActiveConflictFlags(employerId: string) {
  return prisma.hiringConflictFlag.findMany({
    where: { employerId, clearedAt: null },
    orderBy: { detectedAt: 'desc' },
  })
}

// The one predicate visibility checks need — "is this specific pairing
// currently blocked."
export async function isCandidateBlockedForEmployer(employerId: string, candidateId: string): Promise<boolean> {
  const flag = await prisma.hiringConflictFlag.findUnique({
    where: { employerId_candidateId: { employerId, candidateId } },
    select: { clearedAt: true },
  })
  return Boolean(flag && flag.clearedAt === null)
}

// Bulk version of the predicate above — for filtering a candidate list in
// one query instead of N. Used by getCandidatesLookingForYourRoles and the
// Candidate Inbox to exclude any candidate this employer has an uncleared
// conflict flag against.
export async function getBlockedCandidateIdsForEmployer(employerId: string): Promise<Set<string>> {
  const flags = await prisma.hiringConflictFlag.findMany({
    where: { employerId, clearedAt: null },
    select: { candidateId: true },
  })
  return new Set(flags.map((f) => f.candidateId))
}
