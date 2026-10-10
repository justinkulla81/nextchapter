import { describe, it, expect } from 'vitest'
import { summarizePay, isPlausibleAnnualRange } from '@/lib/companies/pay-ranges'
import { buildLayoffTimeline } from '@/lib/companies/layoff-timeline'
import { detectAts, dominantAts, summarizeHowToApply } from '@/lib/companies/how-to-apply'
import { classifyContactForMember } from '@/lib/jobs/contact-role'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'

const day = (n: number) => new Date(Date.UTC(2026, 6, 1) + n * 86_400_000)

describe('pay ranges', () => {
  const p = (title: string, min: number | null, max: number | null, cur: string | null = 'USD') => ({ title, salaryMin: min, salaryMax: max, salaryCurrency: cur })

  it('groups by level and function and reports medians with the count behind them', () => {
    const groups = summarizePay([
      p('Director of Finance', 180_000, 220_000),
      p('Director of Finance', 200_000, 250_000),
      p('Director of Finance', 190_000, 240_000),
      p('Marketing Manager', 110_000, 140_000),
    ])
    const dir = groups.find((g) => g.level === 'Director')!
    expect(dir.postings).toBe(3)
    expect(dir.medianMin).toBe(190_000)
    expect(dir.medianMax).toBe(240_000)
    expect(dir.lowest).toBe(180_000)
    expect(dir.highest).toBe(250_000)
    expect(groups[0].level).toBe('Director') // senior first
  })

  it('excludes ranges that are not plausible annual USD salaries', () => {
    expect(isPlausibleAnnualRange(p('X', 45, 60))).toBe(false) // hourly
    expect(isPlausibleAnnualRange(p('X', 5_000, 9_000))).toBe(false) // monthly
    expect(isPlausibleAnnualRange(p('X', 200_000, 150_000))).toBe(false) // inverted
    expect(isPlausibleAnnualRange(p('X', 100_000, 150_000, 'EUR'))).toBe(false)
    expect(isPlausibleAnnualRange(p('X', null, 150_000))).toBe(false)
    expect(isPlausibleAnnualRange(p('X', 100_000, 150_000))).toBe(true)
    expect(summarizePay([p('Director', 45, 60)])).toEqual([])
  })
})

describe('layoff timeline', () => {
  const notice = (n: number, employees: number | null = 100) => ({ noticeDate: day(n), employees, layoffType: null, sourceUrl: null })
  const posting = (n: number, fn: string | null) => ({ createdAt: day(n), function: fn })

  it('says a company is hiring again once it has posted several roles since the cut', () => {
    const t = buildLayoffTimeline({
      notices: [notice(10)],
      postings: [posting(20, 'Sales'), posting(25, 'Sales'), posting(30, 'Engineering'), posting(5, 'Finance')],
      trackingStart: day(0),
      now: day(100),
    })
    expect(t.status).toBe('hiring_again')
    expect(t.events[0].postedSince).toBe(3) // the posting before the notice is not "since"
    expect(t.events[0].topFunctionsSince[0]).toBe('Sales')
  })

  it('calls a cut with little hiring after it recent or quiet by age', () => {
    expect(buildLayoffTimeline({ notices: [notice(90)], postings: [], trackingStart: day(0), now: day(100) }).status).toBe('recent_cut')
    expect(buildLayoffTimeline({ notices: [notice(10)], postings: [], trackingStart: day(0), now: day(200) }).status).toBe('quiet')
  })

  it('does not imply nothing was posted when the notice predates our tracking', () => {
    const t = buildLayoffTimeline({ notices: [notice(2)], postings: [posting(30, 'Sales')], trackingStart: day(10), now: day(100) })
    expect(t.status).toBe('before_tracking')
    expect(t.events[0].postedSince).toBeNull()
  })

  it('reports none with no notices, and totals the people affected', () => {
    expect(buildLayoffTimeline({ notices: [], postings: [], trackingStart: day(0) }).status).toBe('none')
    expect(buildLayoffTimeline({ notices: [notice(1, 50), notice(2, 70)], postings: [], trackingStart: day(0), now: day(5) }).totalEmployees).toBe(120)
  })
})

