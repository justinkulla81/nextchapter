// The spec §10 demo script, run end to end against /i/demo, then the demo is
// reseeded. Also covers caseload assignment and the outreach composer.
//
//   1. Alumni Relations sees the WARN alert and sends outreach
//   2. The hero joins from that email
//   3. Development sees them in transition, do-not-solicit, no details
//   4. Career Services has them on a caseload, with their situation
//   5. The employer asks to meet them; they accept
//   6. They report a new job
//   7. After "advance time": thank-you ask ready, export shows the new
//      employer, ROI counts them
//
//   npm run verify:he-demo
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { DEMO_TENANTS } from '../../src/lib/higher-ed/demo-tenants'
import { advanceDemoTime, resetDemoInstitution } from '../../src/lib/higher-ed/demo-seed'
import { seedDemoContent } from '../../src/lib/institution/admin'
import { waitingFor } from '../../src/lib/higher-ed/inbox'
import { sendLayoffOutreach } from '../../src/lib/higher-ed/layoffs'
import { completeJoin, findMemberByToken } from '../../src/lib/higher-ed/join'
import { applyJourneyChange } from '../../src/lib/journey/apply'
import { listCaseloadActivity, listOpenTransitions, listSignals, updatesExportRows } from '../../src/lib/higher-ed/views'
import { assignToCaseload, autoAssign, counselors, endAssignment } from '../../src/lib/higher-ed/caseload'
import { requestIntro, respondToIntro, introStatusFor } from '../../src/lib/higher-ed/employers'
import { reportNewJob } from '../../src/lib/higher-ed/transition'
import { roiReport } from '../../src/lib/higher-ed/roi'
import { answerCheckIn } from '../../src/lib/higher-ed/checkins'
import { saveDraft, sendNextBatch, sendTestToSelf, unknownFields, audienceCount } from '../../src/lib/higher-ed/composer'
import { ALL_TOKENS, type AccessToken } from '../../src/lib/higher-ed/workspaces'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const SLUG = 'demo'
const userId = `demo-${SLUG}-hero-verify-${randomUUID().slice(0, 6)}`

async function reseed() {
  const r = await prisma.$transaction((tx) => resetDemoInstitution(tx, new Date(), DEMO_TENANTS[SLUG]), { timeout: 600_000, maxWait: 20_000 })
  await seedDemoContent(r.institutionId, 'demo-seed')
  return r.institutionId
}

