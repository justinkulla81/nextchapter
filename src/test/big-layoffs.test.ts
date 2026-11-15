import { describe, expect, it } from 'vitest'
import { bigLayoffs } from '@/lib/seo/fresh-links'

const NOW = Date.parse('2026-11-13T12:00:00Z')
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('bigLayoffs', () => {
  it('lists cuts of 1,000+ in the last week, largest first, with the number', () => {
    const out = bigLayoffs(
      [
        { slug: 'acme', employer: 'Acme', noticeDate: '2026-11-10', workers: 600 },
        { slug: 'acme', employer: 'Acme', noticeDate: '2026-11-11', workers: 500 },
        { slug: 'small', employer: 'Small Co', noticeDate: '2026-11-12', workers: 40 },
        { slug: 'old', employer: 'Old', noticeDate: '2026-10-01', workers: 5000 },
      ],
      [{ slug: 'cognizant', name: 'Cognizant', items: [{ date: day('2026-11-11'), workers: 15000 }] }],
      NOW,
    )
    expect(out.map((l) => l.label)).toEqual(['Cognizant layoffs: 15,000 jobs', 'Acme layoffs: 1,100 jobs'])
    expect(out[0].href).toBe('/layoffs/company/cognizant')
  })
  it('keeps the larger of a filing and a press report for the same company, never their sum', () => {
    const out = bigLayoffs([{ slug: 'x', employer: 'X', noticeDate: '2026-11-12', workers: 1200 }], [{ slug: 'x', name: 'X', items: [{ date: day('2026-11-12'), workers: 1000 }] }], NOW)
    expect(out[0].label).toBe('X layoffs: 1,200 jobs')
  })
  it('leaves out a single unconfirmed report', () => {
    const out = bigLayoffs([], [{ slug: 'v', name: 'Voestalpine', items: [{ date: day('2026-11-12'), workers: 150000, summary: 'Reported by 1 publisher (ad-hoc-news.de) — unconfirmed' }] }], NOW)
    expect(out).toEqual([])
  })
})
