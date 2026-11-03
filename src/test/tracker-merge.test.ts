import { describe, expect, it } from 'vitest'
import { agreedHeadcount, mergeReported, reportedKind, type LooseNotice } from '@/lib/warn/tracker-merge'

let n = 0
const notice = (o: Partial<LooseNotice> & { employer: string; noticeDate: string }): LooseNotice => ({
  id: `n${++n}`,
  normalizedEmployer: o.employer.toLowerCase().replace(/[^a-z0-9 ]/g, ''),
  companyId: null, employees: null, effectiveDate: null, layoffType: null, sourceUrl: null, publishers: [], country: null, industry: null,
  ...o,
  noticeDate: new Date(`${o.noticeDate}T00:00:00Z`),
})

describe('agreedHeadcount', () => {
  it('takes the figure most reports give', () => {
    expect(agreedHeadcount([300, 300, 19])).toBe(300)
  })
  it('takes the smaller on a tie and ignores missing figures', () => {
    expect(agreedHeadcount([4000, 3000, null])).toBe(3000)
    expect(agreedHeadcount([null, null])).toBeNull()
  })
})

describe('mergeReported', () => {
  it('shows a single report as one unconfirmed line', () => {
    const [m] = mergeReported([notice({ employer: 'Squarespace', noticeDate: '2026-11-01', employees: 300, sourceUrl: 'https://techcrunch.com/a' })])
    expect(m).toMatchObject({ employer: 'Squarespace', employees: 300, sources: 1 })
  })

  it('merges reports of one layoff from different outlets and keeps the agreed figure', () => {
    const merged = mergeReported([
      notice({ employer: 'Squarespace', noticeDate: '2026-11-01', employees: 19, sourceUrl: 'https://ua.news/x' }),
      notice({ employer: 'Squarespace Inc', noticeDate: '2026-11-02', employees: 300, sourceUrl: 'https://techcrunch.com/a' }),
      notice({ employer: 'Squarespace', noticeDate: '2026-11-02', employees: 300, sourceUrl: 'https://theverge.com/b' }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ employees: 300, sources: 3 })
    expect(merged[0].noticeDate.toISOString().slice(0, 10)).toBe('2026-11-01')
    expect(merged[0].sourceUrl).toMatch(/^https:\/\/(techcrunch|theverge)/)
  })

  it('merges two names for one matched company', () => {
    const merged = mergeReported([
      notice({ employer: 'Alaska Airlines', noticeDate: '2026-10-30', companyId: 'c1', employees: 48, sourceUrl: 'https://staradvertiser.com/a' }),
      notice({ employer: 'Alaska Air Group', noticeDate: '2026-10-30', companyId: 'c1', employees: 48, sourceUrl: 'https://seattletimes.com/b' }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].employees).toBe(48)
  })

  it('keeps layoffs by one employer more than 45 days apart separate', () => {
    expect(mergeReported([
      notice({ employer: 'Meta', noticeDate: '2026-06-01', employees: 3600 }),
      notice({ employer: 'Meta', noticeDate: '2026-10-31', employees: 3600 }),
    ])).toHaveLength(2)
  })

  it('does not count a notice\'s own link on top of a named publisher', () => {
    const [m] = mergeReported([notice({ employer: 'Hershey', noticeDate: '2026-10-30', publishers: ['Reuters'], sourceUrl: 'https://news.google.com/rss/articles/a' })])
    expect(m.sources).toBe(1)
  })

  it('counts each Google News link as its own source when no publisher is named', () => {
    const [m] = mergeReported([
      notice({ employer: 'Hershey', noticeDate: '2026-10-30', sourceUrl: 'https://news.google.com/rss/articles/a' }),
      notice({ employer: 'Hershey', noticeDate: '2026-10-30', sourceUrl: 'https://news.google.com/rss/articles/b' }),
    ])
    expect(m.sources).toBe(2)
  })

  it('counts a syndicated copy as the same publisher', () => {
    const [m] = mergeReported([notice({ employer: 'GEICO', noticeDate: '2026-11-02', publishers: ['Reuters', 'Reuters on MSN', 'The Business Journals'] })])
    expect(m.sources).toBe(2)
  })

  it('drops names that are not an employer', () => {
    for (const employer of ['San Francisco HQ', 'N.J. bank', 'Atlanta mortgage lender', 'AT&T and Verizon normalize']) {
      expect(mergeReported([notice({ employer, noticeDate: '2026-10-30' })])).toHaveLength(0)
    }
    // A real name that ends in a common word is kept.
    expect(mergeReported([notice({ employer: 'Fifth Third Bank', noticeDate: '2026-10-30' })])).toHaveLength(1)
  })
})

describe('country and industry', () => {
  it('keeps the first country and industry any report gave', () => {
    const [m] = mergeReported([
      notice({ employer: 'KPMG', noticeDate: '2026-11-01' }),
      notice({ employer: 'KPMG', noticeDate: '2026-11-01', country: 'AU', industry: 'Accounting & Audit' }),
    ])
    expect(m).toMatchObject({ country: 'AU', industry: 'Accounting & Audit' })
  })
})

describe('reportedKind', () => {
  it('keeps the share of staff and an SEC filing type, not the news job\'s wording', () => {
    expect(reportedKind('Reported by 1 publisher (Mashable) — unconfirmed · 50% of staff')).toBe('50% of staff')
    expect(reportedKind('Reported by 2 publishers')).toBeNull()
    expect(reportedKind('SEC 8-K Item 2.05 (restructuring filing) · 12% of staff')).toBe('SEC 8-K Item 2.05 (restructuring filing) · 12% of staff')
    expect(reportedKind(null)).toBeNull()
  })
})
