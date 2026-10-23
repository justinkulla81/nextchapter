import { describe, expect, it } from 'vitest'
import { computeFitAssessment } from '@/lib/jobs/job-fit-bucket'
import { pivotMessage } from '@/lib/journey/pivot-scope-message'
import { COACH_OFFER_COPY } from '@/lib/coach/offer'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import {
  addExploredOption, applyScope, behaviorPointsOutside, DEFAULT_SCOPE, exploreQuestion, hasOutside, homeOf, isPivotingNow, outsideHome,
  parseScope, pivotMessageDue, readExploredOptions, readPivotScopeState, removeExploredOption, resolveScope, scopeFor, setExploredOptionOn,
  widenedFitNote, type BehaviorSignal,
} from '@/lib/jobs/search-scope'

const profile = {
  primaryFunction: 'Finance', secondaryFunction: null, targetFunction: null, industryContext: 'Financial Services & Banking',
  secondaryIndustryContext: null, targetIndustries: ['Financial Services & Banking'], currentState: 'CA',
}
const noExp = readSearchExpansion({})
const home = homeOf(profile, noExp)

describe('scope choice', () => {
  it('defaults to Broader so nothing regresses', () => {
    expect(DEFAULT_SCOPE).toBe('broader')
    expect(scopeFor(null)).toBe('broader')
    expect(scopeFor('narrow')).toBe('narrow')
    expect(scopeFor('narrow', 'everything')).toBe('everything')
    expect(parseScope('wide')).toBeNull()
  })
})

describe('explored options', () => {
  it('start off, dedupe, toggle and remove', () => {
    let l = addExploredOption([], { kind: 'industry', value: 'Healthcare & Hospital Systems', source: 'exploration' })
    l = addExploredOption(l, { kind: 'industry', value: 'healthcare & hospital systems', source: 'exploration' })
    l = addExploredOption(l, { kind: 'place', value: 'nc', source: 'exploration' })
    expect(l).toHaveLength(2)
    expect(l.every((o) => !o.on)).toBe(true)
    expect(l[1].value).toBe('NC')
    l = setExploredOptionOn(l, { kind: 'place', value: 'NC' }, true)
    expect(l.find((o) => o.kind === 'place')?.on).toBe(true)
    expect(removeExploredOption(l, { kind: 'place', value: 'NC' })).toHaveLength(1)
  })
  it('reads journeyDetails defensively', () => {
    expect(readExploredOptions(null)).toEqual([])
    expect(readExploredOptions({ exploredOptions: [{ kind: 'bogus', value: 'x' }, { kind: 'place', value: 'zzz' }, { kind: 'function', value: 'Marketing', on: true }] })).toMatchObject([{ kind: 'function', value: 'Marketing', on: true }])
  })
})

describe('resolving a scope', () => {
  const exp = readSearchExpansion({ states: ['AZ'], roles: ['recruiter'], industries: ['Insurance'], remote: true })
  const options = [
    { kind: 'function' as const, value: 'Marketing', on: true, source: 'exploration' as const, at: '' },
    { kind: 'industry' as const, value: 'Education & EdTech', on: false, source: 'exploration' as const, at: '' },
    { kind: 'place' as const, value: 'NC', on: false, source: 'exploration' as const, at: '' },
  ]
  const stored = ['Financial Services & Banking', 'Insurance']
  it('Narrow reads home only', () => {
    const r = resolveScope({ scope: 'narrow', expansion: exp, options, targetIndustries: stored })
    expect(r.expansion).toMatchObject({ remote: false, states: [], roles: [], industries: [] })
    expect(r.exploredFunctions).toEqual([])
    expect(r.targetIndustries).toEqual(['Financial Services & Banking'])
  })
  it('Broader is the opt-ins plus options that are on', () => {
    const r = resolveScope({ scope: 'broader', expansion: exp, options, targetIndustries: stored })
    expect(r.expansion).toMatchObject({ remote: true, states: ['AZ'], roles: ['recruiter'], industries: ['Insurance'] })
    expect(r.exploredFunctions).toEqual(['Marketing'])
    expect(r.targetIndustries).toEqual(['Financial Services & Banking', 'Insurance'])
  })
  it('Everything adds every explored option', () => {
    const r = resolveScope({ scope: 'everything', expansion: exp, options, targetIndustries: stored })
    expect(r.expansion.states).toEqual(['AZ', 'NC'])
    expect(r.expansion.industries).toEqual(['Insurance', 'Education & EdTech'])
    expect(r.targetIndustries).toContain('Education & EdTech')
  })
  it('an off option changes nothing in Broader', () => {
    const r = resolveScope({ scope: 'broader', expansion: noExp, options: options.slice(1), targetIndustries: ['Financial Services & Banking'] })
    expect(r.expansion).toMatchObject({ states: [], industries: [] })
    expect(r.targetIndustries).toEqual(['Financial Services & Banking'])
  })
  it('applyScope hands the fit score the resolved view', () => {
    const r = resolveScope({ scope: 'narrow', expansion: exp, options, targetIndustries: stored })
    expect(applyScope({ searchExpansion: exp, targetIndustries: stored }, r).searchExpansion.states).toEqual([])
  })
})

