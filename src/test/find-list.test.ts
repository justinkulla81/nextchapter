import { describe, expect, it } from 'vitest'
import { fitFactors, joinList, listItemOf, LIST_PAGE_SIZE, nextStepFor, NO_REASON_YET, oneFact, reasonLine, selectedJobId, visibleCount } from '@/lib/jobs/find-list'
import type { JobMatch, MatchDimension, MatchDimensionKey, MatchStatus } from '@/lib/jobs/job-match-types'

const dim = (key: MatchDimensionKey, status: MatchStatus, evidence: string[] = []): MatchDimension => ({ key, score: null, status, evidence })
const match = (d: Partial<Record<MatchDimensionKey, [MatchStatus, string[]]>>): JobMatch => ({
  overallScore: null,
  overall: 'good',
  gaps: [],
  requirements: [],
  dimensions: Object.fromEntries(
    (['skills', 'culture', 'salary', 'goals', 'workStyle'] as const).map((k) => [k, dim(k, d[k]?.[0] ?? 'unknown', d[k]?.[1] ?? [])])
  ) as JobMatch['dimensions'],
})

describe('joinList', () => {
  it('joins in plain words', () => {
    expect(joinList([])).toBe('')
    expect(joinList(['a'])).toBe('a')
    expect(joinList(['a', 'b'])).toBe('a and b')
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

describe('reasonLine', () => {
  it('says what fits for a good fit', () => {
    expect(reasonLine({ fits: ['your level', 'finance'], gap: null }, 'good')).toBe('Fits your level and finance.')
  })
  it('names the one gap after the fits', () => {
    expect(reasonLine({ fits: ['your level'], gap: 'asks for SQL' }, 'strong')).toBe('Fits your level. One gap: asks for SQL.')
  })
  it('leads with the gap when it is worth a look', () => {
    expect(reasonLine({ fits: ['finance'], gap: 'one level up' }, 'worth_a_look')).toBe('One level up. Fits finance.')
  })
  it('never leaves a verdict without a reason', () => {
    expect(reasonLine(null, 'good')).toBe(NO_REASON_YET)
    expect(reasonLine({ fits: [], gap: null }, 'worth_a_look')).toBe(NO_REASON_YET)
  })
})

describe('oneFact', () => {
  it('prefers a competition claim with its reason', () => {
    expect(oneFact({ posted: 'Posted 3 hours ago', fewerApplicants: { label: 'Likely fewer applicants', because: 'Search-firm listing' } })).toBe('Likely fewer applicants: search-firm listing')
  })
  it('then when it was posted, then pay', () => {
    expect(oneFact({ posted: 'Posted 3 days ago', pay: '$1' })).toBe('Posted 3 days ago')
    expect(oneFact({ posted: null, pay: '$280-340K' })).toBe('$280-340K')
    expect(oneFact({ posted: null })).toBeNull()
  })
})

describe('listItemOf', () => {
  const base = { id: 'j1', kind: 'board' as const, title: 'CFO', companyName: 'Arsenault', place: ' New York, NY ', verdict: 'good' as const, why: { fits: ['finance'], gap: null }, fact: 'Posted today' }
  it('builds one row with one verdict, one reason and one fact', () => {
    const item = listItemOf(base)
    expect(item).toMatchObject({ company: 'Arsenault', place: 'New York, NY', verdictLabel: 'Good fit', reason: 'Fits finance.', fact: 'Posted today', href: '/dashboard/jobs/j1?src=board' })
  })
  it('never names the employer of a confidential search', () => {
    expect(listItemOf({ ...base, confidential: true }).company).toBe('Confidential search')
  })
  it('has no verdict label for a job with no fit read', () => {
    expect(listItemOf({ ...base, verdict: null }).verdictLabel).toBeNull()
  })
})

describe('selectedJobId', () => {
  const items = [{ id: 'a' }, { id: 'b' }]
  it('uses the URL job when it is listed', () => {
    expect(selectedJobId(items, 'b', true)).toBe('b')
    expect(selectedJobId(items, 'b', false)).toBe('b')
  })
  it('opens the first job on a wide screen only', () => {
    expect(selectedJobId(items, null, true)).toBe('a')
    expect(selectedJobId(items, null, false)).toBeNull()
  })
  it('ignores a job that is not in the list', () => {
    expect(selectedJobId(items, 'zzz', true)).toBe('a')
    expect(selectedJobId(items, 'zzz', false)).toBeNull()
    expect(selectedJobId([], null, true)).toBeNull()
  })
})

describe('visibleCount', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: `j${i}` }))
  it('shows a page at a time', () => {
    expect(visibleCount(items, 1, null)).toBe(LIST_PAGE_SIZE)
    expect(visibleCount(items, 2, null)).toBe(2 * LIST_PAGE_SIZE)
    expect(visibleCount(items, 9, null)).toBe(25)
  })
  it('always includes the open job', () => {
    expect(visibleCount(items, 1, 'j14')).toBe(15)
    expect(visibleCount(items, 1, 'j2')).toBe(LIST_PAGE_SIZE)
  })
})

describe('fitFactors', () => {
  it('lists up to three matches, then the first gap', () => {
    const f = fitFactors(
      match({ skills: ['strong', ['Uses SQL']], culture: ['partial', ['Mid-size']], salary: ['gap', ['Below your floor']], goals: ['strong', ['Your goal']], workStyle: ['strong', ['Independent']] })
    )
    expect(f.map((x) => x.state)).toEqual(['match', 'match', 'match', 'gap'])
    expect(f[3]).toEqual({ state: 'gap', label: 'One gap', note: 'Salary: Below your floor' })
  })
  it('leaves out what we do not know and what has no reason', () => {
    expect(fitFactors(match({ skills: ['strong', []], culture: ['unknown', ['x']] }))).toEqual([])
    expect(fitFactors(undefined)).toEqual([])
  })
})

describe('nextStepFor', () => {
  it('puts a requirement the member may not meet first', () => {
    expect(nextStepFor({ blocker: 'US citizenship', contactName: 'Priya', fresh: true })?.kind).toBe('check_requirement')
  })
  it('then someone they know, then members who worked there', () => {
    expect(nextStepFor({ contactName: 'Priya Shah', fresh: true })).toMatchObject({ kind: 'ask_contact', text: 'Ask Priya Shah for an introduction before you apply.' })
    expect(nextStepFor({ insiderCount: 2 })?.text).toContain('2 people')
    expect(nextStepFor({ insiderCount: 1 })?.text).toContain('1 person')
  })
  it('then applying early on a fresh posting, then plain apply', () => {
    expect(nextStepFor({ fresh: true })?.kind).toBe('apply_early')
    expect(nextStepFor({})?.kind).toBe('apply')
  })
  it('says why for every step, and nothing for a closed job', () => {
    for (const s of [nextStepFor({ blocker: 'x' }), nextStepFor({ contactName: 'a' }), nextStepFor({ fresh: true }), nextStepFor({})]) expect(s?.because.length).toBeGreaterThan(10)
    expect(nextStepFor({ past: true })).toBeNull()
  })
})
