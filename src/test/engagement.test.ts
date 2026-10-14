import { describe, expect, it } from 'vitest'
import { connectReason, engagementLead, engagementLevel, engagementPlanItems, gateMove, searchPattern, toneLine, unlockSteps, type EngagementSignals } from '@/lib/journey/engagement'
import { shapePlan } from '@/lib/journey/plan'

const base: EngagementSignals = {
  journey: 'LAID_OFF',
  stage: 'APPLYING',
  tone: null,
  casual: false,
  workingNow: false,
  culture: null, details: { returnDate: null, offering: null, openDays: null, engagementEnds: null }, spineGaps: [],
  redFlags: { restrictiveCovenant: false, firedForCause: false, noDrugTest: false, noBackgroundCheck: false }, conversations: [],
  weeksInStage: 1,
  gmail: true,
  calendar: true,
  linkedin: true,
  completedReferences: 3,
  requestedReferences: 3,
  referencesTarget: 3,
  openResumeIssues: 0,
  hasPersonalityProfile: true,
  skillsAssessmentDone: true,
  dossierUnlocked: true,
  outreach: 5,
  applications: 5,
  interviews: 0,
  offers: 0,
}
const s = (over: Partial<EngagementSignals>): EngagementSignals => ({ ...base, ...over })

describe('unlock steps', () => {
  it('says nothing to someone who is connected and has done the work', () => {
    expect(unlockSteps(base)).toEqual([])
    expect(engagementLead(base)).toBeNull()
  })
  it('puts connecting first, then proof', () => {
    const steps = unlockSteps(s({ gmail: false, linkedin: false, requestedReferences: 0, completedReferences: 0, hasPersonalityProfile: false }))
    expect(steps.map((x) => x.key)).toEqual(['gmail', 'linkedin', 'references', 'personality'])
  })
  it('asks for the references still missing, then for the open ones to be completed', () => {
    expect(unlockSteps(s({ requestedReferences: 1, completedReferences: 0 }))[0].label).toMatch(/Ask 2 more people/)
    expect(unlockSteps(s({ requestedReferences: 3, completedReferences: 1 }))[0].key).toBe('references-follow-up')
  })
  it('every step names what it unlocks and where to do it', () => {
    for (const step of unlockSteps(s({ gmail: false, linkedin: false, requestedReferences: 0, openResumeIssues: 3, hasPersonalityProfile: false, skillsAssessmentDone: false }))) {
      expect(step.unlocks.length).toBeGreaterThan(5)
      expect(step.href.startsWith('/dashboard')).toBe(true)
    }
  })
})

describe('connect prompts follow what the person is doing', () => {
  it('differs by journey', () => {
    expect(connectReason('LAID_OFF', 'gmail')).toMatch(/outreach and applications/)
    expect(connectReason('GROWING', 'gmail')).toMatch(/managers, sponsors and mentors/)
    expect(connectReason('EXPLORING_MOVE', 'gmail')).toMatch(/never contact anyone/)
    expect(connectReason('CAREER_CHANGE', 'linkedin')).toMatch(/field you want/)
    expect(connectReason('READY_TO_MOVE', 'gmail')).toBe(connectReason('EXPLORING_MOVE', 'gmail'))
  })
})

describe('how much of the platform someone uses', () => {
  it('is not connected, connected but unproven, or proving it', () => {
    expect(engagementLevel(s({ gmail: false, linkedin: false }))).toBe('NOT_CONNECTED')
    expect(engagementLevel(s({ dossierUnlocked: false }))).toBe('CONNECTED_NOT_PROVEN')
    expect(engagementLevel(base)).toBe('PROVING')
  })
  it('an unconnected member is led with unlocking, not nagged about points', () => {
    const lead = engagementLead(s({ gmail: false, linkedin: false }))!
    expect(lead.level).toBe('NOT_CONNECTED')
    expect(lead.steps[0].key).toBe('gmail')
    expect(lead.gate).toBeNull()
  })
})