describe('pivot flag', () => {
  const active = (a: Partial<ReturnType<typeof resolveScope>['active']>) => ({ functions: [], roles: [], industries: [], places: [], remote: false, ...a })
  it('flags areas outside home, by kind', () => {
    const o = outsideHome(active({ functions: ['Marketing', 'Finance'], industries: ['Insurance', 'Financial Services & Banking'], places: ['AZ', 'CA'] }), home)
    expect(o).toEqual({ functions: ['Marketing'], industries: ['Insurance'], places: ['AZ'] })
    expect(hasOutside(o)).toBe(true)
  })
  it('remote is never outside; unknown home says nothing is outside', () => {
    expect(hasOutside(outsideHome(active({ remote: true }), home))).toBe(false)
    expect(hasOutside(outsideHome(active({ industries: ['Insurance'], places: ['AZ'] }), homeOf({}, noExp)))).toBe(false)
  })
  it('a pivot role counts by its function, or as outside when unknown', () => {
    expect(outsideHome(active({ roles: ['recruiter'] }), home, () => 'Human Resources').functions).toEqual(['Human Resources'])
    expect(outsideHome(active({ roles: ['analyst'] }), home, () => 'Finance').functions).toEqual([])
    expect(outsideHome(active({ roles: ['mystery'] }), home).functions).toEqual(['mystery'])
  })
  it('target function and industries added from the market page are handled in home', () => {
    const h = homeOf({ ...profile, targetFunction: 'Operations', targetIndustries: ['Financial Services & Banking', 'Insurance'] }, readSearchExpansion({ industries: ['Insurance'] }))
    expect(h.functions).toEqual(['finance', 'operations'])
    expect(h.industries).toEqual(['financial services & banking'])
  })
  it('keeps the older flag: either one is a pivot', () => {
    expect(isPivotingNow(true, { functions: [], industries: [], places: [] })).toBe(true)
    expect(isPivotingNow(false, { functions: [], industries: ['Insurance'], places: [] })).toBe(true)
    expect(isPivotingNow(false, { functions: [], industries: [], places: [] })).toBe(false)
  })
})

describe('lower-fit note', () => {
  const outside = { functions: ['Marketing'], industries: ['Insurance'], places: ['AZ'] }
  it('says why, never hides', () => {
    expect(widenedFitNote({ functions: ['marketing'], industry: null, states: ['CA'] }, outside, home)).toMatch(/^Fits less today: this is Marketing work/)
    expect(widenedFitNote({ functions: ['finance'], industry: 'Insurance', states: ['CA'] }, outside, home)).toMatch(/new industry/)
    expect(widenedFitNote({ functions: ['finance'], industry: null, states: ['AZ'] }, outside, home)).toMatch(/in AZ/)
  })
  it('is null for a job inside home', () => {
    expect(widenedFitNote({ functions: ['finance'], industry: 'Financial Services & Banking', states: ['CA'] }, outside, home)).toBeNull()
  })
})

describe('the message is shown once', () => {
  const out = { functions: ['Marketing'], industries: [], places: [] }
  it('is due only with something outside home, and only until shown', () => {
    expect(pivotMessageDue(readPivotScopeState(null), out)).toBe(true)
    expect(pivotMessageDue(readPivotScopeState(null), { functions: [], industries: [], places: [] })).toBe(false)
    expect(pivotMessageDue(readPivotScopeState({ pivotScope: { messageShownAt: '2026-10-23T00:00:00Z' } }), out)).toBe(false)
  })
})

