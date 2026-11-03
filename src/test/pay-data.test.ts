import { describe, expect, it } from 'vitest'
import { buildGroups, buildSkills, groupHasEnough, paysLess, paysMore, skillPassesGuards, skillSlug, type RawGroupRow, type RawSkillRow } from '@/lib/pay-data/assemble'

const stat = { n: 100, companies: 20, p25: 90_000, p50: 120_000, p75: 150_000 }
const skill = (over: Partial<RawSkillRow>): RawSkillRow => ({
  skill: 'sql', ...stat, topCompanyN: 10, baseP50: 110_000, likePct: 5, likeUsd: 6_000, likeN: 300, likeCells: 8, ...over,
})

describe('pay data groups', () => {
  it('needs enough postings and enough employers', () => {
    expect(groupHasEnough({ n: 30, companies: 8 })).toBe(true)
    expect(groupHasEnough({ n: 29, companies: 8 })).toBe(false)
    expect(groupHasEnough({ n: 500, companies: 7 })).toBe(false)
  })

  it('attaches level rows to their group and drops groups that are too thin', () => {
    const rows: RawGroupRow[] = [
      { key: 'technology', lvl: null, ...stat },
      { key: 'technology', lvl: 'senior', ...stat, p50: 150_200 },
      { key: 'technology', lvl: 'vp', n: 5, companies: 3, p25: 1, p50: 2, p75: 3 },
      { key: 'agriculture', lvl: null, n: 10, companies: 4, p25: 1, p50: 2, p75: 3 },
    ]
    const out = buildGroups(rows, (k) => k)
    expect(out.map((g) => g.key)).toEqual(['technology'])
    expect(out[0].levels?.senior?.p50).toBe(150_000)
    expect(out[0].levels?.vp).toBeUndefined()
  })
})

describe('skills that pay', () => {
  it('drops a skill that one employer supplies most of (the Asana case)', () => {
    expect(skillPassesGuards({ n: 451, companies: 40, topCompanyN: 300 })).toBe(false)
    expect(skillPassesGuards({ n: 451, companies: 40, topCompanyN: 100 })).toBe(true)
  })

  it('drops a skill with too few postings or too few employers', () => {
    expect(skillPassesGuards({ n: 99, companies: 50, topCompanyN: 5 })).toBe(false)
    expect(skillPassesGuards({ n: 400, companies: 14, topCompanyN: 20 })).toBe(false)
  })

  it('keeps the raw gap but withholds a like-for-like figure resting on too little', () => {
    const [thin] = buildSkills([skill({ likeN: 60, likeCells: 5 })], new Map())
    expect(thin.rawPct).toBeCloseTo(9.1, 1)
    expect(thin.likePct).toBeUndefined()
    const [thinCells] = buildSkills([skill({ likeN: 400, likeCells: 2 })], new Map())
    expect(thinCells.likePct).toBeUndefined()
  })

  it('orders by like-for-like gap, skills without one after, then by pay', () => {
    const out = buildSkills(
      [skill({ skill: 'a', likePct: 3 }), skill({ skill: 'b', likePct: 12 }), skill({ skill: 'c', likeN: 10, p50: 200_000 }), skill({ skill: 'd', likeN: 10, p50: 100_000 })],
      new Map()
    )
    expect(out.map((s) => s.skill)).toEqual(['b', 'a', 'c', 'd'])
  })

  it('calls a gap near zero neither more nor less', () => {
    const [s] = buildSkills([skill({ likePct: 1.2 })], new Map())
    expect(paysMore(s)).toBe(false)
    expect(paysLess(s)).toBe(false)
    const [more] = buildSkills([skill({ likePct: 8 })], new Map())
    expect(paysMore(more)).toBe(true)
    const [less] = buildSkills([skill({ likePct: -6 })], new Map())
    expect(paysLess(less)).toBe(true)
  })
})

describe('skill slugs', () => {
  it('writes readable urls for symbols', () => {
    expect(skillSlug('c++')).toBe('c-plus-plus')
    expect(skillSlug('m&a')).toBe('m-and-a')
    expect(skillSlug('Machine Learning')).toBe('machine-learning')
    expect(skillSlug('c#')).toBe('c-sharp')
  })
})

describe('group like-for-like', () => {
  it('shows the adjusted gap only with enough postings and cells', () => {
    const rows: RawGroupRow[] = [{ key: 'MID', lvl: null, ...stat }, { key: 'SMALL', lvl: null, ...stat }]
    const out = buildGroups(rows, (k) => k, 'median', [
      { key: 'MID', likePct: 6.04, likeUsd: 7_200, likeN: 300, likeCells: 9 },
      { key: 'SMALL', likePct: 20, likeUsd: 30_000, likeN: 40, likeCells: 2 },
    ])
    expect(out.find((g) => g.key === 'MID')).toMatchObject({ likePct: 6, likeUsd: 7_000, likeN: 300, likeCells: 9 })
    expect(out.find((g) => g.key === 'SMALL')?.likePct).toBeUndefined()
  })
})

describe('skill display names', () => {
  it('writes skills the way people write them', async () => {
    const { skillName } = await import('@/lib/pay-data/text')
    expect(skillName('machine learning')).toBe('Machine Learning')
    expect(skillName('sql server')).toBe('SQL Server')
    expect(skillName('c++')).toBe('C++')
    expect(skillName('ci/cd')).toBe('CI/CD')
    expect(skillName('fp&a')).toBe('FP&A')
    expect(skillName('pytorch')).toBe('PyTorch')
    expect(skillName('node.js')).toBe('Node.js')
    expect(skillName('go-to-market')).toBe('Go-to-market')
    expect(skillName('a/b testing')).toBe('A/B Testing')
    expect(skillName('saas sales')).toBe('SaaS Sales')
  })
})
