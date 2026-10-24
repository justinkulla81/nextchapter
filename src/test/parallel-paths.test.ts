import { describe, expect, it } from 'vitest'
import {
  INCOME_NEED_OPTIONS,
  INTEREST_KEYS,
  SIDE_GOALS,
  activePaths,
  askableInterests,
  derivedIncomeNeed,
  derivedLevelsOf,
  effectiveLevelsOf,
  hasSideDetails,
  incomeNeedFromMonths,
  incomeNeedIsDerived,
  incomeNeedOf,
  incomePlanItems,
  incomeRecommendation,
  mergeInterestLevels,
  mergeSideDetails,
  parallelPlanItems,
  focusOptions,
  homePathsRow,
  pathsWait,
  parseInterestInput,
  parseSideInput,
  previousMainOf,
  rememberPreviousMain,
  mergeSchoolDetails,
  parseSchoolInput,
  schoolDetailsOf,
  schoolEndDate,
  sideDetailsOf,
  sideIncomeOf,
  statedLevelsOf,
} from '@/lib/journey/paths'
import { PARTNERSHIP_MIN_COHORT, pathInterestCounts } from '@/lib/journey/path-interest-counts'
import { hardPartsToPlanFor, whyNote } from '@/lib/journey/buy-business'
import { SITUATION_FIELDS, parseSituationValue, situationPlanItems } from '@/lib/journey/situation'
import { shapePlan } from '@/lib/journey/plan'
import { cushionMonths } from '@/lib/outcomes/runway'

const WEEK = 7 * 86_400_000
const even = new Date(0 * WEEK) // week index 0
const odd = new Date(1 * WEEK + 1000) // week index 1

describe('what else are you thinking about', () => {
  it('reads only real stated levels from journeyDetails.paths.<key>.level', () => {
    const d = { paths: { buy: { level: 'researching' }, school: { level: 'curious' }, job: { level: 'bogus' }, side: { hours: 5 } } }
    expect(statedLevelsOf(d)).toEqual({ buy: 'researching', school: 'curious' })
    expect(statedLevelsOf(null)).toEqual({})
  })
  it('derives what we already know and does not ask it again', () => {
    const s = { main: 'EXPLORING_MOVE' as const, journeyDetails: { buy: { stage: 'prepare' } }, kinds: ['CONSULTING', 'TRAINING'], workingNow: false, interimInterest: false }
    expect(derivedLevelsOf(s)).toMatchObject({ job: 'doing', buy: 'researching', fractional: 'doing', school: 'doing' })
    expect(askableInterests(s)).toEqual(['start', 'side'])
    expect(derivedLevelsOf({ main: 'BUY_BUSINESS', journeyDetails: {} }).buy).toBe('doing')
    expect(derivedLevelsOf({ main: 'GROWING', journeyDetails: {}, interimInterest: true }).fractional).toBe('researching')
    expect(derivedLevelsOf({ main: 'GROWING', journeyDetails: {}, workingNow: true }).side).toBe('doing')
    expect(derivedLevelsOf({ main: 'GROWING', journeyDetails: { buy: { stage: 'search' } } }).buy).toBe('doing')
  })
  it('never asks about the main journey’s own path', () => {
    expect(askableInterests({ main: 'BUY_BUSINESS', journeyDetails: {} })).not.toContain('buy')
    expect(askableInterests({ main: 'FRACTIONAL', journeyDetails: {} })).not.toContain('fractional')
    expect(askableInterests({ main: 'GROWING', journeyDetails: {} })).toEqual(['job', 'buy', 'start', 'fractional', 'side', 'school'])
  })
  it('lets the member’s own answer win over what we derived', () => {
    expect(effectiveLevelsOf({ main: 'GROWING', journeyDetails: { buy: { stage: 'search' }, paths: { buy: { level: 'curious' } } } }).buy).toBe('curious')
  })
  it('parses a form safely and stores levels next to each path’s own answers, clearing on none', () => {
    expect(parseInterestInput({ level_buy: 'doing', level_job: 'none', level_school: 'whatever', level_nope: 'doing' })).toEqual({ buy: 'doing', job: 'none' })
    const merged = mergeInterestLevels({ paths: { side: { hours: 6, income: 800 }, previousMain: 'LAID_OFF' } }, { side: 'doing', buy: 'curious' })
    expect(merged).toEqual({ side: { hours: 6, income: 800, level: 'doing' }, buy: { level: 'curious' }, previousMain: 'LAID_OFF' })
    expect(mergeInterestLevels({ paths: { buy: { level: 'curious' } } }, { buy: 'none' })).toEqual({})
    expect(mergeInterestLevels({ paths: { side: { hours: 6, level: 'doing' } } }, { side: 'none' })).toEqual({ side: { hours: 6 } })
  })
})