describe('behavior never writes silently', () => {
  const sig: BehaviorSignal[] = [
    { kind: 'industry', value: 'Healthcare & Hospital Systems', count: 4, source: 'saves' },
    { kind: 'industry', value: 'Insurance', count: 2, source: 'contacts' },
    { kind: 'industry', value: 'Financial Services & Banking', count: 9, source: 'saves' },
  ]
  const state = readPivotScopeState(null)
  it('asks one question for the strongest signal outside home', () => {
    expect(exploreQuestion(sig, home, [], state, noExp)?.text).toBe('Are you exploring a move into Healthcare & Hospital Systems?')
  })
  it('stays quiet once an option, an opt-in or an answer exists', () => {
    const opt = addExploredOption([], { kind: 'industry', value: 'Healthcare & Hospital Systems', source: 'question' })
    expect(exploreQuestion(sig, home, opt, state, noExp)).toBeNull()
    expect(exploreQuestion(sig, home, [], readPivotScopeState({ pivotScope: { answers: { 'industry:healthcare & hospital systems': 'no' } } }), noExp)).toBeNull()
  })
  it('only the coach offer sees the signal until a tap', () => {
    expect(behaviorPointsOutside(sig, home)).toBe(true)
    expect(behaviorPointsOutside(sig.slice(1, 2), home)).toBe(false)
  })
})

describe('the fit score reads the scope', () => {
  const base = { primaryFunction: 'Finance', secondaryFunction: null, highestLevelReached: 'Manager', levelRankScore: null, remotePreference: 'onsite', currentCity: 'Louisville', currentState: 'KY', openToRelocation: false, targetCompMin: null, compFlexible: false, targetRoleType: null, resumeKeywords: [], yearsExperience: 10, industryContext: null, secondaryIndustryContext: null, targetIndustries: [], hasJD: false, hasMD: false, hasDO: false, targetCompanySize: null, priorityMaxComp: null, priorityWorkLife: null, priorityBrandName: null, priorityMission: null, isPeopleManager: true }
  const job = { title: 'Marketing Manager', description: 'Lead campaigns.', location: 'Louisville, KY', salaryMin: null, salaryMax: null } as never
  it('an explored function changes nothing until it is on', () => {
    const off = resolveScope({ scope: 'broader', expansion: noExp, options: [{ kind: 'function', value: 'Marketing', on: false, source: 'exploration', at: '' }] })
    const on = resolveScope({ scope: 'broader', expansion: noExp, options: [{ kind: 'function', value: 'Marketing', on: true, source: 'exploration', at: '' }] })
    const narrow = resolveScope({ scope: 'narrow', expansion: noExp, options: [{ kind: 'function', value: 'Marketing', on: true, source: 'exploration', at: '' }] })
    const fit = (r: typeof off) => computeFitAssessment(applyScope(base, r) as never, job).functionFit
    expect(fit(off)).toBe('other')
    expect(fit(narrow)).toBe('other')
    expect(fit(on)).toBe('secondary')
  })
})

describe('the pivot message', () => {
  it('names what is outside, the gaps, a Learn link and the coach words from the coach offer', () => {
    const m = pivotMessage({ outside: { functions: ['Marketing'], industries: [], places: [] }, homeFunction: 'Finance', keywords: ['budgeting'] })
    expect(m.outside).toBe('Marketing work')
    expect(m.gaps.length).toBeGreaterThan(0)
    expect(m.gaps.length).toBeLessThanOrEqual(3)
    expect(m.learnHref).toBe('/dashboard/learning')
    expect(m.coach.title).toBe(COACH_OFFER_COPY.pivot.title)
    expect(m.coach.why).toBe(COACH_OFFER_COPY.pivot.why)
    expect(m.lowerFit).toMatch(/lower fit/)
  })
  it('has no skills gap for an industry or a place alone', () => {
    expect(pivotMessage({ outside: { functions: [], industries: ['Insurance'], places: [] }, homeFunction: 'Finance', keywords: [] }).gaps).toEqual([])
  })
})
