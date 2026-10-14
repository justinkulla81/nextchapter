import { describe, expect, it } from 'vitest'
import { CHECK_IN_ANSWERS, STAGES, changeForAnswer, checkInDue, effectiveJourney, effectiveStage, getJourney, getStage, JOURNEYS, moveDriverOf, notLookingNow, reportFraming, stageForTiming } from '@/lib/journey/journey'
import { JOURNEY_TO_SITUATION, SITUATION_TO_JOURNEY } from '@/lib/constants/onboarding'

describe('journeys (Product Design doc, Journeys tab)', () => {
  it('has the eleven journeys, each reachable from an onboarding card', () => {
    expect(JOURNEYS.map((j) => j.key)).toEqual(['LAID_OFF', 'EXPLORING_MOVE', 'GROWING', 'PROMOTION', 'CAREER_CHANGE', 'STUDENT_NEW_GRAD', 'RETURNING', 'NEXT_ACT', 'TIME_OFF', 'FRACTIONAL', 'ENTREPRENEUR'])
    for (const j of JOURNEYS) expect(SITUATION_TO_JOURNEY[JOURNEY_TO_SITUATION[j.key]]).toBe(j.key)
  })
  it('laid off and resigned share a journey; ready to move and worried about a layoff are thinking about a move', () => {
    expect(SITUATION_TO_JOURNEY.just_resigned).toBe('LAID_OFF')
    expect(SITUATION_TO_JOURNEY.worried_let_go).toBe('EXPLORING_MOVE')
    expect(SITUATION_TO_JOURNEY.ready_to_move).toBe('EXPLORING_MOVE')
  })
  it('members already on the retired Ready for a new job journey read as Thinking about a move', () => {
    expect(effectiveJourney({ journey: 'READY_TO_MOVE' })).toBe('EXPLORING_MOVE')
    expect(getJourney('READY_TO_MOVE').key).toBe('EXPLORING_MOVE')
  })
  it('managing my career is its own journey: not searching, and never silent', () => {
    expect(getJourney('GROWING')).toMatchObject({ searching: false, employed: true, defaultStage: 'STAYING' })
    expect(getStage('STAYING').label).toBe('Managing your career')
    // There is no "on a break": a legacy paused row reads as managing your career.
    expect(getStage('PAUSED').label).toBe('Managing your career')
    expect(effectiveStage({ journeyStage: 'PAUSED' })).toBe('STAYING')
    expect(STAGES.map((s) => s.key)).not.toContain('PAUSED')
  })
  it('people managing their career or already landed get no job-listing emails; searchers do', () => {
    expect(notLookingNow({ journeyStage: 'STAYING' })).toBe(true)
    expect(notLookingNow({ journeyStage: 'PAUSED' })).toBe(true)
    expect(notLookingNow({ journeyStage: 'LANDED' })).toBe(true)
    expect(notLookingNow({ journeyStage: 'APPLYING' })).toBe(false)
    expect(notLookingNow({})).toBe(false)
  })
  it('what is driving a move is read from the journey details', () => {
    expect(moveDriverOf({ moveDriver: 'layoff_worry' })).toBe('layoff_worry')
    expect(moveDriverOf({ moveDriver: 'nonsense' })).toBeNull()
    expect(moveDriverOf(null)).toBeNull()
  })
  it('the report reads a move differently while exploring than once preparing, and by driver', () => {
    expect(reportFraming('EXPLORING_MOVE', 'EXPLORING')).toContain('not applying yet')
    expect(reportFraming('EXPLORING_MOVE', 'PREPARING')).toContain('searching quietly')
    expect(reportFraming('EXPLORING_MOVE', 'EXPLORING', 'layoff_worry')).toContain('worried about a layoff')
    expect(reportFraming('GROWING', 'STAYING')).toContain('performance review')
  })
  it('members from before journeys get one from their job status', () => {
    expect(effectiveJourney({ currentJobStatus: 'RESIGNED' })).toBe('LAID_OFF')
    expect(effectiveJourney({ currentJobStatus: 'SEEKING_PROMOTION' })).toBe('PROMOTION')
    expect(effectiveStage({ currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' })).toBe('EXPLORING')
    expect(effectiveJourney({})).toBeNull()
  })
  it('"When do you want to start applying?" sets the stage', () => {
    expect(stageForTiming('EXPLORING_MOVE', 'now')).toBe('APPLYING')
    expect(stageForTiming('EXPLORING_MOVE', '1_3_months')).toBe('PREPARING')
    expect(stageForTiming('EXPLORING_MOVE', '3_6_months')).toBe('EXPLORING')
    expect(stageForTiming('READY_TO_MOVE', '1_3_months')).toBe('PREPARING')
    expect(stageForTiming('PROMOTION', 'curious')).toBe('EXPLORING')
  })
  it('each check-in answer is a change', () => {
    const cur = { journey: 'EXPLORING_MOVE' as const, stage: 'EXPLORING' as const }
    expect(changeForAnswer('ready', cur)).toEqual({ stage: 'APPLYING' })
    expect(changeForAnswer('laid_off', cur)).toEqual({ journey: 'LAID_OFF', stage: 'APPLYING' })
    expect(changeForAnswer('landed', cur)).toEqual({ stage: 'LANDED' })
    expect(changeForAnswer('nothing', cur)).toEqual({})
    expect(changeForAnswer('managing', cur)).toEqual({ stage: 'STAYING' })
    expect(changeForAnswer('nothing', { journey: 'GROWING', stage: 'STAYING' })).toEqual({})
    expect(CHECK_IN_ANSWERS.map((a) => a.key)).not.toContain('break')
  })
  it('check-ins come at the stage pace: weekly when applying, monthly when exploring', () => {
    const now = new Date('2026-10-12T00:00:00Z')
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
    expect(checkInDue({ journeyStage: 'APPLYING', journey: 'LAID_OFF', journeyCheckedAt: daysAgo(8) }, now)).toBe(true)
    expect(checkInDue({ journeyStage: 'APPLYING', journey: 'LAID_OFF', journeyCheckedAt: daysAgo(3) }, now)).toBe(false)
    expect(checkInDue({ journeyStage: 'EXPLORING', journey: 'EXPLORING_MOVE', journeyCheckedAt: daysAgo(20) }, now)).toBe(false)
    expect(checkInDue({ journeyStage: 'EXPLORING', journey: 'EXPLORING_MOVE', journeyCheckedAt: daysAgo(31) }, now)).toBe(true)
  })
})
