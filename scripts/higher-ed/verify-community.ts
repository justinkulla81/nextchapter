// The alumni community, against the real database on a throwaway college
// deleted at the end: projects and boards (limits, emails only once
// connected), the opt-in directory, people like you (suppression), groups,
// course auditing seats, mentoring matches, portal features switching tabs
// off, FERPA export and delete, and the multi-campus dashboard.
//
//   npm run verify:community
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import {
  answerInterest,
  expressInterest,
  joinGroup,
  listGroups,
  matchPair,
  myInterests,
  myPosts,
  openAuditCourses,
  peopleLikeYou,
  postOpportunity,
  requestAudit,
  searchDirectory,
  signUpForCohort,
  suggestMatches,
} from '../../src/lib/higher-ed/community'
import { modulesFrom } from '../../src/lib/higher-ed/modules'
import { tabsFor, type AccessToken } from '../../src/lib/higher-ed/workspaces'
import { deleteMemberRecord, memberExport } from '../../src/lib/higher-ed/data-requests'
import { systemDashboard } from '../../src/lib/higher-ed/systems'
import { regionAreas } from '../../src/lib/higher-ed/profile'
import { regionNotices } from '../../src/lib/higher-ed/rapid-response'
import { memberAudiences, memberCards, serviceSettingsFrom, serviceTarget, getService } from '../../src/lib/higher-ed/services'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `cmtest${randomUUID().slice(0, 8)}`

