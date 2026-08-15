// Phase 12 (Partners verification sweep) — §E4 item 12: "Seed data
// populates coach, recruiter, hiring, and employer surfaces with no empty
// states." Auditing the running dev database found the coach portal
// already had a real client (Coach.clients some), but:
//   - Recruiter: a real test Recruiter existed (justin.kulla+recruiter@
//     gmail.com) with ZERO consented introductions — /recruiters/search
//     would render its "you don't have any consented introductions" empty
//     state, not a real candidate.
//   - Employer: a real employer_admin RoleGrant existed for justin.kulla+
//     employer@gmail.com, but no OutplacementOrgUser row at all — that
//     account couldn't even reach the portal (getCurrentOutplacementOrgUser
//     redirects to /employer/signup with zero orgs, zero contracts, zero
//     seats to view).
//   - Hiring manager: zero HiringManager/HiringReq rows existed anywhere.
//
// This is a persistent, idempotent seed (unlike the throwaway create-then-
// delete-in-a-finally verification scripts, e.g. verify-recruiter-
// phase6.ts) — same "safe to re-run" contract as seed-commercial-config.ts.
// Every row this script creates is tagged isSampleData: true wherever the
// schema supports it (OutplacementEmployerOrg/Contract/Seat, HiringManager)
// so a future cleanup script can find and remove them without guessing.
// RecruiterCandidateIntroduction/RecruiterCandidateSubmission have no
// isSampleData column — those are identified by their known ids/actor
// string logged in this file's own idempotency checks below instead.
//
// Deliberately reuses the REAL lib functions this data would flow through
// in production (createConsentedIntroductionIfMissing, createSubmission,
// advanceSubmissionStage) rather than hand-writing Prisma creates for
// those two, so the seeded rows exercise (and stay consistent with) the
// same consent-ledger and req-auto-linking logic every other phase's
// verification already depends on. Those modules are 'server-only'-guarded
// — run via `--conditions=react-server` (see package.json's seed:resumes
// for the same trick) so the import doesn't throw outside a Server
// Component context.
//
// Does NOT touch any real candidate's own row — every CandidateProfile
// referenced below is only ever the target of a new FK from a NEW seed row
// (OutplacementSeat.candidateId, RecruiterCandidateIntroduction.candidateId,
// RecruiterCandidateSubmission.candidateId), never an UPDATE to
// CandidateProfile itself. All candidates in this dev database are already
// synthetic seed personas (see scripts/seed/seed_profiles.ts) — no
// production candidate data exists here to touch.
//
// Run: npm run seed:partners-demo

import { PrismaClient } from '@prisma/client'
import { createConsentedIntroductionIfMissing } from '../src/lib/recruiter/introductions'
import { createSubmission, advanceSubmissionStage } from '../src/lib/recruiter/submissions'

const prisma = new PrismaClient()

const SEED_ACTOR = 'system:seed-partners-demo-data'

// Real, existing Supabase-auth test accounts already used by this dev
// project's other single-role QA logins (justin.kulla+recruiter@gmail.com,
// justin.kulla+coach@gmail.com) — this one already held an employer_admin
// RoleGrant with nowhere to land. Not created by this script; only linked.
const EMPLOYER_ADMIN_USER_ID = 'ffaa9267-acc6-4fdc-8f90-0666fb9d1da7'
const EMPLOYER_ADMIN_EMAIL = 'justin.kulla+employer@gmail.com'

const RECRUITER_ID = 'cmry1aarn0001q2cvemydddm2' // justin.kulla+recruiter@gmail.com
const DEMO_CANDIDATE_ID = 'cms7smomb0006jj04m4pwu1di' // Justin Kulla — PUBLIC, assessmentComplete, eligible for recruiter/hiring visibility

const DEMO_COMPANY_NAME = 'Beacon Analytics'
const DEMO_ROLE_TITLE = 'Chief Financial Officer'

