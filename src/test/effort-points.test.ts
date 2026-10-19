import { describe, expect, it } from 'vitest'
import { barFor, CAPS, POINT_VALUES, scoreEffort, unlockStatus, weekKey, type EffortActivity } from '@/lib/effort/points'

const DAY = 86_400_000
// Monday 2026-10-12, noon UTC.
const monday = new Date('2026-10-12T12:00:00Z')
const now = new Date('2026-10-14T12:00:00Z') // Wednesday of that week
const days = (n: number, from = monday) => Array.from({ length: n }, (_, i) => new Date(from.getTime() + i * DAY))
const inWeek = (n: number, from = monday) => Array.from({ length: n }, (_, i) => new Date(from.getTime() + (i % 7) * DAY))
const none: EffortActivity = { loginDays: [], applications: [], networking: [], learning: [], references: [], partnerJobs: [], questionsAnswered: 0 }
const kind = (s: ReturnType<typeof scoreEffort>, k: string) => s.byKind.find((x) => x.kind === k)!

describe('point values', () => {
  it('are the agreed whole numbers, with networking and partner jobs worth most', () => {
    expect(POINT_VALUES).toEqual({ login: 1, application: 2, networking: 3, learning: 2, reference: 2, partnerJob: 4, question: 1 })
    expect(Math.max(...Object.values(POINT_VALUES))).toBe(POINT_VALUES.partnerJob)
    expect(POINT_VALUES.networking).toBeGreaterThan(POINT_VALUES.application)
  })
})

describe('scoreEffort', () => {
  it('scores each activity at its value', () => {
    const s = scoreEffort({ ...none, loginDays: days(1), applications: days(1), networking: days(1), learning: days(1), references: days(1), partnerJobs: days(1), questionsAnswered: 1 }, now)
    expect(s.total).toBe(1 + 2 + 3 + 2 + 2 + 4 + 1)
    expect(s.workKinds).toBe(6)
  })

  it('caps each weekly activity per calendar week', () => {
    const s = scoreEffort({ ...none, loginDays: days(7), applications: inWeek(8), networking: inWeek(7), partnerJobs: inWeek(4), learning: inWeek(5) }, now)
    expect(kind(s, 'login').counted).toBe(CAPS.login.max)
    expect(kind(s, 'application').counted).toBe(5)
    expect(kind(s, 'application').points).toBe(10)
    expect(kind(s, 'networking').points).toBe(12)
    expect(kind(s, 'partnerJob').points).toBe(8)
    expect(kind(s, 'learning').counted).toBe(2)
  })

  it('applies a weekly cap to each week separately', () => {
    const twoWeeks = [...days(5), ...days(5, new Date(monday.getTime() + 7 * DAY))]
    expect(kind(scoreEffort({ ...none, applications: twoWeeks }, now), 'application').counted).toBe(10)
  })

  it('caps references and questions across the whole cycle', () => {
    const s = scoreEffort({ ...none, references: days(6), questionsAnswered: 20 }, now)
    expect(kind(s, 'reference').counted).toBe(3)
    expect(kind(s, 'question').counted).toBe(8)
    expect(kind(s, 'reference').roomLeft).toBe(0)
  })

  it('never counts negative or fractional questions', () => {
    expect(kind(scoreEffort({ ...none, questionsAnswered: -3 }, now), 'question').counted).toBe(0)
  })

  it('does not count logging in as a kind of real work', () => {
    expect(scoreEffort({ ...none, loginDays: days(5) }, now).workKinds).toBe(0)
  })

  it('reports how much of a weekly cap is left this week', () => {
    const s = scoreEffort({ ...none, applications: days(3) }, now)
    expect(kind(s, 'application').roomLeft).toBe(2)
    expect(kind(s, 'networking').roomLeft).toBe(4)
  })

  it('buckets weeks from Monday', () => {
    expect(weekKey(new Date('2026-10-18T23:00:00Z'))).toBe(weekKey(monday))
    expect(weekKey(new Date('2026-10-19T01:00:00Z'))).not.toBe(weekKey(monday))
  })
})

describe('the bar', () => {
  it('is 30 for a strategy and 40 for a report, two thirds for a casual search', () => {
    expect(barFor('STRATEGY', false)).toEqual({ points: 30, minDays: 14, minKinds: 2 })
    expect(barFor('REPORT', false).points).toBe(40)
    expect(barFor('STRATEGY', true).points).toBe(20)
    expect(barFor('REPORT', true).points).toBe(27)
  })
})

