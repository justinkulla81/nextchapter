import { describe, expect, it } from 'vitest'
import { parseP0Leads } from '@/lib/crm/p0-leads-parse'

const base = {
  trigger: { kind: 'WARN', headline: 'Acme closing Dayton plant', sourceUrl: 'https://jfs.ohio.gov/warn/acme', state: 'oh', county: 'Montgomery County', employees: '240', deadline: '2026-12-01' },
  org: { name: 'Acme Corp', type: 'EMPLOYER' },
  why: 'Employer with 240 affected workers',
}

describe('parseP0Leads', () => {
  it('normalizes a valid lead', () => {
    const { leads, errors } = parseP0Leads({ leads: [base] })
    expect(errors).toEqual([])
    expect(leads[0].trigger.state).toBe('OH')
    expect(leads[0].trigger.county).toBe('Montgomery')
    expect(leads[0].trigger.employees).toBe(240)
    expect(leads[0].trigger.deadline?.toISOString().slice(0, 10)).toBe('2026-12-01')
    expect(leads[0].person).toBeNull()
  })

  it('rejects a lead without a source link instead of writing it', () => {
    const { leads, errors } = parseP0Leads({ leads: [{ ...base, trigger: { ...base.trigger, sourceUrl: 'acme.com' } }] })
    expect(leads).toEqual([])
    expect(errors[0]).toMatchObject({ index: 0 })
  })

  it('rejects an org type that is not a rapid-response target', () => {
    const { errors } = parseP0Leads({ leads: [{ ...base, org: { name: 'Fund', type: 'VC_FUND' } }] })
    expect(errors).toHaveLength(1)
  })

  it('requires a full name for a person', () => {
    const { errors } = parseP0Leads({ leads: [{ ...base, person: { fullName: 'Madonna' } }] })
    expect(errors[0].error).toMatch(/first and last/)
  })

  it('keeps good rows when one row is bad', () => {
    const { leads, errors } = parseP0Leads({
      leads: [base, { ...base, trigger: { ...base.trigger, kind: 'RUMOR' } }, { ...base, person: { fullName: 'Jane Doe', title: 'Director', role: 'BD_PARTNER' } }],
    })
    expect(leads).toHaveLength(2)
    expect(errors.map((e) => e.index)).toEqual([1])
    expect(leads[1].person?.role).toBe('BD_PARTNER')
  })

  it('reports a missing leads array', () => {
    expect(parseP0Leads({}).errors[0].index).toBe(-1)
  })
})
