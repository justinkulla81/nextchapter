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
