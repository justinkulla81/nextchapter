import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CRITERIA,
  FAIL,
  STRONG,
  countVerdicts,
  diffVerdicts,
  isMatch,
  isStrong,
  reasonLine,
  singleExclusions,
  topReasons,
  verdictOf,
  type ReasonContext,
  type RetuneResult,
} from '@/lib/personalization/match-verdict'
import { changedFields, matchInputsOf, parseMatchInputs, profileFromInputs, sameMatchInputs } from '@/lib/personalization/match-inputs'
import { buildSignals, precisionOf, SIGNAL_WEIGHT, type SignalInputs } from '@/lib/personalization/signals'
import { readbackFacts } from '@/lib/personalization/resume-readback'
import { RetuneView, RETUNE_STEPS } from '@/components/dashboard/RetuneMoment'

const ctx: ReasonContext = { city: 'Sunnyvale', commuteMiles: 40, fieldLabel: 'Recruiting', industries: ['Technology & Software'], newTools: ['Workday'] }
const m = (entries: [string, number][]) => new Map(entries)

describe('match verdicts', () => {
  it('a match fails nothing; strong only on a match', () => {
    expect(isMatch(verdictOf({}))).toBe(true)
    expect(isStrong(verdictOf({}, true))).toBe(true)
    expect(verdictOf({ location: true }, true)).toBe(FAIL.location) // strong is dropped on a non-match
    expect(isMatch(verdictOf({ skills: true }))).toBe(false)
  })

  it('counts checked, matches and strong fits', () => {
    const v = m([['a', 0], ['b', STRONG], ['c', FAIL.field], ['d', FAIL.dismissed]])
    expect(countVerdicts(v)).toEqual({ checked: 4, matches: 2, strong: 1 })
  })
})

describe('before → after (retune)', () => {
  it('tells each changed job by the criterion that flipped', () => {
    const before = m([
      ['near', 0], // stays
      ['far1', 0], // city added: now too far
      ['far2', STRONG],
      ['tool', FAIL.skills], // tools confirmed: now matches
      ['both', FAIL.skills | FAIL.location], // still fails location: no change
      ['gone', 0], // left the level window
    ])
    const after = m([
      ['near', 0],
      ['far1', FAIL.location],
      ['far2', FAIL.location | FAIL.industry],
      ['tool', STRONG],
      ['both', FAIL.location],
      ['new', 0], // entered the level window
    ])
    const reasons = diffVerdicts(before, after)
    expect(reasons).toEqual([
      { direction: 'removed', criterion: 'location', count: 2 },
      { direction: 'added', criterion: 'skills', count: 1 },
      { direction: 'removed', criterion: 'level', count: 1 },
      { direction: 'added', criterion: 'level', count: 1 },
    ])
    // The counts the card shows are the two runs' own counts, and the reasons add up to the change.
    const b = countVerdicts(before)
    const a = countVerdicts(after)
    expect([b.matches, a.matches]).toEqual([4, 3])
    const net = reasons.reduce((n, r) => n + (r.direction === 'added' ? r.count : -r.count), 0)
    expect(net).toBe(a.matches - b.matches)
  })

  it('nothing changed: no reasons', () => {
    const v = m([['a', 0], ['b', FAIL.location]])
    expect(diffVerdicts(v, new Map(v))).toEqual([])
  })

  it('the first run tells only single-criterion exclusions', () => {
    const v = m([['a', FAIL.location], ['b', FAIL.location], ['c', FAIL.location | FAIL.skills], ['d', FAIL.field], ['e', 0]])
    expect(singleExclusions(v)).toEqual([
      { direction: 'removed', criterion: 'location', count: 2 },
      { direction: 'removed', criterion: 'field', count: 1 },
    ])
  })

  it('words reasons plainly, with the real counts', () => {
    expect(reasonLine({ direction: 'removed', criterion: 'location', count: 312 }, ctx)).toBe('312 removed — too far from Sunnyvale')
    expect(reasonLine({ direction: 'added', criterion: 'skills', count: 22 }, ctx)).toBe('22 new — match your Workday experience')
    expect(reasonLine({ direction: 'removed', criterion: 'dismissed', count: 1214 }, ctx)).toBe('1,214 hidden — like jobs you passed on')
    expect(topReasons([1, 2, 3, 4].map((count) => ({ direction: 'removed' as const, criterion: 'field' as const, count })), ctx)).toHaveLength(3)
    expect(CRITERIA).toHaveLength(Object.keys(FAIL).length)
  })
})

