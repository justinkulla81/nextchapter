import { describe, expect, it } from 'vitest'
import { CHECK_IN_ANSWERS, JOURNEYS, LAID_OFF_TIMING, changeForAnswer, checkInDue, getJourney, returnDateOf, stageForLaidOffTiming } from '@/lib/journey/journey'
import { journeyPlanItems, shapePlan } from '@/lib/journey/plan'
import { MENU_RULES, itemVisibility, menuMode, statusUnlock, type MenuItemKey } from '@/lib/journey/menu'
import { journeyDetailItems, unlockSteps, type EngagementSignals } from '@/lib/journey/engagement'
import { SITUATION_TO_JOURNEY, JOURNEY_TO_SITUATION } from '@/lib/constants/onboarding'

const keys = Object.keys(MENU_RULES) as MenuItemKey[]

describe('three more journeys', () => {
  it('none of them is a job search', () => {
    for (const k of ['TIME_OFF', 'FRACTIONAL', 'ENTREPRENEUR'] as const) {
      expect(getJourney(k)).toMatchObject({ searching: false, defaultStage: 'STAYING' })
    }
  })
  it('each is reachable from an onboarding card', () => {
    for (const j of JOURNEYS) expect(SITUATION_TO_JOURNEY[JOURNEY_TO_SITUATION[j.key]]).toBe(j.key)
    expect(SITUATION_TO_JOURNEY.taking_a_break).toBe('TIME_OFF')
    expect(SITUATION_TO_JOURNEY.happy_fractional).toBe('FRACTIONAL')
    expect(SITUATION_TO_JOURNEY.building_something).toBe('ENTREPRENEUR')
  })
  it('being on leave is not being laid off: no confidentiality needed, and it is not employed-and-quiet', () => {
    expect(getJourney('TIME_OFF')).toMatchObject({ confidentialByDefault: false, employed: false })
    expect(getJourney('ENTREPRENEUR').confidentialByDefault).toBe(true)
  })
})

describe('plans for the three', () => {
  it('each has its own plan in Managing your career, not the generic career plan', () => {
    expect(journeyPlanItems('FRACTIONAL', 'STAYING', 1).map((p) => p.text)).toContain('List your current engagements and when each one ends')
    expect(journeyPlanItems('TIME_OFF', 'STAYING', 1).map((p) => p.text)).toContain('Set your expected return date')
    expect(journeyPlanItems('ENTREPRENEUR', 'STAYING', 1).map((p) => p.text)).toContain('Add what you are building and where it stands to your situation (Privacy)')
  })
  it('keeps the entrepreneur plan to tracking and checking in', () => {
    const t = journeyPlanItems('ENTREPRENEUR', 'STAYING', 3).map((p) => p.text).join(' ')
    expect(t).toMatch(/Check in/)
    expect(t).not.toMatch(/apply|résumé|interview/i)
  })
  it('never asks for applications', () => {
    const general = [{ text: 'Apply to Full-Time Jobs', actionType: 'JOB_APPLICATION_SUBMITTED' }]
    for (const j of ['TIME_OFF', 'FRACTIONAL', 'ENTREPRENEUR'] as const) {
      expect(shapePlan(j, 'STAYING', 3, general).map((p) => p.actionType)).not.toContain('JOB_APPLICATION_SUBMITTED')
    }
  })
})

