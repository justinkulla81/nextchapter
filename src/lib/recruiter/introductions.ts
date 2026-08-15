import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RecruiterIntroductionSource } from '@prisma/client'
import { getRecruiterSettings } from '@/lib/admin/recruiter-settings'

// The single place recruiter-side candidate visibility is decided —
// Partners Master Build Script §A6.2 ("Consented candidates only, never
// browsable") and §E3.6 ("Recruiters see only consented candidates, per
// introduction, revocable"). Every recruiter-facing surface that used to
// query CandidateProfile directly (search, candidate detail, messaging
// eligibility) should go through one of these instead of re-deriving its
// own visibility rule.

// Both visibility helpers below join to CandidateProfile and require
// confidentialSearchMode: false — Master Build Script §E3.1: "Confidential
// Search Mode is checked at every render and send path. One missed check
// exposes a live job." A candidate can enable Confidential Search Mode
// AFTER an introduction was already consented (backfilled or otherwise),
// and turning it on does not revoke any existing RecruiterCandidateIntroduction
// row — so "status: CONSENTED" alone is not sufficient for visibility.
// Checking it here, in the one place recruiter-side visibility is decided,
// means every caller (search list, candidate detail, messaging
// eligibility) inherits the protection instead of each one needing to
// remember to re-add it.

// Every candidateId this recruiter currently has an active (CONSENTED)
// introduction for. Callers scope their own CandidateProfile query to
// `id: { in: await getConsentedCandidateIds(recruiterId) }` — the consent
// check happens BEFORE any candidate data is fetched, not as a filter
// applied after a broader query already ran.
// Phase 3, §A6.4 — an expired consent stops granting visibility the moment
// `consentExpiresAt` passes, with no background job needed to flip status:
// this Prisma filter (OR null / in the future) is checked at read time,
// same enforcement point as the pre-existing confidentialSearchMode check
// below it.
const NOT_EXPIRED = { OR: [{ consentExpiresAt: null }, { consentExpiresAt: { gt: new Date() } }] }

export async function getConsentedCandidateIds(recruiterId: string): Promise<string[]> {
  const rows = await prisma.recruiterCandidateIntroduction.findMany({
    where: {
      recruiterId,
      status: 'CONSENTED',
      candidate: { confidentialSearchMode: false },
      ...NOT_EXPIRED,
    },
    select: { candidateId: true },
  })
  return rows.map((r) => r.candidateId)
}

export async function isCandidateConsentedForRecruiter(candidateId: string, recruiterId: string): Promise<boolean> {
  const row = await prisma.recruiterCandidateIntroduction.findFirst({
    where: {
      recruiterId,
      candidateId,
      status: 'CONSENTED',
      candidate: { confidentialSearchMode: false },
      ...NOT_EXPIRED,
    },
    select: { id: true },
  })
  return !!row
}

// Writes a CONSENTED introduction (idempotent — a no-op if one already
// exists in ANY status, so this never silently resurrects a REVOKED or
// DECLINED row). Called going forward from the one legitimate real-world
// relationship that currently creates consent without a dedicated
// request/approve UI: a candidate signing up through a recruiter's own
// SourcedCandidate invite (see finishAcceptingRecruiterSource in
// src/app/recruiters/(app)/candidates/actions.ts). Mirrors the
// RECRUITER_SOURCED backfill path in scripts/backfill-recruiter-
// introductions.ts.
export async function createConsentedIntroductionIfMissing(
  recruiterId: string,
  candidateId: string,
  source: RecruiterIntroductionSource,
  actor: string,
  detail?: string
): Promise<void> {
  const existing = await prisma.recruiterCandidateIntroduction.findUnique({
    where: { recruiterId_candidateId: { recruiterId, candidateId } },
    select: { id: true },
  })
  if (existing) return

  const { consentExpiryDays } = await getRecruiterSettings()
  const consentExpiresAt =
    consentExpiryDays > 0 ? new Date(Date.now() + consentExpiryDays * 24 * 60 * 60 * 1000) : null

  const introduction = await prisma.recruiterCandidateIntroduction.create({
    data: { recruiterId, candidateId, status: 'CONSENTED', source, respondedAt: new Date(), consentExpiresAt },
  })
  await prisma.recruiterCandidateIntroductionEvent.create({
    data: { introductionId: introduction.id, event: 'CONSENTED', actor, detail },
  })
}

// Scaffolding for a future introduction-request flow (not wired to any UI
// this phase — see the Phase 1 report for what's deliberately left
// incomplete here). Creates a REQUESTED row a candidate or coach could
// later approve/decline; today nothing consumes REQUESTED rows, so calling
// this alone does not grant visibility.
export async function requestIntroduction(
  recruiterId: string,
  candidateId: string,
  source: RecruiterIntroductionSource,
  actor: string
): Promise<void> {
  const existing = await prisma.recruiterCandidateIntroduction.findUnique({
    where: { recruiterId_candidateId: { recruiterId, candidateId } },
    select: { id: true, status: true },
  })
  if (existing && existing.status !== 'DECLINED') return

  const introduction = existing
    ? await prisma.recruiterCandidateIntroduction.update({
        where: { id: existing.id },
        data: { status: 'REQUESTED', requestedAt: new Date(), respondedAt: null },
      })
    : await prisma.recruiterCandidateIntroduction.create({
        data: { recruiterId, candidateId, status: 'REQUESTED', source },
      })

  await prisma.recruiterCandidateIntroductionEvent.create({
    data: { introductionId: introduction.id, event: 'REQUESTED', actor },
  })
}

export async function recordIntroductionEvent(
  recruiterId: string,
  candidateId: string,
  event: 'DOSSIER_VIEWED' | 'RESUME_VIEWED' | 'MESSAGED',
  actor: string,
  detail?: string
): Promise<void> {
  const introduction = await prisma.recruiterCandidateIntroduction.findUnique({
    where: { recruiterId_candidateId: { recruiterId, candidateId } },
    select: { id: true },
  })
  if (!introduction) return
  await prisma.recruiterCandidateIntroductionEvent.create({
    data: { introductionId: introduction.id, event, actor, detail },
  })
}
