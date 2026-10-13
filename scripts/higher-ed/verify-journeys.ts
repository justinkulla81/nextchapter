// Journeys step 1 against the real database, on a throwaway candidate and
// college deleted at the end: a change records history and keeps
// currentJobStatus in step; "laid off" opens the college's transition flag;
// "landed" moves it to its grace period; a no-change check-in only stamps
// the check-in time.
//
//   npm run verify:journeys
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { applyJourneyChange } from '../../src/lib/journey/apply'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

async function main() {
  const tag = `jtest${randomUUID().slice(0, 8)}`
  const cp = await prisma.candidateProfile.create({ data: { userId: randomUUID(), currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' }, select: { id: true } })
  const inst = await prisma.institution.create({ data: { slug: tag, name: 'Journey Test College', isDemo: true, isSampleData: true }, select: { id: true } })
  try {
    const member = await prisma.institutionMember.create({
      data: { institutionId: inst.id, email: `${tag}@x.test`, candidateId: cp.id, status: 'CLAIMED', claimedAt: new Date() },
      select: { id: true },
    })
    const r0 = await applyJourneyChange(cp.id, { source: 'CHECK_IN', isCheckIn: true })
    check('No-change check-in records no event', [r0.journeyChanged, r0.stageChanged, await prisma.journeyEvent.count({ where: { candidateId: cp.id } })], [false, false, 0])
    const p0 = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: cp.id }, select: { journey: true, journeyStage: true, journeyCheckedAt: true } })
    check('...but persists the derived journey and stamps the check-in', [p0.journey, p0.journeyStage, !!p0.journeyCheckedAt], ['EXPLORING_MOVE', 'EXPLORING', true])

    await applyJourneyChange(cp.id, { stage: 'APPLYING', source: 'CHECK_IN', isCheckIn: true })
    await applyJourneyChange(cp.id, { journey: 'LAID_OFF', stage: 'APPLYING', source: 'CHECK_IN', isCheckIn: true })
    const p1 = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: cp.id }, select: { journey: true, currentJobStatus: true } })
    check('Laid off: journey and old job status in step', [p1.journey, p1.currentJobStatus], ['LAID_OFF', 'LAID_OFF'])
    const flag = await prisma.transitionFlag.findUnique({ where: { openFlagMemberId: member.id }, select: { state: true, doNotSolicit: true, source: true } })
    check('Laid off opens the college flag (do-not-solicit)', flag, { state: 'IN_TRANSITION', doNotSolicit: true, source: 'CHECK_IN' })

    await applyJourneyChange(cp.id, { stage: 'LANDED', source: 'CHECK_IN', isCheckIn: true })
    const placed = await prisma.transitionFlag.findFirst({ where: { memberId: member.id }, select: { state: true, doNotSolicit: true } })
    check('Landed moves it to the grace period', placed, { state: 'PLACED_GRACE', doNotSolicit: true })

    const events = await prisma.journeyEvent.findMany({ where: { candidateId: cp.id }, orderBy: { createdAt: 'asc' }, select: { fromStage: true, toStage: true, toJourney: true } })
    check('History has each change in order', events.map((e) => [e.toJourney, e.toStage]), [['EXPLORING_MOVE', 'APPLYING'], ['LAID_OFF', 'APPLYING'], ['LAID_OFF', 'LANDED']])
  } finally {
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
    await prisma.candidateProfile.delete({ where: { id: cp.id } }).catch(() => {})
    await prisma.$disconnect()
  }
  console.log(`${passed} passed, ${failures.length} failed (test records deleted)`)
  for (const f of failures) console.log('  FAIL ' + f)
  if (failures.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
