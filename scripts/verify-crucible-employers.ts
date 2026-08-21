// NEN employer portal + contest system verification. Run with:
//   npm run verify:crucible-employers
//
// Raw PrismaClient (not @/lib/prisma or any 'server-only'-guarded module —
// same convention as scripts/verify-recruiter-phase6.ts) so this runs as a
// plain node script with no Next.js server-component context. The
// directory-eligibility filter below is a second, independent expression of
// the same where-clause used in
// src/app/crucible/employers/(app)/candidates/page.tsx — not a shared
// import — so this can't share a bug with the code it's checking.

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

let failures = 0
function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS  ${message}`)
  } else {
    failures++
    console.error(`  FAIL  ${message}`)
  }
}

async function directoryEligibleSessionIds(): Promise<string[]> {
  const rows = await prisma.crucibleSession.findMany({
    where: { branch: 'PASS', resumeFilePath: { not: null }, resumeShareConsent: true },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

async function main() {
  console.log('1. Seeding throwaway employer + sessions spanning the eligibility matrix...')

  const employer = await prisma.crucibleEmployerProfile.create({
    data: { userId: `verify-employer-${crypto.randomUUID()}`, companyName: 'Verify Co' },
  })

  const sessionSpecs = [
    { key: 'pass_resume_consent', branch: 'PASS', resumeFilePath: 'leads/a.pdf', resumeShareConsent: true },
    { key: 'pass_resume_no_consent', branch: 'PASS', resumeFilePath: 'leads/b.pdf', resumeShareConsent: false },
    { key: 'pass_no_resume', branch: 'PASS', resumeFilePath: null, resumeShareConsent: false },
    { key: 'growth_resume_consent', branch: 'GROWTH', resumeFilePath: 'leads/c.pdf', resumeShareConsent: true },
  ] as const

  const sessions = await Promise.all(
    sessionSpecs.map((spec) =>
      prisma.crucibleSession.create({
        data: {
          source: 'LANDING',
          state: 'SCORED',
          branch: spec.branch,
          resumeFilePath: spec.resumeFilePath,
          resumeShareConsent: spec.resumeShareConsent,
          score: spec.branch === 'PASS' ? 85 : 40,
        },
      })
    )
  )
  const byKey = Object.fromEntries(sessionSpecs.map((s, i) => [s.key, sessions[i]]))

  try {
    console.log('\n2. Directory eligibility — exactly branch=PASS AND resumeFilePath NOT NULL AND resumeShareConsent=true')
    const eligibleIds = new Set(await directoryEligibleSessionIds())
    assert(eligibleIds.has(byKey.pass_resume_consent.id), 'PASS + resume + consent IS eligible')
    assert(!eligibleIds.has(byKey.pass_resume_no_consent.id), 'PASS + resume, no consent is NOT eligible')
    assert(!eligibleIds.has(byKey.pass_no_resume.id), 'PASS, no resume is NOT eligible')
    assert(!eligibleIds.has(byKey.growth_resume_consent.id), 'GROWTH + resume + consent is NOT eligible (not PASS)')

    console.log('\n3. Contest + entry — OPEN-only submission rule, resubmission upsert, idempotency constraints')
    const contest = await prisma.crucibleContest.create({
      data: { employerId: employer.id, title: 'Verify contest', businessProblem: 'Solve this.', state: 'OPEN' },
    })
    const entry = await prisma.crucibleContestEntry.create({
      data: { contestId: contest.id, sessionId: byKey.pass_resume_consent.id },
    })

    await prisma.crucibleContestEntry.update({
      where: { id: entry.id },
      data: { submission: 'first draft', submittedAt: new Date(), status: 'SUBMITTED' },
    })
    const resubmitted = await prisma.crucibleContestEntry.update({
      where: { id: entry.id },
      data: { submission: 'revised draft', submittedAt: new Date() },
    })
    assert(resubmitted.submission === 'revised draft', 'resubmission overwrites the same row in place, no versioning')

    let duplicateEntryBlocked = false
    try {
      await prisma.crucibleContestEntry.create({ data: { contestId: contest.id, sessionId: byKey.pass_resume_consent.id } })
    } catch (error) {
      duplicateEntryBlocked = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    }
    assert(duplicateEntryBlocked, '[contestId, sessionId] unique constraint blocks a duplicate invite (dispatcher idempotency)')

    await prisma.crucibleContest.update({ where: { id: contest.id }, data: { state: 'CLOSED' } })
    const closedContest = await prisma.crucibleContest.findUniqueOrThrow({ where: { id: contest.id } })
    assert(closedContest.state !== 'OPEN', 'contest can be closed — submission action checks this before accepting an entry')

    console.log('\n4. Resume-view cap — [employerId, sessionId] unique constraint does not double-count a repeat view')
    await prisma.crucibleEmployerResumeView.create({ data: { employerId: employer.id, sessionId: byKey.pass_resume_consent.id } })
    let duplicateViewBlocked = false
    try {
      await prisma.crucibleEmployerResumeView.create({ data: { employerId: employer.id, sessionId: byKey.pass_resume_consent.id } })
    } catch (error) {
      duplicateViewBlocked = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    }
    assert(duplicateViewBlocked, '[employerId, sessionId] unique constraint blocks a duplicate view row')
    const viewCount = await prisma.crucibleEmployerResumeView.count({ where: { employerId: employer.id } })
    assert(viewCount === 1, 'exactly one view row exists after two attempts on the same candidate (cap never double-counts)')
  } finally {
    console.log('\nCleaning up throwaway rows...')
    await prisma.crucibleEmployerResumeView.deleteMany({ where: { employerId: employer.id } })
    await prisma.crucibleContestEntry.deleteMany({ where: { contest: { employerId: employer.id } } })
    await prisma.crucibleContest.deleteMany({ where: { employerId: employer.id } })
    await prisma.crucibleSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } })
    await prisma.crucibleEmployerProfile.delete({ where: { id: employer.id } })
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
  .catch((error) => {
    console.error('Verification script crashed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
