import { describe, expect, it } from 'vitest'
import { changeForAnswer, checkInDue, effectiveJourney, effectiveStage, JOURNEYS, stageForTiming } from '@/lib/journey/journey'
import { JOURNEY_TO_SITUATION, SITUATION_TO_JOURNEY } from '@/lib/constants/onboarding'

describe('journeys (Product Design doc, Journeys tab)', () => {
  it('has the eight journeys, each reachable from an onboarding card', () => {
    expect(JOURNEYS.map((j) => j.key)).toEqual(['LAID_OFF', 'READY_TO_MOVE', 'EXPLORING_MOVE', 'PROMOTION', 'CAREER_CHANGE', 'STUDENT_NEW_GRAD', 'RETURNING', 'NEXT_ACT'])
    for (const j of JOURNEYS) expect(SITUATION_TO_JOURNEY[JOURNEY_TO_SITUATION[j.key]]).toBe(j.key)
  })
  it('laid off and resigned share a journey; worried about a layoff is thinking about a move', () => {
    expect(SITUATION_TO_JOURNEY.just_resigned).toBe('LAID_OFF')
    expect(SITUATION_TO_JOURNEY.worried_let_go).toBe('EXPLORING_MOVE')
  })
  it('members from before journeys get one from their job status', () => {
    expect(effectiveJourney({ currentJobStatus: 'RESIGNED' })).toBe('LAID_OFF')
    expect(effectiveJourney({ currentJobStatus: 'SEEKING_PROMOTION' })).toBe('PROMOTION')
    expect(effectiveStage({ currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' })).toBe('EXPLORING')
    expect(effectiveJourney({})).toBeNull()
  })
  it('"When do you want to start applying?" sets the stage', () => {
    expect(stageForTiming('EXPLORING_MOVE', 'now')).toBe('APPLYING')
    expect(stageForTiming('EXPLORING_MOVE', '1_3_months')).toBe('EXPLORING')
    expect(stageForTiming('READY_TO_MOVE', '1_3_months')).toBe('PREPARING')
    expect(stageForTiming('PROMOTION', 'curious')).toBe('EXPLORING')
  })
  it('each check-in answer is a change', () => {
    const cur = { journey: 'EXPLORING_MOVE' as const, stage: 'EXPLORING' as const }
    expect(changeForAnswer('ready', cur)).toEqual({ stage: 'APPLYING' })
    expect(changeForAnswer('laid_off', cur)).toEqual({ journey: 'LAID_OFF', stage: 'APPLYING' })
    expect(changeForAnswer('landed', cur)).toEqual({ stage: 'LANDED' })
    expect(changeForAnswer('nothing', cur)).toEqual({})
    expect(changeForAnswer('nothing', { journey: 'READY_TO_MOVE', stage: 'PAUSED' })).toEqual({ stage: 'PREPARING' })
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