async function main() {
  const institutionId = await reseed()
  try {
    const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { id: true, slug: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, isDemo: true, tier: true } })
    const ctx = { tokens: new Set<AccessToken>(ALL_TOKENS), institution: inst, staffUsers: [], mode: 'demo-admin' as const, email: 'verify@test', userId: 'verify', workspace: 'career' }
    const heroId = `${SLUG}_member_hero`

    // 1
    check('1. Alumni inbox shows the layoff alert', (await waitingFor(institutionId, 'alumni', '')).some((i) => i.key === 'layoffs'), true)
    const out = await sendLayoffOutreach({ institutionId, createdBy: 'verify' })
    check('1. Outreach to all three matches, demo not emailed', [out.sent, out.demo], [3, true])

    // 2
    const send = await prisma.outreachSend.findFirstOrThrow({ where: { memberId: heroId, campaign: { type: 'LAYOFF' } }, select: { claimToken: true } })
    const member = await findMemberByToken(SLUG, send.claimToken)
    check('2. The email link finds the hero', member?.id, heroId)
    // Created first: getOrCreateCandidateProfile reads request headers, which a script has none of.
    await prisma.candidateProfile.create({ data: { userId, isSampleData: true } })
    const joined = await completeJoin({ member: member!, userId, choices: { shareOutcome: true, shareSearchDetail: true, takeCalls: false } })
    await prisma.candidateProfile.update({ where: { id: joined.candidateId }, data: { isSampleData: true } })
    check('2. Hero is joined', (await prisma.institutionMember.findUniqueOrThrow({ where: { id: heroId }, select: { status: true } })).status, 'CLAIMED')
    const ctx2 = { ...ctx }
    await applyJourneyChange(joined.candidateId, { journey: 'LAID_OFF', source: 'SETTINGS' })

    // 3
    const t = (await listOpenTransitions(ctx2)).find((r) => r.memberId === heroId)
    check('3. Development sees the hero in transition, do-not-solicit', [t?.state, t?.doNotSolicit], ['IN_TRANSITION', true])
    check('3. No reason or source reaches Development', t ? Object.keys(t).some((k) => /reason|source/i.test(k)) : null, false)

    // 4 (caseload: auto-assign to the least-loaded counselor, move, remove)
    const team = await counselors(institutionId)
    const assignedTo = await autoAssign(institutionId, heroId)
    const leastLoaded = [...team].sort((a, b) => Number(a.role !== 'CAREER_SERVICES') - Number(b.role !== 'CAREER_SERVICES') || a.open - b.open)[0]
    check('4. Hero auto-assigned to the least-loaded counselor', assignedTo, leastLoaded.id)
    const row = (await listCaseloadActivity(ctx2)).find((r) => r.memberId === heroId)
    check('4. Caseload shows the hero with their situation (shared)', [row?.journey, row?.journeyStage], ['LAID_OFF', 'APPLYING'])
    const coach = team.find((x) => x.role === 'COACH')
    if (coach) {
      const moved = await assignToCaseload({ institutionId, memberId: heroId, counselorId: coach.id })
      check('4. Moving ends the old assignment', await prisma.caseloadAssignment.count({ where: { memberId: heroId, endedAt: null } }), 1)
      check('4. ... and the coach has them', (await prisma.caseloadAssignment.findFirstOrThrow({ where: { memberId: heroId, endedAt: null } })).counselorId, coach.id)
      check('4. Removing ends it', [await endAssignment(institutionId, (moved as { id: string }).id), await prisma.caseloadAssignment.count({ where: { memberId: heroId, endedAt: null } })], [true, 0])
    }

    // 5
    await prisma.institutionConsent.create({ data: { memberId: heroId, scope: 'SHARE_DOSSIER_WITH_EMPLOYERS', granted: true, source: 'MEMBER' } })
    await prisma.candidateProfile.update({ where: { id: joined.candidateId }, data: { positioningStatementText: 'Operations leader; plant turnarounds.' } })
    const employer = await prisma.institutionEmployer.findFirstOrThrow({ where: { institutionId, status: 'APPROVED' }, select: { employerProfileId: true } })
    const intro = await requestIntro({ institutionId, employerProfileId: employer.employerProfileId, memberId: heroId, requestedBy: 'verify', note: 'Ops role' })
    await respondToIntro(heroId, (intro as { id: string }).id, true)
    check('5. Employer asks, hero accepts, employer sees the email', (await introStatusFor(employer.employerProfileId, [heroId])).get(heroId)?.status, 'ACCEPTED')

    // 6 (an existing company, so no fictional Company row is created)
    const company = await prisma.company.findFirstOrThrow({ where: { name: { not: '' } }, orderBy: { createdAt: 'asc' }, select: { name: true } })
    const roiBefore = (await roiReport(institutionId)).roi.users
    await prisma.engagementEvent.create({ data: { institutionId, memberId: heroId, type: 'TOOL_USE', caseCategory: 'EXPERIENTIAL', points: 2, occurredAt: new Date(), sourceTable: 'verify', sourceId: userId } })
    const job = await reportNewJob({ memberId: heroId, candidateId: joined.candidateId, companyName: company.name, title: 'Director of Operations', startDate: new Date(), helpedByInstitution: true, shareMilestone: true, graceDays: 60 })
    check('6. New job moves the flag to its quiet period', job.flagMoved, true)

    // 7
    const adv = await advanceDemoTime(institutionId, 61)
    check('7. Advance time clears the quiet period and queues the thank-you', adv.gratitudePending >= 1, true)
    check('7. Thank-you ask is in Signals', (await listSignals(ctx2)).some((s) => s.memberId === heroId && s.kind === 'GRATITUDE'), true)
    const exp = (await updatesExportRows(ctx2)).find((r) => r.email === member!.email)
    check('7. Export shows the new employer and title', [exp?.employer, exp?.title, exp?.do_not_solicit], [company.name, 'Director of Operations', false])
    check('7. ROI counts the hero as a user', (await roiReport(institutionId)).roi.users, roiBefore + 1)

    // Check-in "laid off" auto-assigns
    const ci = await prisma.checkIn.findFirstOrThrow({ where: { member: { institutionId, caseloadAssignments: { none: { endedAt: null } } }, kind: 'CUSTOM' }, select: { id: true, memberId: true } })
    await answerCheckIn({ checkInId: ci.id, memberId: ci.memberId, answer: 'laid_off' })
    check('Check-in "laid off" lands on a caseload', await prisma.caseloadAssignment.count({ where: { memberId: ci.memberId, endedAt: null } }), 1)

    // Composer
    check('Composer catches a misspelled merge field', unknownFields('Hi {{firstname}} at {{college}}'), ['firstname'])
    const total = await audienceCount(institutionId, 'all')
    const draft = await saveDraft({ institutionId, subject: 'Hello {{firstName}}', body: 'From {{college}}: {{link}}', audience: 'all', createdBy: 'verify' })
    const test = await sendTestToSelf({ institutionId, campaignId: (draft as { id: string }).id, to: 'verify@test' })
    check('Composer test on a demo previews instead of emailing', [('demo' in test && test.demo), 'subject' in test && test.subject], [true, '[Test] Hello Jordan'])
    const b1 = await sendNextBatch({ institutionId, campaignId: (draft as { id: string }).id, createdBy: 'verify' })
    const b2 = await sendNextBatch({ institutionId, campaignId: (draft as { id: string }).id, createdBy: 'verify' })
    const b3 = await sendNextBatch({ institutionId, campaignId: (draft as { id: string }).id, createdBy: 'verify' })
    check('Composer sends in batches of 200 and never twice', [('sent' in b1 && b1.sent) + ('sent' in b2 && b2.sent), 'sent' in b3 && b3.sent], [total, 0])
    check('A sent email can no longer be edited', 'error' in (await saveDraft({ institutionId, id: (draft as { id: string }).id, subject: 'x', body: 'y', audience: 'all', createdBy: 'verify' })), true)
  } finally {
    await reseed()
    await prisma.roleGrant.deleteMany({ where: { userId } }).catch(() => {})
    await prisma.candidateProfile.deleteMany({ where: { userId } }).catch(() => {})
    await prisma.$disconnect()
  }
  console.log(`${passed} passed, ${failures.length} failed (demo reseeded)`)
  for (const f of failures) console.log('  FAIL ' + f)
  if (failures.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
