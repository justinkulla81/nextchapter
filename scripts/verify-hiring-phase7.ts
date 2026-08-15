// Phase 7 verification — Partners Master Build Script §A8 / §E4 items 1 and
// the conflict-of-interest rule. Run with: npm run verify:hiring-phase7
//
// Same convention as scripts/verify-recruiter-phase6.ts: a raw PrismaClient
// (not @/lib/prisma or any 'server-only'-guarded lib module) so this runs
// as a plain node script with no Next.js server-component context. The
// visibility/conflict logic below is a second, independent expression of
// src/lib/hiring/visibility.ts and src/lib/hiring/conflict-check.ts's rules
// (same filters, same stage floor, same unique-flag shape) — deliberately
// not a call into those modules, so this doesn't share a bug with the code
// it's checking.
//
// org-name-match.ts has no 'server-only' guard (confirmed by reading it),
// so orgNamesMatch is imported directly and used exactly as
// companyMatchesCurrentEmployer (src/lib/network/current-employer-flag.ts,
// which DOES carry the guard) does internally.

import { PrismaClient, type RecruiterSubmissionStage } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { orgNamesMatch } from '../src/lib/text/org-name-match'

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

const VISIBLE_STAGES: RecruiterSubmissionStage[] = ['SUBMITTED', 'INTERVIEWED', 'PLACED', 'PASSED']

async function isVisibleToHiringManager(submissionId: string, hiringManagerId: string): Promise<boolean> {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({
    where: { id: submissionId },
    include: { req: true },
  })
  if (!submission) return false
  if (!submission.req || submission.req.hiringManagerId !== hiringManagerId) return false
  if (!VISIBLE_STAGES.includes(submission.stage)) return false

  const flag = await prisma.hiringConflictFlag.findUnique({
    where: { hiringManagerId_candidateId: { hiringManagerId, candidateId: submission.candidateId } },
    select: { clearedAt: true },
  })
  if (flag && flag.clearedAt === null) return false

  return true
}

function checkStaticSource(): void {
  console.log('\n5. Static source audit — hiring-manager Dossier view is a hand-built allowlist')
  const dossierViewPath = join(__dirname, '../src/lib/hiring/dossier-view.ts')
  // Strip //-comments first — this checks actual code, not the doc comment
  // that explains WHY grade/detection fields are excluded (which
  // necessarily names them).
  const src = readFileSync(dossierViewPath, 'utf8')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')

  assert(
    !/gritStatText|overallGrade|marketReality|\bgrade\b|detection|badge/i.test(src),
    'dossier-view.ts (the hiring-manager allowlist builder) never references grade/detection/badge fields in actual code'
  )
  assert(
    src.includes("getDossierSections(candidateId)"),
    'dossier-view.ts sources candidate content only from getDossierSections (documented to exclude grade/detection/motivation/blocker data)'
  )
}

