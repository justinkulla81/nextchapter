import { describe, expect, it } from 'vitest'
import { ASSESSMENT_WHY, assessmentFact, nextAssessment, shapeAssessments, type AssessmentInput } from '@/lib/redesign/assessments'
import { barHeights, bestWeekSentence, minutesInSprint, weeklyEffort } from '@/lib/redesign/effort-history'
import { moneyGate, stepHeadline, summarizeSteps } from '@/lib/redesign/benefits'

const input = (over: Partial<AssessmentInput>): AssessmentInput => ({ key: 'skills', title: 'Skills', completedAt: null, points: 10, href: '/x', ctaLabel: 'Take it', ...over })

describe('assessments', () => {
  it('says how long an open one takes, and when a finished one was done', () => {
    expect(assessmentFact({ completedAt: null, points: 10 })).toBe('About 10 minutes')
    expect(assessmentFact({ completedAt: null, points: 1 })).toBe('About 1 minute')
    expect(assessmentFact({ completedAt: new Date('2026-10-05T12:00:00Z'), points: 10 })).toBe('Done Oct 5, 2026')
    expect(assessmentFact({ completedAt: new Date(0), points: 5, statusLabel: '2 / 3 references' })).toBe('2 / 3 references')
  })

  it('gives every row a reason and picks the first open one', () => {
    const rows = shapeAssessments([input({ key: 'performance', completedAt: new Date() }), input({ key: 'skills' }), input({ key: 'unknown-key' })])
    expect(rows[0].done).toBe(true)
    expect(rows[1].why).toBe(ASSESSMENT_WHY.skills)
    expect(rows[2].why.length).toBeGreaterThan(10)
    expect(nextAssessment(rows)?.key).toBe('skills')
  })

  it('has no next one when everything is done', () => {
    expect(nextAssessment(shapeAssessments([input({ completedAt: new Date() })]))).toBeNull()
  })
})

describe('effort history', () => {
  it('adds up completed work only, and ignores bad data', () => {
    expect(minutesInSprint([{ completed: true, points: 30 }, { completed: false, points: 50 }, { completed: true, points: 'x' }, null, 4])).toBe(30)
    expect(minutesInSprint('nope')).toBe(0)
  })

  it('orders weeks oldest first and keeps the latest', () => {
    const mk = (d: string, pts: number) => ({ weekStartDate: new Date(d), committedActions: [{ completed: true, points: pts }] })
    const weeks = weeklyEffort([mk('2026-10-12', 40), mk('2026-10-05', 90), mk('2026-09-28', 10)], 2)
    expect(weeks.map((w) => w.minutes)).toEqual([90, 40])
  })

  it('names the best week and says so plainly when it is this week', () => {
    const weeks = weeklyEffort([
      { weekStartDate: new Date('2026-10-05T00:00:00Z'), committedActions: [{ completed: true, points: 140 }] },
      { weekStartDate: new Date('2026-10-12T00:00:00Z'), committedActions: [{ completed: true, points: 60 }] },
    ])
    expect(bestWeekSentence(weeks)).toBe('Your best week was the week of Oct 5, at 140 minutes.')
    expect(bestWeekSentence(weeks.slice().reverse().map((w, i) => ({ ...w, minutes: i === 1 ? 140 : 60 })))).toBe('This is your best week so far, at 140 minutes.')
    expect(bestWeekSentence([])).toBeNull()
    expect(bestWeekSentence([{ weekStart: new Date(), minutes: 0 }])).toBeNull()
  })

  it('scales bars to the tallest week with a visible floor', () => {
    expect(barHeights([{ weekStart: new Date(), minutes: 100 }, { weekStart: new Date(), minutes: 1 }, { weekStart: new Date(), minutes: 0 }])).toEqual([100, 8, 0])
    expect(barHeights([{ weekStart: new Date(), minutes: 0 }])).toEqual([0])
  })
})

describe('benefits', () => {
  it('reads the money choice', () => {
    expect(moneyGate(true)).toBe('on')
    expect(moneyGate(false)).toBe('off')
    expect(moneyGate(null)).toBe('ask')
    expect(moneyGate(undefined)).toBe('ask')
  })

  it('finds the next open step', () => {
    const items = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }]
    expect(summarizeSteps(items, new Set(['a']))).toEqual({ next: items[1], done: 1, total: 3 })
    expect(summarizeSteps(items, new Set(['a', 'b', 'c'])).next).toBeNull()
    expect(summarizeSteps([], new Set()).total).toBe(0)
  })

  it('shortens a step to its first clause', () => {
    expect(stepHeadline("File for unemployment insurance right away if you haven't — most states let you apply")).toBe("File for unemployment insurance right away if you haven't")
    expect(stepHeadline('Compare COBRA vs. a Healthcare.gov marketplace plan.')).toBe('Compare COBRA vs. a Healthcare.gov marketplace plan')
    expect(stepHeadline('word '.repeat(40)).endsWith('…')).toBe(true)
    expect(stepHeadline('Call the center')).toBe('Call the center')
  })
})
