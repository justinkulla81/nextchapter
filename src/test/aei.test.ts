import { describe, expect, it } from 'vitest'
import { bandFor, compareVintages, parseExposureCsv, splitCsvLine, type ExposureRow } from '@/lib/aei/exposure'
import { buildTitleIndex, matchTitle, normalizeTitle } from '@/lib/aei/match'
import { MIN_CELL, buildExhibits, matchPostings, pctChange, type PostingInput } from '@/lib/aei/aggregate'
import { compareMeasures, scoresFromCsv } from '@/lib/aei/crosscheck'

const ROWS: ExposureRow[] = [
  { socCode: '15-1252', title: 'Software Developers', exposure: 0.55 },
  { socCode: '13-2011', title: 'Accountants and Auditors', exposure: 0.3 },
  { socCode: '43-4051', title: 'Customer Service Representatives', exposure: 0.7 },
  { socCode: '11-1011', title: 'Chief Executives', exposure: 0.03 },
  { socCode: '11-9199', title: 'Managers, All Other', exposure: 0.1 },
  { socCode: '31-1131', title: 'Nursing Assistants', exposure: 0 },
]

describe('exposure file', () => {
  it('parses the three-column file and quoted titles', () => {
    const csv = 'occ_code,title,observed_exposure\n11-1011,Chief Executives,0.0333\n11-3071,"Transportation, Storage, and Distribution Managers",0.1\n'
    expect(parseExposureCsv(csv)).toEqual([
      { socCode: '11-1011', title: 'Chief Executives', exposure: 0.0333 },
      { socCode: '11-3071', title: 'Transportation, Storage, and Distribution Managers', exposure: 0.1 },
    ])
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })
  it('refuses a changed header or an out-of-range value', () => {
    expect(() => parseExposureCsv('code,title,score\n11-1011,X,0.1\n')).toThrow()
    expect(() => parseExposureCsv('occ_code,title,observed_exposure\n11-1011,X,1.4\n')).toThrow()
  })
  it('bands exposure', () => {
    expect([0, 0.05, 0.1, 0.29, 0.3, 0.8].map(bandFor)).toEqual(['none', 'under-0.1', '0.1-0.3', '0.1-0.3', '0.3-and-above', '0.3-and-above'])
  })
  it('lists the biggest movers between vintages and what was added or removed', () => {
    const prev = [{ socCode: '1', title: 'A', exposure: 0.1 }, { socCode: '2', title: 'B', exposure: 0.2 }, { socCode: '3', title: 'C', exposure: 0.3 }]
    const curr = [{ socCode: '1', title: 'A', exposure: 0.4 }, { socCode: '2', title: 'B', exposure: 0.2 }, { socCode: '4', title: 'D', exposure: 0.5 }]
    const c = compareVintages(prev, curr)
    expect(c.movers).toEqual([{ socCode: '1', title: 'A', previous: 0.1, current: 0.4, change: 0.3 }])
    expect(c.added.map((r) => r.socCode)).toEqual(['4'])
    expect(c.removed.map((r) => r.socCode)).toEqual(['3'])
  })
})

describe('title matching', () => {
  const index = buildTitleIndex(ROWS)
  it('normalizes levels, locations and plurals', () => {
    expect(normalizeTitle('Senior Software Engineer (Remote) - Austin, TX')).toBe('software developer')
    expect(normalizeTitle('Accountants')).toBe('accountant')
  })
  it('matches common titles to the right occupation', () => {
    expect(matchTitle('Sr. Software Engineer II', index)?.socCode).toBe('15-1252')
    expect(matchTitle('Customer Service Rep', index)?.socCode).toBe('43-4051')
    expect(matchTitle('Auditor', index)?.socCode).toBe('13-2011')
    expect(matchTitle('Chief Executive', index)?.socCode).toBe('11-1011')
  })
  it('does not collapse an occupation title at its comma', () => {
    const withDirectors = buildTitleIndex([...ROWS, { socCode: '11-9032', title: 'Directors, Religious Activities and Education', exposure: 0.2 }, { socCode: '27-2012', title: 'Producers and Directors', exposure: 0.2 }])
    expect(matchTitle('Director, Global Indirect Tax', withDirectors)).toBeNull()
    expect(matchTitle('Senior Director - Capture Management', withDirectors)).toBeNull()
  })
  it('leaves unclear titles unmatched and skips "All Other" occupations', () => {
    expect(matchTitle('Growth Hacker Ninja', index)).toBeNull()
    expect(matchTitle('Managers', index)).toBeNull()
    expect(matchTitle('', index)).toBeNull()
  })
})

describe('exhibits', () => {
  const index = buildTitleIndex(ROWS)
  const asOf = new Date('2026-10-31T00:00:00Z')
  const day = (n: number) => new Date(asOf.getTime() - n * 86_400_000)
  const posts = (title: string, fn: string, n: number, recent: number): PostingInput[] =>
    Array.from({ length: n }, (_, i) => ({ title, fn, firstSeenAt: i < recent ? day(5) : day(40), closedAt: null }))
  const data = [...posts('Software Engineer', 'Engineering', 150, 90), ...posts('Nursing Assistant', 'Operations', 120, 40), ...posts('Growth Hacker', 'Marketing', 30, 5)]
  const ex = buildExhibits(matchPostings(data, index), asOf)

  it('reports coverage and bands with the change in new postings', () => {
    expect(ex.coverage).toMatchObject({ open: 300, matchedOpen: 270 })
    const high = ex.byBand.find((b) => b.band === '0.3-and-above')!
    expect(high.open).toBe(150)
    expect(high.newChangePct).toBe(50) // 90 recent vs 60 prior
  })
  it('suppresses small cells and ranks occupations by exposure', () => {
    expect(ex.byBand.find((b) => b.band === 'under-0.1')!.suppressed).toBe(true)
    expect(ex.topOccupations.map((o) => o.socCode)).toEqual(['15-1252', '31-1131'])
    expect(ex.byFunction.find((f) => f.fn === 'Marketing')!.suppressed).toBe(true)
    expect(MIN_CELL).toBe(100)
  })
  it('does not compute a change from a tiny prior count', () => {
    expect(pctChange(10, 5)).toBeNull()
    expect(pctChange(120, 100)).toBe(20)
  })
})

describe('cross-check measures', () => {
  it('reads SOC-keyed scores, including O*NET-SOC codes', () => {
    const csv = 'O*NET-SOC Code,Title,beta\n11-1011.00,Chief Executives,0.4\n11-1011.01,Other,0.6\n'
    expect(scoresFromCsv(csv, 'O*NET-SOC Code', 'beta', true).get('11-1011')).toBeCloseTo(0.5)
  })
  it('gives rank correlation 1 for identical order and -1 for reversed', () => {
    const a = new Map(Array.from({ length: 12 }, (_, i) => [`11-${String(1000 + i)}`, i]))
    const same = new Map([...a])
    const rev = new Map([...a].map(([k, v]) => [k, 100 - v]))
    expect(compareMeasures(a, same).spearman).toBe(1)
    expect(compareMeasures(a, rev).spearman).toBe(-1)
    expect(compareMeasures(a, rev).disagreements).toHaveLength(10)
  })
  it('declines to correlate fewer than ten shared occupations', () => {
    expect(compareMeasures(new Map([['11-1011', 1]]), new Map([['11-1011', 2]])).spearman).toBeNull()
  })
})