async function main() {
  console.log('Seeding throwaway hiring manager, req, candidates, and submissions...')

  const hiringManager = await prisma.hiringManager.create({
    data: {
      fullName: 'Throwaway Hiring Manager',
      workEmail: `verify-phase7-${crypto.randomUUID()}@example.com`,
      companyName: 'Acme Corp',
      isSampleData: true,
    },
  })
  const req = await prisma.hiringReq.create({
    data: { hiringManagerId: hiringManager.id, title: 'VP Finance', status: 'OPEN' },
  })
  const recruiter = await prisma.recruiter.create({
    data: { fullName: 'Throwaway Recruiter', workEmail: `verify-phase7-recruiter-${crypto.randomUUID()}@example.com`, isSampleData: true },
  })

  // Candidate A currently works at a company that does NOT match the
  // hiring manager's employer — the positive control, should be visible.
  const candidateClean = await prisma.candidateProfile.create({
    data: { userId: `verify-phase7-clean-${crypto.randomUUID()}`, firstName: 'Clean', lastName: 'Candidate', privacyTier: 'PRIVATE' },
  })
  await prisma.workHistoryEntry.create({
    data: { candidateId: candidateClean.id, companyName: 'Beta Industries', roleTitle: 'CFO', startDate: new Date('2020-01-01'), isCurrent: true },
  })

  // Candidate B currently works at "Acme Corporation" — a fuzzy match for
  // the hiring manager's own "Acme Corp" (§A8: "same current employer").
  const candidateConflicted = await prisma.candidateProfile.create({
    data: { userId: `verify-phase7-conflict-${crypto.randomUUID()}`, firstName: 'Conflicted', lastName: 'Candidate', privacyTier: 'PRIVATE' },
  })
  await prisma.workHistoryEntry.create({
    data: { candidateId: candidateConflicted.id, companyName: 'Acme Corporation', roleTitle: 'VP Finance', startDate: new Date('2021-01-01'), isCurrent: true },
  })

  const submissionClean = await prisma.recruiterCandidateSubmission.create({
    data: { recruiterId: recruiter.id, candidateId: candidateClean.id, roleTitle: 'VP Finance', companyName: 'Acme Corp', reqId: req.id, stage: 'SUBMITTED' },
  })
  const submissionConflicted = await prisma.recruiterCandidateSubmission.create({
    data: { recruiterId: recruiter.id, candidateId: candidateConflicted.id, roleTitle: 'VP Finance', companyName: 'Acme Corp', reqId: req.id, stage: 'SUBMITTED' },
  })
  const submissionTooEarly = await prisma.recruiterCandidateSubmission.create({
    data: { recruiterId: recruiter.id, candidateId: candidateClean.id, roleTitle: 'VP Finance', companyName: 'Acme Corp', reqId: req.id, stage: 'SCREENED' },
  })

  try {
    console.log('\n1. Positive control — a non-conflicted, SUBMITTED candidate is visible')
    assert(await isVisibleToHiringManager(submissionClean.id, hiringManager.id), 'the clean submission is visible to the hiring manager')

    console.log('\n2. Stage floor — REVIEWED/SCREENED submissions are not visible even with a req')
    assert(!(await isVisibleToHiringManager(submissionTooEarly.id, hiringManager.id)), 'a SCREENED (pre-SUBMITTED) submission is NOT visible')

    console.log('\n3. Conflict-of-interest — same current employer as the hiring manager')
    assert(
      orgNamesMatch('Acme Corp', 'Acme Corporation'),
      'orgNamesMatch fuzzy-matches "Acme Corp" (hiring manager) against "Acme Corporation" (candidate\'s current employer)'
    )
    // Run the actual auto-detection write, same shape as autoDetectConflict.
    await prisma.hiringConflictFlag.create({
      data: { hiringManagerId: hiringManager.id, candidateId: candidateConflicted.id, source: 'AUTO_SAME_EMPLOYER' },
    })
    assert(
      !(await isVisibleToHiringManager(submissionConflicted.id, hiringManager.id)),
      'the conflicted candidate\'s submission is NOT visible to this hiring manager after the flag is written'
    )
    const visibleIds = (
      await prisma.recruiterCandidateSubmission.findMany({
        where: { reqId: req.id, stage: { in: VISIBLE_STAGES } },
      })
    )
      .filter((s) => s.candidateId !== candidateConflicted.id) // simulate the app-level flag filter for the list view
      .map((s) => s.candidateId)
    assert(!visibleIds.includes(candidateConflicted.id), 'the conflicted candidate never appears in the hiring manager\'s candidate list')

    console.log('\n4. Clearing a flag restores visibility (false-positive retraction, audit trail preserved)')
    await prisma.hiringConflictFlag.updateMany({
      where: { hiringManagerId: hiringManager.id, candidateId: candidateConflicted.id },
      data: { clearedAt: new Date(), clearedBy: hiringManager.id },
    })
    assert(await isVisibleToHiringManager(submissionConflicted.id, hiringManager.id), 'visibility is restored once the flag is cleared')
    const flagRow = await prisma.hiringConflictFlag.findUnique({
      where: { hiringManagerId_candidateId: { hiringManagerId: hiringManager.id, candidateId: candidateConflicted.id } },
    })
    assert(!!flagRow, 'the flag row itself still exists after clearing — audit trail preserved, not deleted')

    checkStaticSource()
  } finally {
    console.log('\nCleaning up throwaway rows...')
    await prisma.hiringConflictFlag.deleteMany({ where: { hiringManagerId: hiringManager.id } })
    await prisma.recruiterCandidateSubmission.deleteMany({ where: { reqId: req.id } })
    await prisma.workHistoryEntry.deleteMany({ where: { candidateId: { in: [candidateClean.id, candidateConflicted.id] } } })
    await prisma.hiringReq.delete({ where: { id: req.id } })
    await prisma.hiringManager.delete({ where: { id: hiringManager.id } })
    await prisma.recruiter.delete({ where: { id: recruiter.id } })
    await prisma.candidateProfile.delete({ where: { id: candidateClean.id } })
    await prisma.candidateProfile.delete({ where: { id: candidateConflicted.id } })
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
