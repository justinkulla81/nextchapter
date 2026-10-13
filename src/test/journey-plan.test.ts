import { describe, expect, it } from 'vitest'
import { journeyPlanItems, shapePlan } from '@/lib/journey/plan'
import { chooseCheckInKind } from '@/lib/daily/check-in-schedule'

const general = [
  { text: 'Apply to Full-Time Jobs', actionType: 'JOB_APPLICATION_SUBMITTED' },
  { text: 'Have a coffee chat or call', actionType: 'OUTREACH_CALL' },
  { text: 'Fix your Resume Issues', actionType: 'RESUME_UPDATE' },
]

describe('weekly plan by journey and stage', () => {
  it('someone exploring gets their journey steps and no application targets', () => {
    const plan = shapePlan('EXPLORING_MOVE', 'EXPLORING', 2, general)
    expect(plan.map((p) => p.actionType)).not.toContain('JOB_APPLICATION_SUBMITTED')
    expect(plan[0].text).toBe('Have one coffee chat this month')
  })
  it('someone applying keeps applications', () => {
    expect(shapePlan('LAID_OFF', 'APPLYING', 2, general).map((p) => p.actionType)).toContain('JOB_APPLICATION_SUBMITTED')
  })
  it('Paused gets no plan', () => {
    expect(shapePlan('READY_TO_MOVE', 'PAUSED', 3, general)).toEqual([])
  })
  it('a laid-off member’s first week starts with benefits and severance', () => {
    expect(journeyPlanItems('LAID_OFF', 'APPLYING', 1).slice(0, 2).map((p) => p.text)).toEqual([
      'File for unemployment benefits',
      'Review your severance and benefits dates',
    ])
  })
  it('a journey step and a menu task of the same type appear once', () => {
    const plan = shapePlan('STUDENT_NEW_GRAD', 'PREPARING', 1, general)
    expect(plan.filter((p) => p.actionType === 'RESUME_UPDATE')).toHaveLength(1)
  })
  it('Landed is about the new job', () => {
    expect(journeyPlanItems('PROMOTION', 'LANDED', 4).map((p) => p.text)).toEqual(['Plan your first 90 days', 'Thank the people who helped you'])
  })
})

describe('daily pop-up', () => {
  it('never asks someone outside an active search to apply', () => {
    const kind = chooseCheckInKind({ appliedThisWeek: 0, weeklyGoal: 15, checkedInThisWeek: true, lastShownByKind: {}, activeSearch: false })
    expect(kind).not.toBe('APPLY_COMMIT')
  })
})

describe('VP-and-up promotions (spec §6.4)', () => {
  it('flags VP, C-suite, President and Head of; not directors or managers', async () => {
    const { isVpPlus } = await import('@/lib/higher-ed/transition')
    for (const t of ['VP Operations', 'Senior Vice President, Sales', 'Chief Financial Officer', 'CTO', 'President', 'Head of Product', 'EVP']) expect(isVpPlus(t)).toBe(true)
    for (const t of ['Director of Operations', 'Product Manager', 'Senior Analyst', 'Vice-chair of nothing']) expect(isVpPlus(t)).toBe(false)
  })
})
