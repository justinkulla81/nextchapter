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

describe('organization copy', () => {
  it('names a pain and a payoff, keeps Talk to us, and makes no placement, speed or price claim', async () => {
    const { ORG_COPY, ORG_LAYOFF_COPY, orgCopyForSlug } = await import('@/lib/capture/pull-copy')
    for (const c of [ORG_COPY, ORG_LAYOFF_COPY]) {
      expect(c.org).toBe(true)
      expect(c.headline).toMatch(/\?$/)
      expect(c.button).toBe('Talk to us')
      expect(`${c.headline} ${c.sentence}`).not.toMatch(/WARN|placement rate|faster|free|\$|price|cost/i)
    }
    expect(orgCopyForSlug('rapid-response-ohio')).toBe(ORG_LAYOFF_COPY)
    expect(orgCopyForSlug('tools-warn-notice-generator')).toBe(ORG_LAYOFF_COPY)
    expect(orgCopyForSlug('workforce-boards-ohio')).toBe(ORG_COPY)
  })
})
