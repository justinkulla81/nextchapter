import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { crmOrganization: { findMany } } }))

describe('uniqueClaimSlugs', () => {
  it('keeps an address one record reads to and drops one two records share', async () => {
    findMany.mockResolvedValue([
      { canonicalNameNormalized: 'texas a&m international university' },
      { canonicalNameNormalized: 'texas a & m international university' },
      { canonicalNameNormalized: 'alabama a&m university' },
    ])
    const { uniqueClaimSlugs } = await import('@/lib/org-claims/org')
    const ok = await uniqueClaimSlugs(['texas-a-and-m-international-university', 'alabama-a-and-m-university', 'not-in-the-crm'])
    expect([...ok].sort()).toEqual(['alabama-a-and-m-university'])
  })
  it('ignores a malformed address', async () => {
    const { uniqueClaimSlugs } = await import('@/lib/org-claims/org')
    expect((await uniqueClaimSlugs(['Bad Slug', 'x--y'])).size).toBe(0)
  })
})

describe('claimSlugIsAmbiguous', () => {
  it('is true when two records read to the address, false for one or none', async () => {
    const { claimSlugIsAmbiguous } = await import('@/lib/org-claims/org')
    findMany.mockResolvedValue([{ canonicalNameNormalized: 'prairie view a&m university' }, { canonicalNameNormalized: 'prairie view a & m university' }])
    expect(await claimSlugIsAmbiguous('prairie-view-a-and-m-university')).toBe(true)
    findMany.mockResolvedValue([{ canonicalNameNormalized: 'prairie view a&m university' }])
    expect(await claimSlugIsAmbiguous('prairie-view-a-and-m-university')).toBe(false)
    findMany.mockResolvedValue([])
    expect(await claimSlugIsAmbiguous('nobody-here')).toBe(false)
  })
})
