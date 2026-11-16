import { describe, expect, it } from 'vitest'
import { buildCompanySignals, topSkills } from '@/lib/companies/signals'

const asOf = new Date('2026-11-02T11:00:00Z')
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86_400_000)
const posting = (title: string, level: string | null, ageDays: number) => ({ companyName: 'Acme Corp', title, level, createdAt: daysAgo(ageDays) })

describe('topSkills', () => {
  it('ranks by postings asking, ties by name, and keeps ten', () => {
    const terms = new Map(Array.from({ length: 12 }, (_, i) => [`t${String(i).padStart(2, '0')}`, i < 2 ? 5 : 1] as [string, number]))
    terms.set('python', 9)
    const top = topSkills(terms)
    expect(top).toHaveLength(10)
    expect(top.slice(0, 3)).toEqual([{ term: 'python', count: 9 }, { term: 't00', count: 5 }, { term: 't01', count: 5 }])
    expect(top[3]).toEqual({ term: 't02', count: 1 })
  })
})

describe('buildCompanySignals', () => {
  const key = 'acme'
  const build = (over: Partial<Parameters<typeof buildCompanySignals>[0]> = {}) =>
    buildCompanySignals(
      {
        current: new Map([[key, [posting('Director of Finance', 'DIRECTOR', 40), posting('Senior Accountant', null, 20), posting('Staff Accountant', null, 10), posting('Controller', 'VP', 2)]]]),
        skills: new Map(),
        past4wk: new Map([[key, 2]]),
        past12wk: new Map([[key, 2]]),
        ...over,
      },
      asOf,
    )

  it('counts open roles, director-plus roles, deltas and the median posting age', () => {
    const [s] = build()
    expect(s).toMatchObject({ companyName: 'Acme Corp', companyNameNormalized: key, openRolesTotal: 4, openRolesDirectorPlus: 2, rolesDelta4wk: 2, rolesDelta12wk: 2, medianPostingAgeDays: 15 })
    expect(s.trajectory).toBe('growing')
  })

  it('takes each employer skills list as counted', () => {
    const ranked = [{ term: 'python', count: 3 }, { term: 'sql', count: 1 }]
    expect(build({ skills: new Map([[key, ranked]]) })[0].topSkillsRequested).toEqual(ranked)
  })

  it('has no skills for an employer with none counted', () => {
    expect(build()[0].topSkillsRequested).toEqual([])
  })

  it('returns one signal per employer with at least one open posting', () => {
    expect(build({ current: new Map() })).toEqual([])
  })
})