describe('a path is active only at researching or doing it', () => {
  it('shows a card and adds one step for researching and doing, and nothing for curious', () => {
    const s = { main: 'GROWING' as const, journeyDetails: { paths: { school: { level: 'curious' }, start: { level: 'researching' }, fractional: { level: 'doing' } } } }
    expect(activePaths(s).map((c) => c.key)).toEqual(['start', 'fractional'])
    const steps = parallelPlanItems(s)
    expect(steps).toHaveLength(2)
    expect(steps.some((i) => /program/i.test(i.text))).toBe(false)
  })
  it('never adds more than one step per path, and none for the main journey’s own path', () => {
    const s = { main: 'BUY_BUSINESS' as const, journeyDetails: { buy: { stage: 'search' }, paths: { side: { level: 'doing', hours: 6, goal: 'cover' } } }, kinds: ['PART_TIME'] }
    expect(activePaths(s).map((c) => c.key)).toEqual(['side'])
    const items = parallelPlanItems(s)
    expect(items).toHaveLength(1)
    expect(items[0].text).toMatch(/6 side-work hours/)
    expect(parallelPlanItems({ main: 'GROWING', journeyDetails: {}, kinds: [] })).toEqual([])
    const all = Object.fromEntries(INTEREST_KEYS.map((k) => [k, { level: 'doing' }]))
    expect(parallelPlanItems({ main: 'GROWING', journeyDetails: { paths: all } }).length).toBeLessThanOrEqual(INTEREST_KEYS.length)
  })
  it('a job search shows as a path only when the main journey is not one', () => {
    expect(activePaths({ main: 'GROWING', journeyDetails: { paths: { job: { level: 'researching' } } } }).map((c) => c.key)).toEqual(['job'])
    expect(activePaths({ main: 'LAID_OFF', journeyDetails: { paths: { job: { level: 'researching' } } } })).toEqual([])
  })
})

