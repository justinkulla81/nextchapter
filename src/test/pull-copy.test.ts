import { describe, expect, it } from 'vitest'
import { DEFAULT_COPY, LAID_OFF_COPY, pullCopyFor } from '@/lib/capture/pull-copy'

describe('pull copy', () => {
  it('uses the laid-off pain on layoff, unemployment and start pages', () => {
    for (const path of ['/layoffs/this-week', '/layoffs/california', '/unemployment-benefits/ohio', '/start/laid-off']) expect(pullCopyFor(path)).toBe(LAID_OFF_COPY)
  })
  it('falls back to the default for any other page', () => {
    expect(pullCopyFor('/rankings')).toBe(DEFAULT_COPY)
    expect(pullCopyFor('')).toBe(DEFAULT_COPY)
  })
  it('names a pain and a payoff in plain words, with no jargon in the headline or button', () => {
    for (const c of [LAID_OFF_COPY, DEFAULT_COPY, pullCopyFor('/salaries/x'), pullCopyFor('/ai-skills')]) {
      expect(c.headline).toMatch(/\?|\.$/)
      expect(c.sentence).toContain('Free')
      expect(`${c.headline} ${c.button ?? ''}`).not.toMatch(/WARN|Market Reality|Hireability/)
    }
  })
  it('gives a member the payoff in the page\'s own terms, never the registration ask', () => {
    const paths = ['/layoffs', '/salaries/x', '/ai-skills', '/rankings', ...['job-loss-readiness', 'layoff-runway', 'layoff-deadlines', 'unemployment-estimator', 'severance-calculator', 'ai-job-check', 'pay-check', 'salary-converter', 'resume-check', 'resume-job-match'].map((t) => `/tools/${t}`)]
    for (const path of paths) {
      const c = pullCopyFor(path)
      expect(c.member.headline.length).toBeGreaterThan(0)
      expect(c.member.sentence).not.toContain('Free')
      expect(c.member.sentence).toMatch(/\.$/)
      expect(`${c.member.headline} ${c.member.button}`).not.toMatch(/WARN|Market Reality|Hireability|Get my|Start my/)
    }
    // Different pains get different member copy, not one line everywhere.
    expect(new Set(paths.map((p) => pullCopyFor(p).member.headline)).size).toBeGreaterThan(8)
  })
})

describe('organization copy', () => {
  it('never says "Talk to us", names a pain or a payoff, and makes no price or result claim', async () => {
    const { ORG_COPY, ORG_LAYOFF_COPY, ORG_FREE_WORKFORCE, ORG_FREE_NONPROFIT, ORG_FREE_COLLEGE } = await import('@/lib/capture/pull-copy')
    for (const c of [ORG_COPY, ORG_LAYOFF_COPY, ORG_FREE_WORKFORCE, ORG_FREE_NONPROFIT, ORG_FREE_COLLEGE]) {
      expect(c.org).toBe(true)
      expect(c.button).not.toMatch(/talk to us/i)
      expect(c.button).toMatch(/^Start here/)
      expect(`${c.headline} ${c.sentence}`).not.toMatch(/WARN|placement rate|faster|\$|price|cost/i)
    }
  })
  it('says free only where an organization really gets a free workspace, and starts the claim there', async () => {
    const { ORG_COPY, ORG_LAYOFF_COPY, ORG_FREE_WORKFORCE, ORG_FREE_NONPROFIT, ORG_FREE_COLLEGE } = await import('@/lib/capture/pull-copy')
    expect(ORG_FREE_WORKFORCE.button).toBe('Start here, free')
    expect([ORG_FREE_WORKFORCE.href, ORG_FREE_NONPROFIT.href, ORG_FREE_COLLEGE.href]).toEqual(['/government-workforce#claim', '/nonprofits#claim', '/higher-education#claim'])
    for (const c of [ORG_COPY, ORG_LAYOFF_COPY]) expect(`${c.headline} ${c.sentence} ${c.button}`).not.toMatch(/free/i)
    expect(ORG_LAYOFF_COPY.href).toBe('/outplacement')
  })
  it('picks the copy from the start of the page slug', async () => {
    const { ORG_COPY, ORG_LAYOFF_COPY, ORG_FREE_WORKFORCE, ORG_FREE_NONPROFIT, ORG_FREE_COLLEGE, orgCopyForSlug } = await import('@/lib/capture/pull-copy')
    for (const s of ['workforce-boards-ohio', 'job-centers-ohio-x', 'economic-development-texas', 'rapid-response-ohio']) expect(orgCopyForSlug(s)).toBe(ORG_FREE_WORKFORCE)
    expect(orgCopyForSlug('nonprofits-ohio')).toBe(ORG_FREE_NONPROFIT)
    expect(orgCopyForSlug('higher-education-ohio')).toBe(ORG_FREE_COLLEGE)
    expect(orgCopyForSlug('tools-warn-act-checker')).toBe(ORG_LAYOFF_COPY)
    expect(orgCopyForSlug('search-firms-x')).toBe(ORG_COPY)
  })
})