describe('how to apply', () => {
  it('reads the ATS from the posting URL host, exactly', () => {
    expect(detectAts('https://boards.greenhouse.io/acme/jobs/123')?.name).toBe('Greenhouse')
    expect(detectAts('https://jobs.lever.co/acme/abc')?.name).toBe('Lever')
    expect(detectAts('https://acme.wd5.myworkdayjobs.com/en-US/careers/job/1')?.name).toBe('Workday')
    expect(detectAts('https://jobs.ashbyhq.com/acme/1')?.name).toBe('Ashby')
  })
  it('does not guess for an unknown or malformed URL, or a lookalike host', () => {
    expect(detectAts('https://acme.com/careers/12')).toBeNull()
    expect(detectAts('https://greenhouse.io.evil.com/x')).toBeNull()
    expect(detectAts('not a url')).toBeNull()
    expect(detectAts(null)).toBeNull()
  })
  it('picks the system most of a company\'s postings use', () => {
    const d = dominantAts(['https://boards.greenhouse.io/a/1', 'https://boards.greenhouse.io/a/2', 'https://jobs.lever.co/a/3'])
    expect(d?.info.name).toBe('Greenhouse')
    expect(d?.postings).toBe(2)
  })
  it('summarises time open, backing and recruiter-led searches', () => {
    const now = day(100)
    const f = summarizeHowToApply(
      [
        { url: 'https://boards.greenhouse.io/a/1', createdAt: day(80), badges: ['PE-backed'], postingType: 'direct', sourceCategory: 'employer' },
        { url: 'https://boards.greenhouse.io/a/2', createdAt: day(90), badges: [], postingType: 'recruiter_search', sourceCategory: 'search_firm' },
      ],
      now
    )
    expect(f.medianDaysOpen).toBe(15)
    expect(f.backing).toBe('PE-backed')
    expect(f.recruiterLedSearches).toBe(1)
    expect(f.ats?.info.name).toBe('Greenhouse')
  })
})

describe('classifyContactForMember', () => {
  it('counts a recruiter, and a leader in one of the member\'s own functions', () => {
    expect(classifyContactForMember({ contactTitle: 'Senior Recruiter', memberFunctions: ['Finance'] })).toBe('recruiter')
    expect(classifyContactForMember({ contactTitle: 'VP of Finance', memberFunctions: ['Finance'] })).toBe('hiring_manager')
  })
  it('does not count a leader in an unrelated function, or a junior person', () => {
    expect(classifyContactForMember({ contactTitle: 'VP of Marketing', memberFunctions: ['Finance'] })).toBeNull()
    expect(classifyContactForMember({ contactTitle: 'Financial Analyst', memberFunctions: ['Finance'] })).toBeNull()
    expect(classifyContactForMember({ contactTitle: null, memberFunctions: ['Finance'] })).toBeNull()
  })
})

describe('finance titles (about 1,600 live jobs had no function)', () => {
  it('reads finance leadership titles as Finance', () => {
    for (const t of ['Head of Finance', 'Director of Finance', 'VP of Finance', 'Vice President, Finance', 'Finance Director', 'Senior Manager, Strategic Finance', 'Financial Reporting Manager']) {
      expect(inferFunctionFromTitle(t), t).toBe('Finance')
    }
  })
  it('keeps the more specific function when finance is only context', () => {
    expect(inferFunctionFromTitle('Finance Systems Engineer')).toBe('Engineering')
    expect(inferFunctionFromTitle('Sales Manager, Financial Services')).toBe('Sales')
    expect(inferFunctionFromTitle('Marketing Manager, Finance')).toBe('Marketing')
    expect(inferFunctionFromTitle('Chief Financial Officer')).toBe('Executive Leadership')
  })
  it('does not call a bank branch or a financial advisor the finance function', () => {
    expect(inferFunctionFromTitle('Financial Center Manager')).toBeNull()
    expect(inferFunctionFromTitle('Market Financial Center Manager')).toBeNull()
    expect(inferFunctionFromTitle('Financial Advisor')).toBeNull()
  })
})