describe('how long could you go without new income', () => {
  it('has four answers, and derives from a saved cushion or a runway instead of asking', () => {
    expect(INCOME_NEED_OPTIONS.map((o) => o.value)).toEqual(['year', '6_12', '3_6', 'under_3'])
    expect([14, 12, 9, 6, 4, 3, 2, 0].map(incomeNeedFromMonths)).toEqual(['year', 'year', '6_12', '6_12', '3_6', '3_6', 'under_3', 'under_3'])
    expect(derivedIncomeNeed({ cushionMonths: 4.5 })).toBe('3_6')
    expect(derivedIncomeNeed({ runwayMonths: 2 })).toBe('under_3')
    expect(derivedIncomeNeed({})).toBeNull()
    expect(incomeNeedIsDerived({ cushionMonths: 4 })).toBe(true)
    expect(incomeNeedIsDerived({ cushionMonths: 4, incomeNeed: 'year' })).toBe(false)
    expect(incomeNeedOf({ cushionMonths: 4, incomeNeed: 'year' })).toBe('year')
    expect(incomeNeedOf({ incomeNeed: 'whenever' })).toBeNull()
  })
  it('is a situation question for every journey except full-time fractional, and parses safely', () => {
    const f = SITUATION_FIELDS.find((x) => x.key === 'incomeNeed')!
    expect(f.label).toBe('How long could you go without new income?')
    expect(f.journeys).toEqual(expect.arrayContaining(['LAID_OFF', 'GROWING', 'BUY_BUSINESS']))
    expect(f.journeys).not.toContain('FRACTIONAL')
    expect(parseSituationValue(f, '3_6')).toBe('3_6')
    expect(parseSituationValue(f, 'tomorrow')).toBeNull()
  })
  it('under three months puts income first, in order: benefits, contract or part-time, then interim or fractional', () => {
    const items = incomePlanItems({ details: { incomeNeed: 'under_3' }, main: 'LAID_OFF', kinds: [] }).map((i) => i.text)
    expect(items).toHaveLength(3)
    expect(items[0]).toMatch(/unemployment benefits/)
    expect(items[1]).toMatch(/contract, temp or part-time/)
    expect(items[2]).toMatch(/interim or fractional/)
    const employed = incomePlanItems({ details: { incomeNeed: 'under_3' }, main: 'GROWING', kinds: [] }).map((i) => i.text)
    expect(employed).toHaveLength(2)
    expect(employed[0]).toMatch(/contract, temp or part-time/)
  })
  it('three to six months adds one income step a week, alternating the quick kind with the longer one', () => {
    const a = incomePlanItems({ details: { incomeNeed: '3_6' }, main: 'LAID_OFF', kinds: [], now: even })
    const b = incomePlanItems({ details: { incomeNeed: '3_6' }, main: 'LAID_OFF', kinds: [], now: odd })
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(a[0].text).toMatch(/contract, temp or part-time/)
    expect(b[0].text).toMatch(/interim or fractional/)
    expect(incomePlanItems({ details: { incomeNeed: '3_6' }, main: 'LAID_OFF', kinds: [], now: odd, senior: false })[0].text).toMatch(/contract, temp or part-time/)
  })
  it('six months or more adds no step and shows fractional as an option only', () => {
    expect(incomePlanItems({ details: { incomeNeed: '6_12' }, main: 'LAID_OFF', kinds: [] })).toEqual([])
    expect(incomePlanItems({ details: { incomeNeed: 'year' }, main: 'LAID_OFF', kinds: [] })).toEqual([])
    expect(incomeRecommendation({ need: '6_12', main: 'LAID_OFF', kinds: [] })!.strength).toBe('option')
    expect(incomeRecommendation({ need: 'under_3', main: 'LAID_OFF', kinds: [] })!.strength).toBe('first')
    expect(incomeRecommendation({ need: '3_6', main: 'LAID_OFF', kinds: [] })!.strength).toBe('steady')
  })
  it('says nothing to a full-time fractional member, someone already earning, or someone who has not answered', () => {
    expect(incomeRecommendation({ need: 'under_3', main: 'FRACTIONAL', kinds: [] })).toBeNull()
    expect(incomeRecommendation({ need: 'under_3', main: 'LAID_OFF', kinds: ['CONSULTING'] })).toBeNull()
    expect(incomeRecommendation({ need: 'under_3', main: 'LAID_OFF', kinds: [], workingNow: true })).toBeNull()
    expect(incomeRecommendation({ need: 'under_3', main: 'LAID_OFF', kinds: ['TRAINING'] })).not.toBeNull()
    expect(incomeRecommendation({ need: null, main: 'LAID_OFF', kinds: [] })).toBeNull()
  })
  it('early-career members get part-time or contract steps and never interim or fractional ones', () => {
    const first = incomePlanItems({ details: { incomeNeed: 'under_3' }, main: 'LAID_OFF', kinds: [] })
    const out = shapePlan('LAID_OFF', 'APPLYING', 2, [], 'EARLY_CAREER', null, 0, first).map((i) => i.text)
    expect(out.some((t) => /contract, temp or part-time/.test(t))).toBe(true)
    expect(out.some((t) => /interim or fractional/.test(t))).toBe(false)
  })
  it('flows through the situation plan, using what we know about earning', () => {
    const t = situationPlanItems('LAID_OFF', { incomeNeed: 'under_3' }, { kinds: [] }).map((i) => i.text)
    expect(t.some((x) => /interim or fractional/.test(x))).toBe(true)
    expect(situationPlanItems('LAID_OFF', { incomeNeed: 'under_3' }, { kinds: ['PART_TIME'] }).some((i) => /interim or fractional/.test(i.text))).toBe(false)
  })
})

