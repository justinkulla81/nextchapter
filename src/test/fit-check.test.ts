import { describe, expect, it } from 'vitest'
import { checkFit, fitWords } from '@/lib/capture/fit-check'

describe('checkFit', () => {
  it('finds whole-word skills and aliases, case-insensitive', () => {
    const r = checkFit('Led ML projects in Python; built SQL dashboards. JavaScript too.', ['Python', 'SQL', 'machine learning', 'javascript', 'Tableau'])
    expect(r.covered).toEqual(['Python', 'SQL', 'machine learning', 'javascript'])
    expect(r.missing).toEqual(['Tableau'])
    expect(r.pct).toBe(80)
  })
  it('does not match inside another word', () => {
    expect(checkFit('Managed a javascripting club', ['javascript']).covered).toEqual([])
    expect(checkFit('raised capital', ['R']).covered).toEqual([])
  })
  it('handles empty input', () => {
    expect(checkFit('', ['SQL']).pct).toBe(0)
    expect(checkFit('SQL', []).pct).toBe(0)
  })
  it('words the score', () => {
    expect(fitWords(80)).toMatch(/most/)
    expect(fitWords(10)).toMatch(/wording/)
  })
})
