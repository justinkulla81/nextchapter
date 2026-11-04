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
})