async function seedEmployerPortal(): Promise<void> {
  let org = await prisma.outplacementEmployerOrg.findFirst({ where: { isSampleData: true } })
  if (!org) {
    org = await prisma.outplacementEmployerOrg.create({
      data: {
        name: 'Meridian Health',
        programBrandName: 'Meridian Health Careers',
        primaryContactName: 'Justin Kulla',
        primaryContactEmail: EMPLOYER_ADMIN_EMAIL,
        isSampleData: true,
      },
    })
    console.log(`Created sample OutplacementEmployerOrg ${org.id} (Meridian Health)`)
  } else {
    console.log(`Sample OutplacementEmployerOrg already exists (${org.id}) — skipping org creation`)
  }

  const existingOrgUser = await prisma.outplacementOrgUser.findUnique({ where: { userId: EMPLOYER_ADMIN_USER_ID } })
  if (!existingOrgUser) {
    await prisma.outplacementOrgUser.create({
      data: {
        orgId: org.id,
        role: 'ADMIN',
        invitedEmail: EMPLOYER_ADMIN_EMAIL,
        fullName: 'Justin Kulla',
        userId: EMPLOYER_ADMIN_USER_ID,
        acceptedAt: new Date(),
      },
    })
    console.log(`Linked existing employer_admin RoleGrant (${EMPLOYER_ADMIN_USER_ID}) to the sample org`)
  } else {
    console.log('Employer admin org-user link already exists — skipping')
  }

  let contract = await prisma.outplacementContract.findFirst({ where: { orgId: org.id, isSampleData: true } })
  const SEAT_COUNT = 24 // >= EMPLOYER_ROUNDING_THRESHOLD's 20-seat quarterly floor and >= EMPLOYER_MIN_CELL_SIZE, so
  // both the roster (item-level) AND the aggregate reporting views have
  // real, non-suppressed numbers to show — not just an unsuppressed-but-
  // empty roster.
  if (!contract) {
    const now = new Date()
    const termStartAt = new Date(now)
    termStartAt.setMonth(termStartAt.getMonth() - 4)
    const termEndAt = new Date(now)
    termEndAt.setMonth(termEndAt.getMonth() + 8)

    contract = await prisma.outplacementContract.create({
      data: {
        orgId: org.id,
        cohortLabel: 'Corporate RIF — Fall 2026',
        tier: 'PLUS',
        seatCount: SEAT_COUNT,
        termStartAt,
        termEndAt,
        status: 'ACTIVE',
        createdBy: SEED_ACTOR,
        isSampleData: true,
      },
    })
    console.log(`Created sample OutplacementContract ${contract.id} (${SEAT_COUNT} seats)`)
  } else {
    console.log(`Sample OutplacementContract already exists (${contract.id}) — skipping contract/seat creation`)
    return
  }

  const candidatePool = await prisma.candidateProfile.findMany({
    where: { id: { not: DEMO_CANDIDATE_ID }, outplacementSeats: { none: {} } },
    take: 14,
    orderBy: { createdAt: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  })

  if (candidatePool.length < 14) {
    console.warn(
      `Only found ${candidatePool.length} candidates with no existing seat — seeding fewer ACTIVATED seats than planned.`
    )
  }

  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

  const seatRows: {
    invitedEmail: string
    invitedName: string | null
    status: 'ACTIVATED' | 'INVITED' | 'DEACTIVATED'
    candidateId: string | null
    enrolledAt: Date
    activatedAt: Date | null
    deactivatedAt: Date | null
    placedAt: Date | null
  }[] = []

  candidatePool.forEach((c, i) => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || `Seed Candidate ${i + 1}`
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/(^\.|\.$)/g, '')
    const enrolledAt = daysAgo(120 - i * 4)
    const activatedAt = daysAgo(115 - i * 4)
    // First 3 already placed — gives getTimeToPlacementBenchmarks /
    // getBoomerangSignal real (if still-below-cell-size) rows to compute
    // over instead of every function returning hasEnoughData: false.
    const placedAt = i < 3 ? daysAgo(20 - i * 5) : null
    seatRows.push({
      invitedEmail: `${slug || 'seed-employee-' + i}+meridian-seed@example.com`,
      invitedName: name,
      status: 'ACTIVATED',
      candidateId: c.id,
      enrolledAt,
      activatedAt,
      deactivatedAt: null,
      placedAt,
    })
  })

  // 2 deactivated (no linked candidate — mirrors a seat that was invited
  // and then withdrawn before ever being claimed).
  for (let i = 0; i < 2; i++) {
    seatRows.push({
      invitedEmail: `seed-employee-deactivated-${i}+meridian-seed@example.com`,
      invitedName: null,
      status: 'DEACTIVATED',
      candidateId: null,
      enrolledAt: daysAgo(90),
      activatedAt: null,
      deactivatedAt: daysAgo(60),
      placedAt: null,
    })
  }

  // Remaining seats (up to SEAT_COUNT) still INVITED — never activated,
  // no candidate linked, exactly like a real freshly-enrolled seat
  // awaiting the invitee's first login.
  const remaining = SEAT_COUNT - seatRows.length
  for (let i = 0; i < remaining; i++) {
    seatRows.push({
      invitedEmail: `seed-employee-invited-${i}+meridian-seed@example.com`,
      invitedName: null,
      status: 'INVITED',
      candidateId: null,
      enrolledAt: daysAgo(10 + i),
      activatedAt: null,
      deactivatedAt: null,
      placedAt: null,
    })
  }

  for (const seat of seatRows) {
    await prisma.outplacementSeat.create({
      data: {
        contractId: contract.id,
        invitedEmail: seat.invitedEmail,
        invitedName: seat.invitedName,
        enrollmentMethod: 'BULK_CSV',
        status: seat.status,
        candidateId: seat.candidateId,
        enrolledAt: seat.enrolledAt,
        activatedAt: seat.activatedAt,
        deactivatedAt: seat.deactivatedAt,
        placedAt: seat.placedAt,
        isSampleData: true,
      },
    })
  }
  console.log(`Created ${seatRows.length} sample OutplacementSeat rows on contract ${contract.id}`)
}

