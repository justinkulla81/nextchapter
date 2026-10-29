import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Touch } from '@/lib/outreach/touch-stats'

// The client forms import server actions; the render test only needs them to exist.
vi.mock('@/app/support/admin/(portal)/crm/outreach/actions', () => ({ logOutreachTouch: vi.fn(), saveQuota: vi.fn(), deleteQuota: vi.fn() }))
vi.mock('@/app/support/admin/(portal)/crm/actions', () => ({ searchCrmPeopleByName: vi.fn() }))

import { OutreachTracker } from './OutreachTracker'

const daysAgo = (n: number, hour = 15) => new Date(Date.now() - n * 86_400_000 - 3_600_000 * (new Date().getUTCHours() - hour))
const touches: Touch[] = [
  { at: daysAgo(1), channel: 'email', mode: 'automated', source: 'Cold outreach (automated)', group: 'employer_buyer', personId: 'a', responded: true, positive: true, hasTime: true },
  { at: daysAgo(2), channel: 'call', mode: 'manual', source: 'Phone call', group: 'recruiter', personId: 'b', responded: true, positive: false, hasTime: true },
  { at: daysAgo(3), channel: 'linkedin', mode: 'manual', source: 'LinkedIn', group: 'candidate', personId: 'c', responded: false, positive: false, hasTime: false },
]

describe('OutreachTracker', () => {
  for (const range of ['30', '90', '365'] as const) {
    it(`renders ${range}-day view with targets and no broken numbers`, () => {
      const html = renderToStaticMarkup(<OutreachTracker touches={touches} quotas={[{ groupKey: 'ALL', channel: 'ALL', weeklyTarget: 50 }, { groupKey: 'recruiter', channel: 'call', weeklyTarget: 5 }]} range={range} capped={false} />)
      expect(html).toContain('Who we reached')
      expect(html).toContain('of 50 this week')
      expect(html).toContain('Recruiters')
      expect(html).not.toMatch(/NaN|undefined/)
    })
  }
  it('renders with no data and with targets unavailable', () => {
    const html = renderToStaticMarkup(<OutreachTracker touches={[]} quotas={null} range="90" capped={false} />)
    expect(html).toContain('Targets are not available')
    expect(html).toContain('Nothing in the last')
    expect(html).not.toMatch(/NaN|undefined/)
  })
  it('says so when no targets are set', () => {
    expect(renderToStaticMarkup(<OutreachTracker touches={touches} quotas={[]} range="30" capped={false} />)).toContain('No targets yet')
  })
})
