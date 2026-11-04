import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/posthog/client', () => ({ posthog: { capture: vi.fn() } }))
vi.mock('@/app/dashboard/in-work/actions', () => ({
  addWin: vi.fn(), deleteOutcome: vi.fn(), deleteWin: vi.fn(), loadMarketRange: vi.fn(), logOutcome: vi.fn(), savePrep: vi.fn(),
  savePromotionPlan: vi.fn(), saveReviewSettings: vi.fn(), toggleOutcomeFollowUp: vi.fn(),
}))

import { parseInWorkTab } from '@/components/in-work/InWorkWorkspace'

describe('Reviews and raises tabs', () => {
  it('opens the five current tabs by name', () => {
    for (const t of ['overview', 'impact', 'prep', 'raise', 'feedback'] as const) expect(parseInWorkTab(t)).toBe(t)
  })
  it('keeps the old seven-tab names working (emails and links still use them)', () => {
    expect(parseInWorkTab('salary')).toBe('raise')
    expect(parseInWorkTab('promotion')).toBe('raise')
    expect(parseInWorkTab('outcome')).toBe('feedback')
  })
  it('falls back to Overview for nothing or an unknown name', () => {
    expect(parseInWorkTab(undefined)).toBe('overview')
    expect(parseInWorkTab(null)).toBe('overview')
    expect(parseInWorkTab('nope')).toBe('overview')
  })
})
