import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/jobs/ghost-risk-data', () => ({ getClosedPostingCounts: async () => new Map() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))

import {
  annualPayForSort,
  isSearchActive,
  matchPlace,
  matchSearchDoc,
  normalizeSearchText,
  parseBoardSearchParams,
  parseLocationQuery,
  parseSearchQuery,
  withBoardSearchParams,
  workArrangementOf,
  type SearchDoc,
} from '@/lib/jobs/board-search'
import { boardSearchWith, buildSearchIndex, suggestFrom, type SearchIndex } from '@/lib/jobs/board-search-index'
import { rankBoardRows, type BoardRankRow } from '@/lib/jobs/board-shortlist'
import type { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'

const doc = (title: string, extra: Partial<Omit<SearchDoc, 'role'>> & { role?: string } = {}): SearchDoc => ({
  title: normalizeSearchText(title),
  role: [normalizeSearchText(extra.role ?? '')],
  company: normalizeSearchText(extra.company ?? 'Acme'),
  industry: normalizeSearchText(extra.industry ?? ''),
})
const tier = (q: string, title: string, extra: Partial<Omit<SearchDoc, 'role'>> & { role?: string } = {}) => matchSearchDoc(doc(title, extra), parseSearchQuery(q))

describe('normalizing', () => {
  it('ignores case, accents and punctuation; keeps FP&A, C++ and .NET findable', () => {
    expect(normalizeSearchText('Sr. Director, FP&A')).toBe(' sr director fpa ')
    expect(normalizeSearchText('Café Manager')).toBe(' cafe manager ')
    expect(normalizeSearchText('C++ / C# / .NET developer')).toBe(' cplusplus csharp dotnet developer ')
    expect(normalizeSearchText('Research & Development')).toBe(' research and development ')
    expect(normalizeSearchText('M&A Associate')).toBe(' ma associate ')
  })
})

describe('query parsing', () => {
  it('splits words, drops stop words, stems plurals', () => {
    const p = parseSearchQuery('Engineers jobs in fintech')
    expect(p.terms.map((t) => t.forms)).toEqual([['engineer'], ['fintech']])
  })
  it('keeps quoted phrases whole', () => {
    const p = parseSearchQuery('"product marketing" director')
    expect(p.terms[0]).toMatchObject({ forms: ['product marketing'], exact: true, needles: [' product marketing '] })
    expect(p.terms[1].forms).toContain('director')
  })
  it('expands abbreviations both ways, multi-word forms included', () => {
    expect(parseSearchQuery('VP finance').terms[0].forms).toContain('vice president')
    expect(parseSearchQuery('vice president finance').terms[0].forms).toContain('vp')
    expect(parseSearchQuery('vice president finance').terms).toHaveLength(2)
    expect(parseSearchQuery('FP&A').terms[0].forms).toContain('financial planning and analysis')
    expect(parseSearchQuery('HRBP').terms[0].forms).toContain('hr business partner')
    expect(parseSearchQuery('SWE').terms[0].forms).toContain('software engineer')
    expect(parseSearchQuery('PM').terms[0].forms).toContain('product manager')
    expect(parseSearchQuery('CFO').terms[0].forms).toContain('chief financial officer')
  })
  it('reads company: and -exclusions', () => {
    const p = parseSearchQuery('analyst company:"Goldman Sachs" co:jpmorgan -intern')
    expect(p.companies).toEqual(['goldman sachs', 'jpmorgan'])
    expect(p.excludes).toEqual(['intern'])
    expect(p.terms.map((t) => t.forms[0])).toEqual(['analyst'])
  })
  it('an unclosed quote still searches', () => {
    expect(parseSearchQuery('"head of sales').terms[0]).toMatchObject({ forms: ['head of sales'], exact: true })
  })
})

describe('matching and relevance tiers', () => {
  it('ranks the whole phrase in the title above scattered words', () => {
    expect(tier('product manager', 'Senior Product Manager')).toBe(0)
    expect(tier('vp finance', 'Vice President, Finance')).toBe(1)
    expect(tier('finance manager', 'Manager of Corporate Finance')).toBe(1)
  })
  it('function / occupation / skills, then company / industry', () => {
    expect(tier('finance director', 'Director', { role: 'Finance' })).toBe(2)
    expect(tier('director healthcare', 'Director', { industry: 'Healthcare' })).toBe(3)
    expect(tier('director stripe', 'Director', { company: 'Stripe' })).toBe(3)
  })
  it('every word must match somewhere', () => {
    expect(tier('vp marketing', 'VP Finance')).toBeNull()
  })
  it('short words are whole words, longer ones start a word', () => {
    expect(tier('vp', 'VPN Engineer')).toBeNull()
    expect(tier('engineer', 'Engineering Manager')).toBe(0)
    expect(tier('gineer', 'Engineering Manager')).toBeNull()
  })
  it('quoted phrases need whole words in order', () => {
    expect(tier('"chief of staff"', 'Chief of Staff to the CEO')).toBe(0)
    expect(tier('"staff chief"', 'Chief of Staff')).toBeNull()
  })
  it('company: filters without changing the tier; exclusions drop', () => {
    expect(tier('company:stripe', 'Anything', { company: 'Stripe, Inc.' })).toBe(0)
    expect(tier('company:stripe', 'Anything', { company: 'Plaid' })).toBeNull()
    expect(tier('analyst -intern', 'Analyst Intern')).toBeNull()
  })
})

describe('location and work arrangement', () => {
  it('reads states, cities and metros', () => {
    expect(parseLocationQuery('TX')).toEqual({ states: ['TX'], city: null })
    expect(parseLocationQuery('Texas')).toEqual({ states: ['TX'], city: null })
    expect(parseLocationQuery('Austin, TX')).toEqual({ states: ['TX'], city: 'austin' })
    expect(parseLocationQuery('New York, NY')).toEqual({ states: ['NY'], city: 'new york' })
    expect(parseLocationQuery('metro:NY')).toEqual({ states: ['NY', 'NJ', 'CT'], city: null })
    expect(parseLocationQuery('New York metro')).toEqual({ states: ['NY', 'NJ', 'CT'], city: null })
    expect(parseLocationQuery('Washington, DC metro (DC, MD, VA)')).toEqual({ states: ['DC', 'MD', 'VA'], city: null })
    expect(parseLocationQuery('')).toBeNull()
  })
  it('work arrangement: the import field first, then the location text', () => {
    expect(workArrangementOf('Remote', 'Austin, TX')).toBe('remote')
    expect(workArrangementOf(null, 'Remote - US')).toBe('remote')
    expect(workArrangementOf(null, 'Hybrid - Boston, MA')).toBe('hybrid')
    expect(workArrangementOf(null, 'Boston, MA')).toBeNull()
  })
  const place = (states: string[], text: string, arrangement: 'remote' | 'hybrid' | 'onsite' | null = null) => ({
    states,
    text: normalizeSearchText(text),
    arrangement,
  })
  it('state, city and metro matches', () => {
    expect(matchPlace(place(['TX'], 'Austin, TX'), parseLocationQuery('Texas'), null)).toBe(true)
    expect(matchPlace(place(['TX'], 'Dallas, TX'), parseLocationQuery('Austin, TX'), null)).toBe(false)
    expect(matchPlace(place(['NJ'], 'Jersey City, NJ'), parseLocationQuery('metro:NY'), null)).toBe(true)
    expect(matchPlace(place(['CA'], 'San Francisco, CA'), parseLocationQuery('metro:NY'), null)).toBe(false)
  })
  it('remote / hybrid / on-site', () => {
    expect(matchPlace(place([], 'Remote', 'remote'), null, 'remote')).toBe(true)
    expect(matchPlace(place(['TX'], 'Austin, TX'), null, 'remote')).toBe(false)
    expect(matchPlace(place(['TX'], 'Austin, TX'), null, 'onsite')).toBe(true)
    expect(matchPlace(place(['TX'], 'Austin, TX', 'hybrid'), null, 'onsite')).toBe(false)
    expect(matchPlace(place(['TX'], 'Austin, TX', 'hybrid'), null, 'hybrid')).toBe(true)
  })
  it('remote plus a location: remote jobs open there or anywhere', () => {
    expect(matchPlace(place([], 'Remote - US', 'remote'), parseLocationQuery('Texas'), 'remote')).toBe(true)
    expect(matchPlace(place(['TX'], 'Remote - Texas', 'remote'), parseLocationQuery('Texas'), 'remote')).toBe(true)
    expect(matchPlace(place(['CA'], 'Remote - California', 'remote'), parseLocationQuery('Texas'), 'remote')).toBe(false)
  })
})

describe('URL parameters', () => {
  it('round-trips and drops defaults', () => {
    const s = parseBoardSearchParams({ q: '  VP   finance ', loc: 'Austin, TX', remote: 'hybrid', sort: 'newest' })
    expect(s).toEqual({ q: 'VP finance', loc: 'Austin, TX', remote: 'hybrid', sort: 'newest' })
    const sp = withBoardSearchParams('view=fresh', s)
    expect(sp.get('view')).toBe('fresh')
    expect(parseBoardSearchParams(Object.fromEntries(sp))).toEqual(s)
    const cleared = withBoardSearchParams(sp, { q: '', loc: '', remote: null, sort: 'best' })
    expect(cleared.toString()).toBe('view=fresh')
  })
  it('ignores unknown values; "Remote" as a location is the remote filter', () => {
    expect(parseBoardSearchParams({ remote: 'mars', sort: 'cheapest' })).toEqual({ q: '', loc: '', remote: null, sort: 'best' })
    expect(parseBoardSearchParams({ loc: 'remote' })).toEqual({ q: '', loc: '', remote: 'remote', sort: 'best' })
  })
  it('a sort alone is not a search', () => {
    expect(isSearchActive(parseBoardSearchParams({ sort: 'pay' }))).toBe(false)
    expect(isSearchActive(parseBoardSearchParams({ q: 'cfo' }))).toBe(true)
  })
})

describe('pay sort value', () => {
  it('annualizes hourly figures and puts no pay last', () => {
    expect(annualPayForSort(100_000, 150_000)).toBe(150_000)
    expect(annualPayForSort(50, null)).toBe(104_000)
    expect(annualPayForSort(null, null)).toBeNull()
  })
})

// ── Board ranking with search (real-shaped fixture rows) ────────────────────

type Candidate = Parameters<typeof computeBoardListingFitBucket>[0]
interface Snapshot {
  candidates: (Candidate & { key: string })[]
  postings: (Parameters<typeof computeBoardListingFitBucket>[1] & { id: string; createdAt: string; postedAt: string | null })[]
}
const snapshot: Snapshot = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/fit-scoring-legacy-snapshot.json'), 'utf8'))
const lightRows = (): BoardRankRow[] =>
  snapshot.postings.map((p, i) => ({
    id: p.id,
    title: p.title,
    companyName: `Company ${i % 7}`,
    audienceTier: 'ALL_CANDIDATES',
    source: 'employer',
    targetFunction: p.targetFunction,
    targetLevel: p.targetLevel,
    targetRemotePolicy: p.targetRemotePolicy,
    targetLocation: p.targetLocation,
    location: p.location,
    level: p.level ?? null,
    sourceCategory: null,
    postedAt: p.postedAt ? new Date(p.postedAt) : null,
    sourceCount: null,
    salaryMin: p.salaryMin,
    salaryMax: p.salaryMax,
    createdAt: new Date(p.createdAt),
    employmentType: null,
    employerSector: null,
    requirementTags: null,
  }))

describe('board ranking with a search', () => {
  const rows = lightRows()
  const c = snapshot.candidates[0]
  const now = new Date('2026-10-15T12:00:00Z')

  it('no search: identical to the board without the new options (parity)', () => {
    for (const cand of snapshot.candidates.slice(0, 5)) {
      const base = rankBoardRows(rows, { candidate: cand, isCandidatePlus: true, size: 300, now })
      expect(rankBoardRows(rows, { candidate: cand, isCandidatePlus: true, size: 300, now, relevance: undefined, sort: undefined, perCompany: undefined })).toEqual(base)
      expect(rankBoardRows(rows, { candidate: cand, isCandidatePlus: true, size: 300, now, sort: 'best' })).toEqual(base)
    }
  })

  it('keeps only matches, relevance tier first, fit order within a tier', () => {
    const word = normalizeSearchText(rows[0].title).trim().split(' ').find((w) => w.length > 4) ?? 'director'
    const search = boardSearchWith(parseBoardSearchParams({ q: word }), null)
    const ranked = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 1000, now, relevance: search.relevance })
    const matches = rows.filter((r) => search.relevance(r) !== null)
    expect(ranked.openTotal).toBe(matches.length)
    expect(ranked.openTotal).toBeGreaterThan(0)
    const byId = new Map(rows.map((r) => [r.id, r]))
    const tiers = ranked.openIds.map((id) => search.relevance(byId.get(id)!)!)
    // Picked ones (before the held-back per-company overflow) are in tier order.
    const picked = tiers.slice(0, Math.min(tiers.length, 7 * 5))
    expect([...picked].sort((a, b) => a - b)).toEqual(picked)
  })

  it('newest and highest pay sorts', () => {
    const newest = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 20, now, sort: 'newest', perCompany: 1000 })
    const byId = new Map(rows.map((r) => [r.id, r]))
    const times = newest.openIds.map((id) => (byId.get(id)!.postedAt ?? byId.get(id)!.createdAt).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    const pay = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 20, now, sort: 'pay', perCompany: 1000 })
    const pays = pay.openIds.map((id) => annualPayForSort(byId.get(id)!.salaryMin, byId.get(id)!.salaryMax) ?? -1)
    expect([...pays].sort((a, b) => b - a)).toEqual(pays)
  })

  it('the board matcher gives the same tiers as matchSearchDoc', () => {
    const facts = rows.map((r, i) => ({
      id: r.id, title: r.title, companyName: r.companyName, industry: ['Finance', 'Healthcare', null][i % 3], socTitle: i % 4 === 0 ? 'Financial Managers' : null,
      workArrangement: null, locationCity: null, locationState: null, states: null, skills: i % 5 === 0 ? 'excel sql' : null,
    }))
    const index = buildSearchIndex(facts)
    const queries = ['vp finance', 'director', 'healthcare manager', '"senior director"', 'sql analyst', 'company:"company 2" director', 'financial manager -senior', 'zzz']
    let compared = 0
    for (const q of queries) {
      const search = boardSearchWith(parseBoardSearchParams({ q }), index)
      const parsed = parseSearchQuery(q)
      rows.forEach((r, i) => {
        const f = facts[i]
        const expected = matchSearchDoc(
          {
            title: normalizeSearchText(r.title),
            role: [normalizeSearchText(inferFunctionFromTitle(r.title)), normalizeSearchText(r.targetFunction), normalizeSearchText(f.socTitle), normalizeSearchText(f.skills)],
            company: normalizeSearchText(r.companyName),
            industry: normalizeSearchText(f.industry),
          },
          parsed
        )
        expect(search.relevance(r)).toBe(expected)
        compared++
      })
    }
    expect(compared).toBeGreaterThan(100)
  })

  it('a company: search lifts the per-company cap', () => {
    const search = boardSearchWith(parseBoardSearchParams({ q: 'company:"Company 3"' }), null)
    const capped = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 1000, now, relevance: search.relevance })
    const lifted = rankBoardRows(rows, { candidate: c, isCandidatePlus: true, size: 1000, now, relevance: search.relevance, perCompany: 1000 })
    expect(lifted.openTotal).toBe(capped.openTotal)
    expect(new Set(lifted.openIds)).toEqual(new Set(capped.openIds))
  })

  it('uses the index facts (industry, states) when it has them', () => {
    const row = rows[0]
    const index = buildSearchIndex([
      { id: row.id, title: row.title, companyName: row.companyName, industry: 'Aerospace', socTitle: null, workArrangement: 'Remote', locationCity: null, locationState: null, states: 'WY', skills: 'kubernetes' },
    ])
    expect(boardSearchWith(parseBoardSearchParams({ q: 'aerospace' }), index).relevance(row)).toBe(3)
    expect(boardSearchWith(parseBoardSearchParams({ q: 'kubernetes' }), index).relevance(row)).toBe(2)
    expect(boardSearchWith(parseBoardSearchParams({ loc: 'Wyoming' }), index).relevance(row)).toBe(0)
    expect(boardSearchWith(parseBoardSearchParams({ remote: 'remote' }), index).relevance(row)).toBe(0)
    expect(boardSearchWith(parseBoardSearchParams({ q: 'aerospace' }), null).relevance({ ...row })).toBeNull()
  })
})

