import { describe, expect, it } from 'vitest'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { FUNCTION_DEFAULT_SOURCE, ROLES, SOURCES, SOURCE_DETECT_ORDER, detectSourceRole, titleMatchesRole } from './pivot-map'

describe('pivot map integrity', () => {
  it('every role has a unique key, a known function and examples its own title pattern matches', () => {
    for (const role of ROLES.values()) {
      if (role.fn !== null) expect(PRIMARY_FUNCTION_OPTIONS).toContain(role.fn)
      expect(role.examples.length, role.key).toBeGreaterThan(0)
      for (const ex of role.examples) expect(role.titles.test(ex.toLowerCase()), `${role.key}: ${ex}`).toBe(true)
    }
  })

  it('every edge points at a real target, covers only that target’s needs and has a plain reason', () => {
    for (const source of SOURCES.values()) {
      expect(ROLES.has(source.role), source.role).toBe(true)
      expect(source.edges.length, source.role).toBeGreaterThanOrEqual(4)
      const targets = new Set<string>()
      for (const edge of source.edges) {
        const target = ROLES.get(edge.to)
        expect(target, `${source.role} -> ${edge.to}`).toBeDefined()
        expect(edge.to).not.toBe(source.role)
        expect(targets.has(edge.to), `duplicate edge ${source.role} -> ${edge.to}`).toBe(false)
        targets.add(edge.to)
        expect(edge.brings.length).toBeGreaterThan(0)
        expect(edge.why.length).toBeGreaterThan(30)
        expect(edge.why).not.toMatch(/\d+(\.\d+)?\s*(\/|out of)\s*100|score/i)
        const needKeys = new Set(target!.needs.map((n) => n.key))
        for (const c of edge.covers ?? []) expect(needKeys.has(c), `${source.role} -> ${edge.to} covers ${c}`).toBe(true)
      }
    }
  })

  it('every target used by an edge lists the skills a newcomer usually adds, with a way to close each', () => {
    const used = new Set([...SOURCES.values()].flatMap((s) => s.edges.map((e) => e.to)))
    for (const key of used) {
      const role = ROLES.get(key)!
      expect(role.needs.length, key).toBeGreaterThan(0)
      for (const n of role.needs) {
        expect(n.example.length).toBeGreaterThan(10)
        expect(n.evidence.length).toBeGreaterThan(0)
      }
    }
  })

  it('covers every source function in the brief', () => {
    const required = [
      'recruiter', 'hrbp', 'hr_generalist', 'customer_service', 'customer_success', 'account_management', 'sales', 'marketing',
      'operations', 'project_program', 'finance_accounting', 'teaching', 'nursing_clinical', 'admin_ea', 'data_analytics',
      'engineering', 'product', 'design', 'legal', 'consulting', 'retail_management', 'hospitality', 'military_government',
    ]
    for (const r of required) expect(SOURCES.has(r), r).toBe(true)
    expect([...SOURCE_DETECT_ORDER].sort()).toEqual(required.sort())
  })

  it("includes the owner's examples", () => {
    const targetsOf = (k: string) => SOURCES.get(k)!.edges.map((e) => e.to)
    expect(targetsOf('recruiter')).toEqual(expect.arrayContaining(['account_executive', 'business_development', 'partnerships', 'search_firm_consultant']))
    expect(targetsOf('hr_generalist')).toEqual(expect.arrayContaining(['people_operations', 'hris', 'people_analytics', 'learning_development', 'compensation']))
    expect(targetsOf('customer_service')).toEqual(
      expect.arrayContaining(['customer_success', 'account_manager', 'implementation', 'support_operations', 'sales_development'])
    )
  })

  it('tags extraverted high-rejection, high-upside paths and introverted analytical paths', () => {
    for (const k of ['account_executive', 'business_development', 'partnerships', 'fundraising', 'search_firm_consultant']) {
      expect(ROLES.get(k)!.highRejectionHighUpside, k).toBe(true)
      expect(ROLES.get(k)!.people).toBe('HIGH')
    }
    for (const k of ['people_analytics', 'hris', 'data_analyst']) expect(ROLES.get(k)!.people).toBe('LOW')
  })

  it('every function with a default source maps to a real source', () => {
    for (const [fn, key] of Object.entries(FUNCTION_DEFAULT_SOURCE)) {
      expect(PRIMARY_FUNCTION_OPTIONS).toContain(fn)
      expect(SOURCES.has(key!), key).toBe(true)
    }
  })

  it('target functions agree with how the board classifies their example titles, where it classifies them', () => {
    const mismatches: string[] = []
    for (const role of ROLES.values()) {
      if (!role.fn) continue
      for (const ex of role.examples) {
        const inferred = inferFunctionFromTitle(ex)
        if (inferred && inferred !== role.fn) mismatches.push(`${role.key}: "${ex}" -> ${inferred}`)
      }
    }
    // A few roles straddle functions on purpose (people analytics is HR work the board files under analytics);
    // keep the list short so a real taxonomy drift shows up here.
    expect(mismatches.length, mismatches.join('\n')).toBeLessThanOrEqual(14)
  })
})

describe('detectSourceRole', () => {
  it('reads the title first, most specific role first', () => {
    expect(detectSourceRole({ title: 'Senior Technical Recruiter', primaryFunction: 'Human Resources' })).toBe('recruiter')
    expect(detectSourceRole({ title: 'HR Generalist', primaryFunction: 'Human Resources' })).toBe('hr_generalist')
    expect(detectSourceRole({ title: 'Customer Service Team Lead', primaryFunction: 'Customer Success' })).toBe('customer_service')
    expect(detectSourceRole({ title: 'Customer Success Manager', primaryFunction: null })).toBe('customer_success')
    expect(detectSourceRole({ title: 'Hotel General Manager', primaryFunction: 'Operations' })).toBe('hospitality')
    expect(detectSourceRole({ title: 'Registered Nurse, ICU', primaryFunction: null })).toBe('nursing_clinical')
  })

  it('falls back to the function, and to nothing for General / Other', () => {
    expect(detectSourceRole({ title: 'Associate', primaryFunction: 'Human Resources' })).toBe('hr_generalist')
    expect(detectSourceRole({ title: null, primaryFunction: 'Customer Success' })).toBe('customer_success')
    expect(detectSourceRole({ title: null, primaryFunction: 'General' })).toBeNull()
    expect(detectSourceRole({ title: '', primaryFunction: null })).toBeNull()
  })
})

describe('titleMatchesRole', () => {
  it('filters board titles to a pivot target', () => {
    expect(titleMatchesRole('account_executive', 'Enterprise Account Executive, Healthcare')).toBe(true)
    expect(titleMatchesRole('account_executive', 'Senior Software Engineer')).toBe(false)
    expect(titleMatchesRole('people_analytics', 'Manager, People Analytics')).toBe(true)
    expect(titleMatchesRole('nope', 'Anything')).toBe(false)
  })
})
