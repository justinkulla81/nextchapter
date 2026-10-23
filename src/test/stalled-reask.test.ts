import { describe, expect, it } from 'vitest'
import {
  REASK_AFTER_WEEKS,
  REASK_GAP_DAYS,
  REASK_MAX_ASKS,
  REASK_PLAN_DAYS,
  reaskDue,
  reaskOptions,
  reaskPlanItems,
  reaskStateOf,
  searchWeeks,
  withAnswer,
  withShown,
  withSnooze,
  withStop,
  type ReaskContext,
} from '@/lib/journey/stalled-reask'
import { pickHomeNote } from '@/lib/redesign/home-note'

const now = new Date('2026-10-23T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString()
const base: ReaskContext = {
  journey: 'LAID_OFF',
  stage: 'APPLYING',
  weeksInStage: 8,
  casual: false,
  interviews: 0,
  offers: 0,
  journeyDetails: {},
  hasCoach: false,
  pivotKnown: false,
  activePaths: 0,
  earning: false,
  senior: true,
  now,
}

describe('when the re-ask is due', () => {
  it('asks after six weeks of searching with no interviews or offers', () => {
    expect(reaskDue(base)).toEqual({ weeks: 8, asks: 0 })
    expect(reaskDue({ ...base, weeksInStage: REASK_AFTER_WEEKS - 1 })).toBeNull()
    expect(reaskDue({ ...base, weeksInStage: REASK_AFTER_WEEKS })).not.toBeNull()
  })
  it('counts a casual search at half pace', () => {
    expect(searchWeeks(12, true)).toBe(6)
    expect(reaskDue({ ...base, casual: true, weeksInStage: 8 })).toBeNull()
    expect(reaskDue({ ...base, casual: true, weeksInStage: 12 })).not.toBeNull()
  })
  it('never asks someone who is interviewing, has an offer, is not searching, or is not in the applying stage', () => {
    expect(reaskDue({ ...base, interviews: 1 })).toBeNull()
    expect(reaskDue({ ...base, offers: 1 })).toBeNull()
    expect(reaskDue({ ...base, journey: 'GROWING' })).toBeNull()
    expect(reaskDue({ ...base, journey: 'BUY_BUSINESS' })).toBeNull()
    expect(reaskDue({ ...base, journey: null })).toBeNull()
    for (const stage of ['EXPLORING', 'PREPARING', 'INTERVIEWING', 'OFFER', 'LANDED', 'STAYING'] as const) expect(reaskDue({ ...base, stage })).toBeNull()
  })
  it('does not ask again until the gap has passed, a snooze is over, or after they asked us to stop', () => {
    expect(reaskDue({ ...base, journeyDetails: { reask: { shownAt: daysAgo(10), asks: 1 } } })).toBeNull()
    expect(reaskDue({ ...base, journeyDetails: { reask: { shownAt: daysAgo(REASK_GAP_DAYS + 1), asks: 1 } } })).toEqual({ weeks: 8, asks: 1 })
    expect(reaskDue({ ...base, journeyDetails: { reask: { answeredAt: daysAgo(20), shownAt: daysAgo(21), asks: 1 } } })).toBeNull()
    expect(reaskDue({ ...base, journeyDetails: { reask: { snoozeUntil: new Date(now.getTime() + 86_400_000).toISOString(), asks: 1 } } })).toBeNull()
    expect(reaskDue({ ...base, journeyDetails: { reask: { snoozeUntil: daysAgo(1), shownAt: daysAgo(60), asks: 1 } } })).not.toBeNull()
    expect(reaskDue({ ...base, journeyDetails: { reask: { stop: true } } })).toBeNull()
    expect(reaskDue({ ...base, journeyDetails: { reask: { asks: REASK_MAX_ASKS, shownAt: daysAgo(200) } } })).toBeNull()
  })
})

describe('what is offered, without re-asking what we know', () => {
  const keys = (c: Partial<ReaskContext>) => reaskOptions({ ...base, ...c }).map((o) => o.key)
  it('offers all four by default', () => {
    expect(keys({})).toEqual(['broaden', 'pivot', 'paths', 'coach'])
  })
  it('points a member who already named fields at those, not at a fresh pivot question', () => {
    const o = reaskOptions({ ...base, pivotKnown: true }).find((x) => x.key === 'pivot')!
    expect(o.label).toMatch(/I said I am open to/)
    expect(reaskOptions(base).find((x) => x.key === 'pivot')!.label).toBe('Pivot to another field')
  })
  it('sends a member with a coach to their coach, not to find one', () => {
    const c = reaskOptions({ ...base, hasCoach: true }).find((x) => x.key === 'coach')!
    expect(c.href).toBe('/dashboard/my-coaching')
    expect(reaskOptions(base).find((x) => x.key === 'coach')!.href).toBe('/dashboard/premium')
  })
  it('asks a member with active paths to change them, not to start one', () => {
    expect(reaskOptions({ ...base, activePaths: 2 }).find((x) => x.key === 'paths')!.label).toBe('Change what I do next to my search')
  })
  it('does not offer again what they chose in the last six weeks, but never leaves fewer than two', () => {
    const recent = { reask: { chosen: { broaden: daysAgo(10), coach: daysAgo(5) } } }
    expect(keys({ journeyDetails: recent })).toEqual(['pivot', 'paths'])
    const old = { reask: { chosen: { broaden: daysAgo(100) } } }
    expect(keys({ journeyDetails: old })).toContain('broaden')
    const all = { reask: { chosen: { broaden: daysAgo(1), pivot: daysAgo(1), paths: daysAgo(1), coach: daysAgo(1) } } }
    expect(keys({ journeyDetails: all })).toHaveLength(4)
    const three = { reask: { chosen: { broaden: daysAgo(1), pivot: daysAgo(1), paths: daysAgo(1) } } }
    expect(keys({ journeyDetails: three })).toHaveLength(4)
  })
  it('puts paths first when the cushion is short and they are not earning, and says why', () => {
    const short = { incomeNeed: 'under_3' }
    expect(keys({ journeyDetails: short })[0]).toBe('paths')
    expect(reaskOptions({ ...base, journeyDetails: short }).find((o) => o.key === 'paths')!.because).toMatch(/only a few months/)
    expect(keys({ journeyDetails: short, earning: true })[0]).toBe('broaden')
    expect(keys({ journeyDetails: { incomeNeed: 'year' } })[0]).toBe('broaden')
  })
  it('names interim and fractional work only to senior members', () => {
    expect(reaskOptions({ ...base, senior: true }).find((o) => o.key === 'paths')!.body).toMatch(/fractional/)
    expect(reaskOptions({ ...base, senior: false }).find((o) => o.key === 'paths')!.body).not.toMatch(/fractional|interim/)
  })
  it('gives every option a reason and a destination', () => {
    for (const o of reaskOptions(base)) {
      expect(o.because.length).toBeGreaterThan(20)
      expect(o.href).toMatch(/^\/dashboard\//)
    }
  })
})

describe('state is recorded without losing anything', () => {
  it('reads back only valid state', () => {
    expect(reaskStateOf(null)).toMatchObject({ asks: 0, stop: false, answer: null })
    expect(reaskStateOf({ reask: { asks: 'x', answer: 'nope', chosen: { broaden: 'garbage', coach: daysAgo(3) } } })).toMatchObject({ asks: 0, answer: null, chosen: { coach: daysAgo(3) } })
  })
  it('counts an ask when shown, remembers the answer and the option, snoozes and stops', () => {
    const shown = withShown({}, now) as { asks: number; shownAt: string }
    expect(shown.asks).toBe(1)
    const answered = withAnswer({ reask: shown }, 'pivot', now) as ReturnType<typeof reaskStateOf>
    expect(answered.answer).toBe('pivot')
    expect(answered.asks).toBe(1)
    expect(answered.chosen.pivot).toBe(now.toISOString())
    const snoozed = withSnooze({ reask: answered }, now) as ReturnType<typeof reaskStateOf>
    expect(new Date(snoozed.snoozeUntil!).getTime()).toBeGreaterThan(now.getTime())
    expect((withStop({ reask: snoozed }) as ReturnType<typeof reaskStateOf>).stop).toBe(true)
  })
})

describe('the plan follows the answer for four weeks', () => {
  it('adds one matching step, then lets go', () => {
    const d = { reask: { answer: 'broaden', answeredAt: daysAgo(3) } }
    expect(reaskPlanItems(d, now)).toHaveLength(1)
    expect(reaskPlanItems(d, now)[0].text).toMatch(/Widen your targets/)
    expect(reaskPlanItems({ reask: { answer: 'coach', answeredAt: daysAgo(3) } }, now)[0].text).toMatch(/coaching session/)
    expect(reaskPlanItems({ reask: { answer: 'broaden', answeredAt: daysAgo(REASK_PLAN_DAYS + 2) } }, now)).toEqual([])
    expect(reaskPlanItems({}, now)).toEqual([])
  })
  it('never names fractional or interim work in the step, so early-career plans keep it', () => {
    for (const a of ['broaden', 'pivot', 'paths', 'coach']) {
      expect(reaskPlanItems({ reask: { answer: a, answeredAt: daysAgo(1) } }, now)[0].text).not.toMatch(/fractional|interim/i)
    }
  })
})

describe('Home has one note', () => {
  const inputs = {
    needsCoachingForm: false,
    searchStrategyIncomplete: false,
    reportReady: false,
    accountsNotConnected: false,
    stalledSearch: false,
    passiveToActive: false,
    firstWeek: null,
    gotHired: false,
    searchPlaybook: false,
  }
  it('the re-ask wins over the narrower stalled-search card, and setup still comes first', () => {
    expect(pickHomeNote({ ...inputs, stalledReask: true, stalledSearch: true })).toBe('stalled_reask')
    expect(pickHomeNote({ ...inputs, stalledSearch: true })).toBe('stalled_search')
    expect(pickHomeNote({ ...inputs, stalledReask: true, searchStrategyIncomplete: true })).toBe('setup_strategy')
  })
})
