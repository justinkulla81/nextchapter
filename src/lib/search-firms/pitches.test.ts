import { describe, expect, it } from 'vitest'
import { PITCH_DRAFTS, fillPitch, pitchFor, wordCount } from './pitches'

describe('pitch drafts', () => {
  it('has one draft per segment, each under 150 words', () => {
    expect(new Set(PITCH_DRAFTS.map((p) => p.segment)).size).toBe(3)
    for (const p of PITCH_DRAFTS) expect(wordCount(p.body)).toBeLessThan(150)
  })

  it('makes the offer: open or confidential searches, a screened shortlist within days, free', () => {
    for (const p of PITCH_DRAFTS) {
      expect(p.body).toMatch(/confidential/i)
      expect(p.body).toMatch(/shortlist/)
      expect(p.body).toMatch(/within days/i)
      expect(p.body).toMatch(/free|no fee|no cost/i)
      expect(p.body).toContain('{link}')
    }
  })

  it('fills every placeholder', () => {
    const filled = fillPitch(pitchFor('contingent'), { firstName: 'Ann', firmName: 'Acme Search', searchExample: 'Controller', link: 'https://x.test/submit-search' })
    expect(filled.body).not.toMatch(/\{\w+\}/)
    expect(filled.subject).not.toMatch(/\{\w+\}/)
    expect(filled.body).toContain('your Controller search')
    expect(fillPitch(pitchFor('retained'), { firmName: 'Acme', link: 'l' }).body).toContain('Hi there,')
  })
})
