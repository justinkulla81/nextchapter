import { describe, expect, it } from 'vitest'
import occupations from '@/lib/ai-check/occupations.json'
import pairs from '@/lib/ai-check/compare-pairs.json'
import { COMPARE_PATHS, comparePath, listedPair, pairFromSlug, readingOf, type Figures } from '@/lib/ai-check/compare'
import { fillPrompt, PROMPTS } from '@/lib/ai-check/prompts'

const fig = (soc6: string, title: string, score: number, medianWage: number | null, annualOpenings: number | null): Figures => ({ soc6, title, score, medianWage, growthPct: null, annualOpenings })

describe('comparison pairs', () => {
  it('lists a few hundred distinct pairs of known jobs, lower code first', () => {
    const socs = new Set(occupations.map((o) => o.soc))
    expect(pairs.length).toBeGreaterThan(100)
    expect(pairs.length).toBeLessThanOrEqual(300)
    expect(new Set(pairs.map((p) => p.join('|'))).size).toBe(pairs.length)
    for (const [a, b] of pairs) {
      expect(socs.has(a) && socs.has(b)).toBe(true)
      expect(a < b).toBe(true)
    }
  })
  it('round-trips a path to its codes in either order', () => {
    const [a, b] = pairs[0]
    const path = comparePath(a, b)!
    expect(pairFromSlug(path.split('/').pop()!)).toEqual([a, b])
    expect(comparePath(b, a)).toBe(path)
    expect(listedPair('99-9999', a)).toBeNull()
    expect(COMPARE_PATHS).toHaveLength(pairs.length)
  })
})

describe('reading', () => {
  const a = fig('13-2011', 'Accountants and Auditors', 0.32, 81000, 126500)
  const b = fig('13-2051', 'Financial and Investment Analysts', 0.18, 99000, 27400)
  it('reads back only the numbers in the table', () => {
    const t = readingOf(a, b)
    expect(t).toContain('32%')
    expect(t).toContain('18%')
    expect(t).toContain('$99,000')
    expect(t).toContain('$18,000')
    expect(t).toContain('126,500')
  })
  it('never uses risk, safe or will', () => {
    expect(readingOf(a, b)).not.toMatch(/\b(risk|risky|safe|safer|will)\b/i)
    expect(readingOf(a, fig('x', 'Y', 0.32, null, null))).not.toMatch(/\b(risk|safe|will)\b/i)
  })
})

describe('prompt pack', () => {
  it('has about a dozen prompts with unique ids, each citing a NextChapter page', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(10)
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length)
    for (const p of PROMPTS) {
      const text = fillPrompt(p, null)
      expect(text).toContain('https://launchyournextchapter.com')
      expect(text).toMatch(/cite|source/i)
      expect(text).not.toMatch(/\b(risk|safe|will)\b/i)
    }
  })
  it('fills in the chosen job and its page', () => {
    const t = fillPrompt(PROMPTS[0], { title: 'Marketing Managers', url: 'https://launchyournextchapter.com/tools/ai-job-check/marketing-managers-11-2021' })
    expect(t).toContain('marketing managers')
    expect(t).toContain('/marketing-managers-11-2021')
    expect(t).not.toContain('{job}')
  })
})