describe('what the results say about a search', () => {
  it('reads the pattern, not just the weeks', () => {
    expect(searchPattern(s({ applications: 0, outreach: 0 }))).toBe('NOT_STARTED')
    expect(searchPattern(s({}))).toBe('APPLYING_NO_INTERVIEWS')
    expect(searchPattern(s({ interviews: 2 }))).toBe('INTERVIEWS_NO_OFFERS')
    expect(searchPattern(s({ interviews: 2, offers: 1 }))).toBe('MOVING')
    expect(searchPattern(s({ stage: 'STAYING' }))).toBeNull()
  })
  it('applications but no interviews: résumé first, then wider targets and interim work, then a coach', () => {
    expect(gateMove(s({ weeksInStage: 2 }))).toBeNull()
    expect(gateMove(s({ weeksInStage: 3 }))!.cta).toMatch(/Résumé Fixer/)
    expect(gateMove(s({ weeksInStage: 6 }))!.items.map((i) => i.text).join(' ')).toMatch(/interim or fractional/)
    expect(gateMove(s({ weeksInStage: 9 }))!.items.map((i) => i.text).join(' ')).toMatch(/coaching session/)
  })
  it('interviews but no offers: practice and feedback, not more applications', () => {
    const move = gateMove(s({ weeksInStage: 4, interviews: 3 }))!
    expect(move.headline).toMatch(/interviews but no offers/)
    expect(move.items.map((i) => i.actionType)).toContain('INTERVIEW_PREP')
  })
  it('a search that has not started is told to start with five messages', () => {
    expect(gateMove(s({ weeksInStage: 1, applications: 0, outreach: 0 }))!.cta).toMatch(/first five/)
  })
  it('no gate for someone who has an offer or is not in an active search', () => {
    expect(gateMove(s({ weeksInStage: 10, interviews: 2, offers: 1 }))).toBeNull()
    expect(gateMove(s({ weeksInStage: 10, stage: 'EXPLORING' }))).toBeNull()
  })
})

describe('tone changes how it is said, not what', () => {
  it('has a line for each tone', () => {
    const lines = new Set(['TOUGH_LOVE', 'GENTLE_ENCOURAGEMENT', 'SOMEWHERE_IN_BETWEEN', null].map((t) => toneLine(t as never, 'unlock')))
    expect(lines.size).toBe(3) // a mix and no preference read the same
    expect(toneLine('TOUGH_LOVE', 'unlock')).toMatch(/Do the work/)
    expect(toneLine('GENTLE_ENCOURAGEMENT', 'stalled')).toMatch(/one thing needs to change/)
  })
  it('the lead uses the member tone', () => {
    expect(engagementLead(s({ gmail: false, tone: 'TOUGH_LOVE' }))!.line).toMatch(/Do the work/)
  })
})

describe('screening answers sharpen the member own plan', () => {
  const rf = { restrictiveCovenant: true, firedForCause: true, noDrugTest: true, noBackgroundCheck: true }
  it('adds a step for each answer while looking, and nothing otherwise', () => {
    const items = engagementPlanItems(s({ redFlags: rf })).map((i) => i.text).join(' | ')
    expect(items).toMatch(/non-compete/)
    expect(items).toMatch(/why you left your last role/)
    expect(items).toMatch(/background check/)
    expect(items).toMatch(/drug test/)
    expect(engagementPlanItems(s({})).map((i) => i.text).join(' ')).not.toMatch(/non-compete|drug test/)
    expect(engagementPlanItems(s({ redFlags: rf, stage: 'STAYING' })).map((i) => i.text).join(' ')).not.toMatch(/non-compete/)
    expect(engagementPlanItems(s({ redFlags: rf, stage: 'EXPLORING' })).map((i) => i.text).join(' ')).not.toMatch(/drug test/)
  })
  it('is guidance, never a verdict', () => {
    for (const i of engagementPlanItems(s({ redFlags: rf }))) expect(i.text).not.toMatch(/disqualif|reject|will not hire/i)
  })
})

describe('the weekly plan', () => {
  const general = [{ text: 'Apply to Full-Time Jobs', actionType: 'JOB_APPLICATION_SUBMITTED' }]
  it('leads with the next unlock and, in a stalled search, the new things to try', () => {
    const items = engagementPlanItems(s({ gmail: false, weeksInStage: 6 }))
    expect(items[0].text).toMatch(/Résumé|Widen|interim|Connect Gmail/i)
    expect(items.map((i) => i.text)).toContain('Connect Gmail')
    const plan = shapePlan('LAID_OFF', 'APPLYING', 5, general, null, 0, items)
    expect(plan.slice(0, items.length).map((p) => p.text)).toEqual(items.map((i) => i.text))
  })
  it('still helps someone managing their career: connect and prove, but no search gate', () => {
    const items = engagementPlanItems(s({ stage: 'STAYING', gmail: false }))
    expect(items.map((i) => i.text)).toContain('Connect Gmail')
    expect(engagementLead(s({ stage: 'STAYING', gmail: false }))!.gate).toBeNull()
  })
})
