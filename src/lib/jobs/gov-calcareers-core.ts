import { decodeEntities, htmlToText, type FeedPosting, type SitemapJob } from '@/lib/jobs/gov-feed-core'

// State of California jobs from CalCareers (calcareers.ca.gov). The search is a script-driven grid with no list a crawler
// can read, but every posting has a page at JobPosting.aspx?JobControlId=<number>, ids rise over time, and a page for an id
// that is not a live posting is small and has no job title. So the feed visits the ids above the highest one on the board.
// Postings close on their final filing date, which is when the board row expires. No database access here.

export const CALCAREERS_URL_PREFIX = 'https://www.calcareers.ca.gov/CalHrPublic/Jobs/JobPosting.aspx?JobControlId='

export function calcareersJobs(fromId: number, count: number): SitemapJob[] {
  return Array.from({ length: count }, (_, i) => {
    const id = String(fromId + i)
    return { id, url: `${CALCAREERS_URL_PREFIX}${id}`, title: '' }
  })
}

function span(page: string, id: string): string | null {
  const m = new RegExp(`<span[^>]*id="${id}"[^>]*>([\\s\\S]*?)</span>`).exec(page)
  return m ? decodeEntities(m[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() : null
}

/** A CalCareers posting page as a posting; null for an id that is not a live posting. */
export function parseCalCareers(page: string): FeedPosting | null {
  const title = span(page, 'lblWorkingTitle') ?? span(page, 'lblWorkingTitleHeader')
  if (!title) return null
  const dept = span(page, 'lblDepartmentName')
  const county = span(page, 'lblWorkLocation')
  const salary = span(page, 'lblPrimarySalary') ?? ''
  const range = /\$\s?([\d,]+(?:\.\d+)?)\s*-\s*\$\s?([\d,]+(?:\.\d+)?)\s*(?:per\s+)?(month|year|hour)?/i.exec(salary)
  const factor = range ? ({ month: 12, year: 1, hour: 0 } as Record<string, number>)[(range[3] ?? 'year').toLowerCase()] ?? 0 : 0
  const min = range ? Number(range[1].replace(/,/g, '')) * factor : 0
  const max = range ? Number(range[2].replace(/,/g, '')) * factor : 0
  const filing = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(span(page, 'lblFinalFilingDate') ?? '')
  const closes = filing ? new Date(Date.UTC(Number(filing[3]), Number(filing[1]) - 1, Number(filing[2]), 23, 59, 59)) : null
  const start = page.indexOf('Job Description and Duties')
  const description = [
    span(page, 'lblPrimaryClassification') && `Classification: ${span(page, 'lblPrimaryClassification')}`,
    span(page, 'lblJobType') && `Job type: ${span(page, 'lblJobType')}`,
    span(page, 'lblTelework') && `Work setting: ${span(page, 'lblTelework')}`,
    start >= 0 ? htmlToText(page.slice(start, start + 12_000)) : '',
  ].filter(Boolean).join('\n')
  const type = span(page, 'lblJobType') ?? ''
  return {
    title,
    employer: dept ? `State of California, ${dept}` : 'State of California',
    location: county ? `${county.replace(/\s*County$/i, ' County')}, CA` : 'California',
    state: 'CA',
    description,
    postedAt: null,
    employmentType: /full/i.test(type) ? 'full_time' : /part/i.test(type) ? 'part_time' : null,
    salaryMin: min >= 25_000 ? Math.round(min) : null,
    salaryMax: max >= 25_000 ? Math.round(max) : null,
    closesAt: closes,
  }
}
