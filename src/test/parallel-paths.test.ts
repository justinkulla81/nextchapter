import { describe, expect, it } from 'vitest'
import {
  INCOME_NEED_OPTIONS,
  SIDE_GOALS,
  activePaths,
  hasSideDetails,
  incomeNeedOf,
  incomePlanItem,
  incomeRecommendation,
  parallelPlanItems,
  parseSideInput,
  previousMainOf,
  rememberPreviousMain,
  sideDetailsOf,
  sideIncomeOf,
} from '@/lib/journey/paths'
import { buyHeadline, hardPartsToPlanFor, whyNote } from '@/lib/journey/buy-business'
import { SITUATION_FIELDS, parseSituationValue, situationPlanItems } from '@/lib/journey/situation'
import { journeyPlanItems, shapePlan } from '@/lib/journey/plan'
import { cushionMonths } from '@/lib/outcomes/runway'

describe('how soon do you need income', () => {
  it('reads back only a real answer', () => {
    expect(incomeNeedOf({ incomeNeed: 'now' })).toBe('now')
    expect(incomeNeedOf({ incomeNeed: 'whenever' })).toBeNull()
    expect(incomeNeedOf(null)).toBeNull()
    expect(INCOME_NEED_OPTIONS.map((o) => o.value)).toEqual(['now', 'soon', 'covered'])
  })
  it('is a situation question every journey is asked, and parses safely', () => {
    const f = SITUATION_FIELDS.find((x) => x.key === 'incomeNeed')!
    expect(f.journeys).toEqual(expect.arrayContaining(['LAID_OFF', 'GROWING', 'BUY_BUSINESS', 'EXPLORING_MOVE']))
    expect(parseSituationValue(f, 'soon')).toBe('soon')
    expect(parseSituationValue(f, 'tomorrow')).toBeNull()
    expect(parseSituationValue(f, '')).toBeNull()
  })
})

describe('recommending interim and fractional work', () => {
  it('recommends it, strongest first, when income is needed soon and the member is not earning that way', () => {
    const now = incomeRecommendation({ need: 'now', main: 'LAID_OFF', kinds: [] })!
    const soon = incomeRecommendation({ need: 'soon', main: 'BUY_BUSINESS', kinds: null })!
    expect(now.title).toMatch(/weeks, not months/)
    expect(now.because).toMatch(/within two months/)
    expect(soon.because).toMatch(/three to six months/)
    expect(now.href).toBe('/dashboard/interim-work')
  })
  it('says nothing when they are covered, have not answered, already do fractional work, or already earn on the side', () => {
    expect(incomeRecommendation({ need: 'covered', main: 'LAID_OFF', kinds: [] })).toBeNull()
    expect(incomeRecommendation({ need: null, main: 'LAID_OFF', kinds: [] })).toBeNull()
    expect(incomeRecommendation({ need: 'now', main: 'FRACTIONAL', kinds: [] })).toBeNull()
    expect(incomeRecommendation({ need: 'now', main: 'LAID_OFF', kinds: ['CONSULTING'] })).toBeNull()
    expect(incomeRecommendation({ need: 'now', main: 'LAID_OFF', kinds: ['TRAINING', 'OWN_BUSINESS'] })).not.toBeNull()
    expect(incomeRecommendation({ need: 'now', main: 'LAID_OFF', kinds: [], workingNow: true })).toBeNull()
  })
  it('puts a plan step on it, and the plan drops it for early-career members', () => {
    const item = incomePlanItem({ details: { incomeNeed: 'now' }, main: 'LAID_OFF' })!
    expect(item.text).toMatch(/interim or fractional/)
    expect(incomePlanItem({ details: { incomeNeed: 'covered' }, main: 'LAID_OFF' })).toBeNull()
    const out = shapePlan('LAID_OFF', 'APPLYING', 2, [], 'EARLY_CAREER', null, 0, [item]).map((i) => i.text)
    expect(out).not.toContain(item.text)
    expect(shapePlan('LAID_OFF', 'APPLYING', 2, [], null, null, 0, [item]).map((i) => i.text)).toContain(item.text)
  })
})

