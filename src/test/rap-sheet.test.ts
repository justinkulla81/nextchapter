import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/anthropic', () => ({ getAnthropicClient: vi.fn() }))
vi.mock('@/lib/crm/sync', () => ({ buildSweepContext: vi.fn() }))
vi.mock('@/lib/google/admin-calendar', () => ({ listCalendarEvents: vi.fn() }))
vi.mock('@/lib/webinars/admin-calendar-oauth', () => ({ getValidAdminAccessToken: vi.fn() }))

import { easternDayBounds, isNoMeetingNight } from '@/lib/crm/rap-sheet/offer'
import { parseRapSheet } from '@/lib/crm/rap-sheet/generate'
import { renderRapSheetHtml } from '@/lib/crm/rap-sheet/email'

describe('easternDayBounds', () => {
  it('spans a 24h EDT day starting 04:00Z', () => {
    const { from, to } = easternDayBounds(1, new Date('2026-10-08T23:00:00Z'))
    expect(from.toISOString()).toBe('2026-10-09T04:00:00.000Z')
    expect(to.toISOString()).toBe('2026-10-10T04:00:00.000Z')
  })
  it('handles EST after the fall-back change', () => {
    const { from } = easternDayBounds(0, new Date('2026-11-10T15:00:00Z'))
    expect(from.toISOString()).toBe('2026-11-10T05:00:00.000Z')
  })
})

const sample = {
  headline: 'h', whoTheyAre: 'w', relationship: [], local: { summary: 's', points: [] },
  layoffs: { summary: 'l', items: [] }, initiatives: [], whiteCollar: [],
  pitch: { angle: 'a', howItHelps: ['x'], openingLine: 'o', objections: [], ask: 'k' }, caveats: [], sources: [],
}

describe('parseRapSheet', () => {
  it('parses JSON wrapped in prose', () => {
    expect(parseRapSheet(`Here you go:\n${JSON.stringify(sample)}\nDone`)?.headline).toBe('h')
  })
  it('rejects output missing the pitch', () => {
    expect(parseRapSheet('{"headline":"h"}')).toBeNull()
    expect(parseRapSheet('no json')).toBeNull()
  })
})

describe('renderRapSheetHtml', () => {
  it('escapes model text and drops non-http source links', () => {
    const html = renderRapSheetHtml(
      { ...sample, headline: '<script>x</script>', initiatives: [{ name: 'n', detail: 'd', sourceUrl: 'javascript:alert(1)' }] },
      { personId: 'p', personName: 'Kelly Gold', orgName: null, meetingTitle: null, meetingAt: null },
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('javascript:')
  })
})

describe('isNoMeetingNight', () => {
  it('skips Friday and Saturday nights in Eastern time', () => {
    expect(isNoMeetingNight(new Date('2026-10-10T00:00:00Z'))).toBe(true) // Fri 8 PM ET
    expect(isNoMeetingNight(new Date('2026-10-11T00:00:00Z'))).toBe(true) // Sat 8 PM ET
  })
  it('runs Sunday through Thursday nights', () => {
    expect(isNoMeetingNight(new Date('2026-10-12T00:00:00Z'))).toBe(false) // Sun 8 PM ET
    expect(isNoMeetingNight(new Date('2026-10-09T00:00:00Z'))).toBe(false) // Thu 8 PM ET
  })
})
