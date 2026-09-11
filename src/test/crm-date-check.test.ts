import { describe, it, expect } from 'vitest'
import { extractDateCandidates, htmlToText } from '@/lib/crm/date-check'

const NOW = new Date('2026-09-11T00:00:00Z')

describe('htmlToText', () => {
  it('drops script and style bodies rather than reading them as prose', () => {
    const t = htmlToText('<style>.a{color:red}</style><p>Deadline: 2026-11-04</p><script>var x=1</script>')
    expect(t).toBe('Deadline: 2026-11-04')
  })
})

describe('extractDateCandidates', () => {
  it('reads the common written formats', () => {
    const iso = extractDateCandidates('Applications close 2026-11-04.', NOW)
    const long = extractDateCandidates('Applications close November 4, 2026.', NOW)
    const brit = extractDateCandidates('Applications close 4 November 2026.', NOW)
    for (const r of [iso, long, brit]) {
      expect(r[0].date.toISOString().slice(0, 10)).toBe('2026-11-04')
    }
  })

  it('ranks a date next to deadline words above an incidental one', () => {
    const text = 'Page last updated March 2, 2026. The application deadline is November 4, 2026.'
    const [top] = extractDateCandidates(text, NOW)
    expect(top.date.toISOString().slice(0, 10)).toBe('2026-11-04')
    expect(top.confidence).toBeGreaterThan(0.8)
  })

  it('scores a copyright year down rather than offering it confidently', () => {
    const [only] = extractDateCandidates('© Copyright 2026-01-01 Example Foundation', NOW)
    expect(only.confidence).toBeLessThan(0.3)
  })

  it('ignores dates from years ago', () => {
    expect(extractDateCandidates('Cohort closed 2019-03-01.', NOW)).toHaveLength(0)
  })

  it('keeps one entry per day, at its best confidence', () => {
    const text = 'Updated 2026-11-04. The deadline is 2026-11-04.'
    const out = extractDateCandidates(text, NOW)
    expect(out).toHaveLength(1)
    expect(out[0].confidence).toBeGreaterThan(0.8)
  })

  it('always returns the sentence a date came from, so a guess can be judged', () => {
    const [c] = extractDateCandidates('The next batch deadline is November 4, 2026 for all applicants.', NOW)
    expect(c.snippet).toContain('batch deadline')
    expect(c.matched).toBe('November 4, 2026')
  })

  it('finds nothing in a page with no dates, rather than inventing one', () => {
    expect(extractDateCandidates('Applications are open on a rolling basis.', NOW)).toHaveLength(0)
  })
})
