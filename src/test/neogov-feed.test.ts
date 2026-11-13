import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/companies/posting-company', () => ({ linkPostingsToCompanies: async () => new Map() }))

import { parseJobPage, parseSitemap, isRelevantTitle } from '@/lib/jobs/neogov-feed'
import { parseK12Sitemap } from '@/lib/jobs/k12jobspot-core'
import { gradedTitle, joaToKept } from '@/lib/jobs/usajobs-board-core'

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

describe('k12jobspot sitemap', () => {
  it('reads the id and a title from the job url slug', () => {
    const xml = '<urlset><url><loc>https://www.k12jobspot.com/en/job-postings/6af659be9d5f5f88e73c1a97-employee-relations-specialist---human-resources</loc></url></urlset>'
    const [job] = parseK12Sitemap(xml)
    expect(job.id).toBe('6af659be9d5f5f88e73c1a97')
    expect(job.title).toBe('employee relations specialist human resources')
  })
})

describe('usajobs board rows', () => {
  const open = { usajobsControlNumber: 123, positionTitle: 'Program Analyst', hiringAgencyName: 'Bureau X', hiringDepartmentName: 'Department Y', positionOpeningStatus: 'Accepting applications', positionCloseDate: '2999-01-01', payScale: 'GS', minimumGrade: '12', maximumGrade: '13', salaryType: 'Per Year', minimumSalary: 90000, maximumSalary: 120000, workSchedule: 'Full-time', hiringpaths: [{ hiringPath: 'The public' }], positionlocations: [{ positionLocationCity: 'Denver', positionLocationState: 'Colorado', positionLocationCountry: 'United States' }] }
  it('adds the grade to a title that has none', () => {
    expect(gradedTitle(open)).toBe('Program Analyst (GS-13)')
  })
  it('keeps an open-to-the-public announcement with a link, pay and expiry', () => {
    const v = joaToKept(open, new Date('2026-11-13'))
    expect(v.keep).toBe(true)
    if (v.keep) {
      expect(v.kept.url).toBe('https://www.usajobs.gov/job/123')
      expect(v.kept.posting.salaryMin).toBe(90000)
      expect(v.closesAt?.getFullYear()).toBe(2999)
    }
  })
  it('skips announcements that are closed or not open to the public', () => {
    expect(joaToKept({ ...open, positionCloseDate: '2020-01-01' }, new Date('2026-11-13')).keep).toBe(false)
    expect(joaToKept({ ...open, hiringpaths: [{ hiringPath: 'Federal employees - Competitive service' }] }, new Date('2026-11-13')).keep).toBe(false)
  })
})

describe('edjoin and careersingovernment sitemaps', () => {
  it('reads EdJoin job ids (no titles in the sitemap)', async () => {
    const { parseEdjoinSitemap } = await import('@/lib/jobs/edjoin-core')
    expect(parseEdjoinSitemap('<urlset><url><loc>https://www.edjoin.org/Home/JobPosting/459520</loc></url></urlset>')).toEqual([{ id: '459520', url: 'https://www.edjoin.org/Home/JobPosting/459520', title: '' }])
  })
  it('reads CareersInGovernment ids and title slugs', async () => {
    const { parseCigSitemap } = await import('@/lib/jobs/careersingov-core')
    const [job] = parseCigSitemap('<urlset><url><loc>https://www.careersingovernment.com/job/734713/speech-language-pathologist-clinical-fellow/</loc></url><url><loc>https://www.careersingovernment.com/company/1/x/</loc></url></urlset>')
    expect(job).toMatchObject({ id: '734713', title: 'speech language pathologist clinical fellow' })
  })
  it('matches the same job across sources', async () => {
    const { dedupeKey } = await import('@/lib/jobs/gov-feed-core')
    expect(dedupeKey('City of San Jose', 'Building Inspector, Senior')).toBe(dedupeKey('CITY OF SAN JOSE', 'building inspector senior'))
  })
})
