import { describe, expect, it } from 'vitest'
import { landingHeadline, landingVariant, pickVicPhoto, Q1, VIC_PHOTOS } from '@/lib/layoffs/landing'
import { PERSONAS } from '@/lib/constants/personas'

describe('company page landing helpers', () => {
  it('picks the page version: a recent buyout wins, then any layoff, otherwise neither', () => {
    expect(landingVariant({ hasRecentBuyout: true, hasNoticesOrLayoffReport: true })).toBe('buyout')
    expect(landingVariant({ hasRecentBuyout: false, hasNoticesOrLayoffReport: true })).toBe('layoff')
    expect(landingVariant({ hasRecentBuyout: false, hasNoticesOrLayoffReport: false })).toBe('neither')
  })

  it('writes plain headlines and only says "filed" when a WARN notice exists', () => {
    expect(landingHeadline('buyout', 'Microsoft', null)).toBe('Microsoft is offering buyouts. Here is how to decide, and what to do either way.')
    expect(landingHeadline('layoff', 'Microsoft', 277)).toBe('Microsoft filed layoffs for 277 workers. Here is what to do this week.')
    expect(landingHeadline('layoff', 'Microsoft', null, false)).toBe('Microsoft layoffs have been reported. Here is what to do this week.')
    expect(landingHeadline('neither', 'Costco', null)).toBe('Thinking about your next move from Costco? Start by seeing what is out there.')
  })

  it('keeps the same photo for a company every time, and varies across companies', () => {
    expect(pickVicPhoto('microsoft')).toBe(pickVicPhoto('microsoft'))
    const seen = new Set(['microsoft', 'amazon', 'intel', 'salesforce', 'boeing', 'tiktok', 'meta', 'oracle', 'ibm', 'cisco'].map((s) => pickVicPhoto(s).src))
    expect(seen.size).toBeGreaterThan(2)
    for (const p of VIC_PHOTOS) expect(p.src).toMatch(/^\/marketing\/vic-.*\.webp$/)
  })

  it('maps every answer to a real journey', () => {
    const slugs = new Set(PERSONAS.map((p) => p.slug))
    for (const answers of Object.values(Q1)) for (const a of answers) expect(slugs.has(a.persona)).toBe(true)
  })
})
