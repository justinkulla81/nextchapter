import { describe, expect, it } from 'vitest'
import { pickSearchStart, playbookPosition, searchClock } from '@/lib/journey/search-playbook'

const NOW = new Date('2026-10-13T12:00:00Z')
const weeksAgo = (w: number) => new Date(NOW.getTime() - w * 7 * 24 * 60 * 60 * 1000 - 1000)

describe('searchClock', () => {
  it('counts weeks since the last day for a laid-off member', () => {
    const c = searchClock({ journey: 'LAID_OFF', stage: 'APPLYING', lastJobEndedAt: weeksAgo(14), searchStartedAt: weeksAgo(3), now: NOW })
    expect(c).toEqual({ weeks: 14, basis: 'SINCE_LAST_JOB' })
  })
  it('counts weeks since applying started for an employed member', () => {
    const c = searchClock({ journey: 'READY_TO_MOVE', stage: 'APPLYING', lastJobEndedAt: weeksAgo(100), searchStartedAt: weeksAgo(9), now: NOW })
    expect(c).toEqual({ weeks: 9, basis: 'SINCE_SEARCH_STARTED' })
  })
  it('is quiet when no search is running', () => {
    for (const stage of ['EXPLORING', 'PREPARING', 'LANDED', 'PAUSED'] as const) {
      expect(searchClock({ journey: 'LAID_OFF', stage, lastJobEndedAt: weeksAgo(30), searchStartedAt: weeksAgo(30), now: NOW })).toBeNull()
    }
  })
  it('has no clock without a start date', () => {
    expect(searchClock({ journey: 'PROMOTION', stage: 'APPLYING', lastJobEndedAt: null, searchStartedAt: null, now: NOW })).toBeNull()
  })
})

describe('playbookPosition', () => {
  it('picks the latest passed milestone and the next one', () => {
    const p = playbookPosition({ journey: 'LAID_OFF', stage: 'APPLYING', lastJobEndedAt: weeksAgo(15), searchStartedAt: null, now: NOW })
    expect(p?.current?.atWeek).toBe(12)
    expect(p?.next?.atWeek).toBe(20)
    expect(p?.isLongTermUnemployed).toBe(false)
  })
  it('flags long-term unemployment only for the laid-off clock at 27+ weeks', () => {
    const laid = playbookPosition({ journey: 'LAID_OFF', stage: 'APPLYING', lastJobEndedAt: weeksAgo(28), searchStartedAt: null, now: NOW })
    expect(laid?.isLongTermUnemployed).toBe(true)
    const employed = playbookPosition({ journey: 'READY_TO_MOVE', stage: 'APPLYING', lastJobEndedAt: null, searchStartedAt: weeksAgo(28), now: NOW })
    expect(employed?.isLongTermUnemployed).toBe(false)
  })
  it('shows the first milestone as next before it is reached', () => {
    const p = playbookPosition({ journey: 'PROMOTION', stage: 'APPLYING', lastJobEndedAt: null, searchStartedAt: weeksAgo(1), now: NOW })
    expect(p?.current).toBeNull()
    expect(p?.next?.atWeek).toBe(4)
  })
  it('has no playbook for a new graduate', () => {
    expect(playbookPosition({ journey: 'STUDENT_NEW_GRAD', stage: 'APPLYING', lastJobEndedAt: null, searchStartedAt: weeksAgo(5), now: NOW })).toBeNull()
  })
})

describe('pickSearchStart', () => {
  it('uses the earliest active-stage event under the current journey', () => {
    const d = pickSearchStart({
      events: [
        { toStage: 'APPLYING', createdAt: new Date('2026-01-01') },
        { toStage: 'APPLYING', createdAt: new Date('2026-06-01') },
        { toStage: 'INTERVIEWING', createdAt: new Date('2026-07-01') },
      ],
      journeyChangedAt: new Date('2026-05-01'),
      journeyStageChangedAt: new Date('2026-07-01'),
      currentStageIsActive: true,
      firstAppliedAt: null,
    })
    expect(d).toEqual(new Date('2026-06-01'))
  })
  it('falls back to the stage change, then the first application', () => {
    expect(pickSearchStart({ events: [], journeyChangedAt: null, journeyStageChangedAt: new Date('2026-08-01'), currentStageIsActive: true, firstAppliedAt: new Date('2026-09-01') })).toEqual(new Date('2026-08-01'))
    expect(pickSearchStart({ events: [], journeyChangedAt: null, journeyStageChangedAt: null, currentStageIsActive: true, firstAppliedAt: new Date('2026-09-01') })).toEqual(new Date('2026-09-01'))
  })
})
