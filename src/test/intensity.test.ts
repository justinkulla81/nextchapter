import { describe, expect, it } from 'vitest'
import { INTENSITY_OPTIONS, NOT_CASUAL_WHERE, intensityFromTiming, isCasualIntensity, workingNowOf } from '@/lib/journey/intensity'
import { gateMove, engagementLead, stallsOnApplications, type EngagementSignals } from '@/lib/journey/engagement'
import { journeyPlanItems, shapePlan } from '@/lib/journey/plan'
import { CASUAL_PACE, paceFor, pointsNeededForA } from '@/lib/weekly/action-effort'

const base: EngagementSignals = {
  journey: 'LAID_OFF', stage: 'APPLYING', tone: null, casual: false, workingNow: false, culture: null, details: { returnDate: null, offering: null, openDays: null, engagementEnds: null }, spineGaps: [],
  redFlags: { restrictiveCovenant: false, firedForCause: false, noDrugTest: false, noBackgroundCheck: false }, conversations: [], weeksInStage: 6,
  gmail: true, calendar: true, linkedin: true, completedReferences: 3, requestedReferences: 3, referencesTarget: 3,
  openResumeIssues: 0, hasPersonalityProfile: true, skillsAssessmentDone: true, dossierUnlocked: true,
  outreach: 5, applications: 5, interviews: 0, offers: 0,
}

describe('active versus casual', () => {
  it('offers two ways to look, and casual is the one that is open to the right thing', () => {
    expect(INTENSITY_OPTIONS.map((o) => o.key)).toEqual(['ACTIVELY_SEARCHING', 'CASUALLY_LOOKING'])
    expect(isCasualIntensity('CASUALLY_LOOKING')).toBe(true)
    expect(isCasualIntensity('ACTIVELY_SEARCHING')).toBe(false)
    expect(isCasualIntensity(null)).toBe(false)
  })
  it('employed members: when they want to apply is how hard they are looking', () => {
    expect(intensityFromTiming('now')).toBe('ACTIVELY_SEARCHING')
    expect(intensityFromTiming('1_3_months')).toBe('CASUALLY_LOOKING')
    expect(intensityFromTiming('curious')).toBe('EXPLORING')
  })
  it('remembers fractional or interim work happening now', () => {
    expect(workingNowOf({ workingNow: true })).toBe(true)
    expect(workingNowOf({})).toBe(false)
  })
  it('casual searchers skip the progress-pushing emails; unset and active members still get them', () => {
    expect(NOT_CASUAL_WHERE.AND[0]).toEqual({ OR: [{ searchIntensity: null }, { searchIntensity: 'ACTIVELY_SEARCHING' }] })
    // Not-searching journeys and people managing their career are left out too.
    expect(JSON.stringify(NOT_CASUAL_WHERE.AND[1])).toContain('GROWING')
    expect(JSON.stringify(NOT_CASUAL_WHERE.AND[2])).toContain('STAYING')
  })
})

describe('a casual search runs at half the pace', () => {
  it('the same weeks open a gate later', () => {
    expect(gateMove({ ...base, weeksInStage: 3 })).not.toBeNull()
    expect(gateMove({ ...base, weeksInStage: 3, casual: true })).toBeNull()
    expect(gateMove({ ...base, weeksInStage: 6, casual: true })!.cta).toMatch(/Résumé Fixer/)
  })
  it('keeps the real weeks in the headline and asks for one change, not a push', () => {
    const m = gateMove({ ...base, weeksInStage: 6, casual: true })!
    expect(m.headline).toMatch(/^6 weeks/)
    expect(m.body).toMatch(/one change, not a full push/)
  })
  it('a casual search that has not "started" is not a problem', () => {
    expect(gateMove({ ...base, weeksInStage: 4, applications: 0, outreach: 0, casual: true })).toBeNull()
    expect(engagementLead({ ...base, weeksInStage: 4, applications: 0, outreach: 0, casual: true })).toBeNull()
    expect(gateMove({ ...base, weeksInStage: 4, applications: 0, outreach: 0 })).not.toBeNull()
  })
})

describe('the pop-up stops asking for more of what is not working', () => {
  it('stalls on applications only once the gate is open and there are no interviews', () => {
    expect(stallsOnApplications({ ...base, weeksInStage: 2 })).toBe(false)
    expect(stallsOnApplications({ ...base, weeksInStage: 4 })).toBe(true)
    expect(stallsOnApplications({ ...base, weeksInStage: 4, interviews: 2 })).toBe(true) // interviews but no offers
    expect(stallsOnApplications({ ...base, weeksInStage: 4, interviews: 2, offers: 1 })).toBe(false)
    expect(stallsOnApplications({ ...base, weeksInStage: 4, applications: 0, outreach: 0 })).toBe(false)
  })
})

describe('a casual plan is light', () => {
  const general = [{ text: 'Apply to Full-Time Jobs', actionType: 'JOB_APPLICATION_SUBMITTED' }]
  it('has no application volume while applying, and keeps the right thing able to find them', () => {
    const plan = shapePlan('LAID_OFF', 'APPLYING', 3, general, null, null, 0, [], true)
    expect(plan.map((p) => p.actionType)).not.toContain('JOB_APPLICATION_SUBMITTED')
    expect(plan.map((p) => p.text).join(' ')).toMatch(/strongest-fit roles/)
    expect(plan.map((p) => p.text).join(' ')).toMatch(/references and Executive Dossier current/)
  })
  it('an active search keeps its applications', () => {
    expect(shapePlan('LAID_OFF', 'APPLYING', 3, general).map((p) => p.actionType)).toContain('JOB_APPLICATION_SUBMITTED')
  })
  it('once casual searchers are interviewing, applications are back', () => {
    expect(shapePlan('LAID_OFF', 'INTERVIEWING', 3, general, null, null, 0, [], true).map((p) => p.actionType)).toContain('JOB_APPLICATION_SUBMITTED')
  })
  it('does not change other journeys steps', () => {
    expect(journeyPlanItems('LAID_OFF', 'APPLYING', 1).length).toBeGreaterThan(0)
  })
})

describe('the weekly point target follows the pace', () => {
  it('is the same for active searchers as before', () => {
    expect([1, 2, 3, 4, 5, 9].map((w) => pointsNeededForA(w))).toEqual([60, 75, 90, 105, 120, 120])
    expect(pointsNeededForA(3, paceFor(false))).toBe(90)
  })
  it('is half for casual searchers, in steps of 5, and never zero', () => {
    expect(CASUAL_PACE).toBe(0.5)
    expect([1, 2, 3, 4, 5, 9].map((w) => pointsNeededForA(w, paceFor(true)))).toEqual([30, 40, 45, 55, 60, 60])
    expect(pointsNeededForA(1, 0.01)).toBe(5)
  })
})