describe('side work', () => {
  it('reads and parses safely, never clearing an answer with a blank', () => {
    expect(sideDetailsOf({ paths: { side: { hours: 5, income: 1500, goal: 'cover', level: 'doing', junk: 1 } } })).toEqual({ hours: 5, income: 1500, goal: 'cover' })
    expect(sideDetailsOf({ paths: { side: { hours: 99, income: -1, goal: 'bogus' } } })).toEqual({})
    expect(sideDetailsOf(null)).toEqual({})
    expect(parseSideInput({ hours: '5', income: '$1,500', goal: 'grow' })).toEqual({ hours: 5, income: 1500, goal: 'grow' })
    expect(parseSideInput({ hours: '', income: 'lots', goal: '' })).toEqual({})
    expect(SIDE_GOALS).toHaveLength(4)
    expect(hasSideDetails({ paths: { side: { hours: 5 } } })).toBe(true)
    expect(sideIncomeOf({ paths: { side: { income: 800 } } })).toBe(800)
    expect(mergeSideDetails({ paths: { side: { level: 'doing' }, buy: { level: 'curious' } } }, { hours: 5 })).toEqual({ side: { level: 'doing', hours: 5 }, buy: { level: 'curious' } })
  })
  it('feeds the runway: side income adds months and counts against a laid-off member’s monthly need', () => {
    const without = cushionMonths({ savingsUsd: 30000, monthlyExpensesUsd: 5000, monthlyIncomeUsd: 0 }).months!
    const withSide = cushionMonths({ savingsUsd: 30000, monthlyExpensesUsd: 5000, monthlyIncomeUsd: 1500 }).months!
    expect(withSide - without).toBeCloseTo(2.57, 1)
    const items = situationPlanItems('LAID_OFF', { monthlyNeed: 5000, paths: { side: { income: 1500 } } }).map((i) => i.text)
    expect(items.some((t) => /side income covers about \$1,500 of the \$5,000/.test(t) && /gap is \$3,500/.test(t))).toBe(true)
    expect(situationPlanItems('LAID_OFF', { monthlyNeed: 1200, paths: { side: { income: 1500 } } }).some((i) => /no longer shrinking/.test(i.text))).toBe(true)
  })
})

describe('switching the main focus', () => {
  it('remembers the journey they came from, so they can go back', () => {
    expect(rememberPreviousMain({ paths: { side: { hours: 5 } } }, 'LAID_OFF', 'BUY_BUSINESS')).toEqual({ side: { hours: 5 }, previousMain: 'LAID_OFF' })
    expect(rememberPreviousMain({}, null, 'BUY_BUSINESS')).toBeNull()
    expect(rememberPreviousMain({}, 'GROWING', 'GROWING')).toBeNull()
    expect(previousMainOf({ paths: { previousMain: 'LAID_OFF' } })).toBe('LAID_OFF')
    expect(previousMainOf({ paths: { previousMain: 'drop table' } })).toBeNull()
  })
})