describe('side work', () => {
  it('reads and parses safely, never clearing an answer with a blank', () => {
    expect(sideDetailsOf({ alongside: { side: { hours: 5, income: 1500, goal: 'cover', junk: 1 } } })).toEqual({ hours: 5, income: 1500, goal: 'cover' })
    expect(sideDetailsOf({ alongside: { side: { hours: 99, income: -1, goal: 'bogus' } } })).toEqual({})
    expect(sideDetailsOf(null)).toEqual({})
    expect(parseSideInput({ hours: '5', income: '$1,500', goal: 'grow' })).toEqual({ hours: 5, income: 1500, goal: 'grow' })
    expect(parseSideInput({ hours: '', income: 'lots', goal: '' })).toEqual({})
    expect(parseSideInput({ hours: '0', income: '200000' })).toEqual({})
    expect(SIDE_GOALS).toHaveLength(4)
    expect(hasSideDetails({ alongside: { side: { hours: 5 } } })).toBe(true)
    expect(hasSideDetails({})).toBe(false)
    expect(sideIncomeOf({ alongside: { side: { income: 800 } } })).toBe(800)
    expect(sideIncomeOf({})).toBe(0)
  })
  it('feeds the runway: side income adds months and is counted against a laid-off member’s monthly need', () => {
    const without = cushionMonths({ savingsUsd: 30000, monthlyExpensesUsd: 5000, monthlyIncomeUsd: 0 }).months!
    const withSide = cushionMonths({ savingsUsd: 30000, monthlyExpensesUsd: 5000, monthlyIncomeUsd: 1500 }).months!
    expect(withSide - without).toBeCloseTo(2.57, 1)
    const items = situationPlanItems('LAID_OFF', { monthlyNeed: 5000, alongside: { side: { income: 1500 } } }).map((i) => i.text)
    expect(items.some((t) => /side income covers about \$1,500 of the \$5,000/.test(t) && /gap is \$3,500/.test(t))).toBe(true)
    const covered = situationPlanItems('LAID_OFF', { monthlyNeed: 1200, alongside: { side: { income: 1500 } } }).map((i) => i.text)
    expect(covered.some((t) => /no longer shrinking/.test(t))).toBe(true)
  })
})

describe('parallel paths and the plan', () => {
  const details = { buy: { stage: 'search' }, alongside: { side: { hours: 6, goal: 'cover' } } }
  it('lists each active path once: side work and a started buying plan, but never the main journey as a parallel one', () => {
    const cards = activePaths({ main: 'EXPLORING_MOVE', journeyDetails: details, kinds: ['CONSULTING'] })
    expect(cards.map((c) => c.key)).toEqual(['side', 'buy'])
    expect(activePaths({ main: 'BUY_BUSINESS', journeyDetails: details, kinds: [] }).map((c) => c.key)).toEqual(['side'])
    expect(activePaths({ main: 'LAID_OFF', journeyDetails: {}, kinds: [] })).toEqual([])
    expect(activePaths({ main: 'LAID_OFF', journeyDetails: {}, kinds: ['PART_TIME'] }).map((c) => c.key)).toEqual(['side'])
  })
  it('adds at most one step per path, shaped by the side goal and the buying stage', () => {
    const items = parallelPlanItems({ main: 'EXPLORING_MOVE', journeyDetails: details, kinds: ['CONSULTING'] })
    expect(items).toHaveLength(2)
    expect(items[0].text).toMatch(/6 side-work hours/)
    expect(items[1].text).toMatch(/^Buying a business: /)
    expect(parallelPlanItems({ main: 'EXPLORING_MOVE', journeyDetails: {}, kinds: [] })).toEqual([])
  })
  it('leaves the main journey’s own plan untouched', () => {
    expect(journeyPlanItems('LAID_OFF', 'APPLYING', 1).map((i) => i.text)).toContain('File for unemployment benefits')
  })
})

describe('switching the main focus', () => {
  it('remembers the journey they came from, so they can go back', () => {
    expect(rememberPreviousMain({ alongside: { side: { hours: 5 } } }, 'LAID_OFF', 'BUY_BUSINESS')).toEqual({ side: { hours: 5 }, previousMain: 'LAID_OFF' })
    expect(rememberPreviousMain({}, null, 'BUY_BUSINESS')).toBeNull()
    expect(rememberPreviousMain({}, 'GROWING', 'GROWING')).toBeNull()
    expect(previousMainOf({ alongside: { previousMain: 'LAID_OFF' } })).toBe('LAID_OFF')
    expect(previousMainOf({ alongside: { previousMain: 'drop table' } })).toBeNull()
    expect(previousMainOf(null)).toBeNull()
  })
})

describe('the Buy plan points at the member’s own side work', () => {
  it('sends income links to the side-work card when they have one', () => {
    expect(whyNote({ why: 'income' }, { hasSide: true })!.links[0]).toEqual({ label: 'Your side work', href: '/dashboard/other-paths' })
    expect(whyNote({ why: 'income' })!.links[0].href).toBe('/dashboard/interim-work')
    expect(whyNote({ why: 'boss' }, { hasSide: true })!.links).toEqual([])
    const hard = hardPartsToPlanFor({ ready: ['hours'] }, { hasSide: true }).find((h) => h.key === 'income')!
    expect(hard.learn.href).toBe('/dashboard/other-paths')
    expect(hardPartsToPlanFor({ ready: ['hours'] }).find((h) => h.key === 'income')!.learn.href).toBe('/dashboard/interim-work')
    expect(buyHeadline('search', {}).title).toBeTruthy()
  })
})