async function main() {
  const system = await prisma.institutionSystem.create({ data: { slug: tag, name: 'Test System', isSampleData: true }, select: { id: true } })
  const inst = await prisma.institution.create({ data: { slug: tag, name: 'Community Test College', isDemo: true, isSampleData: true, systemId: system.id }, select: { id: true } })
  const candidates: string[] = []
  try {
    const mk = async (n: string, opts: { major?: string; listed?: boolean; fn?: string; employer?: string } = {}) => {
      const cp = await prisma.candidateProfile.create({ data: { userId: `${tag}-${n}`, isSampleData: true, primaryFunction: opts.fn ?? null }, select: { id: true } })
      candidates.push(cp.id)
      const m = await prisma.institutionMember.create({
        data: { institutionId: inst.id, email: `${n}@${tag}.test`, firstName: n, lastName: 'Test', classYear: 2010, major: opts.major ?? 'History', candidateId: cp.id, status: 'CLAIMED', lastKnownEmployer: opts.employer ?? null, lastKnownTitle: opts.employer ? 'Analyst' : null },
        select: { id: true },
      })
      if (opts.listed) await prisma.institutionConsent.create({ data: { memberId: m.id, scope: 'LIST_IN_DIRECTORY', granted: true, source: 'MEMBER' } })
      return m.id
    }
    const ann = await mk('ann', { listed: true, major: 'Economics' })
    const bo = await mk('bo', { major: 'Economics' })
    const cy = await mk('cy', { listed: true })

    // Projects: interest shows the poster's email only after they connect.
    const op = await postOpportunity({ institutionId: inst.id, memberId: ann, staffEmail: null, kind: 'board', title: 'Board seat', organization: 'Food Bank', description: 'Finance chair', skills: [], hoursPerWeek: 3, durationWeeks: null, compensation: 'volunteer', location: 'Pittsburgh' })
    check('Bad kind refused', 'error' in (await postOpportunity({ institutionId: inst.id, memberId: ann, staffEmail: null, kind: 'x', title: 't', organization: 'o', description: 'd', skills: [], hoursPerWeek: null, durationWeeks: null, compensation: 'paid', location: null })), true)
    const opId = (op as { id: string }).id
    check('Own post refused', 'error' in (await expressInterest(opId, ann, '')), true)
    await expressInterest(opId, bo, 'CPA here')
    check('Email hidden before connect', [(await myInterests(bo))[0].email, (await myPosts(ann))[0].interests[0].email], [null, null])
    check('Only the poster can answer', await answerInterest(cy, (await myPosts(ann))[0].interests[0].id, true), false)
    await answerInterest(ann, (await myPosts(ann))[0].interests[0].id, true)
    check('Both emails after connect', [(await myInterests(bo))[0].email, (await myPosts(ann))[0].interests[0].email], [`ann@${tag}.test`, `bo@${tag}.test`])
    for (let k = 0; k < 4; k++) await postOpportunity({ institutionId: inst.id, memberId: ann, staffEmail: null, kind: 'project', title: `P${k}`, organization: 'o', description: 'd', skills: [], hoursPerWeek: null, durationWeeks: null, compensation: 'paid', location: null })
    check('Five open posts max', 'error' in (await postOpportunity({ institutionId: inst.id, memberId: ann, staffEmail: null, kind: 'project', title: 'P6', organization: 'o', description: 'd', skills: [], hoursPerWeek: null, durationWeeks: null, compensation: 'paid', location: null })), true)

    // Directory: listed only.
    check('Directory lists opted-in only', (await searchDirectory(inst.id, {})).map((d) => d.name).sort(), ['ann Test', 'cy Test'])
    check('Directory search', (await searchDirectory(inst.id, { q: 'cy' })).map((d) => d.name), ['cy Test'])

    // People like you: under five, nothing.
    check('People like you suppressed under 5', (await peopleLikeYou(inst.id, ann))?.majorCount, null)
    for (let k = 0; k < 5; k++) await mk(`ec${k}`, { major: 'Economics', employer: 'Big Bank' })
    const like = await peopleLikeYou(inst.id, ann)
    check('People like you at 5+', [like?.majorCount, like?.majorEmployers[0]?.label], [6, 'Big Bank'])

    // Groups.
    const g = await prisma.alumniGroup.create({ data: { institutionId: inst.id, kind: 'chapter', name: 'Pittsburgh', metro: 'Pittsburgh', createdBy: 'verify' }, select: { id: true } })
    await joinGroup(g.id, cy, true)
    check('Joined group', (await listGroups(inst.id, cy))[0].joined, true)
    check('Directory by group', (await searchDirectory(inst.id, { groupId: g.id })).map((d) => d.name), ['cy Test'])

    // Course auditing: seats fill.
    const c = await prisma.auditCourse.create({ data: { institutionId: inst.id, title: 'Econ', term: 'Spring', seats: 1 }, select: { id: true } })
    await requestAudit(c.id, ann, '')
    await prisma.auditRequest.updateMany({ where: { courseId: c.id }, data: { status: 'APPROVED' } })
    check('Full course refuses', 'error' in (await requestAudit(c.id, bo, '')), true)
    check('Course shows full', (await openAuditCourses(inst.id, bo))[0].full, true)

    // Mentoring: suggestion prefers a shared industry, then matching emails both.
    const cohort = await prisma.mentoringCohort.create({ data: { institutionId: inst.id, name: 'Fall', startsAt: new Date() }, select: { id: true } })
    await signUpForCohort(cohort.id, bo, 'mentor', '', ['Finance'])
    await signUpForCohort(cohort.id, cy, 'mentor', '', ['Healthcare'])
    await signUpForCohort(cohort.id, ann, 'mentee', 'Move into health admin', ['Healthcare'])
    const sug = await suggestMatches(cohort.id)
    check('Suggests the shared-industry mentor', sug[0].mentorId, cy)
    check('Match refuses wrong roles', 'error' in (await matchPair(inst.id, cohort.id, ann, cy, 'verify')), true)
    check('Match', (await matchPair(inst.id, cohort.id, cy, ann, 'verify')).ok, true)
    check('No one left to match', (await suggestMatches(cohort.id)).length, 0)

    // Portal features: off hides the alum's tab; staff tabs stay.
    const mods = modulesFrom({ modules: { alumniJobs: false, projects: false, volunteer: false } })
    check('Default on', modulesFrom(null).projects, true)
    const member = new Set<AccessToken>(['MEMBER'])
    check('Jobs tab hidden when both off', tabsFor(member, 'candidate', mods).some((t) => t.key === 'jobs'), false)
    check('Give back stays while Ask an alum is on', tabsFor(member, 'candidate', mods).some((t) => t.key === 'giveback'), true)
    check('Staff tab unaffected', tabsFor(new Set<AccessToken>(['ALUMNI_RELATIONS']), 'alumni', mods).some((t) => t.key === 'volunteers'), true)

    // FERPA: export has the record; delete removes it and logs a done request.
    check('Export has email', (await memberExport(inst.id, cy))?.member.email, `cy@${tag}.test`)
    await deleteMemberRecord({ institutionId: inst.id, memberId: cy, by: 'verify' })
    check('Deleted', await prisma.institutionMember.count({ where: { id: cy } }), 0)
    check('Deletion logged', await prisma.dataRequest.count({ where: { institutionId: inst.id, kind: 'DELETE', status: 'DONE', email: `cy@${tag}.test` } }), 1)

    // Regions across state lines: notices in both states' counties count; others don't.
    await prisma.institution.update({ where: { id: inst.id }, data: { profile: { region: { name: 'Louisville area', state: 'KY', counties: ['jefferson'], areas: [{ state: 'KY', counties: ['jefferson'] }, { state: 'IN', counties: ['clark', 'floyd'] }] } } } })
    check('Legacy region reads as one area', regionAreas({ name: 'x', state: 'pa', counties: ['Washington'] }), [{ state: 'PA', counties: ['washington'] }])
    const warnIds: string[] = []
    for (const [state, county] of [['KY', 'Jefferson'], ['IN', 'Clark County'], ['IN', 'Marion']] as const) {
      const w = await prisma.warnNotice.create({ data: { employer: `${tag} ${county}`, normalizedEmployer: `${tag} ${county}`.toLowerCase(), state, county, noticeDate: new Date(), employees: 60 }, select: { id: true } })
      warnIds.push(w.id)
    }
    try {
      const mine = (await regionNotices(inst.id)).filter((n) => n.employer.startsWith(tag)).map((n) => n.employer).sort()
      check('Notices from both states, only chosen counties', mine, [`${tag} Clark County`, `${tag} Jefferson`])
    } finally {
      await prisma.warnNotice.deleteMany({ where: { id: { in: warnIds } } })
    }

    // Services: who provides it, and an In-transition-only card.
    const coaching = getService('coaching')!
    const st = serviceSettingsFrom({ services: { coaching: { on: true, provider: 'college', linkUrl: null, audience: ['in_transition'] } } })
    check('College-provided with no link has nowhere to go', serviceTarget(coaching, st.coaching), null)
    const st2 = serviceSettingsFrom({ services: { coaching: { on: true, provider: 'college', linkUrl: 'https://college.example/coach', audience: ['in_transition'] } } })
    check('In transition sees it; others don’t', [memberCards(st2, memberAudiences({ affiliation: 'ALUM', classYear: 2000 }, new Date(), true)).some((x) => x.key === 'coaching'), memberCards(st2, memberAudiences({ affiliation: 'ALUM', classYear: 2000 })).some((x) => x.key === 'coaching')], [true, false])
    check('Old saved link means both', serviceSettingsFrom({ services: { coaching: { linkUrl: 'https://x.example' } } }).coaching.provider, 'both')

    // Multi-campus: small counts suppressed.
    const d = await systemDashboard(system.id)
    check('System dashboard', [d.campuses.length, d.campuses[0].joined, d.campuses[0].landed], [1, 7, null])
  } finally {
    await prisma.institution.deleteMany({ where: { id: inst.id } })
    await prisma.institutionSystem.deleteMany({ where: { id: system.id } })
    await prisma.candidateProfile.deleteMany({ where: { id: { in: candidates } } })
  }
  console.log(`${passed} passed, ${failures.length} failed`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  await prisma.$disconnect()
  if (failures.length) process.exit(1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
