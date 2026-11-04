import { describe, expect, it } from 'vitest'
import { isPostingWorking, POSTING_WORK_WINDOW_MS } from '@/lib/jobs/posting-background'

describe('isPostingWorking', () => {
  const now = Date.parse('2026-11-04T12:00:00Z')
  it('is false when nothing is running', () => {
    expect(isPostingWorking(null, now)).toBe(false)
  })
  it('is true while the mark is recent', () => {
    expect(isPostingWorking(new Date(now - 30_000), now)).toBe(true)
  })
  it('expires, so a run that was cut off never sticks', () => {
    expect(isPostingWorking(new Date(now - POSTING_WORK_WINDOW_MS - 1), now)).toBe(false)
  })
})
