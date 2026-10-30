import { describe, expect, it } from 'vitest'
import { buildAiJobsIndex, editionOf, indexCitation, indexCsv, indexJsonLd, MIN_OPENINGS_RANKED } from '@/lib/ai-index/build'
import type { ExposureMap } from '@/lib/skills/ai-exposure'

const map: ExposureMap = new Map([
  ['15-1252', { title: 'Software Developers', score: 0.45 }],
  ['11-2021', { title: 'Marketing Managers', score: 0.2 }],
  ['29-1141', { title: 'Registered Nurses, "Staff"', score: 0.02 }],
  ['23-1011', { title: 'Lawyers', score: 0.35 }],
])
const openings = new Map([['15-1252', 1000], ['11-2021', 500], ['29-1141', 50], ['23-1011', 120], ['99-9999', 70]])

describe('AI Jobs Index', () => {
  const idx = buildAiJobsIndex({ map, openingsBySoc: openings, market: null, today: '2026-10-30' })
  it('names the edition from the as-of date', () => {
    expect(editionOf('2026-10-30')).toBe('October 2026')
    expect(idx.edition).toBe('October 2026')
  })
  it('ranks exposed occupations that are hiring, and leaves out thin ones', () => {
    expect(idx.mostExposedHiring.map((r) => r.soc6)).toEqual(['15-1252', '11-2021'])
    expect(idx.mostExposedHiring.every((r) => r.openings >= MIN_OPENINGS_RANKED)).toBe(true)
    expect(idx.mostOpenings[0].soc6).toBe('15-1252')
  })
  it('splits openings by band and shows coverage', () => {
    expect(idx.split?.counts).toEqual({ high: 1120, some: 500, little: 50 })
    expect(idx.split?.coverage).toBeCloseTo(1670 / 1740)
  })
  it('writes one CSV row per occupation, quoting titles with commas or quotes', () => {
    const lines = indexCsv(idx).trim().split('\n')
    expect(lines).toHaveLength(5)
    expect(lines[0]).toBe('soc_code,occupation,observed_exposure_pct,exposure_band,live_openings,as_of,exposure_source')
    expect(lines[1]).toBe('15-1252,Software Developers,45,High,1000,2026-10-30,Anthropic Economic Index')
    expect(lines.some((l) => l.includes('"Registered Nurses, ""Staff"""'))).toBe(true)
  })
  it('credits the Anthropic Economic Index in the citation and the dataset block', () => {
    const cite = indexCitation(idx, 'https://launchyournextchapter.com')
    expect(cite).toContain('October 2026')
    expect(cite).toContain('2026-10-30')
    expect(cite).toContain('Anthropic Economic Index')
    expect(cite).toContain('https://launchyournextchapter.com/data/ai-jobs-index')
    const ld = indexJsonLd(idx, 'https://launchyournextchapter.com', { '@type': 'Organization' }) as Record<string, unknown>
    expect(ld['@type']).toBe('Dataset')
    expect(ld.dateModified).toBe('2026-10-30')
    expect(JSON.stringify(ld.distribution)).toContain('/data/ai-jobs-index.csv')
    expect(JSON.stringify(ld.isBasedOn)).toContain('Anthropic Economic Index')
  })
})
