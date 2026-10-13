// Release 4 verification against the real database, on a throwaway demo
// college deleted at the end.
//
//   - mentors: email invitations (once per six months) and sign-up
//   - employers: apply → approve, featured roles pin first, "alumni work here"
//   - intros: only to members sharing their Dossier, one per pair, accept
//     reveals the email to the employer
//
//   npm run verify:release4
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { alumniAtCompanies, countMentorInvitable, inviteMentors, setMentorProfile } from '../../src/lib/higher-ed/mentor-network'
import { applyToRecruit, collegeJobs, introStatusFor, postEmployerRole, requestIntro, respondToIntro, setEmployerPackage, setEmployerStatus } from '../../src/lib/higher-ed/employers'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `r4test${randomUUID().slice(0, 8)}`

async function main() {
  const inst = await prisma.institution.create({ data: { slug: tag, name: 'Release 4 Test College', isDemo: true, isSampleData: true }, select: { id: true } })
  const candidates: string[] = []
  const employerUser = randomUUID()
  let employerId: string | null = null
  try {
    const mk = async (n: string, opts: { join?: boolean; shareOutcome?: boolean; employer?: string } = {}) => {
      let candidateId: string | null = null
      if (opts.join) {
        const cp = await prisma.candidateProfile.create({ data: { userId: randomUUID() }, select: { id: true } })
        candidates.push(cp.id)
        candidateId = cp.id
      }
      const m = await prisma.institutionMember.create({
        data: {
          institutionId: inst.id,
          email: `${n}@${tag}.test`,
          firstName: n,
          lastName: 'Test',
          classYear: 2000,
          candidateId,
          status: opts.join ? 'CLAIMED' : 'IMPORTED',
          lastKnownEmployer: opts.employer ?? null,
          lastKnownEmployerNormalized: opts.employer ? normalizeOrgName(opts.employer) : null,
        },
        select: { id: true },
      })
      if (opts.shareOutcome === false) await prisma.institutionConsent.create({ data: { memberId: m.id, scope: 'SHARE_OUTCOME', granted: false, source: 'MEMBER' } })
      return { memberId: m.id, candidateId }
    }
    const mentor = await mk('mia', { join: true, shareOutcome: false, employer: `${tag} Bank` })
    const asker = await mk('al', { join: true })
    await prisma.institutionMember.update({ where: { id: mentor.memberId }, data: { lastKnownTitle: 'Director' } })

    // Mentors (invitation and sign-up; the in-app directory is mentors.ts)
    const before = await countMentorInvitable(inst.id)
    const inv = await inviteMentors({ institutionId: inst.id, createdBy: 'verify' })
    check('Mentor invitations go to alumni 5+ years out, demo not emailed', [inv.sent, inv.demo, await countMentorInvitable(inst.id)], [before, true, 0])
    check('Not invited twice within six months', (await inviteMentors({ institutionId: inst.id, createdBy: 'verify' })).sent, 0)
    const prof = await setMentorProfile({ institutionId: inst.id, memberId: mentor.memberId, isActive: true, industries: ['Finance', 'Not an industry'], maxCallsPerMonth: 20 })
    const saved = await prisma.institutionMentor.findUniqueOrThrow({ where: { id: prof.id }, select: { industries: true, maxCallsPerMonth: true } })
    check('Sign-up keeps real industries and caps calls', saved, { industries: ['Finance'], maxCallsPerMonth: 8 })

    // Employers
    const ep = await prisma.employerProfile.create({ data: { userId: employerUser, companyName: `${tag} Bank`, isSampleData: true }, select: { id: true } })
    employerId = ep.id
    check('Employer applies, pending', await applyToRecruit(inst.id, employerUser), { status: 'PENDING' })
    const link = await prisma.institutionEmployer.findFirstOrThrow({ where: { institutionId: inst.id }, select: { id: true } })
    await setEmployerStatus(inst.id, link.id, 'APPROVED', 'verify')
    await setEmployerPackage(inst.id, link.id, 'FEATURED', new Date(Date.now() + 7 * 86_400_000))
    const role = await postEmployerRole({ institutionId: inst.id, employerProfileId: ep.id, title: 'Analyst', location: null, url: 'https://example.com/a', description: null })
    await prisma.exclusiveJobPosting.create({
      data: { title: 'Other role', companyName: `${tag} Other`, url: 'https://example.com/b', status: 'approved', institutionScopeId: inst.id, addedBy: 'verify', source: 'institution', postingType: 'direct' },
    })
    await prisma.exclusiveJobPosting.update({ where: { id: role.id }, data: { status: 'approved', createdAt: new Date(Date.now() - 86_400_000) } })
    const jobs = await collegeJobs(inst.id)
    check('Featured employer role pins first', jobs.map((j) => [j.title, j.featured]), [['Analyst', true], ['Other role', false]])
    const counts = await alumniAtCompanies(inst.id, jobs.map((j) => ({ companyId: j.companyId, normalized: j.normalized })))
    check('Alumni work here: 1 at the bank (roster), 0 elsewhere', jobs.map((j) => counts.get(`${j.companyId ?? ''}|${j.normalized}`)), [1, 0])

    // Intros
    const noShare = await requestIntro({ institutionId: inst.id, employerProfileId: ep.id, memberId: asker.memberId, requestedBy: employerUser, note: '' })
    check('No intro without Dossier sharing', 'error' in noShare, true)
    await prisma.institutionConsent.create({ data: { memberId: asker.memberId, scope: 'SHARE_DOSSIER_WITH_EMPLOYERS', granted: true, source: 'MEMBER' } })
    const intro = await requestIntro({ institutionId: inst.id, employerProfileId: ep.id, memberId: asker.memberId, requestedBy: employerUser, note: 'Analyst role' })
    const dup = await requestIntro({ institutionId: inst.id, employerProfileId: ep.id, memberId: asker.memberId, requestedBy: employerUser, note: '' })
    check('One intro per pair', ['id' in intro, 'error' in dup], [true, true])
    check('Employer sees no email before accept', (await introStatusFor(ep.id, [asker.memberId])).get(asker.memberId), { status: 'REQUESTED', email: null })
    await respondToIntro(asker.memberId, (intro as { id: string }).id, true)
    check('Accept reveals email', (await introStatusFor(ep.id, [asker.memberId])).get(asker.memberId)?.email, `al@${tag}.test`)
  } finally {
    // Before the college: deleting it would unscope these and put them on the open board.
    await prisma.exclusiveJobPosting.deleteMany({ where: { institutionScopeId: inst.id } }).catch(() => {})
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
    if (employerId) await prisma.employerProfile.delete({ where: { id: employerId } }).catch(() => {})
    for (const id of candidates) await prisma.candidateProfile.delete({ where: { id } }).catch(() => {})
    await prisma.company.deleteMany({ where: { name: { startsWith: tag } } }).catch(() => {})
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
