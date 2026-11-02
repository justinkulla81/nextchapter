import { describe, expect, it } from 'vitest'
import { buildCompanySignals, scaleSkillCounts } from '@/lib/companies/signals'

const asOf = new Date('2026-11-02T11:00:00Z')
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 86_400_000)
const posting = (title: string, level: string | null, ageDays: number) => ({ companyName: 'Acme Corp', title, level, createdAt: daysAgo(ageDays) })

describe('scaleSkillCounts', () => {
  const ranked = [{ term: 'python', count: 3 }, { term: 'sql', count: 1 }]

  it('leaves counts alone when every open role was read', () => {
    expect(scaleSkillCounts(ranked, 40, 40)).toEqual(ranked)
    expect(scaleSkillCounts(ranked, 50, 40)).toEqual(ranked)
  })

  it('leaves counts alone when there is no sample to scale from', () => {
    expect(scaleSkillCounts([], 0, 100)).toEqual([])
    expect(scaleSkillCounts(ranked, 0, 100)).toEqual(ranked)
  })

  it('scales a sample up to the real number of open roles, never below 1', () => {
    expect(scaleSkillCounts(ranked, 30, 300)).toEqual([{ term: 'python', count: 30 }, { term: 'sql', count: 10 }])
    expect(scaleSkillCounts([{ term: 'rare', count: 1 }], 30, 31)).toEqual([{ term: 'rare', count: 1 }])
  })
})

describe('buildCompanySignals', () => {
  const key = 'acme'
  const build = (over: Partial<Parameters<typeof buildCompanySignals>[0]> = {}) =>
    buildCompanySignals(
      {
        current: new Map([[key, [posting('Director of Finance', 'DIRECTOR', 40), posting('Senior Accountant', null, 20), posting('Staff Accountant', null, 10), posting('Controller', 'VP', 2)]]]),
        sampleTexts: new Map(),
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

  it('counts skills from the sampled text and scales them to all open roles', () => {
    const texts = ['Accountant needs python and sql', 'Controller needs python']
    const [s] = build({ sampleTexts: new Map([[key, texts]]) })
    const python = s.topSkillsRequested.find((r) => r.term === 'python')
    expect(python?.count).toBe(4) // 2 of 2 sampled roles, scaled to the 4 open roles
    expect(s.topSkillsRequested.find((r) => r.term === 'sql')?.count).toBe(2) // 1 of 2, scaled to 4
  })

  it('leaves skills exact when the sample is every open role', () => {
    const texts = ['a python role', 'a python role', 'a python role', 'no skills here']
    const [s] = build({ sampleTexts: new Map([[key, texts]]) })
    expect(s.topSkillsRequested.find((r) => r.term === 'python')?.count).toBe(3)
  })

  it('has no skills for an employer with no sampled text', () => {
    expect(build()[0].topSkillsRequested).toEqual([])
  })

  it('returns one signal per employer with at least one open posting', () => {
    expect(build({ current: new Map() })).toEqual([])
  })
})
