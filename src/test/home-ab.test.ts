import { describe, expect, it } from 'vitest'
import { HOME_AB_VARIANT_PATH, decideHomeVariant, homeAbOn, homeAbStamp, isHomePath, readHomeVariant, visitorsPerArm } from '@/lib/home-ab'
import { APP_TOP_LEVEL } from '@/lib/app-top-level'

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

describe('homeAbOn (the kill switch)', () => {
  it('runs unless HOME_AB is off', () => {
    expect(homeAbOn(undefined)).toBe(true)
    expect(homeAbOn('')).toBe(true)
    expect(homeAbOn('on')).toBe(true)
    expect(homeAbOn('off')).toBe(false)
    expect(homeAbOn(' OFF ')).toBe(false)
  })
})

describe('decideHomeVariant', () => {
  const base = { cookie: undefined, userAgent: CHROME, enabled: true }
  it('assigns a new person 50/50 and asks for the cookie', () => {
    expect(decideHomeVariant({ ...base, random: () => 0.1 })).toEqual({ variant: 'a', assign: true })
    expect(decideHomeVariant({ ...base, random: () => 0.49 })).toEqual({ variant: 'a', assign: true })
    expect(decideHomeVariant({ ...base, random: () => 0.5 })).toEqual({ variant: 'b', assign: true })
    expect(decideHomeVariant({ ...base, random: () => 0.99 })).toEqual({ variant: 'b', assign: true })
  })
  it('keeps the variant a cookie holds, and does not set the cookie again', () => {
    expect(decideHomeVariant({ ...base, cookie: 'b', random: () => 0 })).toEqual({ variant: 'b', assign: false })
    expect(decideHomeVariant({ ...base, cookie: 'a', random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
  })
  it('replaces a cookie value it does not know', () => {
    expect(decideHomeVariant({ ...base, cookie: 'c', random: () => 0.9 })).toEqual({ variant: 'b', assign: true })
  })
  it('gives bots, crawlers and unknown clients the control and never a cookie', () => {
    expect(decideHomeVariant({ ...base, userAgent: GOOGLEBOT, random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
    expect(decideHomeVariant({ ...base, userAgent: GOOGLEBOT, cookie: 'b' })).toEqual({ variant: 'a', assign: false })
    expect(decideHomeVariant({ ...base, userAgent: null, random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
    expect(decideHomeVariant({ ...base, userAgent: 'curl/8.4.0', random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
  })
  it('gives a signed-in member the control, untouched', () => {
    expect(decideHomeVariant({ ...base, hasSession: true, cookie: 'b', random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
  })
  it('sends everyone to the control when the test is off, even people already assigned to B', () => {
    expect(decideHomeVariant({ ...base, enabled: false, cookie: 'b', random: () => 0.9 })).toEqual({ variant: 'a', assign: false })
  })
  it('splits close to evenly', () => {
    let b = 0
    const n = 2000
    for (let i = 0; i < n; i++) if (decideHomeVariant({ ...base, random: () => i / n }).variant === 'b') b++
    expect(b).toBe(1000)
  })
})

describe('the stamp on a homepage view', () => {
  it('records the variant of an assigned visitor', () => {
    expect(homeAbStamp('a', true)).toBe('ab:home:a')
    expect(homeAbStamp('b', true)).toBe('ab:home:b')
  })
  it('records nothing for an unassigned visitor, a bad value, or when the test is off', () => {
    expect(homeAbStamp(undefined, true)).toBeNull()
    expect(homeAbStamp('x', true)).toBeNull()
    expect(homeAbStamp('b', false)).toBeNull()
  })
  it('only the homepage counts, with or without a query string', () => {
    expect(isHomePath('/')).toBe(true)
    expect(isHomePath('/?utm_source=x')).toBe(true)
    expect(isHomePath('/jobs')).toBe(false)
    expect(isHomePath(null)).toBe(false)
  })
  it('reads only a and b', () => {
    expect(readHomeVariant('a')).toBe('a')
    expect(readHomeVariant('b')).toBe('b')
    expect(readHomeVariant('B')).toBeNull()
    expect(readHomeVariant(undefined)).toBeNull()
  })
})

describe('the variant route', () => {
  it('is a top-level folder the proxy knows', () => {
    expect(APP_TOP_LEVEL.has(HOME_AB_VARIANT_PATH.split('/')[1])).toBe(true)
  })
})

describe('visitorsPerArm', () => {
  it('needs hundreds per arm to see a doubling of a 9% rate', () => {
    const n = visitorsPerArm(0.09)
    expect(n).toBeGreaterThan(150)
    expect(n).toBeLessThan(400)
  })
  it('needs thousands per arm for a rare event like a 0.3% email rate', () => {
    expect(visitorsPerArm(0.003)).toBeGreaterThan(3000)
  })
  it('is unbounded when there is nothing to detect', () => {
    expect(visitorsPerArm(0)).toBe(Infinity)
    expect(visitorsPerArm(0.1, 0)).toBe(Infinity)
  })
})
