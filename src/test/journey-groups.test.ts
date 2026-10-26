import { describe, expect, it } from 'vitest'
import { PERSONAS } from '@/lib/constants/personas'
import { JOURNEY_GROUPS, groupForSlug } from '@/lib/constants/journey-groups'

describe('journey groups', () => {
  it('puts every situation in exactly one group', () => {
    const all = JOURNEY_GROUPS.flatMap((g) => g.slugs)
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual(PERSONAS.map((p) => p.slug).sort())
  })

  it('asks at most four things on each screen', () => {
    expect(JOURNEY_GROUPS.length).toBeLessThanOrEqual(4)
    for (const g of JOURNEY_GROUPS) expect(g.slugs.length).toBeLessThanOrEqual(4)
  })

  it('finds a situation’s group', () => {
    expect(groupForSlug('laid-off')?.key).toBe('out')
    expect(groupForSlug('nope')).toBeUndefined()
  })
})
