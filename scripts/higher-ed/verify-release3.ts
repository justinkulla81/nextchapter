// Release 3 verification against the real database, on a throwaway demo
// college deleted at the end.
//
//   - signals: a VP job raises signals, listed with employer only when shared
//   - CRM updates export: employer/title only with SHARE_OUTCOME, approved
//     prospect flag included, suppression list has the open flag
//   - gratitude: held back while in transition, sent once clear, click → CLICKED
//   - fund: award once per alum, donor report counts the placement
//   - ROI rows load and compute for both fiscal years
//
//   npm run verify:release3
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { openTransitionFlag, reportNewJob, closeTransitionFlag } from '../../src/lib/higher-ed/transition'
import { listSignals, suppressionRows, updatesExportRows } from '../../src/lib/higher-ed/views'
import { recordGiveClick, sendGratitude } from '../../src/lib/higher-ed/gratitude'
import { awardFromFund, donorReport, saveFund } from '../../src/lib/higher-ed/fund'
import { roiReport } from '../../src/lib/higher-ed/roi'
import type { AccessToken } from '../../src/lib/higher-ed/workspaces'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `r3test${randomUUID().slice(0, 8)}`

async function main() {
  const inst = await prisma.institution.create({
    data: { slug: tag, name: 'Release 3 Test College', isDemo: true, isSampleData: true, givingUrl: 'https://example.com/give' },
    select: { id: true, slug: true, name: true },
  })
  const ctx = {
    tokens: new Set<AccessToken>(['INSTITUTION_ADMIN']),
    institution: { ...inst, programBrandName: null, logoUrl: null, accentColor: null, isDemo: true, tier: 'INSTITUTION' as const },
    staffUsers: [],
    mode: 'own' as const,
    email: 'verify@test',
    userId: 'verify',
  }
  const candidates: string[] = []
  const company = `${tag} Corp`
  try {
    const mk = async (n: string, share: boolean) => {
      const cp = await prisma.candidateProfile.create({ data: { userId: randomUUID() }, select: { id: true } })
      candidates.push(cp.id)
      const m = await prisma.institutionMember.create({
        data: { institutionId: inst.id, email: `${n}@${tag}.test`, firstName: n, classYear: 2005, externalId: `x-${n}`, candidateId: cp.id, status: 'CLAIMED', claimedAt: new Date('2026-07-15') },
        select: { id: true },
      })
      if (!share) await prisma.institutionConsent.create({ data: { memberId: m.id, scope: 'SHARE_OUTCOME', granted: false, source: 'MEMBER' } })
      return { memberId: m.id, candidateId: cp.id }
    }
    const ann = await mk('ann', true)
    const bo = await mk('bo', false)

    // Ann: in transition, lands a VP job, says the college helped.
    await openTransitionFlag(ann.memberId, 'SELF_REPORTED')
    const job = await reportNewJob({ memberId: ann.memberId, candidateId: ann.candidateId, companyName: company, title: 'VP Finance', startDate: new Date('2026-09-01'), helpedByInstitution: true, shareMilestone: true, graceDays: 60 })
    await reportNewJob({ memberId: bo.memberId, candidateId: bo.candidateId, companyName: company, title: 'Analyst', startDate: null, helpedByInstitution: false, shareMilestone: false, graceDays: 60 })

    const signals = await listSignals(ctx)
    const annSignals = signals.filter((s) => s.memberId === ann.memberId)
    check('VP job raises two signals for Ann, with her employer', [annSignals.length, annSignals[0]?.employer, annSignals[0]?.doNotSolicit], [2, company, true])
    check('Bo shares no outcome: no signals for Bo', signals.some((s) => s.memberId === bo.memberId), false)

    await prisma.prospectFlag.updateMany({ where: { memberId: ann.memberId, type: 'PROMOTION_VP_PLUS' }, data: { approvedAt: new Date() } })
    const exp = await updatesExportRows(ctx)
    const a = exp.find((r) => r.external_id === 'x-ann')
    const b = exp.find((r) => r.external_id === 'x-bo')
    check('Export: Ann employer, title, start date, approved flag, do-not-solicit in grace', [a?.employer, a?.title, a?.start_date?.toISOString().slice(0, 10), a?.prospect_flag, a?.do_not_solicit, a?.in_transition], [company, 'VP Finance', '2026-09-01', 'PROMOTION_VP_PLUS', true, false])
    check('Export: Bo employer, title, start date withheld', [b?.employer, b?.title, b?.start_date], [null, null, null])
    check('Suppression list has Ann only', (await suppressionRows(ctx)).map((r) => r.external_id), ['x-ann'])

    // Gratitude: pending, held back while the flag is open, sent once clear.
    await prisma.outcomeReport.update({ where: { id: job.outcomeReportId }, data: { gratitudeStatus: 'PENDING' } })
    const held = await sendGratitude({ institutionId: inst.id, outcomeReportIds: [job.outcomeReportId], createdBy: 'verify' })
    check('Thank-you held back while do-not-solicit', held, { sent: 0, skipped: 1, demo: false })
    await closeTransitionFlag(ann.memberId)
    const sent = await sendGratitude({ institutionId: inst.id, outcomeReportIds: [job.outcomeReportId], createdBy: 'verify' })
    check('Thank-you sent once clear (demo: recorded)', [('sent' in sent && sent.sent), ('demo' in sent && sent.demo)], [1, true])
    const send = await prisma.outreachSend.findFirstOrThrow({ where: { memberId: ann.memberId, campaign: { type: 'GRATITUDE' } }, select: { claimToken: true } })
    const target = await recordGiveClick({ slug: inst.slug, token: send.claimToken })
    const status = await prisma.outcomeReport.findUniqueOrThrow({ where: { id: job.outcomeReportId }, select: { gratitudeStatus: true } })
    check('Click goes to the giving page and marks CLICKED', [target, status.gratitudeStatus], ['https://example.com/give', 'CLICKED'])
    check('Click scores GIFT_PROMPT_CLICK once', await prisma.engagementEvent.count({ where: { memberId: ann.memberId, type: 'GIFT_PROMPT_CLICK' } }), 1)

    // Fund
    await saveFund(inst.id, { name: 'Resilience Fund', description: null, goalCents: 5_000_000, raisedCents: 1_200_000 })
    await openTransitionFlag(bo.memberId, 'COUNSELOR')
    const aw1 = await awardFromFund({ institutionId: inst.id, memberId: bo.memberId, awardType: 'COACHING_PACKAGE', valueCents: 75_000, awardedBy: 'verify' })
    const aw2 = await awardFromFund({ institutionId: inst.id, memberId: bo.memberId, awardType: 'COACHING_PACKAGE', valueCents: 75_000, awardedBy: 'verify' })
    check('One open award per alum', ['id' in aw1, 'error' in aw2], [true, true])
    await reportNewJob({ memberId: bo.memberId, candidateId: bo.candidateId, companyName: `${company} Two`, title: 'Manager', startDate: null, helpedByInstitution: true, shareMilestone: true, graceDays: 60 })
    const rep = await donorReport(inst.id)
    check('Donor report: 1 funded, placed, story shared', [rep.awards, rep.awardedCents, rep.placed, rep.sharedStories], [1, 75_000, 1, 1])

    // ROI
    const roi = await roiReport(inst.id)
    check('ROI computes with small groups and hides lift', [roi.fy.label.startsWith('FY'), roi.roi.lift, roi.roi.enough, roi.fund.awards], [true, null, false, 1])
  } finally {
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
    for (const id of candidates) await prisma.candidateProfile.delete({ where: { id } }).catch(() => {})
    await prisma.company.deleteMany({ where: { name: { startsWith: company } } }).catch(() => {})
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
