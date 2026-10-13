import { describe, expect, it } from 'vitest'
import { gateItems, journeyPlanItems, shapePlan } from '@/lib/journey/plan'
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
  it('someone managing their career always has a plan, whatever journey they began on', () => {
    for (const j of ['LAID_OFF', 'EXPLORING_MOVE', 'GROWING'] as const) {
      const plan = shapePlan(j, 'STAYING', 3, general)
      expect(plan.length).toBeGreaterThan(2)
      expect(plan.map((p) => p.actionType)).not.toContain('JOB_APPLICATION_SUBMITTED')
    }
    expect(journeyPlanItems('LAID_OFF', 'STAYING', 1).map((p) => p.text)).toContain('Benchmark your pay against the market')
    expect(journeyPlanItems('LAID_OFF', 'PAUSED', 1)).toEqual(journeyPlanItems('LAID_OFF', 'STAYING', 1))
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

describe('thinking about a move', () => {
  it('exploring gets market and pay steps; preparing gets a quiet search', () => {
    expect(journeyPlanItems('EXPLORING_MOVE', 'EXPLORING', 1).map((p) => p.text)).toContain('Compare your pay with the market')
    expect(journeyPlanItems('EXPLORING_MOVE', 'PREPARING', 1).map((p) => p.text)).toContain('Line up two references you trust')
  })
  it('a retired Ready for a new job member gets the same plan', () => {
    expect(journeyPlanItems('READY_TO_MOVE', 'PREPARING', 1)).toEqual(journeyPlanItems('EXPLORING_MOVE', 'PREPARING', 1))
  })
  it('worry about a layoff puts runway and benefits first', () => {
    const items = journeyPlanItems('EXPLORING_MOVE', 'EXPLORING', 1, 'layoff_worry').map((p) => p.text)
    expect(items[0]).toMatch(/runway/i)
    expect(items.some((t) => /unemployment benefits/i.test(t))).toBe(true)
  })
  it('a driver adds nothing to other journeys', () => {
    expect(journeyPlanItems('PROMOTION', 'PREPARING', 1, 'layoff_worry')).toEqual(journeyPlanItems('PROMOTION', 'PREPARING', 1))
  })
})

describe('managing my career', () => {
  it('gets an active plan with no application targets', () => {
    const plan = shapePlan('GROWING', 'STAYING', 1, general)
    expect(plan.map((p) => p.text)).toContain('Benchmark your pay against the market')
    expect(plan.map((p) => p.actionType)).not.toContain('JOB_APPLICATION_SUBMITTED')
  })
  it('keeps going after the first week', () => {
    expect(journeyPlanItems('GROWING', 'STAYING', 3).length).toBeGreaterThan(2)
  })
})

describe('time gates in an active search', () => {
  it('adds nothing early, and new steps as weeks pass', () => {
    expect(gateItems('APPLYING', 2)).toEqual([])
    expect(gateItems('APPLYING', 3).length).toBeGreaterThan(0)
    expect(gateItems('APPLYING', 6).length).toBeGreaterThan(gateItems('APPLYING', 3).length)
    expect(gateItems('APPLYING', 13).map((p) => p.text).join(' ')).toMatch(/different lane/)
  })
  it('opens different doors, not the same plan reworded', () => {
    const texts = gateItems('APPLYING', 13).map((p) => p.text)
    expect(new Set(texts).size).toBe(texts.length)
    expect(texts.some((t) => /interim or fractional/i.test(t))).toBe(true)
    expect(texts.some((t) => /coaching session/i.test(t))).toBe(true)
  })
  it('only applies in an active search', () => {
    expect(gateItems('STAYING', 20)).toEqual([])
    expect(gateItems('EXPLORING', 20)).toEqual([])
    expect(gateItems('PAUSED', 20)).toEqual([])
  })
  it('reaches the plan, and the clock restarts when the stage changes', () => {
    expect(shapePlan('LAID_OFF', 'APPLYING', 7, general, null, 7).map((p) => p.text)).toContain('Widen your targets: add a second role title or industry')
    expect(shapePlan('LAID_OFF', 'INTERVIEWING', 7, general, null, 0).map((p) => p.text)).not.toContain('Widen your targets: add a second role title or industry')
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
