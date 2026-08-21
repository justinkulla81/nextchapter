import { describe, it, expect } from 'vitest'
import { mapFunctionInterestToJobIntent } from '@/lib/crucible/employers/function-interest'
import type { CrucibleFunctionInterest, CrucibleJobIntent } from '@prisma/client'

describe('mapFunctionInterestToJobIntent', () => {
  const cases: [CrucibleFunctionInterest, CrucibleJobIntent][] = [
    ['TECH', 'TECH'],
    ['MARKETING', 'MARKETING'],
    ['DATA', 'DATA'],
    ['DESIGN', 'DESIGN'],
    ['BUSINESS', 'BUSINESS'],
    ['GENERALIST', 'UNSURE'],
  ]

  it.each(cases)('%s -> %s', (interest, expected) => {
    expect(mapFunctionInterestToJobIntent(interest)).toBe(expected)
  })
})
