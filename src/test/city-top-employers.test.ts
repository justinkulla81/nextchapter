import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { mergeCityTops } from '@/lib/places/places'

const e = (name: string, n: number, cid: string | null = name) => ({ name, n, cid, cn: null, linkable: null })

describe('mergeCityTops', () => {
  it('keeps one stored list as it is, cut to the limit', () => {
    expect(mergeCityTops([[e('A', 9), e('B', 5), e('C', 2)]], 2).map((r) => [r.name, r.n])).toEqual([['A', 9], ['B', 5]])
  })

  it('adds up an employer across a city\'s spellings and re-ranks, ties by name', () => {
    const merged = mergeCityTops([[e('A', 9), e('B', 5)], [e('B', 6), e('C', 5), e('Z', 5)]], 4)
    expect(merged.map((r) => [r.name, r.n])).toEqual([['B', 11], ['A', 9], ['C', 5], ['Z', 5]])
  })

  it('keeps two employers with the same name but different companies apart', () => {
    const merged = mergeCityTops([[e('Acme', 4, 'c1')], [e('Acme', 3, 'c2')]], 5)
    expect(merged).toHaveLength(2)
  })
})
