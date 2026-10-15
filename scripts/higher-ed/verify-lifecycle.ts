// The college at every stage, against the real database on a throwaway
// college deleted at the end: alumni intros, office hours, events and their
// engagement, segments (and the composer sending to one), learners kept out
// of alumni email, completion rules and credentials, the ETPL rows, rapid
// response sign-ups, the outcomes report's suppression, stage help, program
// recommendations, and Eastern-time parsing.
//
//   npm run verify:lifecycle
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { addOfficeHours, alumniAtCompany, answerAlumniIntro, bookOfficeHour, checkIn, myAlumniIntros, myOfficeHours, openOfficeHours, programRecommendations, requestAlumniIntro, rsvp, stageHelp } from '../../src/lib/higher-ed/lifecycle'
import { collegeTimeZone, zonedToUtc } from '../../src/lib/higher-ed/time-zone'
import { saveEngagementWeights, syncEngagement } from '../../src/lib/higher-ed/engagement'
import { saveSegment, segmentWhere, parseFilters } from '../../src/lib/higher-ed/segments'
import { audienceCount, saveDraft, sendNextBatch } from '../../src/lib/higher-ed/composer'
import { countInvitable } from '../../src/lib/higher-ed/invites'
import { addCohort, addLearner, credentialById, etplRows, saveProgram, setCohortRules, setProgress, updateEnrollment } from '../../src/lib/higher-ed/programs'
import { createRapidResponse, signUpForRapidResponse } from '../../src/lib/higher-ed/rapid-response'
import { outcomesReport } from '../../src/lib/higher-ed/outcomes-report'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `lctest${randomUUID().slice(0, 8)}`
const DAY = 86_400_000

