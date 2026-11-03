import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/marketing/TrackedLink', () => ({
  TrackedLink: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a>,
}))

import { SegmentJobs, SegmentTable } from '@/components/segments/SegmentTable'
import { buildEdition } from '@/lib/segments/aggregate'
import type { BoardRow } from '@/lib/segments/types'

const row = (company: string, st = 'VA'): BoardRow => ({
  id: company + st + Math.random(), title: 'Engineer', company, companyId: null, st, city: 'Arlington', level: 'MID_IC', payMin: 100_000, payMax: 120_000, payPeriod: 'year',
  currency: 'USD', postedAt: '2026-11-09T00:00:00Z', createdAt: '2026-11-09T00:00:00Z', industry: null, reqTags: null, postingType: null, sourceCategory: null, socCode: null, sector: null, skills: ['Python'], noExperience: false, soc: 'Engineers',
})

describe('segment tables', () => {
  const rows = [...Array.from({ length: 5 }, () => row('Alpha Co')), ...Array.from({ length: 3 }, () => row('Beta Co', 'TX'))]
  const e = buildEdition('defense', '2026-11', rows, null, new Date('2026-11-10T00:00:00Z'))
  it('renders ranked rows with links and bars', () => {
    const html = renderToStaticMarkup(<SegmentTable rows={e.cuts['top-employers']!} valueHead="Open jobs" nounHead="Employer" hrefs={new Map([['alpha', '/employers/alpha']])} segment="defense" cut="top-employers" />)
    expect(html).toContain('Alpha Co')
    expect(html).toContain('5 open')
    expect(html).toContain('<th')
  })
  it('names states in full and links to their page', () => {
    const html = renderToStaticMarkup(<SegmentTable rows={e.cuts['top-states']!} valueHead="Open jobs" nounHead="State" segment="defense" cut="top-states" />)
    expect(html).toContain('Virginia')
    expect(html).toContain('/places/virginia')
  })
  it('renders jobs, and a plain empty state', () => {
    expect(renderToStaticMarkup(<SegmentJobs jobs={e.newest} segment="defense" cut="newest" allHref="/jobs?q=defense" />)).toContain('/jobs/')
    expect(renderToStaticMarkup(<SegmentJobs jobs={[]} segment="defense" cut="newest" allHref="/jobs?q=defense" />)).toContain('No new jobs')
  })
})