describe('match inputs', () => {
  const profile = { id: 'x', currentCity: 'Sunnyvale', currentState: 'CA', confirmedSkillsHave: ['SQL', 'Workday'], toolsConfirmedAt: new Date('2026-10-01T00:00:00Z'), firstName: 'Linda', subFunction: 'hr_recruiting' }

  it('keeps only what matching reads, JSON-safe', () => {
    const inputs = matchInputsOf(profile)
    expect(inputs.fields).not.toHaveProperty('firstName')
    expect(inputs.fields.toolsConfirmedAt).toBe('2026-10-01T00:00:00.000Z')
    expect(parseMatchInputs(JSON.parse(JSON.stringify(inputs)))).toEqual(inputs)
  })

  it('compares lists without order; spots what changed', () => {
    const a = matchInputsOf(profile)
    const b = matchInputsOf({ ...profile, confirmedSkillsHave: ['Workday', 'SQL'] })
    expect(sameMatchInputs(a, b)).toBe(true)
    const c = matchInputsOf({ ...profile, currentCity: 'San Jose' })
    expect(sameMatchInputs(a, c)).toBe(false)
    expect(changedFields(a, c)).toEqual(['currentCity'])
  })

  it('rebuilds the past profile over today’s, never carrying the saved sub-function', () => {
    const past = profileFromInputs({ ...profile, currentCity: 'San Jose' }, matchInputsOf(profile))
    expect(past.currentCity).toBe('Sunnyvale')
    expect(past.toolsConfirmedAt).toEqual(new Date('2026-10-01T00:00:00Z'))
    expect(past.subFunction).toBeUndefined()
  })
})

const base: SignalInputs = {
  city: 'Sunnyvale', state: 'CA', cityPlaced: true, commuteMiles: 40, acceptsRemote: true, remotePreference: 'remote', relocationStates: [],
  title: 'Talent Partner', fieldLabel: 'Recruiting', primaryFunction: 'Human Resources', toolsConfirmed: false, toolCount: 0,
  industries: ['Technology & Software'], clearanceLevel: null, clearanceLabel: null, matches: 33, geoUnchecked: 0, skillsUnchecked: 26,
  industryKnown: 31, clearanceAsked: 0, clearanceMet: 0,
}

describe('precision meter', () => {
  it('weights sum to 100 and only matching signals weigh', () => {
    expect(Object.values(SIGNAL_WEIGHT).reduce((a, b) => a + b, 0)).toBe(100)
    expect(SIGNAL_WEIGHT.clearance).toBe(0)
  })

  it('is the weight of the known signals; the next step is the heaviest missing one, with its counted payoff', () => {
    const p = precisionOf(buildSignals(base))
    expect(p.pct).toBe(80)
    expect(p.next).toMatchObject({ key: 'tools', gain: 20 })
    expect(p.next!.effect).toContain('26 matches')
  })

  it('a bare profile', () => {
    const p = precisionOf(buildSignals({ ...base, city: null, state: null, cityPlaced: false, title: null, primaryFunction: null, industries: [], remotePreference: null, geoUnchecked: 120 }))
    expect(p.pct).toBe(0)
    expect(p.next).toMatchObject({ key: 'city', gain: 25 })
    expect(p.next!.effect).toContain('120 matches')
  })

  it('fully tuned has no next step; clearance shows only when it matters and never moves the meter', () => {
    const full = { ...base, toolsConfirmed: true, toolCount: 9 }
    expect(precisionOf(buildSignals(full))).toEqual({ pct: 100, next: null })
    expect(buildSignals(full).some((s) => s.key === 'clearance')).toBe(false)
    const asked = buildSignals({ ...full, clearanceAsked: 14 })
    expect(asked.find((s) => s.key === 'clearance')).toMatchObject({ known: false, effect: expect.stringContaining('14 cleared jobs') })
    expect(precisionOf(asked).pct).toBe(100)
  })
})

describe('résumé read-back', () => {
  it('lists the facts matching uses, marking the résumé’s unconfirmed ones', () => {
    const facts = readbackFacts({
      currentCity: 'Sunnyvale', currentState: 'CA', yearsExperience: 29, resumeLatestJobTitle: 'Talent Partner', industries: ['Technology & Software'],
      resumeKeywords: ['Workday', 'Greenhouse', 'SQL', 'Excel', 'Lever', 'Tableau'], licensesHeld: ['pmp'], clearanceLevel: 'none',
      resumePrefilledFields: ['currentCity', 'resumeLatestJobTitle'],
    })
    expect(facts.map((f) => f.key)).toEqual(['city', 'years', 'title', 'industries', 'tools', 'licenses'])
    expect(facts.find((f) => f.key === 'tools')!.value).toBe('Workday, Greenhouse, SQL, Excel, Lever +1 more')
    expect(facts.filter((f) => f.fromResume).map((f) => f.key)).toEqual(['city', 'title'])
  })
})

