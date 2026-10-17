import { describe, expect, it } from 'vitest'
import { CARD_VERDICT_LABEL, cardMetaParts, cardVerdict, levelPhrase, whyLineText } from '@/lib/jobs/job-card'

describe('job card: one verdict', () => {
  it('maps fit scoring v2 to three plain labels', () => {
    expect(CARD_VERDICT_LABEL[cardVerdict('strong')]).toBe('Strong fit')
    expect(CARD_VERDICT_LABEL[cardVerdict('good')]).toBe('Good fit')
    for (const b of ['stretch', 'below_level', 'overqualified'] as const) expect(CARD_VERDICT_LABEL[cardVerdict(b)]).toBe('Worth a look')
  })
  it('holds a bridge job (outside strict relevance) to "Worth a look"', () => {
    expect(cardVerdict('strong', { bridge: true })).toBe('worth_a_look')
    expect(cardVerdict('good', { bridge: true })).toBe('worth_a_look')
  })
  it('never uses the retired labels', () => {
    expect(Object.values(CARD_VERDICT_LABEL).join()).not.toMatch(/Ideal match|On Target|Mixed match|Good match|Your field/)
  })
})

describe('job card: why line', () => {
  it('says seniority against the member in words', () => {
    expect(levelPhrase('same')).toBe('your level')
    expect(levelPhrase('up')).toBe('one level up')
    expect(levelPhrase('down')).toBe('one level down')
    expect(levelPhrase('unknown')).toBeNull()
  })
  it('reads as one line with at most one gap', () => {
    expect(whyLineText({ fits: ['your level', 'finance', '12 mi away'], gap: 'asks for PE-backed experience' })).toBe(
      'Fits you: your level · finance · 12 mi away — Gap: asks for PE-backed experience'
    )
    expect(whyLineText({ fits: [], gap: null })).toBe('')
  })
})

describe('job card: meta line', () => {
  const base = { posted: 'Posted 34 hours ago', location: 'Louisville, KY', pay: '$250k–$300k', title: 'Chief Financial Officer' }
  it('drops the default work type and the level', () => {
    expect(cardMetaParts({ ...base, workType: 'full_time' })).toEqual(['Posted 34 hours ago', 'Louisville, KY', '$250k–$300k'])
  })
  it('shows contract, part-time, interim and remote', () => {
    expect(cardMetaParts({ ...base, workType: 'contract' })).toContain('Contract')
    expect(cardMetaParts({ ...base, workType: 'part_time' })).toContain('Part-time')
    expect(cardMetaParts({ ...base, workType: 'full_time', title: 'Interim CFO' })).toContain('Interim')
    expect(cardMetaParts({ ...base, location: 'United States', remote: true, workType: 'full_time' })).toContain('Remote')
    // Not twice when the location already says it.
    expect(cardMetaParts({ ...base, location: 'Remote - US', remote: true, workType: 'full_time' }).filter((p) => /remote/i.test(p))).toHaveLength(1)
  })
})
