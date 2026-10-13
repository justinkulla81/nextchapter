// HE-05/HE-06 verification against the real database, on a throwaway demo
// college that is deleted at the end (with everything it created):
//
//   - roster import, twice: the second run adds and changes nothing new
//   - gift import, twice: the second run adds no gifts
//   - transition lifecycle: in transition → new job (grace) → nightly clear
//     → gratitude ask pending when the alum said the college helped
//
//   npm run verify:he06
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { importGifts, importRoster } from '../../src/lib/higher-ed/crm-import'
import { clearEndedGrace, openTransitionFlag, reportNewJob } from '../../src/lib/higher-ed/transition'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `he06test${randomUUID().slice(0, 8)}`
const ROSTER = `external_id,email,first_name,last_name,affiliation,class_year,degree,major,employer,title,do_not_contact
1,a@${tag}.test,Ann,Alpha,ALUM,2009,BA,Economics,Example Corp,Director of Operations,false
2,b@${tag}.test,Ben,Beta,STUDENT,2028,,,,,
3,bad-email,Cy,Gamma,ALUM,2001,,,,,`
const GIFTS = `external_id,gift_date,amount,fund,appeal
1,2026-09-01,100.00,Annual Fund,Fall
2,2026-09-02,25,Annual Fund,Fall
9,2026-09-03,50,Annual Fund,Fall`

async function main() {
  const inst = await prisma.institution.create({ data: { slug: tag, name: 'HE06 Test College', isDemo: true, isSampleData: true }, select: { id: true } })
  let candidateId: string | null = null
  const companyName = `${tag} Hiring Co`
  try {
    const args = { institutionId: inst.id, csv: ROSTER, fileName: 'roster.csv', createdBy: 'verify' }
    const r1 = await importRoster(args)
    check('Roster: 2 added, bad row reported by number', [r1.imported, r1.updated, r1.errors.map((e) => e.row)], [2, 0, [4]])
    const r2 = await importRoster(args)
    check('Roster rerun adds no one', [r2.imported, r2.updated], [0, 2])
    check('Roster rerun: still 2 members', await prisma.institutionMember.count({ where: { institutionId: inst.id } }), 2)
    const run = await prisma.crmExchangeRun.findUnique({ where: { id: r1.runId }, select: { status: true, rowCount: true, errorCount: true } })
    check('Run logged as partial with its error', run, { status: 'PARTIAL', rowCount: 2, errorCount: 1 })
    const ann = await prisma.institutionMember.findFirstOrThrow({ where: { institutionId: inst.id, externalId: '1' }, select: { id: true, candidateId: true, status: true, lastKnownEmployerNormalized: true } })
    check('Import never links a NextChapter account', [ann.candidateId, ann.status], [null, 'IMPORTED'])

    const gargs = { institutionId: inst.id, csv: GIFTS, fileName: 'gifts.csv', createdBy: 'verify' }
    const g1 = await importGifts(gargs)
    check('Gifts: 3 added', g1.imported, 3)
    const g2 = await importGifts(gargs)
    check('Gift rerun adds nothing', g2.imported, 0)
    check('Gift from an unknown constituent is kept, unmatched', await prisma.institutionGift.count({ where: { institutionId: inst.id, memberId: null } }), 1)

    // Transition lifecycle, for Ann as a joined member.
    const cp = await prisma.candidateProfile.create({ data: { userId: randomUUID() }, select: { id: true } })
    candidateId = cp.id
    await prisma.institutionMember.update({ where: { id: ann.id }, data: { candidateId, status: 'CLAIMED', claimedAt: new Date() } })
    const f1 = await openTransitionFlag(ann.id, 'SELF_REPORTED')
    const f2 = await openTransitionFlag(ann.id, 'SELF_REPORTED')
    check('One open flag, however often she says so', [f1.created, f2.created, f1.id === f2.id], [true, false, true])
    const t0 = new Date('2026-10-01T00:00:00Z')
    const job = await reportNewJob({ memberId: ann.id, candidateId, companyName, title: 'VP Operations', startDate: null, helpedByInstitution: true, shareMilestone: true, graceDays: 60, now: t0 })
    check('New job moves the flag to grace', job.flagMoved, true)
    const flag = await prisma.transitionFlag.findUniqueOrThrow({ where: { id: f1.id }, select: { state: true, doNotSolicit: true, graceEndsAt: true } })
    check('Still do-not-solicit during grace, 60 days', [flag.state, flag.doNotSolicit, flag.graceEndsAt?.toISOString()], ['PLACED_GRACE', true, '2026-11-30T00:00:00.000Z'])
    check('Before grace ends nothing clears', (await clearEndedGrace(new Date('2026-11-29T00:00:00Z'), inst.id)).cleared, 0)
    const cleared = await clearEndedGrace(new Date('2026-11-30T00:00:01Z'), inst.id)
    check('After grace: cleared and gratitude ask pending', cleared, { cleared: 1, gratitudePending: 1 })
    const after = await prisma.transitionFlag.findUniqueOrThrow({ where: { id: f1.id }, select: { state: true, doNotSolicit: true, openFlagMemberId: true } })
    check('Cleared flag can be asked again and frees the slot', after, { state: 'CLEARED', doNotSolicit: false, openFlagMemberId: null })
    check('Nightly is idempotent', (await clearEndedGrace(new Date('2026-12-30T00:00:00Z'), inst.id)).cleared, 0)
    const emp = await prisma.memberEmployment.findFirst({ where: { candidateId, isCurrent: true }, select: { title: true } })
    check('New job is the current employment', emp?.title, 'VP Operations')
    const signals = await prisma.prospectFlag.findMany({ where: { memberId: ann.id }, select: { type: true }, orderBy: { type: 'asc' } })
    check('A VP job at a new employer raises both prospect signals', signals.map((x) => x.type).sort(), ['NEW_EMPLOYER_MATCHING_GIFT', 'PROMOTION_VP_PLUS'])
  } finally {
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
    if (candidateId) await prisma.candidateProfile.delete({ where: { id: candidateId } }).catch(() => {})
    await prisma.company.deleteMany({ where: { name: companyName } }).catch(() => {})
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
