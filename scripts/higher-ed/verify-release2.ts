// Release 2 verification against the real database, on a throwaway demo
// college deleted at the end. Reads one real WARN notice; never writes to it.
//
//   - layoff matching from the roster employer, rerun adds nothing
//   - layoff outreach: one send per member, matches marked SENT, demo not emailed
//   - check-ins: M18 and annual scheduled once, sent after approval, answer
//     "laid off" opens a transition flag, a repeat answer changes nothing
//   - engagement: a gift scores once, the tier view sees it
//
//   npm run verify:release2
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { matchLayoffs, sendLayoffOutreach } from '../../src/lib/higher-ed/layoffs'
import { answerCheckIn, scheduleCheckIns, sendDueCheckIns } from '../../src/lib/higher-ed/checkins'
import { engagementOverview, syncEngagement } from '../../src/lib/higher-ed/engagement'
import { waitingFor } from '../../src/lib/higher-ed/inbox'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `r2test${randomUUID().slice(0, 8)}`
const NOW = new Date('2026-11-20T12:00:00Z')

async function main() {
  const notice = await prisma.warnNotice.findFirst({
    where: { dismissedAt: null, noticeDate: { gte: new Date(NOW.getTime() - 150 * 86_400_000) } },
    orderBy: { noticeDate: 'desc' },
    select: { id: true, normalizedEmployer: true, employer: true },
  })
  if (!notice) throw new Error('No recent WARN notice to match against')
  const inst = await prisma.institution.create({
    data: {
      slug: tag,
      name: 'Release 2 Test College',
      isDemo: true,
      isSampleData: true,
      enabledFeatures: { graceDays: 60, services: { grad_checkins: { on: true }, annual_checkin: { on: true } }, checkIns: { annualMonth: 11 } },
    },
    select: { id: true },
  })
  try {
    const mk = (n: string, classYear: number, employer: string | null) =>
      prisma.institutionMember.create({
        data: { institutionId: inst.id, email: `${n}@${tag}.test`, firstName: n, classYear, lastKnownEmployer: employer, lastKnownEmployerNormalized: employer },
        select: { id: true },
      })
    const ann = await mk('ann', 2025, notice.normalizedEmployer) // M18 due Nov 15 2026, at the laid-off company
    const ben = await mk('ben', 2001, notice.normalizedEmployer) // annual only, same company
    const cy = await mk('cy', 1999, null)
    await prisma.institutionMember.update({ where: { id: cy.id }, data: { doNotContact: true } })

    // Layoffs
    const m1 = await matchLayoffs(inst.id, NOW)
    const m2 = await matchLayoffs(inst.id, NOW)
    check('Two alumni matched to the notice; rerun adds nothing', [m1.added >= 2, m2.added], [true, 0])
    const base = `/i/${tag}/alumni`
    check('Alumni inbox shows the layoff matches', (await waitingFor(inst.id, 'alumni', base)).some((i) => i.key === 'layoffs'), true)
    const sent = await sendLayoffOutreach({ institutionId: inst.id, createdBy: 'verify' })
    check('One layoff email per member, demo not emailed', [sent.sent, sent.demo], [2, true])
    check('No new matches left', await prisma.layoffMatch.count({ where: { institutionId: inst.id, outreachStatus: 'NEW' } }), 0)
    check('Flag never opened by a match alone', await prisma.transitionFlag.count({ where: { member: { institutionId: inst.id } } }), 0)

    // Check-ins
    const s1 = await scheduleCheckIns(inst.id, NOW)
    const s2 = await scheduleCheckIns(inst.id, NOW)
    const kinds = await prisma.checkIn.findMany({ where: { member: { institutionId: inst.id } }, select: { memberId: true, kind: true }, orderBy: { kind: 'asc' } })
    check('Ann gets M18, Ben the annual, do-not-contact Cy nothing; rerun adds nothing', [kinds.map((k) => `${k.memberId === ann.id ? 'ann' : k.memberId === ben.id ? 'ben' : 'cy'}:${k.kind}`).sort(), s1.scheduled, s2.scheduled], [['ann:M18', 'ben:CUSTOM'], 2, 0])
    const career = await sendDueCheckIns({ institutionId: inst.id, createdBy: 'verify', kinds: ['M6', 'M18', 'M24'], now: NOW })
    check('Career approves its own check-ins only', career.sent, 1)
    const annCheckIn = await prisma.checkIn.findFirstOrThrow({ where: { memberId: ann.id }, select: { id: true, status: true } })
    check('Sent check-in is SENT', annCheckIn.status, 'SENT')
    const a1 = await answerCheckIn({ checkInId: annCheckIn.id, memberId: ann.id, answer: 'laid_off', now: NOW })
    const a2 = await answerCheckIn({ checkInId: annCheckIn.id, memberId: ann.id, answer: 'laid_off', now: NOW })
    check('Answer recorded once', [a1.changed, a2.changed], [true, false])
    const flag = await prisma.transitionFlag.findUnique({ where: { openFlagMemberId: ann.id }, select: { source: true, doNotSolicit: true } })
    check('"Laid off" opens a do-not-solicit flag from the check-in', flag, { source: 'CHECK_IN', doNotSolicit: true })
    check('Career inbox shows the follow-up', (await waitingFor(inst.id, 'career', `/i/${tag}/career`)).some((i) => i.key === 'followups'), true)
    let threw = false
    await answerCheckIn({ checkInId: annCheckIn.id, memberId: ben.id, answer: 'good', now: NOW }).catch(() => (threw = true))
    check("Nobody can answer someone else's check-in", threw, true)

    // Engagement
    await prisma.institutionGift.create({
      data: { institutionId: inst.id, memberId: ben.id, externalConstituentId: 'b', amountCents: 5000, giftDate: new Date(), dedupeKey: `${tag}-g1`, isSampleData: true },
    })
    const e1 = await syncEngagement(inst.id)
    const e2 = await syncEngagement(inst.id)
    check('Gift scores once', [e1.added >= 1, e2.added], [true, 0])
    const o = await engagementOverview(inst.id)
    check('Engagement view sees every member', o.tiers.reduce((n, t) => n + t.members, 0), 3)
  } finally {
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
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
