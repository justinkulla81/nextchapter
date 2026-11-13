import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/companies/posting-company', () => ({ linkPostingsToCompanies: async () => new Map() }))

import { isRelevantTitle, parseJobPage, parseSitemap } from '@/lib/jobs/neogov-feed'

describe('neogov feed title screen', () => {
  it('keeps professional and management titles', () => {
    for (const t of ['senior accountant', 'budget analyst ii', 'finance director', 'software engineer', 'registered nurse', 'human resources manager'])
      expect(isRelevantTitle(t), t).toBe(true)
  })
  it('drops trades, protective, service and clerical titles', () => {
    for (const t of ['police officer', 'plumber', 'custodian', 'water treatment operator', 'office assistant', 'parking enforcement officer pt', 'correctional deputy i'])
      expect(isRelevantTitle(t), t).toBe(false)
  })
})

describe('neogov feed parsing', () => {
  it('reads job ids, urls and title slugs from the sitemap', () => {
    const xml = '<urlset><url><loc>https://www.governmentjobs.com/jobs/5074137-0/budget-analyst</loc></url><url><loc>https://www.governmentjobs.com/category/x</loc></url></urlset>'
    expect(parseSitemap(xml)).toEqual([{ id: '5074137-0', url: 'https://www.governmentjobs.com/jobs/5074137-0/budget-analyst', title: 'budget analyst' }])
  })
  it('reads the JobPosting block of a job page', () => {
    const ld = JSON.stringify({
      '@type': 'JobPosting', title: 'Budget Analyst', description: '&lt;p&gt;Prepare the budget.&lt;/p&gt;', datePosted: '2026-10-21', employmentType: 'FULL_TIME',
      hiringOrganization: { name: 'Rock County' },
      jobLocation: { address: { addressLocality: 'Janesville', addressRegion: 'WI' } },
      baseSalary: { value: { minValue: 60000, maxValue: 80000, unitText: 'YEAR' } },
    })
    const p = parseJobPage(`<html><script type="application/ld+json">${ld}</script></html>`)
    expect(p).toMatchObject({ title: 'Budget Analyst', employer: 'Rock County', location: 'Janesville, WI', state: 'WI', employmentType: 'full_time', salaryMin: 60000, salaryMax: 80000 })
    expect(p?.description).toBe('Prepare the budget.')
  })
  it('returns null when the page has no JobPosting', () => {
    expect(parseJobPage('<html></html>')).toBeNull()
  })
})