describe('menus for the three', () => {
  it('fractional members see the work first and full-time job tools locked', () => {
    expect(menuMode('STAYING', 'FRACTIONAL')).toBe('PORTFOLIO')
    expect(itemVisibility('interim', 'PORTFOLIO')).toBe('show')
    expect(itemVisibility('jobs', 'PORTFOLIO')).toBe('locked')
    expect(itemVisibility('worth', 'PORTFOLIO')).toBe('show') // the rate
    expect(itemVisibility('growCase', 'PORTFOLIO')).toBe('hide')
  })
  it('someone on a break sees a gentle menu: no job tools, no interim work', () => {
    expect(menuMode('STAYING', 'TIME_OFF')).toBe('LEAVE')
    expect(itemVisibility('jobs', 'LEAVE')).toBe('locked')
    expect(itemVisibility('interim', 'LEAVE')).toBe('hide')
    expect(itemVisibility('benefits', 'LEAVE')).toBe('show')
    expect(itemVisibility('coach', 'LEAVE')).toBe('show')
  })
  it('an entrepreneur gets the managing-your-career menu', () => {
    expect(menuMode('STAYING', 'ENTREPRENEUR')).toBe('STAYING')
  })
  it('every locked tool says how to turn it on, for these two modes too', () => {
    for (const m of ['PORTFOLIO', 'LEAVE'] as const) {
      expect(keys.some((k) => itemVisibility(k, m) === 'locked')).toBe(true)
      expect(statusUnlock(m)).not.toBeNull()
    }
  })
})

describe('coming back, and settling into fractional work', () => {
  it('"I\'m back at work" returns to managing a career; "doing fractional work" moves to that journey', () => {
    expect(changeForAnswer('back', { journey: 'TIME_OFF', stage: 'STAYING' })).toEqual({ journey: 'GROWING', stage: 'STAYING' })
    expect(changeForAnswer('fractional', { journey: 'LAID_OFF', stage: 'APPLYING' })).toEqual({ journey: 'FRACTIONAL', stage: 'STAYING' })
    expect(CHECK_IN_ANSWERS.map((a) => a.key)).toEqual(expect.arrayContaining(['back', 'fractional']))
  })
  it('on a break, the check-in comes as the return nears, not on a calendar', () => {
    const base = { journey: 'TIME_OFF' as const, journeyStage: 'STAYING' as const, journeyDetails: { returnDate: '2026-12-01' }, journeyCheckedAt: new Date('2026-10-01T00:00:00Z') }
    expect(checkInDue(base, new Date('2026-11-10T00:00:00Z'))).toBe(false) // a month on a calendar would say due
    expect(checkInDue(base, new Date('2026-11-26T00:00:00Z'))).toBe(true) // within a week of returning
    expect(checkInDue({ ...base, journeyCheckedAt: new Date('2026-11-25T00:00:00Z') }, new Date('2026-11-26T00:00:00Z'))).toBe(false) // already asked
  })
  it('reads the return date', () => {
    expect(returnDateOf({ returnDate: '2026-12-01' })?.toISOString().slice(0, 10)).toBe('2026-12-01')
    expect(returnDateOf({ returnDate: 'soon' })).toBeNull()
    expect(returnDateOf(null)).toBeNull()
  })
})

describe('laid off but taking some time first', () => {
  it('is a modified Laid off: when they want to start sets the stage', () => {
    expect(LAID_OFF_TIMING.map((t) => t.key)).toEqual(['now', 'few_weeks', 'after_time_off'])
    expect(stageForLaidOffTiming('now')).toBe('APPLYING')
    expect(stageForLaidOffTiming('few_weeks')).toBe('PREPARING')
    expect(stageForLaidOffTiming('after_time_off')).toBe('EXPLORING')
  })
  it('keeps the laid-off first week, with benefits and severance, even when starting later', () => {
    expect(journeyPlanItems('LAID_OFF', 'EXPLORING', 1).map((p) => p.text)).toContain('File for unemployment benefits')
    const general = [{ text: 'Apply to Full-Time Jobs', actionType: 'JOB_APPLICATION_SUBMITTED' }]
    expect(shapePlan('LAID_OFF', 'EXPLORING', 1, general).map((p) => p.actionType)).not.toContain('JOB_APPLICATION_SUBMITTED')
  })
})

