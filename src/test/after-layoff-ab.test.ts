import { describe, expect, it } from 'vitest'
import { APP_TOP_LEVEL } from '@/lib/app-top-level'
import { AFTER_LAYOFF_PATH, AFTER_LAYOFF_VARIANT_PATH, afterLayoffAbOn, decideAfterLayoffVariant } from '@/lib/after-layoff-ab'
import { AFTER_LAYOFF_A, AFTER_LAYOFF_B, LANDING_SEO, LAYOFF_CLOCKS, STILL_SEARCHING } from '@/lib/marketing/candidate-landing'
import { getPersona } from '@/lib/constants/personas'

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

describe('after-a-layoff test assignment', () => {
  const base = { cookie: undefined, userAgent: CHROME, enabled: true }
  it('runs unless AFTER_LAYOFF_AB is off', () => {
    expect(afterLayoffAbOn(undefined)).toBe(true)
    expect(afterLayoffAbOn('off')).toBe(false)
    expect(afterLayoffAbOn(' OFF ')).toBe(false)
  })
  it('assigns a new person 50/50 and keeps the variant a cookie holds', () => {
    expect(decideAfterLayoffVariant({ ...base, random: () => 0.2 })).toEqual({ variant: 'a', assign: true })
    expect(decideAfterLayoffVariant({ ...base, random: () => 0.8 })).toEqual({ variant: 'b', assign: true })
    expect(decideAfterLayoffVariant({ ...base, cookie: 'b', random: () => 0 })).toEqual({ variant: 'b', assign: false })
  })
  it('gives bots, signed-in members and the kill switch version A with no cookie', () => {
    expect(decideAfterLayoffVariant({ ...base, userAgent: GOOGLEBOT, random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
    expect(decideAfterLayoffVariant({ ...base, hasSession: true, cookie: 'b' })).toEqual({ variant: 'a', assign: false })
    expect(decideAfterLayoffVariant({ ...base, enabled: false, cookie: 'b', random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
  })
  it('lists the new routes the proxy needs to know', () => {
    expect(APP_TOP_LEVEL.has('after-a-layoff')).toBe(true)
    expect(APP_TOP_LEVEL.has('still-searching')).toBe(true)
    expect(APP_TOP_LEVEL.has(AFTER_LAYOFF_VARIANT_PATH.split('/')[1])).toBe(true)
    expect(AFTER_LAYOFF_PATH).toBe('/after-a-layoff')
  })
})

describe('candidate landing copy', () => {
  it('differs between the two versions only in the opening', () => {
    expect(AFTER_LAYOFF_A.headline).not.toBe(AFTER_LAYOFF_B.headline)
    expect(AFTER_LAYOFF_A.cta).not.toBe(AFTER_LAYOFF_B.cta)
    expect({ ...AFTER_LAYOFF_A, headline: '', subhead: '', cta: '', variant: 'a' }).toEqual({ ...AFTER_LAYOFF_B, headline: '', subhead: '', cta: '', variant: 'a' })
  })
  it('uses personas that exist, writes the button as an action and quotes no amount of money', () => {
    for (const c of [AFTER_LAYOFF_A, AFTER_LAYOFF_B, STILL_SEARCHING]) {
      expect(getPersona(c.persona), c.persona).toBeTruthy()
      expect(c.cta).toMatch(/^(Get|See|Show) /)
      for (const s of [c.headline, c.subhead, ...c.tiles.map((t) => t.body), ...c.faq.map((f) => f.a)]) expect(s).not.toMatch(/\$\s*\d/)
    }
    expect(LAYOFF_CLOCKS).toHaveLength(4)
  })
  it('keeps the page titles and descriptions inside search limits', () => {
    for (const seo of Object.values(LANDING_SEO)) {
      expect(seo.title.length).toBeLessThanOrEqual(100)
      expect(seo.description.length).toBeGreaterThan(60)
      expect(seo.description.length).toBeLessThanOrEqual(200)
    }
  })
})
