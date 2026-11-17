import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { normalizeMajor, parseMajors } from '@/lib/higher-ed/major-groups-shared'
import { toBreakdown } from '@/lib/higher-ed/alumni-data'

describe('normalizeMajor', () => {
  it('lower-cases, spells out "&", drops punctuation and collapses spaces', () => {
    expect(normalizeMajor('  Computer Science & Engineering ')).toBe('computer science and engineering')
    expect(normalizeMajor('Information Systems (B.S.)')).toBe('information systems b s')
    expect(normalizeMajor('Economics')).toBe(normalizeMajor('economics '))
  })
})

describe('parseMajors', () => {
  it('splits on commas, semicolons and new lines, de-duplicates and drops blanks', () => {
    expect(parseMajors('Computer Science, computer science; Statistics\n\n, ')).toEqual(['computer science', 'statistics'])
  })
  it('keeps at most 20', () => {
    expect(parseMajors(Array.from({ length: 30 }, (_, i) => `Major ${i}`).join(','))).toHaveLength(20)
  })
})

describe('toBreakdown', () => {
  const rows = (pairs: [string | null, number][]) => pairs.map(([value, n]) => ({ dim: 'x', value, n }))

  it('folds groups under five into other and leaves unknowns out of covered', () => {
    const b = toBreakdown(rows([['Product', 12], ['Finance', 7], ['Legal', 3], ['Design', 1], [null, 40]]))
    expect(b.slices).toEqual([
      { label: 'Product', n: 12 },
      { label: 'Finance', n: 7 },
    ])
    expect(b.other).toBe(4)
    expect(b.covered).toBe(23)
  })

  it('keeps a fixed order and labels when given', () => {
    const b = toBreakdown(rows([['IC', 20], ['VP', 6], ['Director', 9]]), { order: ['VP', 'Director', 'IC'], labels: { VP: 'Vice presidents' } })
    expect(b.slices.map((s) => s.label)).toEqual(['Vice presidents', 'Director', 'IC'])
  })

  it('moves groups past the limit into other', () => {
    const b = toBreakdown(rows([['A', 9], ['B', 8], ['C', 7]]), { limit: 2 })
    expect(b.slices.map((s) => s.label)).toEqual(['A', 'B'])
    expect(b.other).toBe(7)
  })
})
