import { describe, expect, it } from 'vitest'
import { profileDrivenItems, type EngagementSignals } from '@/lib/journey/engagement'
import { buildTarget } from '@/lib/journey/pivot'
import { careerPlanItems, careerOf } from '@/lib/journey/career'
import { parseSituationValue, situationFieldsFor, situationPlanItems, SITUATION_FIELDS } from '@/lib/journey/situation'

const now = new Date('2026-10-16T12:00:00Z')
const base = { journey: 'LAID_OFF', stage: 'APPLYING', casual: false, weeksInStage: 7 } as unknown as EngagementSignals
const targets = { roleType: 'Controller', function: 'Finance', industries: ['Healthcare', 'SaaS'], compFloor: 180000, relocation: { scope: 'STATES' as const, states: ['CO', 'TX'] }, applicationGoal: 10, outreachGoal: 5, followUp: true }
const texts = (s: EngagementSignals) => profileDrivenItems(s, now).map((i) => i.text).join(' | ')

describe('two people on the same journey get different plans', () => {
  it('names their own industries, goals and places', () => {
    const t = texts({ ...base, targets })
    // The company list is a first-weeks step.
    expect(texts({ ...base, weeksInStage: 1, targets })).toMatch(/List 10 companies in Healthcare or SaaS that hire for Finance/)
    expect(t).toMatch(/Apply to 10 roles/)
    expect(t).toMatch(/Send 5 outreach messages/)
    expect(t).toMatch(/Follow up on applications/)
    expect(t).toMatch(/Search roles in CO, TX: you said you would move there/)
  })
  it('a search that stays local is not told to widen', () => {
    expect(texts({ ...base, targets: { ...targets, relocation: { scope: 'LOCAL' } } })).not.toMatch(/Search roles in|Widen|outside your area/)
  })
  it('widens only after six weeks', () => {
    expect(texts({ ...base, weeksInStage: 2, targets })).not.toMatch(/you said you would move there/)
  })
  it('casual searchers get none of the volume steps', () => {
    expect(texts({ ...base, casual: true, targets })).toBe('')
  })
  it('a committed change becomes a learning path whose next step is in the plan, for any searching journey', () => {
    const t = buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, now)
    const out = texts({ ...base, journey: 'LAID_OFF', from: 'Finance', pivot: { targets: [t], updatedAt: now.toISOString() } })
    expect(out).toMatch(/Your Design plan, next step: Compare two programs/)
  })
  it('the plan moves on to the next step once one is done', () => {
    const t = buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, now)
    const out = texts({ ...base, journey: 'LAID_OFF', from: 'Finance', pivot: { targets: [t], updatedAt: now.toISOString() }, rawDetails: { pathProgress: { 'pivot-design': ['pivot-design:1'] } } })
    expect(out).toMatch(/Your Design plan, next step: Apply and enroll/)
  })
  it('people not searching get no pivot or volume steps', () => {
    const t = buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, now)
    expect(texts({ ...base, journey: 'GROWING', stage: 'STAYING', targets, pivot: { targets: [t], updatedAt: '' } })).toBe('')
  })
})

describe('what people want from their career', () => {
  it('turns a review date, next level, pay focus and skills into steps', () => {
    const c = careerOf({ career: { reviewDate: '2026-11-20', nextLevel: 'Senior manager', focus: 'both', intent: 'maybe_leave' } })
    const t = careerPlanItems(c, ['data_storytelling'], now).map((i) => i.text).join(' | ')
    expect(t).toMatch(/Your review is in 5 weeks/)
    expect(t).toMatch(/gap between your role and Senior manager/)
    expect(t).toMatch(/Benchmark your pay/)
    expect(t).toMatch(/may leave within a year/)
    expect(t).toMatch(/data storytelling/)
  })
  it('says nothing when nothing was answered, and ignores bad dates', () => {
    expect(careerPlanItems(null, [], now)).toEqual([])
    expect(careerOf({ career: { reviewDate: 'soon', focus: 'x' } })).toBeNull()
  })
  it('the Managing my career plan reads it', () => {
    const t = texts({ journey: 'GROWING', stage: 'STAYING', casual: true, weeksInStage: 0, career: careerOf({ career: { nextLevel: 'Director', focus: 'level', intent: 'stay' } }), skillsToBuild: [] } as unknown as EngagementSignals)
    expect(t).toMatch(/Director/)
  })
})

describe('situation facts', () => {
  it('every fact belongs to a journey and is read by a plan step', () => {
    const sample: Record<string, string | number> = {
      hoursAvailable: 2, boardExperience: 'NONE', boardSectors: 'health', clientCount: 0, returnHours: 'PART', monthlyNeed: 6000,
      runwayMonths: 3, retirementPath: 'PHASED', retirementIncome: 'SOME', noticeWeeks: 6, breakMonths: 18, dayRate: 1500, hoursPerWeek: 20,
    }
    const detailsFor = (k: string) => {
      const f = SITUATION_FIELDS.find((x) => x.key === k)!
      return { journey: f.journeys[0], details: { [k]: f.kind === 'date' ? '2026-11-20' : sample[k] } }
    }
    for (const f of SITUATION_FIELDS) {
      const { journey, details } = detailsFor(f.key)
      expect(situationPlanItems(journey, details, { now }).length, f.key).toBeGreaterThan(0)
    }
  })
  it('accepts only sensible values', () => {
    const rate = SITUATION_FIELDS.find((f) => f.key === 'dayRate')!
    expect(parseSituationValue(rate, '1500')).toBe(1500)
    expect(parseSituationValue(rate, '5')).toBeNull()
    expect(parseSituationValue(rate, 'abc')).toBeNull()
    expect(parseSituationValue(rate, '')).toBeNull()
    const when = SITUATION_FIELDS.find((f) => f.key === 'severanceEnds')!
    expect(parseSituationValue(when, '2026-13-45')).toBeNull()
    expect(parseSituationValue(when, '2026-12-01')).toBe('2026-12-01')
    const hours = SITUATION_FIELDS.find((f) => f.key === 'returnHours')!
    expect(parseSituationValue(hours, 'WEIRD')).toBeNull()
  })
  it('asks laid-off people about severance and coverage, not fractional people', () => {
    expect(situationFieldsFor('LAID_OFF').map((f) => f.key)).toEqual(expect.arrayContaining(['severanceEnds', 'benefitsEnd', 'monthlyNeed']))
    expect(situationFieldsFor('FRACTIONAL').map((f) => f.key).sort()).toEqual(['clientCount', 'dayRate', 'hoursAvailable'])
    expect(situationFieldsFor(null)).toEqual([])
  })
  it('a deadline that has passed or is far away is not a step', () => {
    expect(situationPlanItems('LAID_OFF', { severanceEnds: '2025-01-01' }, { now })).toEqual([])
    expect(situationPlanItems('LAID_OFF', { severanceEnds: '2027-06-01' }, { now })).toEqual([])
  })
})