describe('the Buy plan’s income note comes from the member’s answer', () => {
  it('replaces the generic note with what they told us, and points at their own side work', () => {
    expect(whyNote({ why: 'income' }, { incomeNeed: 'under_3' })!.text).toMatch(/under three months/)
    expect(whyNote({ why: 'hiring' }, { incomeNeed: '3_6' })!.text).toMatch(/one income step every week/)
    expect(whyNote({ why: 'income' }, { incomeNeed: 'year' })!.links).toEqual([])
    expect(whyNote({ why: 'income' }, { incomeNeed: 'under_3', hasSide: true })!.links[0]).toEqual({ label: 'Your side work', href: '/dashboard/other-paths' })
  })
  it('without an answer, keeps the general note and asks the question', () => {
    const n = whyNote({ why: 'income' })!
    expect(n.links.map((l) => l.href)).toEqual(expect.arrayContaining(['/dashboard/interim-work', '/dashboard/other-paths#paths-income']))
    expect(whyNote({ why: 'boss' }, { incomeNeed: 'under_3' })!.links).toEqual([])
    expect(hardPartsToPlanFor({ ready: ['hours'] }, { hasSide: true }).find((h) => h.key === 'income')!.learn.href).toBe('/dashboard/other-paths')
  })
})

describe('aggregate counts for partnership conversations', () => {
  const members = (n: number, level: string) => Array.from({ length: n }, () => ({ paths: { buy: { level } } }))
  it('counts per path and level and withholds any cell under ten members', () => {
    const c = pathInterestCounts([...members(12, 'researching'), ...members(9, 'doing'), { paths: { school: { level: 'curious' } } }])
    expect(PARTNERSHIP_MIN_COHORT).toBe(10)
    expect(c.buy.researching).toBe(12)
    expect(c.buy.doing).toBeNull()
    expect(c.buy.curious).toBeNull()
    expect(c.school.curious).toBeNull()
  })
  it('counts only what members said, never what we derived, and returns no rows', () => {
    const c = pathInterestCounts(Array.from({ length: 20 }, () => ({ buy: { stage: 'search' } })))
    expect(c.buy.doing).toBeNull()
    expect(JSON.stringify(c)).not.toMatch(/userId|email|name/)
  })
})

describe('paths on Home: the row, the focus switch and the hours cap', () => {
  const base = { main: 'LAID_OFF' as const, kinds: [] as string[], journeyDetails: { buy: { stage: 'prepare' }, paths: { side: { level: 'doing', hours: 6 }, school: { level: 'curious' } } } }

  it('shows nothing when there are no active paths', () => {
    expect(homePathsRow({ main: 'LAID_OFF', journeyDetails: {}, kinds: [] })).toBeNull()
    expect(homePathsRow({ main: 'LAID_OFF', journeyDetails: { paths: { school: { level: 'curious' } } }, kinds: [] })).toBeNull()
    expect(focusOptions({ main: 'LAID_OFF', journeyDetails: {}, kinds: [] })).toBeNull()
  })
  it('lists active paths with their level, and never curious ones', () => {
    const row = homePathsRow(base)!
    expect(row.items.map((i) => [i.key, i.label, i.level])).toEqual([
      ['buy', 'buying a business', 'researching'],
      ['side', 'side income', 'doing it'],
    ])
    expect(row.waiting).toBe(false)
  })
  it('offers the main journey plus each active path that can become main, as 2 to 4 buttons', () => {
    const opts = focusOptions(base)!
    expect(opts.map((o) => o.to)).toEqual(['LAID_OFF', 'BUY_BUSINESS'])
    expect(opts[0].current).toBe(true)
    const back = focusOptions({ main: 'BUY_BUSINESS', journeyDetails: { buy: { stage: 'search' }, paths: { side: { level: 'doing' }, previousMain: 'LAID_OFF' } }, kinds: [] })!
    expect(back.map((o) => o.to)).toEqual(['BUY_BUSINESS', 'BACK'])
    const all = focusOptions({ main: 'GROWING', journeyDetails: { paths: { buy: { level: 'doing' }, fractional: { level: 'doing' }, previousMain: 'LAID_OFF' } }, kinds: [] })!
    expect(all.length).toBeLessThanOrEqual(4)
  })
  it('caps the plan: 3 hours a week or less means the main plan only, paths wait', () => {
    expect(pathsWait({ hoursAvailable: 3 })).toBe(true)
    expect(pathsWait({ hoursAvailable: 4 })).toBe(false)
    expect(pathsWait({})).toBe(false)
    expect(parallelPlanItems(base)).toHaveLength(2)
    expect(parallelPlanItems({ ...base, journeyDetails: { ...base.journeyDetails, hoursAvailable: 3 } })).toEqual([])
    expect(parallelPlanItems({ ...base, journeyDetails: { ...base.journeyDetails, hoursAvailable: 5 } })).toHaveLength(2)
    const row = homePathsRow({ ...base, journeyDetails: { ...base.journeyDetails, hoursAvailable: 2 } })!
    expect(row.waiting).toBe(true)
    expect(row.hours).toBe(2)
  })
  it('adds at most one step per active path', () => {
    const all = Object.fromEntries(INTEREST_KEYS.map((k) => [k, { level: 'doing' }]))
    const s = { main: 'GROWING' as const, journeyDetails: { hoursAvailable: 10, paths: all }, kinds: [] }
    expect(parallelPlanItems(s).length).toBe(activePaths(s).length)
  })
})

