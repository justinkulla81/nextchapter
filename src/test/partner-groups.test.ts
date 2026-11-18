import { describe, expect, it } from 'vitest'
import { MAX_GROUP_MEMBERS, canStartGroup, cleanMembers, memberChanges, validateGroup, validatePost } from '@/lib/workforce/partner-groups'
import { featureOn, institutionEntitlements } from '@/lib/plans/entitlements'

const form = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k] : null) })

describe('partner groups', () => {
  it('a free organization runs one group; paid and trial run as many as it likes', () => {
    expect(canStartGroup(1, 0).allowed).toBe(true)
    expect(canStartGroup(1, 1)).toMatchObject({ allowed: false, message: expect.stringMatching(/one group/) })
    expect(canStartGroup(null, 40).allowed).toBe(true)
    expect(institutionEntitlements({ plan: 'FREE' }).partnerGroupLimit).toBe(1)
    expect(featureOn(institutionEntitlements({ plan: 'FREE' }), 'partnerGroups')).toBe(false)
    expect(featureOn(institutionEntitlements({ plan: 'PAID' }), 'partnerGroups')).toBe(true)
  })
  it('needs a name, and trims the rest', () => {
    expect(validateGroup(form({ name: ' ' }))).toMatchObject({ error: expect.stringMatching(/name/) })
    expect(validateGroup(form({ name: ' Funders table ', purpose: '' }))).toEqual({ value: { name: 'Funders table', purpose: null } })
    expect(validateGroup(form({ name: 'x', purpose: 'Meets monthly' }))).toEqual({ value: { name: 'x', purpose: 'Meets monthly' } })
  })
  it('an update must say something', () => {
    expect(validatePost(form({ body: '  ' }))).toMatchObject({ error: expect.stringMatching(/Write the update/) })
    expect(validatePost(form({ body: ' Meeting Dec 9 ' }))).toEqual({ value: { body: 'Meeting Dec 9' } })
  })
  it('members are only partners the organization has, once each, and capped', () => {
    const valid = new Set(['a', 'b', 'c'])
    expect(cleanMembers(['a', 'x', 'a', 'c'], valid)).toEqual(['a', 'c'])
    const many = new Set(Array.from({ length: 100 }, (_, i) => `p${i}`))
    expect(cleanMembers([...many], many)).toHaveLength(MAX_GROUP_MEMBERS)
  })
  it('works out who to add and who to remove', () => {
    expect(memberChanges(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] })
    expect(memberChanges([], [])).toEqual({ add: [], remove: [] })
  })
})
