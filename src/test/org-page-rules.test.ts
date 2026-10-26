import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ORG_PAGE_MIN_EXTRA_BLOCKS, ORG_PAGE_MIN_OPEN_JOBS, cleanOrgName, crmOrgName, groupPartnerDuplicates, partnerKey, extraBlocks, meetsOrgPageBar, orgSlugs, planOrgPageUpdates, slugifyName, type OrgPageFacts,
} from '@/lib/seo/org-page-rules'

const base: OrgPageFacts = { hasIdentity: true, hasArea: true, jobsOpen: 40, entryLevelJobs: 6, colleges: 1, otherPartners: 0, hasLabor: false }

describe('content bar', () => {
  it('passes with identity, an area, enough jobs and two extra blocks', () => {
    expect(extraBlocks(base)).toBe(2)
    expect(meetsOrgPageBar(base)).toBe(true)
  })
  it('fails below the job minimum', () => {
    expect(meetsOrgPageBar({ ...base, jobsOpen: ORG_PAGE_MIN_OPEN_JOBS - 1 })).toBe(false)
    expect(meetsOrgPageBar({ ...base, jobsOpen: ORG_PAGE_MIN_OPEN_JOBS })).toBe(true)
  })
  it('needs the extra blocks', () => {
    expect(meetsOrgPageBar({ ...base, colleges: 0 })).toBe(false)
    expect(ORG_PAGE_MIN_EXTRA_BLOCKS).toBe(2)
  })
  it('needs something the source publishes, and an area', () => {
    expect(meetsOrgPageBar({ ...base, hasIdentity: false })).toBe(false)
    expect(meetsOrgPageBar({ ...base, hasArea: false })).toBe(false)
  })
})

describe('slugs', () => {
  const rows = [
    { id: 'KY-1', name: 'Career Center', city: 'Louisville' },
    { id: 'KY-2', name: 'Career Center', city: 'Lexington' },
    { id: 'KY-3', name: 'Career Center', city: 'Lexington' },
    { id: 'KY-4', name: 'Morgan County Economic Development (listed by EDAA)', city: null },
    { id: 'KY-5', name: 'Smith & Sons Center', city: 'Paris' },
  ]
  const slugs = orgSlugs(rows)
  it('uses the name when it is unique, ignoring source notes', () => {
    expect(slugs.get('KY-4')).toBe('morgan-county-economic-development')
    expect(slugs.get('KY-5')).toBe('smith-and-sons-center')
    expect(cleanOrgName('X (listed by Y)')).toBe('X')
  })
  it('adds the city on a clash, then the id', () => {
    expect(slugs.get('KY-1')).toBe('career-center-louisville')
    expect(slugs.get('KY-2')).toBe('career-center-ky-2')
    expect(slugs.get('KY-3')).toBe('career-center-ky-3')
  })
  it('is unique, url-safe and independent of row order', () => {
    expect(new Set(slugs.values()).size).toBe(rows.length)
    expect([...orgSlugs([...rows].reverse())].sort()).toEqual([...slugs].sort())
    for (const s of slugs.values()) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    expect(slugifyName('  ')).toBe('')
  })
})

describe('duplicate partner records', () => {
  const rows = [
    { id: 'state-KY', name: 'Barren River Area Development District', kind: 'LOCAL_EDO', counties: ['warren'] },
    { id: 'edd-12', name: 'Barren River Area Development District (KY DLG/Gold)', kind: 'EDD', counties: ['allen', 'barren', 'warren'] },
    { id: 'edo-1', name: 'Lowndes County Economic Development Commission', kind: 'LOCAL_EDO', counties: ['lowndes'] },
  ]
  it('strips source tags so the two spellings share a key', () => {
    expect(cleanOrgName('Kentucky River ADD (KY DLG/Gold)')).toBe('Kentucky River ADD')
    expect(partnerKey(rows[0].name)).toBe(partnerKey(rows[1].name))
  })
  it('folds a district and its directory copy into the district', () => {
    const g = groupPartnerDuplicates(rows)
    expect(g).toHaveLength(2)
    const barren = g.find((x) => x.primary.id === 'edd-12')!
    expect(barren.aliases.map((a) => a.id)).toEqual(['state-KY'])
  })
  it('never depends on row order', () => {
    expect(groupPartnerDuplicates([...rows].reverse()).map((g) => g.primary.id).sort()).toEqual(groupPartnerDuplicates(rows).map((g) => g.primary.id).sort())
  })
})

describe('CRM names and IndexNow plan', () => {
  it('qualifies the name with the state, or the city on a clash', () => {
    expect(crmOrgName({ name: 'Career Center (listed by X)', state: 'KY', city: 'Paris' })).toBe('Career Center (KY)')
    expect(crmOrgName({ name: 'Career Center', state: 'KY', city: 'Paris' }, { sameNameInState: true })).toBe('Career Center (Paris, KY)')
  })
  it('announces new pages and moved lastmods only', () => {
    const current = [{ path: '/a', lastModified: '2026-10-01' }, { path: '/b', lastModified: '2026-10-02' }, { path: '/c', lastModified: '2026-10-03' }]
    expect(planOrgPageUpdates(current, { '/a': '2026-10-01', '/b': '2026-09-01' })).toEqual(['/b', '/c'])
  })
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : []
  })
}

describe('layoffs are never on these pages (owner decision 2026-10-25)', () => {
  const files = [
    'src/lib/seo/org-pages.ts', 'src/lib/seo/org-page-jsonld.ts', 'src/lib/seo/org-page-rules.ts', 'src/components/seo/OrgPageView.tsx',
    ...['job-centers', 'economic-development'].flatMap((d) => walk(join('src/app', d))),
    ...walk('src/app/workforce-boards/[state]/[board]'),
    ...walk('src/app/nonprofits'),
  ]
  it.each(files)('%s does not read or show layoff data', (f) => {
    const text = readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')
    expect(text).not.toMatch(/warn|layoff/i)
  })
})