describe('honesty rule: the "thinking" steps are bound to the server action', () => {
  const result: RetuneResult = { trigger: 'city', before: { matches: 1240, strong: 210 }, after: { matches: 410, strong: 64 }, checked: 68036, reasons: ['312 removed — too far from Sunnyvale'], signals: 5, ms: 1234, notes: [] }

  it('shows the steps only while pending, and only real numbers after', () => {
    const pending = renderToStaticMarkup(createElement(RetuneView, { pending: true, result: undefined, error: null }))
    for (const step of RETUNE_STEPS) expect(pending).toContain(step)
    const done = renderToStaticMarkup(createElement(RetuneView, { pending: false, result, error: null }))
    for (const step of RETUNE_STEPS) expect(done).not.toContain(step)
    expect(done).toContain('1,240')
    expect(done).toContain('410')
    expect(done).toContain('Checked 68,036 jobs')
    expect(done).toContain('in 1.2 s')
    expect(done).toContain('312 removed — too far from Sunnyvale')
    // Nothing pending and no result: nothing at all (no idle animation).
    expect(renderToStaticMarkup(createElement(RetuneView, { pending: false, result: undefined, error: null }))).toBe('')
  })

  it('uses no timers or added delay', () => {
    const files = ['src/components/dashboard/RetuneMoment.tsx', 'src/lib/personalization/retune.ts', 'src/app/dashboard/retune-actions.ts']
    for (const f of files) {
      const src = readFileSync(path.resolve(__dirname, '../..', f), 'utf8')
      expect(src, f).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|\bsleep\(|\bdelay\(/)
    }
  })
})

import { whyThisJob } from '@/lib/personalization/why-this-job'

describe('why this job', () => {
  const crit = { fn: 'own', geo: 0, geoNote: null, skills: 'strong', industry: 'own', industryName: 'Technology & Software' } as const
  it('up to three fits, then one honest gap', () => {
    const w = whyThisJob({ reason: { kind: 'field', label: 'Your field' }, crit, jobRemote: false, city: 'Sunnyvale', hasIndustries: true, have: ['Workday', 'SQL', 'Excel'], missing: ['Tableau'] })
    expect(w).toEqual({ fits: ['Your field', 'Uses Workday, SQL', 'Near Sunnyvale'], gap: 'asks for Tableau' })
  })
  it('keeps ring notes, prefers a blocker as the gap, never repeats a skills label', () => {
    const w = whyThisJob({
      reason: { kind: 'skills', label: 'Skills match: scheduling · 45 mi away', sharedSkills: ['scheduling'] },
      crit: { ...crit, geo: 1, geoNote: '45 mi away' },
      jobRemote: false,
      city: 'Sunnyvale',
      hasIndustries: false,
      have: ['scheduling'],
      missing: ['Tableau'],
      blocker: 'Requires active TS/SCI',
    })
    expect(w).toEqual({ fits: ['Skills match: scheduling', '45 mi away'], gap: 'Requires active TS/SCI' })
  })
})

import { smarterLines } from '@/lib/personalization/smarter'

describe('your board got smarter', () => {
  const now = new Date('2026-10-16T15:00:00Z')
  it('only real changes, at most two', () => {
    expect(smarterLines({ passedOn: 0, hiddenLikeThem: 0, hasHides: false, toolsConfirmed: false, newThisWeekSkills: 5, lastRetune: null, now })).toEqual([])
    const lines = smarterLines({
      passedOn: 3,
      hiddenLikeThem: 214,
      hasHides: true,
      toolsConfirmed: true,
      newThisWeekSkills: 18,
      lastRetune: { trigger: 'city', at: new Date('2026-10-14T15:00:00Z'), before: 1240, after: 410 },
      now,
    })
    expect(lines).toEqual(['Since you added your city on Oct 14: 1,240 → 410 matches.', 'Because you passed on 3 jobs, we hid 214 like them.'])
  })
  it('no line for a retune that changed nothing, or one over a week old', () => {
    const base = { passedOn: 0, hiddenLikeThem: 0, hasHides: false, toolsConfirmed: true, newThisWeekSkills: 0, now }
    expect(smarterLines({ ...base, lastRetune: { trigger: 'tools', at: now, before: 40, after: 40 } })).toEqual([])
    expect(smarterLines({ ...base, lastRetune: { trigger: 'tools', at: new Date('2026-10-01T00:00:00Z'), before: 40, after: 60 } })).toEqual([])
  })
})