describe('typeahead', () => {
  const index: SearchIndex = {
    ...buildSearchIndex([]),
    companies: [
      { name: 'Stripe', norm: 'stripe', count: 40 },
      { name: 'Goldman Sachs', norm: 'goldman sachs', count: 30 },
    ],
    cities: [{ label: 'Austin, TX', norm: 'austin', count: 900 }],
  }
  it('locations: remote, metros, states, cities', () => {
    expect(suggestFrom(index, 'location', 're')[0]).toMatchObject({ kind: 'remote' })
    expect(suggestFrom(index, 'location', 'new york').map((s) => s.kind)).toEqual(['metro', 'state'])
    expect(suggestFrom(index, 'location', 'aus')).toEqual([{ kind: 'city', label: 'Austin, TX', value: 'Austin, TX', count: 900 }])
    expect(suggestFrom(index, 'location', 'tx')[0]).toMatchObject({ kind: 'state', value: 'Texas' })
  })
  it('companies by word start', () => {
    expect(suggestFrom(index, 'company', 'sach').map((s) => s.label)).toEqual(['Goldman Sachs'])
    expect(suggestFrom(null, 'company', 'stripe')).toEqual([])
  })
})

describe('email paths do not search', () => {
  const EMAIL_FILES = ['src/lib/jobs/fresh-job-alerts.ts', 'src/lib/job-search-daily/build.ts', 'src/lib/jobs/email-fit-scoring.ts']
  for (const f of EMAIL_FILES) {
    it(`${f} passes no search options`, () => {
      const src = readFileSync(path.resolve(__dirname, '../..', f), 'utf8')
      expect(src).not.toMatch(/relevance|board-search|perCompany|sort:\s*'(newest|pay)'/)
    })
  }
})

