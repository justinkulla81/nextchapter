import { describe, expect, it } from 'vitest'
import {
  HELP_GROUP_LABEL,
  SCHOOL_ASKS,
  START_FIELDS,
  START_HELP,
  START_STAGES,
  currentStartStage,
  getStartStage,
  hasStartDetails,
  missingStartFields,
  parseStartValue,
  rankHelp,
  schoolCenterSearch,
  startDetailsOf,
  startPlanItems,
  suggestedStage,
} from '@/lib/journey/start-business'
import { activePaths, derivedLevelsOf, parallelPlanItems } from '@/lib/journey/paths'

describe('Start a business: stages', () => {
  it('has five stages, each with a first step, a goal and a plan', () => {
    expect(START_STAGES.map((s) => s.key)).toEqual(['idea', 'validate', 'build', 'launch', 'grow'])
    for (const s of START_STAGES) {
      expect(s.next.length).toBeGreaterThan(10)
      expect(s.firstWeek.length).toBeGreaterThan(0)
      expect(s.ongoing.length).toBeGreaterThan(0)
    }
  })
  it('suggests a stage from traction instead of asking for it, and the member’s own stage wins', () => {
    expect(suggestedStage(undefined)).toBe('idea')
    expect(suggestedStage('none')).toBe('idea')
    expect(suggestedStage('talked')).toBe('validate')
    expect(suggestedStage('first')).toBe('launch')
    expect(suggestedStage('steady')).toBe('grow')
    expect(currentStartStage({ customers: 'first' })).toBe('launch')
    expect(currentStartStage({ customers: 'first', stage: 'build' })).toBe('build')
    expect(getStartStage('grow').label).toBe('Grow')
  })
})

describe('Start a business: what we ask, and what we already know', () => {
  it('reads back only valid answers from journeyDetails.start', () => {
    const d = startDetailsOf({ venture: 'A bakery', start: { kind: 'local', customers: 'bogus', funding: ['savings', 'nope'], stage: 'build', team: 'solo' } })
    expect(d).toEqual({ kind: 'local', funding: ['savings'], stage: 'build', team: 'solo' })
    expect(startDetailsOf(null)).toEqual({})
    expect(hasStartDetails({ start: { stage: 'idea' } })).toBe(true)
    expect(hasStartDetails({ venture: 'x' })).toBe(false)
  })
  it('does not ask for what is already stored elsewhere: the venture, the runway and the hours', () => {
    const keys = START_FIELDS.map((f) => f.key)
    expect(keys).not.toContain('venture')
    expect(keys).not.toContain('runway')
    expect(keys).not.toContain('hours')
    for (const f of START_FIELDS) expect(f.why.length).toBeGreaterThan(10)
  })
  it('parses safely and asks the unanswered questions in order', () => {
    const kind = START_FIELDS.find((f) => f.key === 'kind')!
    const funding = START_FIELDS.find((f) => f.key === 'funding')!
    expect(parseStartValue(kind, 'tech')).toBe('tech')
    expect(parseStartValue(kind, 'huge')).toBeNull()
    expect(parseStartValue(funding, ['savings', 'savings', 'x'])).toEqual(['savings'])
    expect(parseStartValue(funding, [])).toBeNull()
    expect(missingStartFields({}).map((f) => f.key)).toEqual(['customers', 'kind', 'team', 'funding'])
    expect(missingStartFields({ customers: 'none', kind: 'tech' }).map((f) => f.key)).toEqual(['team', 'funding'])
  })
})

describe('Start a business: the plan', () => {
  it('gives the steps for the stage they are on, at most three, and a runway step when it is short', () => {
    const items = startPlanItems({ start: { stage: 'validate' } }, 1).map((i) => i.text)
    expect(items.length).toBeLessThanOrEqual(3)
    expect(items.join(' ')).toMatch(/pay, pre-order or sign up/)
    expect(startPlanItems({ start: { stage: 'validate' }, runwayMonths: 3 }, 2).some((i) => /3 months of runway/.test(i.text))).toBe(true)
    expect(startPlanItems({ start: { stage: 'validate' }, runwayMonths: 12 }, 2).some((i) => /runway/.test(i.text))).toBe(false)
    expect(startPlanItems({}, 1).length).toBeGreaterThan(0)
  })
})

describe('Start a business: where to get help', () => {
  it('links the groups we promised: school, local, incubators and accelerators, programs for owners, funding', () => {
    expect(Object.keys(HELP_GROUP_LABEL)).toEqual(['school', 'local', 'accelerators', 'owners', 'funding'])
    const names = START_HELP.map((h) => h.name).join(' ')
    for (const n of ['Small Business Development Center', 'SCORE', 'INBIA', 'Y Combinator', 'Techstars', '10,000 Small Businesses', 'microloans', 'I-Corps']) expect(names).toContain(n)
    for (const h of START_HELP) expect(h.href).toMatch(/^(https:\/\/|\/dashboard\/)/)
    expect(new Set(START_HELP.map((h) => h.id)).size).toBe(START_HELP.length)
  })
  it('orders help by stage and kind of business, and keeps technology-only programs from a local shop', () => {
    const top = rankHelp({ stage: 'grow', kind: 'local' })
    expect(top.findIndex((h) => h.id === '10ksb')).toBeLessThan(top.findIndex((h) => h.id === 'icorps'))
    const tech = rankHelp({ stage: 'validate', kind: 'tech' }).slice(0, 8).map((h) => h.id)
    expect(tech).toEqual(expect.arrayContaining(['yc', 'techstars']))
    const shop = rankHelp({ stage: 'validate', kind: 'local' }).slice(0, 8).map((h) => h.id)
    expect(shop).not.toContain('yc')
  })
  it('builds a search for the member’s own school, and nothing when we do not know it', () => {
    expect(schoolCenterSearch('University of Louisville')).toBe('https://www.google.com/search?q=University%20of%20Louisville%20entrepreneurship%20center%20alumni')
    expect(schoolCenterSearch(null)).toBeNull()
    expect(schoolCenterSearch('  ')).toBeNull()
    expect(SCHOOL_ASKS.length).toBeGreaterThanOrEqual(4)
  })
})

describe('Start a business as a parallel path', () => {
  it('counts as researching in the first two stages and doing from build on, and adds one stage step', () => {
    expect(derivedLevelsOf({ main: 'GROWING', journeyDetails: { start: { stage: 'validate' } } }).start).toBe('researching')
    expect(derivedLevelsOf({ main: 'GROWING', journeyDetails: { start: { stage: 'build' } } }).start).toBe('doing')
    const s = { main: 'GROWING' as const, journeyDetails: { start: { stage: 'launch' } } }
    expect(activePaths(s)[0]).toMatchObject({ key: 'start', href: '/dashboard/start-a-business' })
    expect(activePaths(s)[0].line).toMatch(/Launch/)
    const items = parallelPlanItems(s)
    expect(items).toHaveLength(1)
    expect(items[0].text).toMatch(/^Starting a business: /)
  })
})
