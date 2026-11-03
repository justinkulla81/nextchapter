import { describe, expect, it } from 'vitest'
import { bestCompanyRank, combineEmployers, employerSpecs, isEmployer, parentOf, rankEmployers, type EmployerStat } from '@/lib/rankings/employers-specs'
import { collegeSpecs, compositeSpecs, functionSpecs, industryCitySpecs, industrySpecs, skillSpecs, wave1Specs, wave2PlaceSpecs, workforceSpecs } from '@/lib/rankings/build-edition'
import { profileSpecs } from '@/lib/rankings/wave5-specs'
import { supportSpecs } from '@/lib/rankings/wave6-specs'

const emp = (name: string, n: number, over: Partial<EmployerStat> = {}): EmployerStat => ({ name, n, junior: Math.floor(n / 4), mid: Math.floor(n / 4), senior: Math.floor(n / 4), lead: Math.floor(n / 4), fn: { Marketing: Math.floor(n / 5) }, sizeBand: null, ...over })
const data = (employers: EmployerStat[], growth: { name: string; open: number; delta12: number; sizeBand: string | null }[] = []) => ({ employers, growth, href: (n: string) => (n === 'Amazon' ? '/employers/amazon-1' : null) })

describe('employer hiring lists', () => {
  it('has unique addresses next to every other list', () => {
    const all = [...wave1Specs(['TX']), ...wave2PlaceSpecs(), ...functionSpecs(), ...skillSpecs(), ...industrySpecs(), ...workforceSpecs(), ...collegeSpecs([]), ...industryCitySpecs(), ...compositeSpecs(), ...profileSpecs(), ...supportSpecs(), ...employerSpecs()]
    expect(new Set(all.map((s) => s.slug)).size).toBe(all.length)
    expect(employerSpecs()).toHaveLength(5 + 2 + 13 + 1)
  })

  it('combines parent brands and drops placeholders and staffing firms', () => {
    expect(parentOf('Prime Video & Amazon MGM Studios')).toBe('Amazon')
    expect(parentOf('AWS')).toBe('Amazon')
    expect(parentOf('YouTube')).toBe('Alphabet')
    expect(parentOf('Arthur J. Gallagher')).toBe('Gallagher')
    expect(parentOf('Acme Widgets, Inc.')).toBe('Acme Widgets')
    expect(parentOf('Bain & Company')).toBe('Bain & Company')
    expect(parentOf('Cisco Systems')).toBe('Cisco')
    expect(parentOf('Hilton Worldwide Holdings')).toBe('Hilton')
    expect(isEmployer('Confidential')).toBe(false)
    expect(isEmployer('Remote')).toBe(false)
    expect(isEmployer('Creative Financial Staffing')).toBe(false)
    expect(isEmployer('Robert Half')).toBe(false)
    expect(isEmployer('Deloitte')).toBe(true)
    const out = combineEmployers([emp('AWS', 100, { fn: { Operations: 60 } }), emp('Amazon', 50, { fn: { Operations: 10, Marketing: 5 } }), emp('Jobot', 900), emp('Cintas', 40)])
    expect(out.map((e) => e.name).sort()).toEqual(['Amazon', 'Cintas'])
    const amazon = out.find((e) => e.name === 'Amazon')!
    expect(amazon.n).toBe(150)
    expect(amazon.fn).toEqual({ Operations: 70, Marketing: 5 })
  })

  it('ranks employers on open roles, links the employer page and applies the sample bar', () => {
    const names = ['Amazon', 'Alpha Co', 'Beta Co', 'Gamma Co', 'Delta Co', 'Echo Co', 'Foxtrot Co', 'Golf Co', 'Tiny Co']
    const list = names.map((n, i) => emp(n, n === 'Tiny Co' ? 20 : 1000 - i * 50))
    const spec = employerSpecs().find((s) => s.measure === 'em_all')!
    const e = rankEmployers(spec, data(list), '2026-11', 'x', null)!
    expect(e.placeNoun).toBe('employers')
    expect(e.rows[0].name).toBe('Amazon')
    expect(e.rows[0].href).toBe('/employers/amazon-1')
    expect(e.rows.find((r) => r.name === 'Tiny Co')).toBeUndefined()
    expect(e.minN).toBe(50)
  })

  it('ranks a job family and returns nothing when too few employers qualify', () => {
    const list = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => emp(`${n} Corp`, 500, { fn: { Marketing: 40 - i } }))
    const spec = employerSpecs().find((s) => s.measure === 'em_fn' && s.fn === 'Marketing')!
    const e = rankEmployers(spec, data(list), '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('A Corp')
    expect(rankEmployers(spec, data(list.slice(0, 3)), '2026-11', 'x', null)).toBeNull()
  })

  it('ranks growth against the employer\'s own base with floors on both ends', () => {
    const growth = [
      { name: 'Ramp', open: 219, delta12: 148, sizeBand: null },
      { name: 'Figma', open: 131, delta12: 75, sizeBand: 'MID_LARGE' },
      { name: 'Tiny Startup', open: 30, delta12: 20, sizeBand: null },
      { name: 'Shrinker', open: 80, delta12: -10, sizeBand: null },
      { name: 'Staffing Plus Staffing', open: 300, delta12: 200, sizeBand: null },
      ...['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => ({ name: `${n} Labs`, open: 100 + i, delta12: 30 + i, sizeBand: null })),
    ]
    const spec = employerSpecs().find((s) => s.measure === 'em_growth')!
    const e = rankEmployers(spec, data([], growth), '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('Ramp')
    expect(e.rows[0].valueLabel).toBe('+208%')
    const names = e.rows.map((r) => r.name)
    expect(names).not.toContain('Tiny Startup')
    expect(names).not.toContain('Shrinker')
    expect(names).not.toContain('Staffing Plus Staffing')
    expect(e.rows.find((r) => r.name === 'Figma')!.stats.some((s) => s.label === 'Company size')).toBe(true)
    expect(e.method.join(' ')).toContain('not against its headcount')
  })

  it('matches Fortune\'s 100 Best on the full name only and ranks those that are hiring', () => {
    expect(bestCompanyRank('Wegmans')).toBe(5)
    expect(bestCompanyRank('Wegmans Food Markets, Inc.')).toBe(5)
    expect(bestCompanyRank('PwC')).toBe(35)
    expect(bestCompanyRank('Deloitte')).toBe(24)
    expect(bestCompanyRank('Hilton Worldwide Holdings')).toBe(2)
    expect(bestCompanyRank('Dow Jones')).toBeNull()
    expect(bestCompanyRank('Target Hospitality')).toBeNull()
    const names = ['Wegmans', 'Hilton', 'Cisco', 'Deloitte', 'Nvidia', 'Not Listed Co']
    const list = names.map((n, i) => emp(n, 200 - i * 10))
    const spec = employerSpecs().find((s) => s.measure === 'em_best')!
    const e = rankEmployers(spec, data(list), '2026-11', 'x', null)!
    expect(e.rows.map((r) => r.name)).not.toContain('Not Listed Co')
    expect(e.rows[0].name).toBe('Wegmans')
    expect(e.rows[0].stats[0]).toEqual({ label: 'Fortune 100 Best rank, 2026', value: '#5' })
    expect(e.method.join(' ')).toContain('greatplacetowork.com')
  })
})