describe('search index', () => {
  it('stores distinct values once and reads the import city / states / arrangement', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => ({
      id, title: 'Controller', companyName: 'Acme', industry: 'Finance', socTitle: null, workArrangement: id === 'c' ? 'hybrid' : null,
      locationCity: id === 'd' ? 'HOBOKEN' : 'Hoboken', locationState: 'NJ', states: null, skills: null,
    }))
    const index = buildSearchIndex(rows)
    expect(index.tables.industry).toEqual([' ', ' finance '])
    expect(index.companies).toEqual([{ name: 'Acme', norm: 'acme', count: 4 }])
    expect(index.cities).toEqual([{ label: 'Hoboken, NJ', norm: 'hoboken', count: 4 }])
    const row = { id: 'c', title: 'Controller', companyName: 'Acme', location: null, targetFunction: null, targetRemotePolicy: null }
    expect(boardSearchWith(parseBoardSearchParams({ loc: 'metro:NY', remote: 'hybrid' }), index).relevance(row)).toBe(0)
    expect(boardSearchWith(parseBoardSearchParams({ loc: 'Hoboken, NJ' }), index).relevance(row)).toBe(0)
    expect(boardSearchWith(parseBoardSearchParams({ q: 'controller acme' }), index).relevance(row)).toBe(3)
  })
})