const base: EngagementSignals = {
  journey: 'TIME_OFF', stage: 'STAYING', tone: null, casual: false, workingNow: false, culture: null,
  details: { returnDate: null, offering: null, openDays: null, engagementEnds: null }, spineGaps: [],
  redFlags: { restrictiveCovenant: false, firedForCause: false, noDrugTest: false, noBackgroundCheck: false }, conversations: [],
  weeksInStage: 2, gmail: false, calendar: false, linkedin: false, completedReferences: 0, requestedReferences: 0, referencesTarget: 3,
  openResumeIssues: 3, hasPersonalityProfile: false, skillsAssessmentDone: false, dossierUnlocked: false, outreach: 0, applications: 0, interviews: 0, offers: 0,
}

describe('engagement for the three', () => {
  it('does not push accounts or references on someone on a break or building something', () => {
    expect(unlockSteps(base)).toEqual([])
    expect(unlockSteps({ ...base, journey: 'ENTREPRENEUR' })).toEqual([])
    expect(unlockSteps({ ...base, journey: 'FRACTIONAL' }).length).toBeGreaterThan(0)
  })
  it('counts down to the return, but only when it is near', () => {
    const now = new Date('2026-11-01T00:00:00Z')
    const items = (d: string) => journeyDetailItems({ ...base, details: { ...base.details, returnDate: new Date(`${d}T12:00:00Z`) } }, now).map((i) => i.text)
    expect(items('2026-11-20')[0]).toMatch(/Your return is in 3 weeks/)
    expect(items('2027-03-01')).toEqual([])
  })
  it('starts the renewal conversation 45 days before an engagement ends, and uses open days and the offer', () => {
    const now = new Date('2026-11-01T00:00:00Z')
    const f = { ...base, journey: 'FRACTIONAL' as const, details: { returnDate: null, offering: 'I help SaaS teams cut churn', openDays: 2, engagementEnds: new Date('2026-11-20T12:00:00Z') } }
    const texts = journeyDetailItems(f, now).map((i) => i.text).join(' | ')
    expect(texts).toMatch(/engagement ends in 20 days/)
    expect(texts).toMatch(/2 open days a week/)
    expect(texts).toMatch(/I help SaaS teams cut churn/)
    expect(journeyDetailItems({ ...f, details: { ...f.details, engagementEnds: new Date('2027-02-01T12:00:00Z') } }, now).map((i) => i.text).join(' ')).not.toMatch(/engagement ends/)
  })
})

describe('people who are not searching are not held to a search', () => {
  it('knows who is not searching', async () => {
    const { isNotSearching } = await import('@/lib/journey/intensity')
    for (const j of ['GROWING', 'ENTREPRENEUR', 'FRACTIONAL', 'TIME_OFF'] as const) expect(isNotSearching(j, 'STAYING'), j).toBe(true)
    expect(isNotSearching('EXPLORING_MOVE', 'STAYING')).toBe(true) // said they are not looking
    expect(isNotSearching('EXPLORING_MOVE', 'APPLYING')).toBe(false)
    expect(isNotSearching('LAID_OFF', 'APPLYING')).toBe(false)
    expect(isNotSearching(null, null)).toBe(false)
  })
  it('the dashboard hard gate does not ask them for job-search targets', async () => {
    const { getHardGateStatus } = await import('@/lib/dashboard/access-gate')
    const empty = { subjectToHardGate: true, targetRoleType: null, primaryFunction: null, targetIndustries: [], targetCompanySize: null, targetCompanyStage: null, remotePreference: null, highestLevelReached: null, blockers: [], motivations: [], coachingStylePreference: null, changePacePreference: null, changeReadiness: null }
    expect(getHardGateStatus({ ...empty, journey: 'GROWING' })).toBe('exempt')
    expect(getHardGateStatus({ ...empty, journey: 'TIME_OFF' })).toBe('exempt')
    expect(getHardGateStatus({ ...empty, journey: 'LAID_OFF' })).toBe('search_strategy_required')
  })
  it('changing careers sets the pivot flag', async () => {
    const src = (await import('node:fs')).readFileSync('src/lib/journey/apply.ts', 'utf8')
    expect(src).toMatch(/toJourney === 'CAREER_CHANGE'\) data\.isPivoting = true/)
  })
})
