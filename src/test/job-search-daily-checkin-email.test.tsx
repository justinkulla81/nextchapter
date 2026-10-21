import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import JobSearchDailyEmail from '@/emails/job-search-daily'
it('renders the weekly check-in', () => {
  const content = {
    firstName: 'Pat', streak: 0, dayNumber: null, score: null, priorities: [], todos: [], applications: [], applicationsMoreCount: 0, staleApplicationCount: 0,
    networking: [], networkingMoreCount: 0, jobs: { items: [], fresh: [] }, companyMoves: [], likelyOpenings: [], reconnect: null, article: null, unlock: null,
    fromProfile: null, action: { label: 'Go', href: 'https://x' }, quote: null, freshCount: 0, whatChanged: [], matchCount: null,
    checkIn: { key: 'checkin:2026-10-19', rows: [{ kind: 'applications', label: 'Applications', taps: [{ label: '0', href: 'https://a/0' }, { label: '1–2', href: 'https://a/1' }] }, { kind: 'outreach', label: 'Outreach', taps: [{ label: '6+', href: 'https://o/6' }] }] },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html = renderToStaticMarkup(JobSearchDailyEmail({ content: content as any, masthead: 'Job Search Daily', weekday: 'Monday', appUrl: 'https://x', unsubscribeUrl: 'https://u' }))
  expect(html).toContain('Applied or reached out anywhere this week? Tap:')
  expect(html).toContain('href="https://a/1"')
  expect(html).toContain('Outreach:')
})