describe('going back to school', () => {
  it('reads and parses safely, keeping the level and every other answer', () => {
    expect(schoolDetailsOf({ paths: { school: { level: 'doing', program: ' MBA ', mode: 'full', ends: '2027-05', funding: 'loans', junk: 1 } } })).toEqual({ program: 'MBA', mode: 'full', ends: '2027-05', funding: 'loans' })
    expect(schoolDetailsOf({ paths: { school: { mode: 'sometimes', ends: '2027-13', funding: 'gold' } } })).toEqual({})
    expect(schoolDetailsOf(null)).toEqual({})
    expect(parseSchoolInput({ program: 'x'.repeat(200), mode: 'part', ends: '2026-12', funding: 'employer' })).toEqual({ program: 'x'.repeat(120), mode: 'part', ends: '2026-12', funding: 'employer' })
    expect(parseSchoolInput({ program: '', mode: '', ends: 'soon', funding: '' })).toEqual({})
    expect(mergeSchoolDetails({ paths: { school: { level: 'doing' }, side: { hours: 4 } } }, { program: 'MBA' })).toEqual({ school: { level: 'doing', program: 'MBA' }, side: { hours: 4 } })
    expect(schoolEndDate({ ends: '2027-05' })!.toISOString().slice(0, 10)).toBe('2027-05-31')
    expect(schoolEndDate({})).toBeNull()
  })
  const now = new Date('2026-10-23T12:00:00Z')
  const sig = (school: Record<string, unknown>) => ({ main: 'GROWING' as const, journeyDetails: { paths: { school } }, now, weekNumber: 1 })
  it('a full-time student gets the school-network and proof steps, timed to when the program ends, named for the program', () => {
    const early = parallelPlanItems(sig({ level: 'doing', program: 'MBA', mode: 'full', ends: '2028-05' }))
    expect(early).toHaveLength(1)
    expect(early[0].text).toMatch(/^MBA: /)
    const closing = parallelPlanItems(sig({ level: 'doing', program: 'MBA', mode: 'full', ends: '2027-01' }))
    expect(closing[0].text).not.toBe(early[0].text)
  })
  it('part-time and researching students get their own step, and one step only', () => {
    expect(parallelPlanItems(sig({ level: 'doing', mode: 'part' }))[0].text).toMatch(/coursework/)
    const r = parallelPlanItems(sig({ level: 'researching', program: 'Master of Public Health' }))
    expect(r).toHaveLength(1)
    expect(r[0].text).toMatch(/Ask two people who finished Master of Public Health/)
    expect(parallelPlanItems(sig({ level: 'researching' }))[0].text).toMatch(/Look at one program/)
    expect(parallelPlanItems(sig({ level: 'curious', program: 'MBA' }))).toEqual([])
  })
  it('shows the program on the card', () => {
    const c = activePaths(sig({ level: 'doing', program: 'MBA', mode: 'full', ends: '2027-05' })).find((x) => x.key === 'school')!
    expect(c.line).toBe('Doing it: MBA, full time, ends 2027-05')
  })
})
