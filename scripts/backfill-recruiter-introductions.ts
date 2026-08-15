// One-time backfill for the recruiter-portal consent fix (Partners Master
// Build Script §A6.2 — "Consented candidates only, never browsable").
//
// src/app/recruiters/(app)/search/page.tsx used to run a direct Prisma
// query across every CandidateProfile matching a privacy-tier filter — any
// recruiter could browse any opted-in candidate. That's now replaced with a
// hard block: a recruiter can only see a candidate through an active
// CONSENTED row in RecruiterCandidateIntroduction (see
// src/lib/recruiter/introductions.ts).
//
// Without this backfill, every existing recruiter would suddenly see zero
// candidates the moment that fix ships. This script creates a CONSENTED
// introduction for every (recruiter, candidate) pair that already has real,
// unambiguous engagement — not "was theoretically browsable," but "these
// two parties have actually interacted":
//
//   1. A SourcedCandidate row with status SIGNED_UP (candidateId set) — the
//      candidate actually joined through THIS recruiter's own direct
//      outreach. (ALREADY_HAD_ACCOUNT rows never get a candidateId — see
//      inviteSourcedCandidate — so they never contribute a pair here; that
//      status just means the invite failed because the email already had
//      an unrelated account, not a real relationship with this recruiter.)
//      Source: RECRUITER_SOURCED.
//   2. A MessageThread already exists between this recruiter and this
//      candidate — they've actually messaged. Source: ENGAGEMENT_BACKFILL.
//      (Only recorded if no RECRUITER_SOURCED row already covers the pair.)
//
// Anything short of that — e.g. a candidate merely opted into the general
// recruiter database (recruiterDatabaseOptIn) without ever having been
// sourced or messaged by a specific recruiter — is deliberately NOT
// backfilled. That blanket-visible state is exactly what this fix removes;
// carrying it forward as a "consented" row would just reintroduce the same
// browsability under a new name.
//
// Idempotent — the unique constraint on [recruiterId, candidateId] means a
// re-run only fills in pairs that don't already have a row.
//
// Run: npm run backfill:recruiter-introductions

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Pair {
  recruiterId: string
  candidateId: string
}

function pairKey(p: Pair): string {
  return `${p.recruiterId}::${p.candidateId}`
}

async function main() {
  const [sourcedRows, threadRows, introCountBefore] = await Promise.all([
    prisma.sourcedCandidate.findMany({
      where: { status: 'SIGNED_UP', candidateId: { not: null } },
      select: { recruiterId: true, candidateId: true },
    }),
    prisma.messageThread.findMany({
      where: { partnerType: 'RECRUITER', recruiterId: { not: null }, candidateId: { not: null } },
      select: { recruiterId: true, candidateId: true },
    }),
    prisma.recruiterCandidateIntroduction.count(),
  ])

  const sourcedPairs: Pair[] = sourcedRows
    .filter((r): r is { recruiterId: string; candidateId: string } => !!r.candidateId)
    .map((r) => ({ recruiterId: r.recruiterId, candidateId: r.candidateId }))
  const threadPairs: Pair[] = threadRows
    .filter((r): r is { recruiterId: string; candidateId: string } => !!r.recruiterId && !!r.candidateId)
    .map((r) => ({ recruiterId: r.recruiterId!, candidateId: r.candidateId! }))

  const sourcedKeys = new Set(sourcedPairs.map(pairKey))
  // Dedupe within each source and drop thread pairs already covered by a
  // sourced pair (RECRUITER_SOURCED is the stronger/more specific signal).
  const seenSourced = new Set<string>()
  const uniqueSourcedPairs = sourcedPairs.filter((p) => {
    const key = pairKey(p)
    if (seenSourced.has(key)) return false
    seenSourced.add(key)
    return true
  })
  const seenThread = new Set<string>()
  const uniqueThreadOnlyPairs = threadPairs.filter((p) => {
    const key = pairKey(p)
    if (sourcedKeys.has(key) || seenThread.has(key)) return false
    seenThread.add(key)
    return true
  })

  console.log('--- Before ---')
  console.log({
    sourcedSignedUp: sourcedRows.length,
    uniqueSourcedPairs: uniqueSourcedPairs.length,
    recruiterMessageThreads: threadRows.length,
    uniqueThreadOnlyPairs: uniqueThreadOnlyPairs.length,
    introCountBefore,
  })

  let created = 0
  let alreadyExisted = 0

  async function backfillPair(pair: Pair, source: 'RECRUITER_SOURCED' | 'ENGAGEMENT_BACKFILL') {
    const existing = await prisma.recruiterCandidateIntroduction.findUnique({
      where: { recruiterId_candidateId: { recruiterId: pair.recruiterId, candidateId: pair.candidateId } },
      select: { id: true },
    })
    if (existing) {
      alreadyExisted++
      return
    }

    const introduction = await prisma.recruiterCandidateIntroduction.create({
      data: {
        recruiterId: pair.recruiterId,
        candidateId: pair.candidateId,
        status: 'CONSENTED',
        source,
        respondedAt: new Date(),
      },
    })
    await prisma.recruiterCandidateIntroductionEvent.create({
      data: {
        introductionId: introduction.id,
        event: 'CONSENTED',
        actor: 'system:backfill',
        detail:
          source === 'RECRUITER_SOURCED'
            ? 'Backfilled — candidate signed up (or already had an account) through this recruiter\'s own sourcing invite.'
            : 'Backfilled — an existing message thread between this recruiter and candidate is real, pre-existing engagement.',
      },
    })
    created++
  }

  for (const pair of uniqueSourcedPairs) {
    await backfillPair(pair, 'RECRUITER_SOURCED')
  }
  for (const pair of uniqueThreadOnlyPairs) {
    await backfillPair(pair, 'ENGAGEMENT_BACKFILL')
  }

  const introCountAfter = await prisma.recruiterCandidateIntroduction.count()
  const expectedTotal = uniqueSourcedPairs.length + uniqueThreadOnlyPairs.length
  console.log('--- After ---')
  console.log({ created, alreadyExisted, expectedTotal, introCountBefore, introCountAfter })

  if (introCountAfter !== introCountBefore + created) {
    throw new Error(
      `Snapshot mismatch: expected ${introCountBefore + created} RecruiterCandidateIntroduction rows after backfill, found ${introCountAfter}.`
    )
  }
  if (created + alreadyExisted !== expectedTotal) {
    throw new Error(
      `Pair accounting mismatch: created(${created}) + alreadyExisted(${alreadyExisted}) !== expectedTotal(${expectedTotal}).`
    )
  }

  // Verify every intended pair now resolves to an active CONSENTED row.
  const allPairs = [...uniqueSourcedPairs, ...uniqueThreadOnlyPairs]
  let unverified = 0
  for (const pair of allPairs) {
    const row = await prisma.recruiterCandidateIntroduction.findUnique({
      where: { recruiterId_candidateId: { recruiterId: pair.recruiterId, candidateId: pair.candidateId } },
      select: { status: true },
    })
    if (!row || row.status !== 'CONSENTED') unverified++
  }
  if (unverified > 0) {
    throw new Error(`${unverified} of ${allPairs.length} backfilled pairs do not resolve to an active CONSENTED row.`)
  }

  console.log(`Backfill verified OK — ${allPairs.length} pairs all resolve to an active CONSENTED introduction.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
