import 'server-only'
import { prisma } from '@/lib/prisma'
import { getRecruiterSettings } from '@/lib/admin/recruiter-settings'

// The opt-in pool: candidates who turned on recruiter visibility can be FOUND by a
// recruiter, but finding is not seeing. A recruiter sees a role-level description, asks
// for an introduction, and nothing more is visible until the candidate says yes. The
// existing consent machinery (src/lib/recruiter/introductions.ts) then takes over, so
// everything downstream of a yes behaves exactly as it does today.
//
// Deliberately NOT here: any score, ranking or "match" label. Pool results are filtered
// and ordered by recency only, so this surface cannot act as an automated screen.

/** A recruiter can have this many unanswered requests out at once. */
export const MAX_PENDING_REQUESTS = 25

export interface PoolFilters {
  function?: string
  level?: string
  location?: string
  school?: string
  industry?: string
}

export async function listPoolCandidates(recruiterId: string, userId: string | null, f: PoolFilters) {
  // Candidates this recruiter already has any relationship with are not "found" again.
  const known = await prisma.recruiterCandidateIntroduction.findMany({
    where: { recruiterId },
    select: { candidateId: true },
  })
  const own = userId ? await prisma.candidateProfile.findUnique({ where: { userId }, select: { id: true } }) : null
  const excluded = [...known.map((k) => k.candidateId), ...(own ? [own.id] : [])]

  return prisma.candidateProfile.findMany({
    where: {
      recruiterDatabaseOptIn: true,
      confidentialSearchMode: false,
      privacyTier: { notIn: ['LOCKED', 'STEALTH'] },
      assessmentComplete: true,
      id: { notIn: excluded },
      ...(f.function && { primaryFunction: f.function }),
      ...(f.level && { highestLevelReached: f.level }),
      ...(f.location && {
        OR: [
          { currentCity: { contains: f.location, mode: 'insensitive' as const } },
          { currentState: { contains: f.location, mode: 'insensitive' as const } },
        ],
      }),
      ...(f.school && {
        educationHistory: { some: { schoolNameNormalized: { contains: f.school.toLowerCase(), mode: 'insensitive' as const } } },
      }),
      ...(f.industry && {
        OR: [
          { workHistory: { some: { companyIndustry: { contains: f.industry, mode: 'insensitive' as const } } } },
          { targetIndustries: { has: f.industry } },
        ],
      }),
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      privacyTier: true,
      firstName: true,
      lastName: true,
      highestLevelReached: true,
      primaryFunction: true,
      currentCity: true,
      currentState: true,
    },
  })
}

export type RequestResult = { ok: true } | { ok: false; reason: 'limit' | 'not_available' }

export async function requestFromPool(recruiterId: string, candidateId: string): Promise<RequestResult> {
  const [pending, candidate, existing] = await Promise.all([
    prisma.recruiterCandidateIntroduction.count({ where: { recruiterId, status: 'REQUESTED' } }),
    prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: { recruiterDatabaseOptIn: true, confidentialSearchMode: true, privacyTier: true },
    }),
    prisma.recruiterCandidateIntroduction.findUnique({
      where: { recruiterId_candidateId: { recruiterId, candidateId } },
      select: { id: true },
    }),
  ])
  if (
    !candidate ||
    existing ||
    !candidate.recruiterDatabaseOptIn ||
    candidate.confidentialSearchMode ||
    candidate.privacyTier === 'LOCKED' ||
    candidate.privacyTier === 'STEALTH'
  ) {
    return { ok: false, reason: 'not_available' }
  }
  if (pending >= MAX_PENDING_REQUESTS) return { ok: false, reason: 'limit' }

  const intro = await prisma.recruiterCandidateIntroduction.create({
    // CANDIDATE_REQUESTED = the candidate's own opt-in to this recruiter; here it is the
    // candidate answering a request, and the ledger events below record who asked.
    data: { recruiterId, candidateId, status: 'REQUESTED', source: 'CANDIDATE_REQUESTED' },
  })
  await prisma.recruiterCandidateIntroductionEvent.create({
    data: { introductionId: intro.id, event: 'REQUESTED', actor: `recruiter:${recruiterId}`, detail: 'opt-in pool' },
  })
  return { ok: true }
}

export async function listRequestsForCandidate(candidateId: string) {
  return prisma.recruiterCandidateIntroduction.findMany({
    where: { candidateId, status: 'REQUESTED' },
    orderBy: { requestedAt: 'desc' },
    select: {
      id: true,
      requestedAt: true,
      recruiter: { select: { fullName: true, firmName: true } },
    },
  })
}

// Only the candidate the request is for can answer it, and only while it is REQUESTED.
export async function respondToRequest(candidateId: string, introductionId: string, approve: boolean): Promise<boolean> {
  const intro = await prisma.recruiterCandidateIntroduction.findFirst({
    where: { id: introductionId, candidateId, status: 'REQUESTED' },
    select: { id: true },
  })
  if (!intro) return false

  const { consentExpiryDays } = await getRecruiterSettings()
  await prisma.recruiterCandidateIntroduction.update({
    where: { id: intro.id },
    data: approve
      ? {
          status: 'CONSENTED',
          respondedAt: new Date(),
          consentExpiresAt: consentExpiryDays > 0 ? new Date(Date.now() + consentExpiryDays * 86_400_000) : null,
        }
      : { status: 'DECLINED', respondedAt: new Date() },
  })
  await prisma.recruiterCandidateIntroductionEvent.create({
    data: { introductionId: intro.id, event: approve ? 'CONSENTED' : 'DECLINED', actor: `candidate:${candidateId}` },
  })
  return true
}
