import { describe, expect, it } from 'vitest'
import {
  companyRowText,
  hiringSignalText,
  marketHeadline,
  nextPortfolioStep,
  offerClaimStatusText,
  payPositionText,
  portfolioAssetRows,
  shortMoney,
  splitFirstView,
  strengthStepHref,
} from '@/lib/redesign/jobs-pages'

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

describe('shortMoney', () => {
  it('rounds thousands and keeps small amounts whole', () => {
    expect(shortMoney(245000)).toBe('$245k')
    expect(shortMoney(950)).toBe('$950')
  })
})

describe('payPositionText', () => {
  const base = { pay: 245000, shareBelow: 0.62, role: 'Director of Operations', place: 'Massachusetts', p25: 190000, p50: 232000, p75: 285000 }
  it('gives one headline with the share and the place', () => {
    expect(payPositionText(base).headline).toBe('Your pay of $245k is above about 62% of advertised salaries for Director of Operations in Massachusetts.')
  })
  it('says it is an estimate in words and gives the range', () => {
    const t = payPositionText(base)
    expect(t.because).toMatch(/middle half runs \$190k to \$285k/)
    expect(t.because).toMatch(/estimate/)
  })
  it('falls back to the US and a softer headline when the share is unknown', () => {
    const t = payPositionText({ ...base, shareBelow: null, place: null, p25: null, p50: null, p75: null })
    expect(t.headline).toBe('Your pay of $245k sits among advertised salaries for Director of Operations in the US.')
    expect(t.because).not.toMatch(/middle half/)
  })
})

describe('hiringSignalText', () => {
  const base = { openRolesTotal: 12, openRolesDirectorPlus: 3, rolesDelta12wk: 4, trajectory: 'growing', medianPostingAgeDays: 40, topFunctions: ['Operations', 'Finance'] }
  it('gives a verdict and the fact it rests on, and says it is not about layoffs', () => {
    const t = hiringSignalText(base)
    expect(t.headline).toBe('Hiring more than it was.')
    expect(t.because).toBe('12 open roles, 3 at director level and above, up 50% in 12 weeks. Based on posting activity only, not layoff filings.')
  })
  it('keeps at most two follow-up lines and explains a long posting age', () => {
    const t = hiringSignalText({ ...base, medianPostingAgeDays: 120 })
    expect(t.facts).toHaveLength(2)
    expect(t.facts[1]).toMatch(/slow process, not a bad one/)
  })
  it('handles a contracting, flat or empty change', () => {
    expect(hiringSignalText({ ...base, trajectory: 'contracting', rolesDelta12wk: -3 }).headline).toBe('Hiring less than it was.')
    expect(hiringSignalText({ ...base, trajectory: 'flat', rolesDelta12wk: 0 }).because).not.toMatch(/weeks/)
    expect(hiringSignalText({ ...base, openRolesTotal: 1, openRolesDirectorPlus: 0, rolesDelta12wk: 0 }).because).toMatch(/^1 open role\./)
  })
})

describe('offerClaimStatusText', () => {
  it('has plain words for each status, with no emoji', () => {
    for (const s of ['PENDING', 'APPROVED', 'REJECTED', 'OTHER']) {
      const t = offerClaimStatusText(s)
      expect(t.heading.length).toBeGreaterThan(0)
      expect(`${t.heading} ${t.body}`).not.toMatch(/\p{Extended_Pictographic}/u)
    }
    expect(offerClaimStatusText('APPROVED').body).toMatch(/\$500/)
  })
})

describe('portfolioAssetRows', () => {
  const none = { resumeName: null, resumeVersions: 0, coverLetters: 0, narratives: 0, workSamples: 0, completedReferences: 0, credentials: 0 }
  it('says why each missing asset is worth having and what to do', () => {
    const rows = portfolioAssetRows(none)
    expect(rows).toHaveLength(6)
    for (const r of rows) {
      expect(r.done).toBe(false)
      expect(r.why).toBeTruthy()
      expect(r.href.startsWith('/dashboard/')).toBe(true)
    }
    expect(rows[0]).toMatchObject({ key: 'resume', actionLabel: 'Upload your résumé' })
  })
  it('drops the reason once an asset exists and counts what is there', () => {
    const rows = portfolioAssetRows({ ...none, resumeName: 'cv.pdf', resumeVersions: 3, completedReferences: 2, workSamples: 1 })
    expect(rows[0]).toMatchObject({ done: true, why: null, status: 'cv.pdf, 3 versions' })
    expect(rows.find((r) => r.key === 'references')?.status).toBe('2 of 3 completed.')
    expect(rows.find((r) => r.key === 'samples')?.status).toBe('1 sample uploaded.')
  })
})