async function seedHiringManagerPortal(): Promise<{ hiringManagerId: string }> {
  let hiringManager = await prisma.hiringManager.findFirst({ where: { isSampleData: true } })
  if (!hiringManager) {
    hiringManager = await prisma.hiringManager.create({
      data: {
        fullName: 'Priya Anand',
        workEmail: 'hiring-demo+beacon@example.com',
        companyName: DEMO_COMPANY_NAME,
        isSampleData: true,
        // No userId — this is a claimable dev fixture, not a real Supabase
        // account. Creating a new auth account is out of this script's
        // (and this session's) scope; whoever wants a real logged-in demo
        // for the hiring-manager portal can complete /hiring/signup with
        // this same work email and the row above will be claimed by it
        // (see completeHiringManagerSignupFromSession).
      },
    })
    console.log(`Created sample HiringManager ${hiringManager.id} (${DEMO_COMPANY_NAME})`)
  } else {
    console.log(`Sample HiringManager already exists (${hiringManager.id}) — skipping`)
  }

  const existingReq = await prisma.hiringReq.findFirst({ where: { hiringManagerId: hiringManager.id, title: DEMO_ROLE_TITLE } })
  if (!existingReq) {
    const req = await prisma.hiringReq.create({
      data: { hiringManagerId: hiringManager.id, title: DEMO_ROLE_TITLE, status: 'OPEN' },
    })
    console.log(`Created sample HiringReq ${req.id} (${DEMO_ROLE_TITLE})`)
  } else {
    console.log('Sample HiringReq already exists — skipping')
  }

  return { hiringManagerId: hiringManager.id }
}

async function seedRecruiterIntroductionAndSubmission(): Promise<void> {
  await createConsentedIntroductionIfMissing(
    RECRUITER_ID,
    DEMO_CANDIDATE_ID,
    'ADMIN_INTRODUCED',
    SEED_ACTOR,
    'Phase 12 seed — Partners portal QA/demo coverage (§E4 item 12).'
  )
  console.log(`Ensured CONSENTED RecruiterCandidateIntroduction (${RECRUITER_ID} -> ${DEMO_CANDIDATE_ID})`)

  const existingSubmission = await prisma.recruiterCandidateSubmission.findFirst({
    where: { recruiterId: RECRUITER_ID, candidateId: DEMO_CANDIDATE_ID, companyName: DEMO_COMPANY_NAME },
  })
  if (existingSubmission) {
    console.log(`Sample RecruiterCandidateSubmission already exists (${existingSubmission.id}) — skipping`)
    return
  }

  const { error, submissionId } = await createSubmission(RECRUITER_ID, DEMO_CANDIDATE_ID, DEMO_ROLE_TITLE, DEMO_COMPANY_NAME)
  if (error || !submissionId) {
    console.error(`Failed to create sample submission: ${error}`)
    return
  }
  // REVIEWED -> SCREENED -> SUBMITTED -> INTERVIEWED. Stopping short of
  // PLACED/PASSED (terminal stages) so the hiring-manager portal shows a
  // real submission genuinely in flight, not one that immediately reads
  // as closed-out. Crossing SUBMITTED triggers autoLinkSubmissionToReq
  // (companyName/roleTitle exact-match the HiringReq seeded above), which
  // is what actually makes this submission visible to the hiring manager.
  await advanceSubmissionStage(submissionId, RECRUITER_ID, 'SCREENED')
  await advanceSubmissionStage(submissionId, RECRUITER_ID, 'SUBMITTED')
  await advanceSubmissionStage(submissionId, RECRUITER_ID, 'INTERVIEWED')
  console.log(`Created sample RecruiterCandidateSubmission ${submissionId}, advanced to INTERVIEWED and auto-linked to the req`)
}

async function main() {
  console.log('Seeding Partners portal demo/QA data (idempotent, safe to re-run)...\n')
  await seedEmployerPortal()
  const { hiringManagerId } = await seedHiringManagerPortal()
  await seedRecruiterIntroductionAndSubmission()

  const submission = await prisma.recruiterCandidateSubmission.findFirst({
    where: { recruiterId: RECRUITER_ID, candidateId: DEMO_CANDIDATE_ID, companyName: DEMO_COMPANY_NAME },
    select: { id: true, stage: true, reqId: true },
  })
  console.log('\nDone. Final submission state:', submission)
  if (submission && !submission.reqId) {
    console.warn(
      `WARNING: submission ${submission.id} did not auto-link to HiringReq — hiring-manager portal (manager ${hiringManagerId}) will still show an empty "my candidates" list. Check companyName/title matching in req-matching.ts.`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
