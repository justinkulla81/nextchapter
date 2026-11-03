import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { rankingImage } from '@/lib/rankings/art'
import { rankingCapture } from '@/lib/rankings/capture'
import { captureSource } from '@/lib/capture/page-capture'
import type { RankingIndexEntry } from '@/lib/rankings/types'

const e = (slug: string, extra: Partial<RankingIndexEntry> = {}) => ({ slug, measure: 'junior' as const, scopeKind: 'national' as const, scopeId: 'us', scopeName: 'United States', family: 'Entry-level', ...extra })
const onDisk = (url: string) => fs.existsSync(path.join(process.cwd(), 'public', url))

describe('ranking pictures', () => {
  const entries = [
    e('best-cities-for-marketing-jobs', { measure: 'fnopen', family: 'Job families' }),
    e('best-cities-for-technology-jobs', { measure: 'icopen', family: 'Industry markets' }),
    e('best-cities-for-consumer-and-retail-pay-vs-cost-of-living', { measure: 'icpay', family: 'Industry markets' }),
    e('colleges-with-the-highest-earnings', { measure: 'collegepay', family: 'Higher education' }),
    e('most-requested-ai-skills', { measure: 'aiskills', family: 'AI skills' }),
    e('best-cities-for-junior-jobs-in-the-southwest', { scopeKind: 'region', scopeId: 'southwest' }),
    e('best-cities-for-junior-jobs-in-new-england', { scopeKind: 'region', scopeId: 'new-england' }),
    e('best-cities-for-junior-jobs-in-texas', { scopeKind: 'state', scopeId: 'texas' }),
    e('best-cities-for-junior-jobs'),
  ]
  it('always gives a picture that exists', () => {
    expect(entries.map((x) => rankingImage(x)).filter((u) => !onDisk(u))).toEqual([])
  })
  it('uses the family, industry and region pictures where there is one', () => {
    expect(rankingImage(entries[0])).toBe('/images/topics/function-marketing.webp')
    expect(rankingImage(entries[1])).toBe('/images/topics/industry-technology-and-software.webp')
    expect(rankingImage(entries[2])).toBe('/images/topics/industry-retail-and-e-commerce.webp')
    expect(rankingImage(entries[5])).toBe('/images/topics/place-region-southwest.webp')
    expect(rankingImage(entries[0])).toBe(rankingImage(entries[0]))
  })
})

describe('ranking lead capture', () => {
  it('saves the search the page is about', () => {
    expect(rankingCapture(e('best-cities-for-marketing-jobs', { measure: 'fnopen', family: 'Job families' }))).toMatchObject({ kind: 'ranking', label: 'marketing', save: { q: 'marketing', loc: '' } })
    expect(rankingCapture(e('best-cities-for-junior-jobs-in-texas', { scopeKind: 'state', scopeName: 'Texas' }))).toMatchObject({ label: 'entry-level', save: { q: 'entry level', loc: 'Texas' } })
    expect(rankingCapture(e('best-cities-for-technology-jobs', { measure: 'icopen', family: 'Industry markets' }))).toMatchObject({ label: 'technology', save: { q: 'technology' } })
    expect(rankingCapture(e('lowest-unemployment', { measure: 'lowunemp', family: 'Workforce' }))).toMatchObject({ label: 'professional' })
  })
  it('builds a source the lead actions accept', () => {
    const src = captureSource(rankingCapture(e('best-cities-for-junior-jobs')))
    expect(src).toBe('page:ranking:best-cities-for-junior-jobs')
    expect(/^page:(state|county|city|industry|title|company|college|ranking):[a-z0-9-]{1,70}$/.test(src)).toBe(true)
  })
})