describe('unlockStatus', () => {
  const longAgo = new Date(now.getTime() - 20 * DAY)
  const strong: EffortActivity = { ...none, loginDays: days(5), applications: days(5), networking: days(4), learning: days(1), partnerJobs: days(1) }

  it('unlocks when the points, the kinds of work and the days are all there', () => {
    const st = unlockStatus('STRATEGY', scoreEffort(strong, now), { casual: false, cycleStartedAt: longAgo, now })
    // A full week of everything: 5 + 10 + 12 + 2 + 4 = 33.
    expect(st.score.total).toBe(5 + 10 + 12 + 2 + 4)
    expect(st.unlocked).toBe(true)
    expect(st.blockers).toEqual([])
  })

  it('does not unlock on logins alone, however many', () => {
    const logins = Array.from({ length: 8 }, (_, w) => days(5, new Date(monday.getTime() + w * 7 * DAY))).flat()
    const st = unlockStatus('STRATEGY', scoreEffort({ ...none, loginDays: logins }, now), { casual: false, cycleStartedAt: longAgo, now })
    expect(st.score.total).toBe(40)
    expect(st.unlocked).toBe(false)
    expect(st.kindsShort).toBe(2)
    expect(st.blockers.join(' ')).toMatch(/besides logging in/)
  })

  it('holds the unlock until enough days have passed, and says how many', () => {
    const st = unlockStatus('STRATEGY', scoreEffort(strong, now), { casual: false, cycleStartedAt: new Date(now.getTime() - 5 * DAY), now })
    expect(st.unlocked).toBe(false)
    expect(st.daysLeft).toBe(9)
    expect(st.blockers.join(' ')).toMatch(/9 more days/)
  })

  it('says how many points are short, and the casual bar is lower', () => {
    const some: EffortActivity = { ...none, loginDays: days(3), applications: days(2), networking: days(2) }
    const active = unlockStatus('STRATEGY', scoreEffort(some, now), { casual: false, cycleStartedAt: longAgo, now })
    expect(active.pointsShort).toBe(30 - (3 + 4 + 6))
    const casual = unlockStatus('STRATEGY', scoreEffort(some, now), { casual: true, cycleStartedAt: longAgo, now })
    expect(casual.pointsShort).toBe(20 - 13)
  })

  it('needs two kinds of real work even when the points are there', () => {
    const one: EffortActivity = { ...none, networking: [...days(4), ...days(4, new Date(monday.getTime() + 7 * DAY))], loginDays: [...days(5), ...days(5, new Date(monday.getTime() + 7 * DAY))] }
    const st = unlockStatus('STRATEGY', scoreEffort(one, now), { casual: false, cycleStartedAt: longAgo, now })
    expect(st.pointsShort).toBe(0)
    expect(st.kindsShort).toBe(1)
    expect(st.unlocked).toBe(false)
  })

  it('suggests the highest-value things first and skips what is capped out this week', () => {
    const st = unlockStatus('STRATEGY', scoreEffort({ ...none, partnerJobs: days(2) }, now), { casual: false, cycleStartedAt: longAgo, now })
    expect(st.suggestions.map((s) => s.kind)).toEqual(['networking', 'application', 'reference'])
    expect(st.suggestions[0].points).toBe(3)
    const fresh = unlockStatus('STRATEGY', scoreEffort(none, now), { casual: false, cycleStartedAt: longAgo, now })
    expect(fresh.suggestions[0].kind).toBe('partnerJob')
  })
})

describe('time to unlock', () => {
  it('a steady active search earns a strategy at the fourteen-day floor, a thin one takes longer', () => {
    // A typical active week: 5 logins, 4 applications, 3 networking touches, a course every other week.
    const week = (i: number): Partial<EffortActivity> => {
      const start = new Date(monday.getTime() + i * 7 * DAY)
      return { loginDays: days(5, start), applications: days(4, start), networking: days(3, start) }
    }
    const merge = (n: number): EffortActivity => ({
      ...none,
      loginDays: Array.from({ length: n }, (_, i) => week(i).loginDays!).flat(),
      applications: Array.from({ length: n }, (_, i) => week(i).applications!).flat(),
      networking: Array.from({ length: n }, (_, i) => week(i).networking!).flat(),
    })
    // After one such week: 5 + 8 + 9 = 22, short of 30.
    expect(scoreEffort(merge(1), now).total).toBe(22)
    // After two: 44, which clears the points and, from the 14th day, the floor.
    const start = new Date(monday.getTime())
    const at14 = new Date(start.getTime() + 14 * DAY)
    const st = unlockStatus('STRATEGY', scoreEffort(merge(2), at14), { casual: false, cycleStartedAt: start, now: at14 })
    expect(st.score.total).toBe(44)
    expect(st.unlocked).toBe(true)
  })
})