async function main() {
  const inst = await prisma.institution.create({ data: { slug: tag, name: 'Lifecycle Test College', isDemo: true, isSampleData: true, enabledFeatures: { wioa: true } }, select: { id: true } })
  const candidates: string[] = []
  try {
    const now = new Date()
    const mk = async (n: string, opts: { join?: boolean; employer?: string; classYear?: number; shareOutcome?: boolean } = {}) => {
      let candidateId: string | null = null
      if (opts.join) {
        const cp = await prisma.candidateProfile.create({ data: { userId: `${tag}-${n}`, isSampleData: true }, select: { id: true } })
        candidates.push(cp.id)
        candidateId = cp.id
      }
      const m = await prisma.institutionMember.create({
        data: { institutionId: inst.id, email: `${n}@${tag}.test`, firstName: n, lastName: 'Test', classYear: opts.classYear ?? 2005, candidateId, status: opts.join ? 'CLAIMED' : 'IMPORTED', lastKnownEmployer: opts.employer ?? null },
        select: { id: true },
      })
      if (opts.shareOutcome === false) await prisma.institutionConsent.create({ data: { memberId: m.id, scope: 'SHARE_OUTCOME', granted: false, source: 'MEMBER' } })
      return { memberId: m.id, candidateId }
    }
    const ann = await mk('ann', { join: true })
    const bo = await mk('bo', { join: true, employer: 'Acme Health' })
    const cy = await mk('cy', { join: true, employer: 'Acme Health', shareOutcome: false })
    const di = await mk('di', { employer: 'Acme Health' }) // not joined

    // Intros: only joined alumni who share their employer are offered.
    const atAcme = await alumniAtCompany(inst.id, 'ACME HEALTH', ann.memberId)
    check('Intro targets: joined and sharing only', atAcme.map((a) => a.name), ['bo T.'])
    const r1 = await requestAlumniIntro({ institutionId: inst.id, requesterMemberId: ann.memberId, targetMemberId: bo.memberId, companyName: 'Acme Health', purpose: 'interviewing', note: 'Second round next week', createdBy: 'verify' })
    const r2 = await requestAlumniIntro({ institutionId: inst.id, requesterMemberId: ann.memberId, targetMemberId: cy.memberId, companyName: 'Acme Health', purpose: 'applying', note: '', createdBy: 'verify' })
    check('Can’t ask someone who doesn’t share', ['id' in r1, 'error' in r2], [true, true])
    check('Email hidden until accepted', (await myAlumniIntros(ann.memberId)).sent[0].email, null)
    await answerAlumniIntro(bo.memberId, (r1 as { id: string }).id, true)
    check('Accepted: both see each other', [(await myAlumniIntros(ann.memberId)).sent[0].email, (await myAlumniIntros(bo.memberId)).received[0].email], [`bo@${tag}.test`, `ann@${tag}.test`])

    // Office hours: Bo mentors, Ann books; a second booking of the same slot fails.
    await prisma.institutionMentor.create({ data: { institutionId: inst.id, memberId: bo.memberId, industries: ['Healthcare'] } })
    const start = new Date(now.getTime() + 2 * DAY)
    await addOfficeHours({ memberId: bo.memberId, startsAt: start, count: 2, minutes: 20, topic: 'Résumés' })
    const open = await openOfficeHours(inst.id, ann.memberId)
    check('Two consecutive 20-minute slots', [open.length, open[1].startsAt.getTime() - open[0].startsAt.getTime()], [2, 20 * 60_000])
    check('Mentors don’t see their own slots to book', (await openOfficeHours(inst.id, bo.memberId)).length, 0)
    const b1 = await bookOfficeHour({ slotId: open[0].id, memberId: ann.memberId, note: 'Résumé read' })
    const b2 = await bookOfficeHour({ slotId: open[0].id, memberId: di.memberId, note: '' })
    check('A slot books once', ['ok' in b1, 'error' in b2], [true, true])
    check('Both sides see the call', [(await myOfficeHours(ann.memberId)).booked.length, (await myOfficeHours(bo.memberId)).hosting.filter((h) => h.with).length], [1, 1])

    // Events: capacity, check-in counts as engagement after the sync.
    const ev = await prisma.collegeEvent.create({ data: { institutionId: inst.id, title: 'Panel', kind: 'panel', startsAt: new Date(now.getTime() - DAY), capacity: 1, createdBy: 'verify' }, select: { id: true } })
    await rsvp(ev.id, ann.memberId, true)
    check('Full events refuse', 'error' in (await rsvp(ev.id, bo.memberId, true)), true)
    const rs = await prisma.eventRsvp.findFirstOrThrow({ where: { eventId: ev.id, memberId: ann.memberId }, select: { id: true } })
    await checkIn(inst.id, rs.id, true)
    await syncEngagement(inst.id, now)
    const evs = await prisma.engagementEvent.findMany({ where: { institutionId: inst.id }, select: { memberId: true, type: true, sourceTable: true } })
    check('Check-in and accepted intro count toward engagement', [evs.some((e) => e.memberId === ann.memberId && e.type === 'EVENT'), evs.filter((e) => e.sourceTable === 'AlumniIntroRequest').length], [true, 2])

    // Weights re-score history: Ann's event check-in at 3 standard, 10 after.
    const score = async () => (await prisma.$queryRaw<{ score: number }[]>`select score from private.v_member_engagement where "memberId" = ${ann.memberId}`)[0]?.score ?? 0
    const before = await score()
    await saveEngagementWeights(inst.id, { EVENT: 10 })
    const after = await score()
    await saveEngagementWeights(inst.id, null)
    check('A weight change re-scores history; reset restores it', [after - before, await score()], [7, before])

    // Segments and the composer.
    const f = parseFilters({ joined: 'joined', employerContains: 'acme' })
    check('Segment: joined at Acme', await prisma.institutionMember.count({ where: segmentWhere(inst.id, f) }), 2)
    const segId = await saveSegment(inst.id, 'Acme', f, 'verify')
    check('Composer counts a segment', await audienceCount(inst.id, `segment:${segId}`), 2)
    const draft = await saveDraft({ institutionId: inst.id, subject: 'Hi {{firstName}}', body: '{{link}}', audience: `segment:${segId}`, createdBy: 'verify' })
    const sent = await sendNextBatch({ institutionId: inst.id, campaignId: (draft as { id: string }).id, createdBy: 'verify' })
    check('Composer sends to the segment', 'sent' in sent && sent.sent, 2)

    // Programs: rules, learners, credentials, ETPL.
    const p = await saveProgram({ institutionId: inst.id, name: 'Data analytics', summary: null, audience: null, credential: 'Data Certificate', priceCents: 0, wioaEligible: true, isActive: true, createdBy: 'v', skills: ['SQL'], cipCode: '11.0802', hours: 90, credentialType: 'certificate', prerequisites: 'None' })
    const programId = (p as { id: string }).id
    const ch = await addCohort({ institutionId: inst.id, programId, name: 'Spring', startsAt: new Date(now.getTime() + 5 * DAY), endsAt: null, seats: null, modality: 'online', facultyUserId: null })
    const cohortId = (ch as { id: string }).id
    await setCohortRules({ institutionId: inst.id, cohortId, sessionsTotal: 10, minAttendancePct: 80, requiresCapstone: true })
    const learner = await addLearner({ institutionId: inst.id, cohortId, firstName: 'Lee', lastName: 'Ner', email: `lee@${tag}-client.test`, corporateClientId: null, payer: 'SELF_PAY' })
    check('Learners never get the alumni invitation', await countInvitable(inst.id), 1)
    const eid = (learner as { id: string }).id
    const early = await updateEnrollment({ institutionId: inst.id, enrollmentId: eid, status: 'COMPLETED' })
    check('Completion blocked until attendance and capstone', 'error' in early && early.error, 'Needs 8 of 10 sessions attended (80%); has 0.')
    await setProgress({ institutionId: inst.id, enrollmentId: eid, sessionsAttended: 99, capstoneDone: true })
    check('Attendance capped at the sessions', (await prisma.enrollment.findUniqueOrThrow({ where: { id: eid } })).sessionsAttended, 10)
    await updateEnrollment({ institutionId: inst.id, enrollmentId: eid, status: 'COMPLETED' })
    const done = await prisma.enrollment.findUniqueOrThrow({ where: { id: eid }, select: { credentialId: true, credentialName: true } })
    const cred = await credentialById(done.credentialId!)
    check('Credential issued and verifiable', [done.credentialName, cred?.status, cred?.cohort.program.name], ['Data Certificate', 'COMPLETED', 'Data analytics'])
    const etpl = (await etplRows(inst.id))[0]
    check('ETPL row', [etpl.cipCode, etpl.enrolled, etpl.completed, etpl.completionRate], ['11.0802', 1, 1, 1])

    // Rapid response: a new worker becomes a learner; an alum's email is reused.
    const rr = await createRapidResponse({ institutionId: inst.id, warnNoticeId: null, employerName: 'Acme Health', title: 'Retraining', message: 'For affected workers', programIds: [programId], createdBy: 'v' })
    const rid = (rr as { id: string }).id
    await signUpForRapidResponse({ slug: tag, id: rid, cohortId, firstName: 'Wren', lastName: 'Worker', email: `wren@${tag}-community.test`, note: '' })
    await signUpForRapidResponse({ slug: tag, id: rid, cohortId, firstName: 'Di', lastName: 'Test', email: `DI@${tag}.test`, note: 'evenings' })
    const signups = await prisma.enrollment.findMany({ where: { rapidResponseId: rid }, select: { payer: true, member: { select: { affiliation: true, email: true } } }, orderBy: { createdAt: 'asc' } })
    check('Rapid sign-ups: WIOA applications, learner vs existing alum', signups.map((s) => [s.payer, s.member.affiliation]), [['WIOA_VOUCHER', 'LEARNER'], ['WIOA_VOUCHER', 'ALUM']])

    // Outcomes report withholds small numbers.
    const rep = await outcomesReport(inst.id, now)
    check('Outcomes report withholds counts under 5', [rep.joined, rep.landed, rep.medianDaysToLand], [null, null, null])

    // Stage help and program recommendations.
    check('Stage help follows the stage', stageHelp('INTERVIEWING', tag, { hasPrograms: true, hasOfficeHours: true, hasEvents: true, hasJobs: true }).map((s) => s.key), ['interview', 'officeHours', 'mentors'])
    check('Landed and promotion link to the In-work track', [stageHelp('LANDED', tag, { hasPrograms: true, hasOfficeHours: true, hasEvents: true, hasJobs: true })[0].href, stageHelp('PREPARING', tag, { hasPrograms: true, hasOfficeHours: true, hasEvents: true, hasJobs: true, journey: 'PROMOTION' })[0].key], ['/dashboard/in-work?tab=impact', 'promotion'])
    check('Paused gets nothing', stageHelp('PAUSED', tag, { hasPrograms: true, hasOfficeHours: true, hasEvents: true, hasJobs: true }).length, 0)
    await prisma.marketRealityReport.create({ data: { candidateId: ann.candidateId!, strengths: [], weaknesses: [], actionPlan: [], gapAnalysis: { targetRole: 'Analyst', gaps: [{ area: 'SQL', why: '', remediation: '' }] } } })
    check('A SQL gap recommends the SQL program', (await programRecommendations(inst.id, ann.candidateId)).map((r) => [r.program, r.skill, r.from]), [['Data analytics', 'SQL', 'report']])

    check('Eastern time: summer and winter', [zonedToUtc('2026-07-01', '12:00', 'America/New_York')?.toISOString(), zonedToUtc('2026-12-01', '12:00', 'America/New_York')?.toISOString()], ['2026-07-01T16:00:00.000Z', '2026-12-01T17:00:00.000Z'])
    check('Pacific and Arizona', [zonedToUtc('2026-07-01', '12:00', 'America/Los_Angeles')?.toISOString(), zonedToUtc('2026-07-01', '12:00', 'America/Phoenix')?.toISOString()], ['2026-07-01T19:00:00.000Z', '2026-07-01T19:00:00.000Z'])
    check('Zone: setting, else the college’s state', [collegeTimeZone({ timeZone: 'America/Chicago' }, { college: { state: 'CA' } }), collegeTimeZone({}, { college: { state: 'CA' } }), collegeTimeZone({}, null)], ['America/Chicago', 'America/Los_Angeles', 'America/New_York'])
  } finally {
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
    for (const id of candidates) await prisma.candidateProfile.delete({ where: { id } }).catch(() => {})
    await prisma.$disconnect()
  }
  console.log(`${passed} passed, ${failures.length} failed (test college deleted)`)
  for (const f of failures) console.log('  FAIL ' + f)
  if (failures.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
