import { describe, expect, it } from 'vitest'
import { alumniAtRisk, employerInsights, hasSkill, retrainingDemand, riskKeys, skillGaps, trendOf, type AlumniSkillRow, type EmployerSignal, type RegionEmployerRow, type RoleExposure } from '@/lib/higher-ed/academic-insights'

const emp = (name: string, open: number, fields: Record<string, number>, extra: Partial<RegionEmployerRow> = {}): RegionEmployerRow => ({
  name, companyId: `c-${name}`, cn: name.toLowerCase(), open, entry: 0, fields, paid: 0, payMed: null, openNow: null, open4wAgo: null, warn12mo: 0, lastWarnAt: null, ...extra,
})

describe('academic insights', () => {
  it('reads the four-week trend only from at least 10 roles', () => {
    expect(trendOf(130, 100)).toEqual({ trend: 'growing', change: 30 })
    expect(trendOf(70, 100).trend).toBe('cutting')
    expect(trendOf(105, 100).trend).toBe('steady')
    expect(trendOf(20, 5).trend).toBe('unknown')
    expect(trendOf(null, 100).trend).toBe('unknown')
  })

  it('ranks employers by roles in the college fields and merges one employer across counties', () => {
    const rows = [emp('Big', 500, { Nursing: 400 }), emp('Fit', 100, { Engineering: 80 }), emp('Fit', 50, { Engineering: 20 }, { paid: 40, payMed: 120_000 })]
    const out = employerInsights(rows, new Set(['Engineering']))
    expect(out.map((e) => e.name)).toEqual(['Fit', 'Big'])
    expect(out[0]).toMatchObject({ open: 150, inYourFields: 100, topField: 'Engineering', payMed: 120_000 })
    // Two company records for one employer merge; the college itself is left out.
    const two = employerInsights([emp('BNY', 90, {}), { ...emp('BNY', 68, {}), companyId: 'other' }, emp('Carnegie Mellon University (SEI)', 35, {})], new Set(), 25, ['Carnegie Mellon University'])
    expect(two.map((e) => [e.name, e.open])).toEqual([['BNY', 158]])
  })

  it('flags alumni employers with layoffs or falling hiring, and hides small groups', () => {
    const work = [
      ...Array.from({ length: 6 }, () => ({ employer: 'Acme Corp', title: 'Analyst' })),
      ...Array.from({ length: 3 }, () => ({ employer: 'Tiny LLC', title: 'Engineer' })),
      ...Array.from({ length: 7 }, () => ({ employer: 'Growco', title: 'Designer' })),
    ]
    const signals = new Map<string, EmployerSignal>([
      ['tiny', { name: 'Tiny', openNow: 50, open4wAgo: 100, warn12mo: 0, warnEmployees12mo: 0, lastWarnAt: null }],
      ['growco', { name: 'Growco', openNow: 150, open4wAgo: 100, warn12mo: 0, warnEmployees12mo: 0, lastWarnAt: null }],
    ])
    const a = alumniAtRisk(work, signals, [{ employerKey: 'acme', employer: 'ACME CORP', noticeDate: '2026-10-01', employees: 120, where: 'Allegheny, PA', alumni: 2, sample: true }])
    expect(a.sharing).toBe(16)
    expect(a.atRisk).toBe(9)
    const acme = a.employers.find((e) => e.key === 'acme')!
    expect(acme).toMatchObject({ alumni: 6, reasons: ['layoff'], roles: [{ title: 'Analyst', n: 6 }] })
    const tiny = a.employers.find((e) => e.key === 'tiny')!
    expect(tiny.alumni).toBeNull()
    expect(tiny.reasons).toEqual(['cutting'])
    expect(a.growing).toEqual([{ employer: 'Growco', alumni: 7, change: 50 }])
    expect(a.sample).toBe(true)
    expect([...riskKeys(a)].sort()).toEqual(['acme', 'tiny'])
  })

  it('compares what postings ask for with alumni résumés, per function with enough alumni', () => {
    expect(hasSkill('sql | python', { name: 'SQL', slug: 'sql' })).toBe(true)
    expect(hasSkill('mysqlite', { name: 'SQL', slug: 'sql' })).toBe(false)
    const rows: AlumniSkillRow[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ primaryFunction: 'Finance', resumeKeywords: i < 2 ? ['SQL'] : ['Excel'], confirmedSkillsHave: [], certifications: [] })),
      ...Array.from({ length: 3 }, () => ({ primaryFunction: 'Legal', resumeKeywords: [], confirmedSkillsHave: [], certifications: [] })),
    ]
    const gaps = skillGaps(rows, (fn) => (fn === 'Finance' ? { postings: 1000, skills: [{ slug: 'sql', name: 'SQL', share: 0.6, rising: true, ai: false }, { slug: 'excel', name: 'Excel', share: 0.7, rising: false, ai: false }] } : null))
    expect(gaps).toHaveLength(1)
    expect(gaps[0].fn).toBe('Finance')
    expect(gaps[0].gaps[0]).toMatchObject({ skill: 'SQL', alumni: 0.2, rising: true })
    expect(gaps[0].gaps[0].gap).toBeCloseTo(0.4)
  })

  it('counts each alumnus in need once and matches skills to the college programs', () => {
    const roles: RoleExposure[] = [
      ...Array.from({ length: 5 }, () => ({ title: 'Analyst', occupation: 'Financial Analysts', score: 0.4, employerKey: 'acme' })),
      ...Array.from({ length: 5 }, () => ({ title: 'Nurse', occupation: 'Registered Nurses', score: 0.02, employerKey: 'acme' })),
      ...Array.from({ length: 5 }, () => ({ title: 'Writer', occupation: 'Writers', score: 0.5, employerKey: 'other' })),
      { title: 'Wizard', occupation: null, score: null, employerKey: null },
    ]
    const gaps = [{ fn: 'Finance', alumni: 20, postings: 100, gaps: [{ skill: 'SQL', slug: 'sql', demand: 0.6, alumni: 0.2, gap: 0.4, rising: true, ai: false }, { skill: 'Excel', slug: 'excel', demand: 0.5, alumni: 0.45, gap: 0.05, rising: false, ai: false }] }]
    const r = retrainingDemand(roles, new Set(['acme']), gaps, [{ name: 'Data for Finance', kind: 'program', href: '/p/1', skills: ['sql'] }])
    expect(r.matched).toBe(15)
    expect(r.unmatched).toBe(1)
    expect(r.inNeed).toBe(15)
    expect(r.groups.find((g) => g.band === 'high')).toMatchObject({ alumni: 10, occupations: [{ title: 'Financial Analysts', n: 5 }, { title: 'Writers', n: 5 }] })
    expect(r.skills[0]).toMatchObject({ skill: 'SQL', fn: 'Finance', without: 16, offerings: [{ name: 'Data for Finance' }] })
    expect(r.skills[1]).toMatchObject({ skill: 'Excel', without: 11, offerings: [] })
  })
})
