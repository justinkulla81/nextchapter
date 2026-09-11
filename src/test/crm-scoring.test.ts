import { describe, it, expect } from 'vitest'
import { computePriority, deadlineUrgency, staleness, warmPathFromContacts } from '@/lib/crm/scoring'

const NOW = new Date('2026-09-11T00:00:00Z')
const base = {
  quality: 'B' as const,
  eligibility: 'FOR_PROFIT_ELIGIBLE' as const,
  warmPath: 0.6,
  nextDueAt: null,
  committedFollowUpAt: null,
  stageProgress: 0.3,
  lastTouchedAt: NOW,
  createdAt: NOW,
  now: NOW,
}
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

describe('deadlineUrgency', () => {
  it('peaks inside two weeks and for anything past due', () => {
    expect(deadlineUrgency(days(7), NOW)).toBe(1)
    expect(deadlineUrgency(days(-30), NOW)).toBe(1)
  })
  it('halves between two weeks and two months, then stops counting', () => {
    expect(deadlineUrgency(days(45), NOW)).toBe(0.5)
    expect(deadlineUrgency(days(120), NOW)).toBe(0)
  })
  it('contributes nothing when there is no date', () => {
    // 241 of 252 funding deadline cells are prose like "Rolling".
    expect(deadlineUrgency(null, NOW)).toBe(0)
  })
})

describe('staleness', () => {
  it('measures from creation when nothing was ever logged', () => {
    expect(staleness(null, days(-45), NOW)).toBeCloseTo(0.5, 5)
  })
  it('caps at 90 days so ancient and very ancient rank the same', () => {
    expect(staleness(days(-90), NOW, NOW)).toBe(1)
    expect(staleness(days(-900), NOW, NOW)).toBe(1)
  })
})

describe('computePriority', () => {
  it('ranks an A-grade warm lead above a D-grade cold one', () => {
    const hot = computePriority({ ...base, quality: 'A', warmPath: 1 })
    const cold = computePriority({ ...base, quality: 'D', warmPath: 0.2 })
    expect(hot.score).toBeGreaterThan(cold.score)
  })

  it('caps a nonprofit-only funder below anything winnable, even with a deadline tomorrow', () => {
    // The reason eligibility multiplies instead of subtracting: urgency alone
    // must never float an ineligible funder into the queue.
    const ineligible = computePriority({
      ...base, quality: 'A', warmPath: 1, nextDueAt: days(1), eligibility: 'NONPROFIT_ONLY',
    })
    const mediocreButEligible = computePriority({ ...base, quality: 'C', warmPath: 0.2 })
    expect(ineligible.score).toBeLessThan(mediocreButEligible.score)
  })

  it('treats a promise to a person as at least as urgent as a deadline', () => {
    const promised = computePriority({ ...base, committedFollowUpAt: days(2) })
    const nothing = computePriority(base)
    expect(promised.score).toBeGreaterThan(nothing.score)
  })

  it('takes the more urgent of a deadline and a promise, not the average', () => {
    const both = computePriority({ ...base, nextDueAt: days(120), committedFollowUpAt: days(2) })
    const onlyPromise = computePriority({ ...base, committedFollowUpAt: days(2) })
    expect(both.score).toBe(onlyPromise.score)
  })

  it('penalises going cold', () => {
    const fresh = computePriority(base)
    const stale = computePriority({ ...base, lastTouchedAt: days(-90) })
    expect(stale.score).toBeLessThan(fresh.score)
  })

  it('never returns a negative score', () => {
    const worst = computePriority({
      ...base, quality: 'D', warmPath: 0, stageProgress: 0,
      lastTouchedAt: days(-900), eligibility: 'NONPROFIT_ONLY',
    })
    expect(worst.score).toBeGreaterThanOrEqual(0)
  })
})

describe('warmPathFromContacts', () => {
  it('rates a real first-degree connection highest', () => {
    expect(warmPathFromContacts([{ connectedAt: NOW }])).toBe(1)
  })
  it('rates a known contact without a connection date lower', () => {
    expect(warmPathFromContacts([{ connectedAt: null }])).toBe(0.6)
  })
  it('rates nobody-at-all lowest', () => {
    expect(warmPathFromContacts([])).toBe(0.2)
  })
})

describe('warmPathFromIntroPaths', () => {
  it('takes the best live route rather than averaging them', async () => {
    const { warmPathFromIntroPaths } = await import('@/lib/crm/scoring')
    // One strong route should not be dragged down by three speculative ones.
    expect(warmPathFromIntroPaths([
      { strength: 'STRONG', status: 'IDENTIFIED' },
      { strength: 'UNVERIFIED', status: 'IDENTIFIED' },
      { strength: 'WEAK', status: 'IDENTIFIED' },
    ])).toBe(1)
  })

  it('treats an introduction already made as the strongest possible signal', async () => {
    const { warmPathFromIntroPaths } = await import('@/lib/crm/scoring')
    expect(warmPathFromIntroPaths([{ strength: 'WEAK', status: 'INTRO_MADE' }])).toBe(1)
  })

  it('ignores a declined route so it stops inflating the score', async () => {
    const { warmPathFromIntroPaths } = await import('@/lib/crm/scoring')
    expect(warmPathFromIntroPaths([{ strength: 'STRONG', status: 'DECLINED' }])).toBe(0)
  })

  it('falls back to who you know when no route is recorded', async () => {
    const { bestWarmPath } = await import('@/lib/crm/scoring')
    expect(bestWarmPath([{ connectedAt: new Date() }], [])).toBe(1)
    expect(bestWarmPath([], [{ strength: 'MEDIUM', status: 'IDENTIFIED' }])).toBe(0.7)
  })
})
