import { describe, expect, it } from 'vitest'
import { headlineChange, headlineIndex, INDEX_ROUNDING_RULE } from '@/lib/reports-wc-index'

// The published series: August 2026 is 161.6 and August 2025 is 128.2 (public/reports/wc-index.csv). The page once showed
// "+34" because it subtracted the two rounded levels (162 - 128); the change from the unrounded values is 33.4, shown as 33.
describe('index rounding', () => {
  it('rounds a level to the nearest whole point', () => {
    expect(headlineIndex(161.6)).toBe(162)
    expect(headlineIndex(128.2)).toBe(128)
  })
  it('computes a change from the unrounded values', () => {
    expect(headlineChange(161.6, 128.2)).toBe(33)
    expect(headlineIndex(161.6) - headlineIndex(128.2)).toBe(34) // the old, inconsistent way
  })
  it('states the rule', () => {
    expect(INDEX_ROUNDING_RULE).toMatch(/whole point/)
    expect(INDEX_ROUNDING_RULE).toMatch(/one decimal/)
  })
})
