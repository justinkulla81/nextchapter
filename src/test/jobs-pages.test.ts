import { describe, expect, it } from 'vitest'
import { companyRowText, marketHeadline, nextPortfolioStep, splitFirstView, strengthStepHref } from '@/lib/redesign/jobs-pages'

describe('companyRowText', () => {
  it('leads with the first reason and keeps one note', () => {
    expect(companyRowText({ reasons: ['Hiring in your field', 'You know 2 people'], cautions: ['Filed layoffs'] })).toEqual({ reason: 'Hiring in your field', note: 'Filed layoffs' })
  })
  it('never shows a bare label when there is no reason', () => {
    expect(companyRowText({ reasons: [], cautions: [] }).reason).toMatch(/nothing about it stands out/)
    expect(companyRowText(null).reason).toMatch(/target industries/)
  })
})

describe('marketHeadline', () => {
  const base = { marketReady: true, local: 40, remote: 20, national: 300, trendPct: null, placeLabel: 'Boston' }
  it('sizes local plus remote and says what it rests on', () => {
    const h = marketHeadline(base)
    expect(h.headline).toBe('60 jobs fit you in Boston and remote.')
    expect(h.because).toMatch(/live NextChapter job board/)
  })
  it('frames a slower market as a reason to widen', () => {
    expect(marketHeadline({ ...base, trendPct: -0.12 }).because).toMatch(/12% slower.*widening/)
  })
  it('notes a faster market positively', () => {
    expect(marketHeadline({ ...base, trendPct: 0.08 }).because).toMatch(/up 8%/)
  })
  it('handles counts still updating', () => {
    expect(marketHeadline({ ...base, marketReady: false }).headline).toMatch(/counting/)
  })
  it('falls back to national when there is no local count', () => {
    expect(marketHeadline({ ...base, local: null, placeLabel: null }).headline).toBe('300 jobs fit you across the country.')
  })
})

describe('nextPortfolioStep', () => {
  it('starts with the résumé and says why', () => {
    const s = nextPortfolioStep([
      { key: 'hasWorkSample', done: false },
      { key: 'hasResume', done: false },
    ])
    expect(s?.href).toBe('/dashboard/resume')
    expect(s?.why).toMatch(/recruiter/)
  })
  it('moves on once something is done', () => {
    expect(
      nextPortfolioStep([
        { key: 'hasResume', done: true },
        { key: 'hasWorkSample', done: false },
      ])?.href,
    ).toBe('/dashboard/work-samples')
  })
  it('returns null when everything is built', () => {
    expect(nextPortfolioStep([{ key: 'hasResume', done: true }])).toBeNull()
  })
})

describe('strengthStepHref', () => {
  it('sends each missing piece of evidence to where it is added', () => {
    expect(strengthStepHref('Take How I Perform')).toBe('/dashboard/how-i-perform')
    expect(strengthStepHref('Ask for a reference')).toBe('/dashboard/references')
    expect(strengthStepHref('Complete Track Record')).toBe('/dashboard/track-record')
    expect(strengthStepHref('Upload a résumé')).toBe('/dashboard/resume')
  })
})

describe('splitFirstView', () => {
  it('splits a list', () => {
    expect(splitFirstView([1, 2, 3, 4], 2)).toEqual({ shown: [1, 2], rest: [3, 4] })
  })
})
